// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { LedgerLeaf } from "../../src/lib/LedgerLeaf.sol";

/// @notice Unit tests for the LedgerLeaf encoding library. Asserts the kind constants match the
///         exact dotted strings tawf-network uses, and that the double-hash encoding is stable for
///         the three new kinds against a fixed vector.
contract LedgerLeafTest is Test {
    uint256 constant CHAIN_ID = 1;
    bytes32 constant SUBJECT = bytes32(uint256(1));
    uint256 constant A = 2;
    uint256 constant B = 3;

    function _expected(bytes32 kind) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(CHAIN_ID, kind, SUBJECT, A, B))));
    }

    // --- kind strings ----------------------------------------------------

    function test_kindStringsMatchLedger() public pure {
        assertEq(LedgerLeaf.SUKUK_APPROVED, keccak256("tawf.sukuk.approved"));
        assertEq(LedgerLeaf.SUKUK_DISTRIBUTION, keccak256("tawf.sukuk.distribution"));
        assertEq(LedgerLeaf.SUKUK_REDEMPTION, keccak256("tawf.sukuk.redemption"));
        assertEq(LedgerLeaf.SUKUK_DEFAULT, keccak256("tawf.sukuk.default"));
        assertEq(LedgerLeaf.SUKUK_RESERVE, keccak256("tawf.sukuk.reserve"));
        assertEq(LedgerLeaf.DEPOSITO_PLACEMENT, keccak256("tawf.deposito.placement"));
        assertEq(LedgerLeaf.DEPOSITO_RESERVE, keccak256("tawf.deposito.reserve"));
    }

    // --- encoding --------------------------------------------------------

    /// @dev The library must reproduce the same double-hash the formula gives. These are the three
    ///      new kinds this migration adds; the formula equality guards against any accidental
    ///      change to the encoding.
    ///
    ///      The literals are the same ones tawf-network/contracts/test/LedgerAnchor.t.sol asserts
    ///      for (chainId=1, subject=bytes32(uint256(1)), a=2, b=3), so the on-chain and ledger
    ///      encodings cannot drift apart.
    function test_sukukReserveEncoding() public pure {
        assertEq(LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.SUKUK_RESERVE, SUBJECT, A, B), _expected(LedgerLeaf.SUKUK_RESERVE));
        assertEq(LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.SUKUK_RESERVE, SUBJECT, A, B), 0xf2e1dd91ba101532e2a2b89b232b7274ab543c41ea4198bc24f7ac071a7fb294);
    }

    function test_depositoPlacementEncoding() public pure {
        assertEq(
            LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_PLACEMENT, SUBJECT, A, B),
            _expected(LedgerLeaf.DEPOSITO_PLACEMENT)
        );
        assertEq(LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_PLACEMENT, SUBJECT, A, B), 0x713e67c97bbea1f92cbbb531b2602b46c6b0b9a0fdb3861d24f17083f946e173);
    }

    function test_depositoReserveEncoding() public pure {
        assertEq(
            LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_RESERVE, SUBJECT, A, B), _expected(LedgerLeaf.DEPOSITO_RESERVE)
        );
        assertEq(LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_RESERVE, SUBJECT, A, B), 0xa997ee7069e0627c8a24ae8aa6108326bb665d49787c886797024981b9176553);
    }

    /// @dev Distinct kinds (all else equal) must produce distinct leaves.
    function test_kindsAreDistinct() public pure {
        bytes32 r = LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.SUKUK_RESERVE, SUBJECT, A, B);
        bytes32 p = LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_PLACEMENT, SUBJECT, A, B);
        bytes32 d = LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_RESERVE, SUBJECT, A, B);
        assertTrue(r != p && p != d && r != d);
    }

    /// @dev Changing any field changes the leaf.
    function testFuzz_encodingIsCollisionResistant(uint256 a1, uint256 b1, uint256 a2, uint256 b2) public pure {
        vm.assume(a1 != a2 || b1 != b2);
        assertTrue(
            LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_PLACEMENT, SUBJECT, a1, b1)
                != LedgerLeaf.hash(CHAIN_ID, LedgerLeaf.DEPOSITO_PLACEMENT, SUBJECT, a2, b2)
        );
    }
}
