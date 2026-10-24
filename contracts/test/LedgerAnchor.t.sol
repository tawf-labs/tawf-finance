// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { LedgerAnchor } from "../src/LedgerAnchor.sol";

contract LedgerAnchorTest is Test {
    LedgerAnchor internal anchor;
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        anchor = new LedgerAnchor(46630, operator);
    }

    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        // OpenZeppelin v5 commutative hashing
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function test_verify_acceptsLeafAndRejectsOthers() public {
        bytes32 l0 = keccak256("leaf0");
        bytes32 l1 = keccak256("leaf1");
        vm.prank(operator);
        uint256 epoch = anchor.push(_pair(l0, l1));
        assertEq(epoch, 0);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = l1;
        assertTrue(anchor.verify(0, l0, proof));
        assertFalse(anchor.verify(0, keccak256("other"), proof));
    }

    function test_verify_unknownEpochReturnsFalse() public view {
        assertFalse(anchor.verify(7, bytes32(0), new bytes32[](0)));
    }

    function test_push_onlyOperator() public {
        vm.prank(stranger);
        vm.expectRevert(LedgerAnchor.NotOperator.selector);
        anchor.push(bytes32(uint256(1)));
    }

    function test_transferOperator() public {
        vm.prank(operator);
        anchor.transferOperator(stranger);
        assertEq(anchor.operator(), stranger);
        vm.prank(operator);
        vm.expectRevert(LedgerAnchor.NotOperator.selector);
        anchor.push(bytes32(uint256(1)));
        vm.prank(stranger);
        anchor.push(bytes32(uint256(1)));
        assertEq(anchor.epochs(), 1);
    }

    function test_constructor_rejectsZeroOperator() public {
        vm.expectRevert(LedgerAnchor.ZeroAddress.selector);
        new LedgerAnchor(1, address(0));
    }
}
