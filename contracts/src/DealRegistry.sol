// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title DealRegistry
 * @notice On-chain ledger of community Green Sukuk deals (warung purchase
 *         orders funded by retail investors).
 *
 * @dev No funds are ever held by this contract — it is the source of truth
 *      for deal lifecycle state. The RedemptionVault moves money and mints
 *      receipts; the BondReceiptNFT stores investor-level receipt metadata.
 *
 *      State machine:
 *          Submitted → BmtApproved → Mintable → Active → Matured → Completed
 *                                                          ↘
 *                                                          Defaulted
 *
 *      MVP access model: the owner (Tawf Labs) drives every transition.
 *      The roadmap replaces this with BMTGateway.sol (originator role) and
 *      SekuritasOracle.sol (EIP-712 + 48h timelock for the regulated issuer).
 */
contract DealRegistry is Ownable {
    enum DealStatus {
        Submitted,    // 0 — deal submitted by a BMT originator
        BmtApproved,  // 1 — cooperative underwriting approved
        Mintable,     // 2 — issuance confirmed; investors may fund
        Active,       // 3 — funding target reached; working capital live
        Matured,      // 4 — repayment received; redemptions open
        Completed,    // 5 — all receipts redeemed/burned
        Defaulted     // 6 — deal failed; principal-only return
    }

    struct Deal {
        uint256 id;
        bytes32 invoiceHash;       // SHA-256 of the underlying invoice (IPFS pin)
        string supplierName;       // e.g. "Warung Sari Rejeki"
        string anchorBuyer;        // e.g. "Indomaret" / "Alfamart"
        address bmtOriginator;     // cooperative that underwrote the deal
        uint96 apyBps;             // annualized yield in basis points (1200 = 12%)
        uint32 durationDays;       // 30–90
        uint96 minInvestment;      // in USDC base units (6 decimals)
        uint96 fundingTarget;      // in USDC base units
        uint96 totalFunded;        // in USDC base units
        uint32 investorCount;
        DealStatus status;
        uint256 createdAt;
        uint256 maturesAt;         // block.timestamp when the deal matures
    }

    /// @notice The vault authorized to fund deals (and the only caller of
    ///         fundDeal / completeDeal).
    address public vault;

    Deal[] private _deals;
    uint256 private _nextId = 1;

    mapping(uint256 => mapping(address => uint96)) public investorPrincipal;

    error NotVault();
    error InvalidVaultAddress();
    error InvalidDealParams();
    error DealDoesNotExist(uint256 id);
    error InvalidTransition(DealStatus current, DealStatus expected);
    error FundingExceedsTarget(uint256 id);
    error NotMatured(uint256 id);

    event DealCreated(uint256 indexed id, string supplierName, string anchorBuyer, bytes32 invoiceHash);
    event DealStatusChanged(uint256 indexed id, DealStatus from, DealStatus to);
    event DealFunded(uint256 indexed id, address indexed investor, uint96 amount, uint96 totalFunded);
    event VaultSet(address vault);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------

    /// @notice Set the RedemptionVault address. Only the vault may fund deals.
    function setVault(address vault_) external onlyOwner {
        if (vault_ == address(0)) revert InvalidVaultAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }

    // ---------------------------------------------------------------------
    // Deal lifecycle
    // ---------------------------------------------------------------------

    /**
     * @notice Create a new deal in Submitted state.
     * @param invoiceHash_      SHA-256 hash of the invoice document
     * @param supplierName_     Business receiving working capital
     * @param anchorBuyer_      Buyer of the goods (the repayment source)
     * @param bmtOriginator_    Cooperative that underwrote the deal
     * @param apyBps_           Annualized yield in basis points
     * @param durationDays_     Deal duration in days
     * @param minInvestment_    Minimum ticket size (USDC base units)
     * @param fundingTarget_    Funding target (USDC base units)
     */
    function createDeal(
        bytes32 invoiceHash_,
        string calldata supplierName_,
        string calldata anchorBuyer_,
        address bmtOriginator_,
        uint96 apyBps_,
        uint32 durationDays_,
        uint96 minInvestment_,
        uint96 fundingTarget_
    ) external onlyOwner returns (uint256 id) {
        if (
            bytes(supplierName_).length == 0 ||
            bytes(anchorBuyer_).length == 0 ||
            bmtOriginator_ == address(0) ||
            minInvestment_ == 0 ||
            fundingTarget_ == 0 ||
            durationDays_ == 0
        ) {
            revert InvalidDealParams();
        }

        id = _nextId++;
        _deals.push(
            Deal({
                id: id,
                invoiceHash: invoiceHash_,
                supplierName: supplierName_,
                anchorBuyer: anchorBuyer_,
                bmtOriginator: bmtOriginator_,
                apyBps: apyBps_,
                durationDays: durationDays_,
                minInvestment: minInvestment_,
                fundingTarget: fundingTarget_,
                totalFunded: 0,
                investorCount: 0,
                status: DealStatus.Submitted,
                createdAt: block.timestamp,
                maturesAt: block.timestamp + uint256(durationDays_) * 1 days
            })
        );

        emit DealCreated(id, supplierName_, anchorBuyer_, invoiceHash_);
    }

    /// @notice Cooperative underwriting approval (Submitted → BmtApproved).
    function approveDeal(uint256 id) external onlyOwner {
        _requireStatus(id, DealStatus.Submitted);
        _transition(id, DealStatus.BmtApproved);
    }

    /// @notice Issuance confirmed; investors may fund (BmtApproved → Mintable).
    function markMintable(uint256 id) external onlyOwner {
        _requireStatus(id, DealStatus.BmtApproved);
        _transition(id, DealStatus.Mintable);
    }

    /**
     * @notice Record an investment. Called by the RedemptionVault after it
     *         has pulled USDC from the investor.
     *
     * @dev Transitions Mintable → Active once the funding target is reached.
     */
    function fundDeal(uint256 id, address investor, uint96 amount) external onlyVault {
        Deal storage deal = _requireStatus(id, DealStatus.Mintable);

        uint96 remaining = deal.fundingTarget - deal.totalFunded;
        if (amount > remaining) revert FundingExceedsTarget(id);

        deal.totalFunded += amount;
        if (investorPrincipal[id][investor] == 0) {
            deal.investorCount += 1;
        }
        investorPrincipal[id][investor] += amount;

        emit DealFunded(id, investor, amount, deal.totalFunded);

        if (deal.totalFunded >= deal.fundingTarget) {
            deal.status = DealStatus.Active;
            emit DealStatusChanged(id, DealStatus.Mintable, DealStatus.Active);
        }
    }

    /**
     * @notice Mark a deal matured once the anchor buyer has paid.
     *
     * @dev A deal may mature from Mintable (partial funding) or Active (fully
     *      funded) — what matters is that it has real principal outstanding.
     *      Anyone may mature a deal after `maturesAt`; the owner and the
     *      vault may mature early (needed for the live testnet demo so
     *      judges don't wait 30+ days).
     */
    function markMatured(uint256 id) external {
        Deal storage deal = _requireExists(id);
        if (deal.status != DealStatus.Mintable && deal.status != DealStatus.Active) {
            revert InvalidTransition(deal.status, DealStatus.Active);
        }
        if (
            msg.sender != owner() &&
            msg.sender != vault &&
            block.timestamp < deal.maturesAt
        ) {
            revert NotMatured(id);
        }
        _transition(id, DealStatus.Matured);
    }

    /// @notice Finalize a fully-redeemed deal. Called by the vault when the
    ///         last receipt is burned; owner may also call it. Accepts both
    ///         Matured (paid out with yield) and Defaulted (principal-only)
    ///         deals.
    function completeDeal(uint256 id) external {
        if (msg.sender != owner() && msg.sender != vault) revert NotVault();
        Deal storage deal = _requireExists(id);
        if (deal.status != DealStatus.Matured && deal.status != DealStatus.Defaulted) {
            revert InvalidTransition(deal.status, DealStatus.Matured);
        }
        _transition(id, DealStatus.Completed);
    }

    /// @notice Flag a deal as defaulted (principal-only return).
    function defaultDeal(uint256 id) external onlyOwner {
        _requireStatus(id, DealStatus.Active);
        _transition(id, DealStatus.Defaulted);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function dealCount() external view returns (uint256) {
        return _deals.length;
    }

    function getDeal(uint256 id) external view returns (Deal memory) {
        _requireExists(id);
        return _deals[id - 1];
    }

    function getDeals() external view returns (Deal[] memory) {
        return _deals;
    }

    function getDealsByStatus(DealStatus status) external view returns (Deal[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _deals.length; i++) {
            if (_deals[i].status == status) count++;
        }
        Deal[] memory result = new Deal[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < _deals.length; i++) {
            if (_deals[i].status == status) {
                result[j] = _deals[i];
                j++;
            }
        }
        return result;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _requireExists(uint256 id) internal view returns (Deal storage) {
        if (id == 0 || id > _deals.length) revert DealDoesNotExist(id);
        return _deals[id - 1];
    }

    function _requireStatus(uint256 id, DealStatus status) internal view returns (Deal storage) {
        Deal storage deal = _requireExists(id);
        if (deal.status != status) revert InvalidTransition(deal.status, status);
        return deal;
    }

    function _transition(uint256 id, DealStatus to) internal {
        Deal storage deal = _requireExists(id);
        DealStatus from = deal.status;
        deal.status = to;
        emit DealStatusChanged(id, from, to);
    }
}
