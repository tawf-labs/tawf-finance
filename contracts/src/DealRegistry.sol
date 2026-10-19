// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title DealRegistry
 * @notice On-chain ledger of BPRS financing sell-down pools (a licensed
 *         Shariah bank sells down economic exposure to a pool of the financing
 *         it originates and services, funded by an outside investor pool).
 *
 * @dev No funds are ever held by this contract — it is the source of truth
 *      for pool lifecycle state. The RedemptionVault moves money and mints
 *      receipts; the BondReceiptNFT stores investor-level receipt metadata.
 *
 *      Naming note: identifiers (DealRegistry, Deal, BmtApproved, bmtOriginator)
 *      are retained from the original code so the tested state machine and the
 *      frontend ABIs stay intact. Read a "deal" as a financing pool,
 *      `BmtApproved` as originator/DPS-approved, and `bmtOriginator` as the
 *      originating BPRS.
 *
 *      State machine:
 *          Submitted → BmtApproved → Mintable → Active → Matured → Completed
 *                                                          ↘
 *                                                          Defaulted
 *
 *      Access model: role-separated via AccessControl instead of a single
 *      owner, so each stakeholder in the regulation.md role split can hold
 *      its own key or multisig. ORIGINATOR_ROLE lists deals, SHARIAH_ROLE
 *      approves them (the on-chain moment corresponding to a real DPS
 *      sign-off), OPS_ROLE runs routine lifecycle transitions, ADMIN_ROLE
 *      wires the vault and manages the other roles. The roadmap still
 *      expects a SekuritasOracle.sol (EIP-712 + 48h timelock) for the
 *      regulated issuer once that licence exists; this role split is the
 *      step before it, not a replacement for it.
 */
contract DealRegistry is AccessControl {
    bytes32 public constant ORIGINATOR_ROLE = keccak256("ORIGINATOR_ROLE");
    bytes32 public constant SHARIAH_ROLE = keccak256("SHARIAH_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    enum DealStatus {
        Submitted,    // 0 — pool submitted by a BPRS originator
        BmtApproved,  // 1 — originator/DPS approved (akad reviewed)
        Mintable,     // 2 — sell-down confirmed; investors may fund
        Active,       // 3 — funding target reached; capacity released
        Matured,      // 4 — servicer remittance received; redemptions open
        Completed,    // 5 — all receipts redeemed/burned
        Defaulted     // 6 — pool failed; principal-only return
    }

    struct Deal {
        uint256 id;
        bytes32 invoiceHash;       // SHA-256 of the akad + pool-composition doc (IPFS pin)
        string supplierName;       // financing segment, e.g. "Micro-Trade Financing Segment"
        string anchorBuyer;        // originating BPRS, e.g. "BPRS Amanah Ummah"
        address bmtOriginator;     // BPRS that originated and services the financing
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

    /// @param admin Address (an EOA for local dev, a Safe multisig in
    ///        production) granted DEFAULT_ADMIN_ROLE and ADMIN_ROLE. It must
    ///        grant ORIGINATOR_ROLE / SHARIAH_ROLE / OPS_ROLE separately.
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    /// @notice Set the RedemptionVault address. Only the vault may fund deals.
    function setVault(address vault_) external onlyRole(ADMIN_ROLE) {
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
     * @param bmtOriginator_    BPRS that originated and services the financing
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
    ) external onlyRole(ORIGINATOR_ROLE) returns (uint256 id) {
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

    /// @notice DPS/Shariah board approval (Submitted → BmtApproved). Held by
    ///         a Safe multisig combining the DPS and the independent board
    ///         (regulation.md §3.6), so this transition corresponds to a real
    ///         Shariah sign-off, not a routine operational action.
    function approveDeal(uint256 id) external onlyRole(SHARIAH_ROLE) {
        _requireStatus(id, DealStatus.Submitted);
        _transition(id, DealStatus.BmtApproved);
    }

    /// @notice Issuance confirmed; investors may fund (BmtApproved → Mintable).
    function markMintable(uint256 id) external onlyRole(OPS_ROLE) {
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
     *      Anyone may mature a deal after `maturesAt`; OPS_ROLE and the
     *      vault may mature early (needed for the live testnet demo so
     *      judges don't wait 30+ days).
     */
    function markMatured(uint256 id) external {
        Deal storage deal = _requireExists(id);
        if (deal.status != DealStatus.Mintable && deal.status != DealStatus.Active) {
            revert InvalidTransition(deal.status, DealStatus.Active);
        }
        if (
            !hasRole(OPS_ROLE, msg.sender) &&
            msg.sender != vault &&
            block.timestamp < deal.maturesAt
        ) {
            revert NotMatured(id);
        }
        _transition(id, DealStatus.Matured);
    }

    /// @notice Finalize a fully-redeemed deal. Called by the vault when the
    ///         last receipt is burned; OPS_ROLE may also call it. Accepts
    ///         both Matured (paid out with yield) and Defaulted
    ///         (principal-only) deals.
    function completeDeal(uint256 id) external {
        if (!hasRole(OPS_ROLE, msg.sender) && msg.sender != vault) revert NotVault();
        Deal storage deal = _requireExists(id);
        if (deal.status != DealStatus.Matured && deal.status != DealStatus.Defaulted) {
            revert InvalidTransition(deal.status, DealStatus.Matured);
        }
        _transition(id, DealStatus.Completed);
    }

    /// @notice Flag a deal as defaulted (principal-only return).
    function defaultDeal(uint256 id) external onlyRole(OPS_ROLE) {
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
