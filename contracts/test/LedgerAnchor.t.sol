// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { LedgerAnchor } from "../src/LedgerAnchor.sol";
import { Proxies } from "../src/proxy/Proxies.sol";
import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { BeaconProxy } from "openzeppelin-contracts/contracts/proxy/beacon/BeaconProxy.sol";
import { UpgradeableBeacon } from "openzeppelin-contracts/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract LedgerAnchorTest is Test {
    LedgerAnchor internal anchor;
    UpgradeableBeacon internal beacon;
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");
    address internal governance = makeAddr("governance");

    function setUp() public {
        beacon = Proxies.beacon(address(new LedgerAnchor()), governance);
        anchor = Proxies.ledgerAnchorOn(address(beacon), 46630, operator);
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

    function test_initialize_rejectsZeroOperator() public {
        vm.expectRevert(LedgerAnchor.ZeroAddress.selector);
        new BeaconProxy(address(beacon), abi.encodeCall(LedgerAnchor.initialize, (1, address(0))));
    }

    // ---- beacon controls ----

    function test_initialize_cannotRunTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        anchor.initialize(1, operator);
    }

    function test_implementation_isLocked() public {
        address impl = beacon.implementation();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        LedgerAnchor(impl).initialize(1, operator);
    }

    function test_onlyBeaconOwnerUpgrades_everyInstanceFollows_stateIsKept() public {
        LedgerAnchor second = Proxies.ledgerAnchorOn(address(beacon), 7, stranger);
        vm.prank(operator);
        anchor.push(bytes32(uint256(7)));
        LedgerAnchorV2 v2 = new LedgerAnchorV2();
        vm.prank(operator); // the data-post operator is not the beacon owner
        vm.expectRevert();
        beacon.upgradeTo(address(v2));
        vm.prank(governance);
        beacon.upgradeTo(address(v2));
        assertEq(LedgerAnchorV2(address(anchor)).version(), 2);
        assertEq(LedgerAnchorV2(address(second)).version(), 2); // one upgrade covers both
        assertEq(anchor.epochs(), 1);
        assertEq(anchor.operator(), operator);
        assertEq(anchor.ledgerChainId(), 46630);
        assertEq(second.ledgerChainId(), 7);
    }

    function test_beaconOwnerIsGovernance() public view {
        assertEq(beacon.owner(), governance);
    }
}

contract LedgerAnchorV2 is LedgerAnchor {
    uint256 public extra;

    function version() external pure returns (uint256) {
        return 2;
    }
}
