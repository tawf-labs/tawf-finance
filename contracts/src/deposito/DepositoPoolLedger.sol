// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { AccessControlUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import { PausableUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import { ILedgerAnchor } from "../sukuk/ILedgerAnchor.sol";
import { LedgerLeaf } from "../lib/LedgerLeaf.sol";

/**
 * @title DepositoPoolLedger
 * @notice The reserve ledger of a regional Tawf Deposito Pool: customers hold
 *         mudharabah deposito in their own name at each of several BPRS in a
 *         region, placed through Tawf, and one series token is backed by the
 *         sum of those deposito. This contract records the customer deposito
 *         at each bank, adds them up,
 *         and serves the totals to a TawfDepositoSeries as ledger facts.
 *
 * @dev It implements ILedgerAnchor, so an unmodified TawfDepositoSeries uses
 *      it as its anchor. Each post opens an epoch holding the leaves of that
 *      fact. `verify` checks that a leaf was recorded in that epoch, so the
 *      proof is always empty.
 *
 *      A reserve post records the aggregate DEPOSITO_RESERVE leaf (subject
 *      seriesId, a = snapshot ts, b = total sen), which the series checks on
 *      allocation, and one DEPOSITO_BANK_BALANCE leaf per bank (subject
 *      bankId), so anyone can check each bank's part of the total.
 *
 *      Trust model: the operator attests the balances. In production each
 *      balance comes from the bank's core banking through the bprs-connector
 *      and the Tawf Network ledger, and this contract is replaced by the
 *      anchored ledger roots. This is the same operator-attested model as the
 *      standalone LedgerAnchor.
 */
