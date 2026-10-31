// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import {TrexFixture} from "../trex/TrexFixture.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";
import {ISukukDistributor, IMockLedgerAnchor, SUKUK, APPROVED, DISTRIBUTION, REDEMPTION, RESERVE, RESOLUTION} from "./SukukDistributor.t.sol";

interface IReentrantCoin {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function armMode(address target, uint8 mode) external;
}

interface IExtra {
    function claimProfit(address coin) external;
    function releaseHeldProfit(uint16 index, address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof) external;
}

/// @notice Proves every payout path is guarded: a malicious settlement coin that calls back into
///         claim, redeem, claimProfit or refund from inside transfer is rejected by the guard.
contract SukukReentrancyModesTest is TrexFixture {
    address coin;
    address anchor;
    ISukukDistributor dist;
    Token token;
    address alice = makeAddr("alice");
    bytes32[] noProof;
    uint40 maturity;
    bytes4 internal constant REENTERED = bytes4(keccak256("ReentrancyGuardReentrantCall()"));

    function setUp() public {
        maturity = uint40(block.timestamp + 365 days);
        _setUpTrex();
        coin = deployCode("ReentrantUSDC.sol:ReentrantUSDC");
        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(uint256(1)));
        ModularCompliance mc;
        DistributionCheckpointModule module;
        (token, mc, module) = _deployTrexToken("S", "S", 6);
        address[] memory list = new address[](1);
        list[0] = coin;
        dist = ISukukDistributor(
            _deployProxy(
                "SukukDistributor.sol:SukukDistributor",
                abi.encodePacked(DIST_INIT, abi.encode(
                    list, anchor, address(ir), address(token), address(module),
                    keccak256("S"), uint256(100e6), maturity, uint256(10e6), uint256(1e6), uint40(1 days), deployer,
                    deployer))
            )
        );
        _wireDistributor(token, mc, module, address(dist));
        _registerVerified(alice, 360);
        uint256 e0 = _fact(APPROVED, 100e6, maturity);
        vm.prank(deployer);
        dist.openSubscription(e0, noProof);
        uint256 eR = _fact(RESERVE, block.timestamp, 100e6);
        dist.updateReserve(uint64(block.timestamp), 100e6, eR, noProof);
    }

    function _fact(bytes32 kind, uint256 a, uint256 b) internal returns (uint256) {
        return IMockLedgerAnchor(anchor).push(dist.leafHash(1, kind, keccak256("S"), a, b));
    }

    function _subscribe(uint256 amount) internal {
        vm.startPrank(alice);
        IReentrantCoin(coin).faucet(amount);
        IReentrantCoin(coin).approve(address(dist), amount);
        dist.subscribe(coin, amount);
        vm.stopPrank();
    }

    function _fund(uint256 amount) internal {
        vm.startPrank(deployer);
        IReentrantCoin(coin).faucet(amount);
        IReentrantCoin(coin).approve(address(dist), amount);
        vm.stopPrank();
    }

    function test_claimIsGuarded() public {
        _subscribe(100e6);
        vm.prank(deployer);
        dist.closeSubscription();
        _fund(5e6);
        uint256 e = _fact(DISTRIBUTION, 1, 5e6);
        vm.prank(deployer);
        dist.distribute(1, coin, 5e6, e, noProof);
        IReentrantCoin(coin).armMode(address(dist), 0);
        vm.expectRevert(REENTERED);
        vm.prank(alice);
        dist.claim(coin);
    }

    function test_redeemIsGuarded() public {
        _subscribe(100e6);
        vm.prank(deployer);
        dist.closeSubscription();
        _fund(100e6);
        uint256 e = _fact(REDEMPTION, 100e6, 0);
        vm.prank(deployer);
        dist.settleMaturity(coin, 100e6, e, noProof);
        IReentrantCoin(coin).armMode(address(dist), 1);
        vm.expectRevert(REENTERED);
        vm.prank(alice);
        dist.redeem(coin);
    }

    function test_claimProfitIsGuarded() public {
        _subscribe(100e6);
        vm.prank(deployer);
        dist.closeSubscription();
        _fund(100e6);
        uint256 e = _fact(REDEMPTION, 100e6, 0);
        vm.prank(deployer);
        dist.settleMaturity(coin, 100e6, e, noProof);
        _fund(10e6);
        uint256 eH = _fact(RESOLUTION, 10e6, 1);
        vm.prank(deployer);
        IExtra(address(dist)).releaseHeldProfit(1, coin, 10e6, eH, noProof);
        IReentrantCoin(coin).armMode(address(dist), 2);
        vm.expectRevert(REENTERED);
        vm.prank(alice);
        IExtra(address(dist)).claimProfit(coin);
    }

    function test_refundIsGuarded() public {
        _subscribe(5e6); // below the 10e6 minimum raise
        vm.warp(block.timestamp + 1 days);
        vm.prank(deployer);
        dist.closeSubscription();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Cancelled));
        IReentrantCoin(coin).armMode(address(dist), 3);
        vm.expectRevert(REENTERED);
        vm.prank(alice);
        dist.refund();
    }
}
