// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { DepositoPoolLedger } from "../munged/deposito/DepositoPoolLedger.sol";
import { LedgerLeaf } from "../../src/lib/LedgerLeaf.sol";

/// @dev Read-only helpers over DepositoPoolLedger for the Certora spec. No behaviour is changed.
contract DepositoPoolLedgerHarness is DepositoPoolLedger {
    constructor(uint256 ledgerChainId_, bytes32 seriesId_, address operator_)
        DepositoPoolLedger(ledgerChainId_, seriesId_, operator_)
    { }

    function bankIdsLen() external view returns (uint256) {
        return _bankIds.length;
    }

    function bankIdAt(uint256 i) external view returns (bytes32) {
        return _bankIds[i];
    }

    function isListed(bytes32 id) external view returns (bool) {
        return bankOf[id].listed;
    }

    function nameHash(bytes32 id) external view returns (bytes32) {
        return keccak256(bytes(bankOf[id].name));
    }

    function refHash(bytes32 id) external view returns (bytes32) {
        return keccak256(bytes(bankOf[id].accountRef));
    }

    /// @dev Sum of the stored balance over every id in the bank array.
    function sumBalances() external view returns (uint256 total) {
        for (uint256 i = 0; i < _bankIds.length; i++) {
            total += balanceOf[_bankIds[i]];
        }
    }

    function reserveLeafFor(bytes32 subject, uint256 a, uint256 b) external view returns (bytes32) {
        return LedgerLeaf.hash(ledgerChainId, LedgerLeaf.DEPOSITO_RESERVE, subject, a, b);
    }

    function bankLeafFor(bytes32 subject, uint256 a, uint256 b) external view returns (bytes32) {
        return LedgerLeaf.hash(ledgerChainId, LedgerLeaf.DEPOSITO_BANK_BALANCE, subject, a, b);
    }

    function profitLeafFor(bytes32 subject, uint256 a, uint256 b) external view returns (bytes32) {
        return LedgerLeaf.hash(ledgerChainId, LedgerLeaf.DEPOSITO_PROFIT, subject, a, b);
    }

    function kindReserve() external pure returns (bytes32) {
        return LedgerLeaf.DEPOSITO_RESERVE;
    }

    function kindBank() external pure returns (bytes32) {
        return LedgerLeaf.DEPOSITO_BANK_BALANCE;
    }

    function kindProfit() external pure returns (bytes32) {
        return LedgerLeaf.DEPOSITO_PROFIT;
    }

    function kindMaturity() external pure returns (bytes32) {
        return LedgerLeaf.DEPOSITO_MATURITY;
    }
}