/// @dev GUARDIAN_ROLE pauses the data posts.
contract DepositoPoolLedger is Initializable, AccessControlUpgradeable, PausableUpgradeable, ILedgerAnchor {
    /// @notice Pause only (the data posts). Held by the Guardian Safe. Governance unpauses.
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");


    struct Bank {
        string name;
        string accountRef;
        bool listed;
    }

    uint256 public override ledgerChainId;
    /// @notice The pool series these facts are about.
    bytes32 public seriesId;
    address public operator;

    bytes32[] private _bankIds;
    mapping(bytes32 => Bank) public bankOf;
    /// @notice Tawf's latest balance at each bank, in sen.
    mapping(bytes32 => uint256) public balanceOf;
    /// @notice Latest reserve snapshot time and the total over all banks.
    uint64 public snapshotAt;
    uint256 public totalBalance;
    /// @notice Profit each bank credited for a period, in sen.
    mapping(uint32 => mapping(bytes32 => uint256)) public profitOf;
    /// @notice Number of epochs recorded so far.
    uint256 public epochs;
    /// @notice Epoch of the latest reserve snapshot.
    uint256 public reserveEpoch;

    mapping(uint256 => mapping(bytes32 => bool)) private _leafIn;

    error NotOperator();
    error ZeroAddress();
    error BadBank(bytes32 bankId);
    error LengthMismatch();
    error StaleSnapshot(uint64 latest, uint64 got);
    error FutureSnapshot(uint64 got);

    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);
    event BankAdded(bytes32 indexed bankId, string name, string accountRef);
    event BankBalance(uint256 indexed epoch, bytes32 indexed bankId, uint64 snapshotAt, uint256 balance);
    event ReserveRecorded(uint256 indexed epoch, uint64 snapshotAt, uint256 total);
    event BankProfit(uint32 indexed period, bytes32 indexed bankId, uint256 profit);
    event ProfitRecorded(uint256 indexed epoch, uint32 indexed period, uint256 total);
    event MaturityRecorded(uint256 indexed epoch, uint64 at, uint32 finalPeriod, uint256 principal);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _lockImplementation();
    }

    /// @dev Locks the bare implementation so only proxies can be initialised.
    ///      Virtual so a verification harness can skip it.
    function _lockImplementation() internal virtual {
        _disableInitializers();
    }
    function initialize(uint256 ledgerChainId_, bytes32 seriesId_, address operator_, address admin_)
        public
        initializer
    {
        if (operator_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        __Pausable_init();
        if (admin_ == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin_); // Governance: banks and the operator key
        ledgerChainId = ledgerChainId_;
        seriesId = seriesId_;
        operator = operator_;
    }

    function transferOperator(address newOperator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorTransferred(operator, newOperator);
        operator = newOperator;
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------
    // Banks
    // ---------------------------------------------------------------

    /// @notice List a BPRS where customers placed through Tawf hold deposito for this pool.
    function addBank(bytes32 bankId, string calldata name, string calldata accountRef) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bankId == bytes32(0) || bankOf[bankId].listed) revert BadBank(bankId);
        bankOf[bankId] = Bank({ name: name, accountRef: accountRef, listed: true });
        _bankIds.push(bankId);
        emit BankAdded(bankId, name, accountRef);
    }

    function bankCount() external view returns (uint256) {
        return _bankIds.length;
    }

    /// @notice Every bank with its account reference and latest balance.
    function banks()
        external
        view
        returns (bytes32[] memory ids, string[] memory names, string[] memory accountRefs, uint256[] memory balances)
    {
        uint256 n = _bankIds.length;
        ids = _bankIds;
        names = new string[](n);
        accountRefs = new string[](n);
        balances = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            Bank storage b = bankOf[_bankIds[i]];
            names[i] = b.name;
            accountRefs[i] = b.accountRef;
            balances[i] = balanceOf[_bankIds[i]];
        }
    }

    // ---------------------------------------------------------------
    // Facts
    // ---------------------------------------------------------------

    /// @notice Record new balances for the listed banks (others keep their
    ///         last balance) and the total over all banks, as one epoch.
    /// @return epoch The epoch holding the aggregate and per-bank leaves.
    function postReserve(uint64 at, bytes32[] calldata bankIds, uint256[] calldata balances)
        external
        onlyOperator
        whenNotPaused
        returns (uint256 epoch)
    {
        if (bankIds.length != balances.length) revert LengthMismatch();
        if (at < snapshotAt) revert StaleSnapshot(snapshotAt, at);
        if (at > block.timestamp) revert FutureSnapshot(at);
        for (uint256 i = 0; i < bankIds.length; i++) {
            if (!bankOf[bankIds[i]].listed) revert BadBank(bankIds[i]);
            balanceOf[bankIds[i]] = balances[i];
        }

        epoch = epochs++;
        uint256 total;
        for (uint256 i = 0; i < _bankIds.length; i++) {
            bytes32 id = _bankIds[i];
            uint256 bal = balanceOf[id];
            total += bal;
            _leafIn[epoch][LedgerLeaf.hash(ledgerChainId, LedgerLeaf.DEPOSITO_BANK_BALANCE, id, at, bal)] = true;
            emit BankBalance(epoch, id, at, bal);
        }
        _leafIn[epoch][LedgerLeaf.hash(ledgerChainId, LedgerLeaf.DEPOSITO_RESERVE, seriesId, at, total)] = true;
        snapshotAt = at;
        totalBalance = total;
        reserveEpoch = epoch;
        emit ReserveRecorded(epoch, at, total);
    }

    /// @notice Record the profit each bank credited for `period` and the pool total.
    function postProfit(uint32 period, bytes32[] calldata bankIds, uint256[] calldata profits)
        external
        onlyOperator
        whenNotPaused
        returns (uint256 epoch, uint256 total)
    {
        if (bankIds.length != profits.length) revert LengthMismatch();
        for (uint256 i = 0; i < bankIds.length; i++) {
            if (!bankOf[bankIds[i]].listed) revert BadBank(bankIds[i]);
            profitOf[period][bankIds[i]] = profits[i];
            total += profits[i];
            emit BankProfit(period, bankIds[i], profits[i]);
        }
        epoch = epochs++;
        _leafIn[epoch][LedgerLeaf.hash(ledgerChainId, LedgerLeaf.DEPOSITO_PROFIT, seriesId, period, total)] = true;
        emit ProfitRecorded(epoch, period, total);
    }

    /// @notice Record the pool's maturity: principal returned across all banks.
    function postMaturity(uint64 at, uint32 finalPeriod, uint256 principal)
        external
        onlyOperator
        whenNotPaused
        returns (uint256 epoch)
    {
        epoch = epochs++;
        _leafIn[epoch][
            LedgerLeaf.hash(
                ledgerChainId, LedgerLeaf.DEPOSITO_MATURITY, seriesId, LedgerLeaf.packMaturity(at, finalPeriod), principal
            )
        ] = true;
        emit MaturityRecorded(epoch, at, finalPeriod, principal);
    }

    /// @inheritdoc ILedgerAnchor
    function verify(uint256 epoch, bytes32 leaf, bytes32[] calldata) external view override returns (bool) {
        return _leafIn[epoch][leaf];
    }

    uint256[40] private __gap;
}
