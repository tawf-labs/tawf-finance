// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title DealRegistry
 * @notice On-chain ledger of BPRS financing sell-down pools.
 * @dev Mutated copy of src/DealRegistry.sol. See that file for full docs.
 */
contract DealRegistry is AccessControl {
    bytes32 public constant ORIGINATOR_ROLE = keccak256("ORIGINATOR_ROLE");
    bytes32 public constant SHARIAH_ROLE = keccak256("SHARIAH_ROLE");
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    enum DealStatus {
        Submitted,    // 0
        BmtApproved,  // 1
        Mintable,     // 2
        Active,       // 3
        Matured,      // 4
        Completed,    // 5
        Defaulted     // 6
    }

    struct Deal {
        uint256 id;
        bytes32 invoiceHash;
        string supplierName;
        string anchorBuyer;
        address bmtOriginator;
        uint96 apyBps;
        uint32 durationDays;
        uint96 minInvestment;
        uint96 fundingTarget;
        uint96 totalFunded;
        uint32 investorCount;
        DealStatus status;
        uint256 createdAt;
        uint256 maturesAt;
    }

    address public vault;
    address public receiptNft;

    Deal[] private _deals;
    uint256 private _nextId = 1;

    mapping(uint256 => mapping(address => uint96)) public investorPrincipal;

    error NotVault();
    error NotReceiptNft();
    error PrincipalMoveInvalid(uint256 id, address from, address to);
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
    event ReceiptNftSet(address receiptNft);
    event InvestorPrincipalMoved(uint256 indexed id, address indexed from, address indexed to, uint96 amount);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function setVault(address vault_) external onlyRole(ADMIN_ROLE) {
        if (vault_ == address(0)) revert InvalidVaultAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }

    function setReceiptNft(address receiptNft_) external onlyRole(ADMIN_ROLE) {
        if (receiptNft_ == address(0)) revert InvalidVaultAddress();
        receiptNft = receiptNft_;
        emit ReceiptNftSet(receiptNft_);
    }

    function moveInvestorPrincipal(uint256 id, address from, address to) external {
        if (msg.sender != receiptNft || receiptNft == address(0)) revert NotReceiptNft();
        _requireExists(id);
        uint96 amount = investorPrincipal[id][from];
        if (amount == 0 || to == address(0) || to == from || investorPrincipal[id][to] != 0) {
            revert PrincipalMoveInvalid(id, from, to);
        }
        investorPrincipal[id][from] = 0;
        investorPrincipal[id][to] = amount;
        emit InvestorPrincipalMoved(id, from, to, amount);
    }

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

    function approveDeal(uint256 id) external onlyRole(SHARIAH_ROLE) {
        _requireStatus(id, DealStatus.Submitted);
        _transition(id, DealStatus.BmtApproved);
    }

    function markMintable(uint256 id) external onlyRole(OPS_ROLE) {
        _requireStatus(id, DealStatus.BmtApproved);
        _transition(id, DealStatus.Mintable);
    }

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

    function completeDeal(uint256 id) external {
        if (!hasRole(OPS_ROLE, msg.sender) && msg.sender != vault) revert NotVault();
        Deal storage deal = _requireExists(id);
        // MUTANT M2: allow completeDeal from Active in addition to Matured and
        // Defaulted, creating the illegal Active -> Completed edge.
        if (
            deal.status != DealStatus.Matured &&
            deal.status != DealStatus.Defaulted &&
            deal.status != DealStatus.Active
        ) {
            revert InvalidTransition(deal.status, DealStatus.Matured);
        }
        _transition(id, DealStatus.Completed);
    }

    function defaultDeal(uint256 id) external onlyRole(OPS_ROLE) {
        _requireStatus(id, DealStatus.Active);
        _transition(id, DealStatus.Defaulted);
    }

    function dealCount() public view returns (uint256) {
        return _deals.length;
    }

    function getDeal(uint256 id) public view returns (Deal memory) {
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
