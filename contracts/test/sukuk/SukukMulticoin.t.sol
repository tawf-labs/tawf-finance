// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import {TrexFixture} from "../trex/TrexFixture.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";
import {
    ISukukDistributor,
    IMockUSDC,
    IMockLedgerAnchor,
    SUKUK,
    APPROVED,
    DISTRIBUTION,
    REDEMPTION,
    RESERVE,
    DEFAULT,
    RESOLUTION,
    SWEEP_DEST,
    LEDGER_CHAIN_ID,
    FACE,
    MIN_RAISE,
    MIN_SUB,
    WINDOW
} from "./SukukDistributor.t.sol";

/// @dev The multi-coin additions to the distributor.
interface IMulti {
    function coins() external view returns (address[] memory);
    function isCoin(address) external view returns (bool);
    function coinBalance(address) external view returns (uint256);
    function freeBalance(address) external view returns (uint256);
    function heldBalanceOf(address) external view returns (uint256);
    function coinPaused(address) external view returns (bool);
    function setCoinPaused(address coin, bool paused) external;
    function totalRaised() external view returns (uint256);
    function totalRefunded() external view returns (uint256);
    function netRaised() external view returns (uint256);
    function FUNDER_ROLE() external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
    function topUp(address coin, uint256 amount) external;
    function paidOf(address investor, address coin) external view returns (uint256);
    function raisedOf(address coin) external view returns (uint256);
    function refundedOf(address coin) external view returns (uint256);
}

/// @notice Multi-coin behaviour of SukukDistributor: three accepted stablecoins, the investor
///         picks the coin to claim and redeem in, refunds return the coin that was paid.
contract SukukMulticoinTest is TrexFixture {
    address usdc;
    address usdt;
    address usdg;
    address anchor;
    ISukukDistributor dist;
    IMulti multi;
    Token token;
    ModularCompliance mc;
    DistributionCheckpointModule module;

    address bank = makeAddr("bank");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address stranger = makeAddr("stranger");

    uint40 maturity;
    bytes32[] noProof;

    function setUp() public {
        maturity = uint40(block.timestamp + 365 days);
        _setUpTrex();
        usdc = deployCode("MockUSDC.sol:MockUSDC");
        usdt = deployCode("MockUSDC.sol:MockUSDC");
        usdg = deployCode("MockUSDC.sol:MockUSDC");
        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(LEDGER_CHAIN_ID));
        (token, mc, module) = _deployTrexToken("Tawf Sukuk Multi 001", "TSM001", 6);

        address[] memory list = new address[](3);
        list[0] = usdc;
        list[1] = usdt;
        list[2] = usdg;
        dist = ISukukDistributor(_deploy(list));
        multi = IMulti(address(dist));
        _wireDistributor(token, mc, module, address(dist));
        _registerVerified(alice, 360);
        _registerVerified(bob, 360);
        bytes32 funder = multi.FUNDER_ROLE();
        vm.prank(deployer);
        multi.grantRole(funder, bank);
    }

    function _deploy(address[] memory list) internal returns (address) {
        return _deployProxy(
                "SukukDistributor.sol:SukukDistributor",
                abi.encodePacked(DIST_INIT, abi.encode(
                list, anchor, address(ir), address(token), address(module),
                SUKUK, FACE, maturity, MIN_RAISE, MIN_SUB, WINDOW, treasury,
                deployer))
            );
    }

    // --- helpers ---------------------------------------------------------

    function _anchorFact(bytes32 kind, uint256 a, uint256 b) internal returns (uint256) {
        return IMockLedgerAnchor(anchor).push(dist.leafHash(LEDGER_CHAIN_ID, kind, SUKUK, a, b));
    }

    function _postReserve(uint256 outstanding) internal {
        uint64 at = uint64(block.timestamp);
        if (at <= dist.reserveSnapshotAt()) at = dist.reserveSnapshotAt() + 1;
        dist.updateReserve(at, outstanding, _anchorFact(RESERVE, at, outstanding), noProof);
    }

    function _open() internal {
        uint256 epoch = _anchorFact(APPROVED, FACE, maturity);
        vm.prank(deployer);
        dist.openSubscription(epoch, noProof);
        _postReserve(FACE);
    }

    function _sub(address who, address coin, uint256 amount) internal {
        vm.startPrank(who);
        IMockUSDC(coin).faucet(amount);
        IMockUSDC(coin).approve(address(dist), amount);
        dist.subscribe(coin, amount);
        vm.stopPrank();
    }

    function _close() internal {
        vm.warp(block.timestamp + WINDOW);
        _postReserve(FACE);
        vm.prank(deployer);
        dist.closeSubscription();
    }

    /// alice 150k USDC + 50k USDT, bob 100k USDG: 300k raised across three coins.
    function _issueMixed() internal {
        _open();
        _sub(alice, usdc, 150_000e6);
        _sub(alice, usdt, 50_000e6);
        _sub(bob, usdg, 100_000e6);
        _close();
    }

    function _distribute(uint16 period, address coin, uint256 amount) internal {
        uint256 epoch = _anchorFact(DISTRIBUTION, period, amount);
        vm.startPrank(bank);
        IMockUSDC(coin).faucet(amount);
        IMockUSDC(coin).approve(address(dist), amount);
        dist.distribute(period, coin, amount, epoch, noProof);
        vm.stopPrank();
    }

    function _topUp(address coin, uint256 amount) internal {
        vm.startPrank(bank);
        IMockUSDC(coin).faucet(amount);
        IMockUSDC(coin).approve(address(dist), amount);
        multi.topUp(coin, amount);
        vm.stopPrank();
    }

    function _settle(address coin, uint256 amount) internal {
        uint256 epoch = _anchorFact(REDEMPTION, amount, 0);
        vm.startPrank(bank);
        IMockUSDC(coin).faucet(amount);
        IMockUSDC(coin).approve(address(dist), amount);
        dist.settleMaturity(coin, amount, epoch, noProof);
        vm.stopPrank();
    }

    function _bal(address coin, address who) internal view returns (uint256) {
        return IMockUSDC(coin).balanceOf(who);
    }

    // --- construction ----------------------------------------------------

    function test_coinsAreRecorded() public view {
        address[] memory c = multi.coins();
        assertEq(c.length, 3);
        assertEq(c[0], usdc);
        assertEq(c[2], usdg);
        assertTrue(multi.isCoin(usdt));
        assertFalse(multi.isCoin(stranger));
        assertEq(multi.coinBalance(stranger), 0);
    }

    /// @dev Deploys with CREATE and returns the revert data, which deployCode would swallow.
    function _tryDeploy(address[] memory list, address tokenAddr) internal returns (address created, bytes memory err) {
        address beacon = _beaconFor("SukukDistributor.sol:SukukDistributor");
        bytes memory code = abi.encodePacked(
            vm.getCode(BEACON_PROXY),
            abi.encode(
                beacon,
                abi.encodePacked(
                    DIST_INIT,
                    abi.encode(
                        list, anchor, address(ir), tokenAddr, address(module),
                        SUKUK, FACE, maturity, MIN_RAISE, MIN_SUB, WINDOW, treasury,
                        deployer
                    )
                )
            )
        );
        assembly {
            created := create(0, add(code, 0x20), mload(code))
        }
        if (created == address(0)) {
            assembly {
                let size := returndatasize()
                err := mload(0x40)
                mstore(err, size)
                returndatacopy(add(err, 0x20), 0, size)
                mstore(0x40, add(add(err, 0x20), size))
            }
        }
    }

    function _assertInvalidCoins(address[] memory list) internal {
        (address created, bytes memory err) = _tryDeploy(list, address(token));
        assertEq(created, address(0), "deployed");
        assertEq(bytes4(err), bytes4(keccak256("InvalidCoins()")), "selector");
    }

    function test_constructorRejectsBadCoinLists() public {
        _assertInvalidCoins(new address[](0));

        address[] memory dup = new address[](2);
        dup[0] = usdc;
        dup[1] = usdc;
        _assertInvalidCoins(dup);

        address[] memory five = new address[](5);
        for (uint256 i; i < 5; ++i) five[i] = deployCode("MockUSDC.sol:MockUSDC");
        _assertInvalidCoins(five);

        _assertInvalidCoins(new address[](1)); // the zero address
    }

    function test_constructorRejectsNonSixDecimals() public {
        address eighteen = deployCode("MockUSDC.sol:MockUSDC");
        vm.mockCall(eighteen, abi.encodeWithSignature("decimals()"), abi.encode(uint8(18)));
        address[] memory list = new address[](2);
        list[0] = usdc;
        list[1] = eighteen;
        _assertInvalidCoins(list);
    }

    function test_constructorRejectsTheSukukTokenAsACoin() public {
        address[] memory list = new address[](2);
        list[0] = usdc;
        list[1] = address(token);
        _assertInvalidCoins(list);
    }

    function test_constructorAcceptsFourCoins() public {
        address[] memory four = new address[](4);
        for (uint256 i; i < 4; ++i) four[i] = deployCode("MockUSDC.sol:MockUSDC");
        (address created,) = _tryDeploy(four, address(token));
        assertTrue(created != address(0));
    }

    // --- subscription and close -----------------------------------------

    function test_mixedSubscriptionsTrackEachCoin() public {
        _open();
        _sub(alice, usdc, 150_000e6);
        _sub(alice, usdt, 50_000e6);
        _sub(bob, usdg, 100_000e6);
        assertEq(token.balanceOf(alice), 200_000e6);
        assertEq(multi.paidOf(alice, usdc), 150_000e6);
        assertEq(multi.paidOf(alice, usdt), 50_000e6);
        assertEq(multi.paidOf(bob, usdg), 100_000e6);
        assertEq(multi.raisedOf(usdc), 150_000e6);
        assertEq(multi.raisedOf(usdt), 50_000e6);
        assertEq(multi.raisedOf(usdg), 100_000e6);
        assertEq(token.totalSupply(), multi.raisedOf(usdc) + multi.raisedOf(usdt) + multi.raisedOf(usdg));
    }

    function test_closeSendsEachCoinToTheIssuer() public {
        _issueMixed();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Active));
        assertEq(_bal(usdc, treasury), 150_000e6);
        assertEq(_bal(usdt, treasury), 50_000e6);
        assertEq(_bal(usdg, treasury), 100_000e6);
        assertEq(_bal(usdc, address(dist)) + _bal(usdt, address(dist)) + _bal(usdg, address(dist)), 0);
    }

    function test_subscribeInUnacceptedCoinReverts() public {
        _open();
        address other = deployCode("MockUSDC.sol:MockUSDC");
        vm.startPrank(alice);
        IMockUSDC(other).faucet(MIN_SUB);
        IMockUSDC(other).approve(address(dist), MIN_SUB);
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", other));
        dist.subscribe(other, MIN_SUB);
        vm.stopPrank();
    }

    // --- refunds ---------------------------------------------------------

    function test_cancelledRefundsEachCoinThatWasPaid() public {
        _open();
        _sub(alice, usdc, 20_000e6);
        _sub(alice, usdt, 30_000e6);
        _sub(bob, usdg, 10_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription(); // 60k < 100k minimum raise
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Cancelled));
        assertEq(_bal(usdc, treasury) + _bal(usdt, treasury) + _bal(usdg, treasury), 0);

        vm.prank(alice);
        dist.refund();
        assertEq(_bal(usdc, alice), 20_000e6);
        assertEq(_bal(usdt, alice), 30_000e6);
        assertEq(_bal(usdg, alice), 0);

        vm.prank(bob);
        dist.refund();
        assertEq(_bal(usdg, bob), 10_000e6);

        assertEq(token.totalSupply(), 0);
        assertEq(multi.refundedOf(usdc), multi.raisedOf(usdc));
        assertEq(multi.refundedOf(usdt), multi.raisedOf(usdt));
        assertEq(multi.refundedOf(usdg), multi.raisedOf(usdg));
        assertEq(_bal(usdc, address(dist)) + _bal(usdt, address(dist)) + _bal(usdg, address(dist)), 0);
    }

    function test_refundOfBoughtTokensIsPaidFromRemainingEscrow() public {
        _open();
        _sub(alice, usdc, 20_000e6);
        _sub(bob, usdg, 10_000e6);
        // alice sells her 20k units to bob before the sale is cancelled.
        vm.prank(alice);
        token.transfer(bob, 20_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription();

        vm.prank(bob);
        dist.refund();
        // bob paid 10k USDG, so that comes back first, the other 20k comes from the USDC escrow.
        assertEq(_bal(usdg, bob), 10_000e6);
        assertEq(_bal(usdc, bob), 20_000e6);
        assertEq(token.totalSupply(), 0);
        assertEq(_bal(usdc, address(dist)) + _bal(usdt, address(dist)) + _bal(usdg, address(dist)), 0);
    }

    // --- distribution and claims ----------------------------------------

    function test_distributeInOneCoinClaimInAnother() public {
        _issueMixed();
        _distribute(1, usdc, 30_000e6); // alice holds 200k of 300k: 20k, bob 10k

        // Nothing sits in USDT yet, so a USDT claim is paid from the USDC the contract holds.
        vm.prank(alice);
        dist.claim(usdt);
        assertEq(_bal(usdt, alice), 0);
        assertEq(_bal(usdc, alice), 20_000e6);

        // With USDT topped up, the preferred coin is used first.
        _topUp(usdt, 25_000e6);
        vm.prank(bob);
        dist.claim(usdt);
        assertEq(_bal(usdt, bob), 10_000e6);
        assertEq(_bal(usdc, bob), 0);
        assertEq(multi.coinBalance(usdt), 15_000e6);
    }

    function test_distributeInAnUnacceptedCoinReverts() public {
        _issueMixed();
        address other = deployCode("MockUSDC.sol:MockUSDC");
        uint256 epoch = _anchorFact(DISTRIBUTION, 1, 1_000e6);
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", other));
        vm.prank(bank);
        dist.distribute(1, other, 1_000e6, epoch, noProof);
    }

    function test_claimOrRedeemInAnUnacceptedCoinReverts() public {
        _issueMixed();
        _distribute(1, usdc, 3_000e6);
        address other = deployCode("MockUSDC.sol:MockUSDC");
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", other));
        vm.prank(alice);
        dist.claim(other);

        _settle(usdc, 300_000e6);
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", other));
        vm.prank(alice);
        dist.redeem(other);
    }

    function test_topUpOnlyAcceptedCoins() public {
        address other = deployCode("MockUSDC.sol:MockUSDC");
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", other));
        multi.topUp(other, 1);
    }

    function test_tawfShareIsTakenInTheDistributedCoin() public {
        address fee = makeAddr("fee");
        vm.prank(deployer);
        dist.setTawfShare(1000, fee); // 10%
        _issueMixed();
        _distribute(1, usdt, 10_000e6);
        assertEq(_bal(usdt, fee), 1_000e6);
        assertEq(_bal(usdc, fee), 0);
        assertEq(dist.totalTawfShare(), 1_000e6);
    }

    // --- maturity and redemption ----------------------------------------

    function test_settleInOneCoinRedeemInEach() public {
        _issueMixed();
        _distribute(1, usdc, 3_000e6); // alice 2k, bob 1k
        // Maturity is funded in USDG only, then topped up so holders can pick any coin.
        _settle(usdg, 300_000e6);
        _topUp(usdc, 300_000e6);
        _topUp(usdt, 300_000e6);

        vm.prank(alice);
        dist.redeem(usdt);
        assertEq(_bal(usdt, alice), 200_000e6 + 2_000e6);
        assertEq(token.balanceOf(alice), 0);

        vm.prank(bob);
        dist.redeem(usdg);
        assertEq(_bal(usdg, bob), 100_000e6 + 1_000e6);
        assertEq(token.totalSupply(), 0);
    }

    function test_redeemInAnEmptyCoinIsPaidFromTheOthers() public {
        _issueMixed();
        _settle(usdc, 300_000e6);
        vm.prank(bob);
        dist.redeem(usdg);
        assertEq(_bal(usdg, bob), 0);
        assertEq(_bal(usdc, bob), 100_000e6);
    }


    // --- single-coin parity ---------------------------------------------

    function test_singleCoinOfferingBehavesAsBefore() public {
        address[] memory one = new address[](1);
        one[0] = usdc;
        ISukukDistributor d = ISukukDistributor(_deploy(one));
        assertEq(IMulti(address(d)).coins().length, 1);
        assertTrue(IMulti(address(d)).isCoin(usdc));
        assertFalse(IMulti(address(d)).isCoin(usdt));
    }

    // --- payouts split across coins (qa1 M1) ----------------------------

    function test_claimSplitsAcrossCoinsAndEmitsAPartPerCoin() public {
        _issueMixed();
        _distribute(1, usdc, 6_000e6); // alice 4k, bob 2k, all held as USDC
        _topUp(usdt, 1_000e6);
        vm.expectEmit(true, true, false, true, address(dist));
        emit PayoutPart(alice, usdt, 1_000e6);
        vm.expectEmit(true, true, false, true, address(dist));
        emit PayoutPart(alice, usdc, 3_000e6);
        vm.prank(alice);
        dist.claim(usdt); // 1k USDT then 3k USDC
        assertEq(_bal(usdt, alice), 1_000e6);
        assertEq(_bal(usdc, alice), 3_000e6);
    }

    event PayoutPart(address indexed to, address indexed coin, uint256 amount);

    function test_strandedRedeemerIsPaidThroughTheSplit() public {
        _issueMixed(); // alice 200k units, bob 100k
        _distribute(1, usdc, 6_000e6);
        _settle(usdg, 300_000e6);
        vm.prank(alice);
        dist.claim(usdg); // alice's 4k profit from the principal coin
        vm.prank(bob);
        dist.redeem(usdg); // 100k principal + 2k profit
        // alice is owed 200k and the contract holds exactly that, but across USDG and USDC.
        vm.prank(alice);
        dist.redeem(usdt);
        assertEq(token.balanceOf(alice), 0);
        assertEq(_bal(usdg, alice) + _bal(usdc, alice) + _bal(usdt, alice), 200_000e6 + 4_000e6);
        assertEq(_bal(usdc, address(dist)) + _bal(usdt, address(dist)) + _bal(usdg, address(dist)), 0);
    }

    function test_twoHoldersCompetingForTheLastOfOneCoin() public {
        _issueMixed();
        _settle(usdt, 300_000e6); // everything funded in USDT
        _topUp(usdc, 150_000e6);
        vm.prank(alice);
        dist.redeem(usdt); // takes 200k USDT
        vm.prank(bob);
        dist.redeem(usdt); // 100k USDT left, enough
        assertEq(_bal(usdt, alice), 200_000e6);
        assertEq(_bal(usdt, bob), 100_000e6);
        assertEq(multi.coinBalance(usdc), 150_000e6);
    }

    function test_partlyFundedRedemptionPaysAcrossCoins() public {
        _issueMixed();
        _distribute(1, usdc, 6_000e6);
        // Maturity funded for only part of the principal: the declared amount is 100k.
        _settle(usdg, 100_000e6); // 100k for 300k units: 1/3 per unit
        vm.prank(alice);
        dist.redeem(usdt); // principal 66,666.666666 + profit 4,000 = enough in total
        assertGt(_bal(usdg, alice) + _bal(usdc, alice), 0);
    }

    // --- funders (qa1 M3) ------------------------------------------------

    function test_onlyFundersMayFundPayouts() public {
        _issueMixed();
        uint256 epoch = _anchorFact(DISTRIBUTION, 1, 1_000e6);
        vm.expectRevert();
        vm.prank(stranger);
        dist.distribute(1, usdc, 1_000e6, epoch, noProof);

        epoch = _anchorFact(REDEMPTION, 300_000e6, 0);
        vm.expectRevert();
        vm.prank(stranger);
        dist.settleMaturity(usdc, 300_000e6, epoch, noProof);

        vm.expectRevert();
        vm.prank(stranger);
        dist.settleDefault(usdc, 100e6, epoch, noProof);
    }

    // --- pausing a coin (qa1 M4) ----------------------------------------

    function test_pausedCoinTakesNoNewMoneyAndIsNoPreferredPayout() public {
        _open();
        vm.prank(deployer);
        multi.setCoinPaused(usdt, true);
        vm.startPrank(alice);
        IMockUSDC(usdt).faucet(MIN_SUB);
        IMockUSDC(usdt).approve(address(dist), MIN_SUB);
        vm.expectRevert(abi.encodeWithSignature("CoinIsPaused(address)", usdt));
        dist.subscribe(usdt, MIN_SUB);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSignature("CoinIsPaused(address)", usdt));
        multi.topUp(usdt, 1);

        _sub(alice, usdc, 150_000e6);
        _sub(bob, usdg, 150_000e6);
        _close();
        _distribute(1, usdc, 3_000e6);
        // A paused preferred coin is no preference: the claim is paid from the active coins.
        uint256 usdtBefore = _bal(usdt, alice);
        vm.prank(alice);
        dist.claim(usdt);
        assertEq(_bal(usdt, alice), usdtBefore);
        assertEq(_bal(usdc, alice), 1_500e6);
        vm.prank(bob);
        dist.claim(usdc);
        assertEq(_bal(usdc, bob), 1_500e6);
    }

    function test_pausedCoinStillCompletesAPayout() public {
        _issueMixed();
        _settle(usdt, 300_000e6); // all funded in USDT
        vm.prank(deployer);
        multi.setCoinPaused(usdt, true);
        vm.prank(alice);
        dist.redeem(usdc); // preferred USDC is empty, so the paused USDT covers it
        assertEq(_bal(usdt, alice), 200_000e6);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_pauseIsAdminOnlyAndForAcceptedCoins() public {
        vm.expectRevert();
        vm.prank(stranger);
        multi.setCoinPaused(usdc, true);
        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", stranger));
        multi.setCoinPaused(stranger, true);
    }

    // --- refunds (qa1 M5) ------------------------------------------------

    function test_refundWhenOneCoinEscrowRunsOut() public {
        _open();
        _sub(alice, usdc, 20_000e6);
        _sub(bob, usdt, 20_000e6);
        // alice sells to carol before the cancel, carol never paid.
        address carol = makeAddr("carol");
        _registerVerified(carol, 360);
        vm.prank(alice);
        token.transfer(carol, 20_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription();

        vm.prank(bob);
        dist.refund(); // bob paid USDT and gets USDT
        assertEq(_bal(usdt, bob), 20_000e6);
        vm.prank(carol);
        dist.refund(); // carol paid nothing, escrow left is the USDC
        assertEq(_bal(usdc, carol), 20_000e6);
        assertEq(token.totalSupply(), 0);
        assertEq(multi.totalRaised(), 40_000e6);
        assertEq(multi.totalRefunded(), 40_000e6);
        assertEq(multi.netRaised(), 0);
    }

    // --- held profit per coin (qa1 M2) ----------------------------------

    function _release(uint16 index, address coin, uint256 amount) internal {
        uint256 epoch = _anchorFact(RESOLUTION, amount, index);
        vm.startPrank(bank);
        IMockUSDC(coin).faucet(amount);
        IMockUSDC(coin).approve(address(dist), amount);
        dist.releaseHeldProfit(index, coin, amount, epoch, noProof);
        vm.stopPrank();
    }

    function test_sweepReturnsEachReleaseInItsOwnCoin() public {
        _issueMixed();
        _distribute(1, usdc, 6_000e6); // ordinary profit sits in USDC, unclaimed
        _settle(usdt, 300_000e6);
        address waqf = makeAddr("waqf");
        dist.setSweepDestination(waqf, _anchorFact(SWEEP_DEST, uint256(uint160(waqf)), 0), noProof);
        _release(1, usdg, 1_000e6);
        _release(2, usdt, 500e6);
        assertEq(multi.heldBalanceOf(usdg), 1_000e6);
        assertEq(multi.heldBalanceOf(usdt), 500e6);

        vm.warp(block.timestamp + 366 days);
        uint256 usdcBefore = _bal(usdc, address(dist));
        dist.sweepUnclaimed();
        assertEq(_bal(usdg, waqf), 1_000e6);
        assertEq(_bal(usdt, waqf), 500e6);
        assertEq(_bal(usdc, waqf), 0);
        assertEq(_bal(usdc, address(dist)), usdcBefore, "ordinary profit coin untouched");
        assertEq(multi.heldBalanceOf(usdg) + multi.heldBalanceOf(usdt), 0);
    }

    function test_claimProfitDrawsFromReleaseCoinsOnly() public {
        _issueMixed();
        _settle(usdt, 300_000e6);
        _release(1, usdg, 3_000e6); // alice 2k, bob 1k
        _release(2, usdc, 3_000e6); // alice 2k more
        uint256 freeUsdt = multi.freeBalance(usdt);
        vm.prank(alice);
        dist.claimProfit(usdg); // 4k owed: the USDG pool of released profit first, then the USDC one
        assertEq(_bal(usdg, alice), 3_000e6);
        assertEq(_bal(usdc, alice), 1_000e6);
        assertEq(multi.freeBalance(usdt), freeUsdt, "principal funding untouched");
    }

    function test_settleDefaultInOneCoinRedeemInAnother() public {
        _issueMixed();
        uint256 epoch = _anchorFact(DEFAULT, 90_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdt).faucet(90_000e6);
        IMockUSDC(usdt).approve(address(dist), 90_000e6);
        dist.settleDefault(usdt, 90_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Defaulted));
        vm.prank(alice);
        dist.redeem(usdg);
        vm.prank(bob);
        dist.redeem(usdc);
        assertEq(_bal(usdt, alice) + _bal(usdt, bob), 90_000e6);
    }

    // --- constructor and sweep destination (qa1 M7) --------------------

    function test_sweepDestinationCannotBeACoinOrTheToken() public {
        _issueMixed();
        _settle(usdt, 300_000e6);
        uint256 e1 = _anchorFact(SWEEP_DEST, uint256(uint160(usdc)), 0);
        vm.expectRevert(abi.encodeWithSignature("InvalidSweepDestination(address)", usdc));
        dist.setSweepDestination(usdc, e1, noProof);
        uint256 e2 = _anchorFact(SWEEP_DEST, uint256(uint160(address(token))), 0);
        vm.expectRevert(abi.encodeWithSignature("InvalidSweepDestination(address)", address(token)));
        dist.setSweepDestination(address(token), e2, noProof);
    }

    // --- single-coin parity, end to end --------------------------------

    function test_singleCoinEndToEndRejectsASecondCoin() public {
        address[] memory one = new address[](1);
        one[0] = usdc;
        (address created,) = _tryDeploy(one, address(token));
        assertTrue(created != address(0));
        IMulti m = IMulti(created);
        assertEq(m.coins().length, 1);
        assertFalse(m.isCoin(usdt));
        // The shared token is already wired to `dist`, so only the coin surface is exercised here.
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", usdt));
        vm.prank(deployer);
        m.setCoinPaused(usdt, true);
    }

    // --- fuzz across coins ----------------------------------------------

    function testFuzz_coinChoiceNeverChangesTotals(
        uint96 a,
        uint96 b,
        uint96 profit,
        uint8 subA,
        uint8 subB,
        uint8 distCoin,
        uint8 settleCoin,
        uint8 prefA,
        uint8 prefB
    ) public {
        uint256 amtA = bound(uint256(a), MIN_SUB, 200_000e6);
        uint256 amtB = bound(uint256(b), MIN_RAISE, 200_000e6);
        uint256 prof = bound(uint256(profit), 0, 50_000e6);
        address[3] memory c = [usdc, usdt, usdg];
        _open();
        _sub(alice, c[subA % 3], amtA);
        _sub(bob, c[subB % 3], amtB);
        _close();
        uint256 supply = amtA + amtB;
        assertEq(multi.totalRaised(), supply);
        _distribute(1, c[distCoin % 3], prof);
        _settle(c[settleCoin % 3], supply);

        uint256 owedProfitA = dist.claimable(alice);
        uint256 owedProfitB = dist.claimable(bob);
        uint256 total = _bal(usdc, address(dist)) + _bal(usdt, address(dist)) + _bal(usdg, address(dist));
        assertGe(total, supply + owedProfitA + owedProfitB);

        vm.prank(alice);
        dist.redeem(c[prefA % 3]);
        vm.prank(bob);
        dist.redeem(c[prefB % 3]);
        uint256 paidOut;
        for (uint256 i; i < 3; ++i) paidOut += _bal(c[i], alice) + _bal(c[i], bob);
        assertGe(paidOut, supply);
        assertLe(paidOut, supply + prof);
        assertEq(token.totalSupply(), 0);
    }

    /// While the sale is open, raisedOf per coin always equals what the investors paid in that coin.
    function testFuzz_raisedMatchesPaidWhileOpen(uint96 a1, uint96 a2, uint96 a3, uint8 c1, uint8 c2, uint8 c3) public {
        address[3] memory c = [usdc, usdt, usdg];
        _open();
        _sub(alice, c[c1 % 3], bound(uint256(a1), MIN_SUB, 100_000e6));
        _sub(bob, c[c2 % 3], bound(uint256(a2), MIN_SUB, 100_000e6));
        _sub(alice, c[c3 % 3], bound(uint256(a3), MIN_SUB, 100_000e6));
        for (uint256 i; i < 3; ++i) {
            assertEq(multi.raisedOf(c[i]), multi.paidOf(alice, c[i]) + multi.paidOf(bob, c[i]));
        }
        assertEq(multi.totalRaised(), token.totalSupply());
    }

    // --- pause never stops a payout, ordering, escrow (qa1 N1, N3) -----

    function test_payoutOrderIsPreferredThenActiveThenPaused() public {
        _issueMixed();
        _settle(usdc, 300_000e6);
        _topUp(usdt, 50_000e6);
        _topUp(usdg, 50_000e6);
        vm.prank(deployer);
        multi.setCoinPaused(usdt, true);
        // alice redeems 200k, preferring USDG (50k), then active USDC in list order (150k), paused USDT untouched.
        vm.prank(alice);
        dist.redeem(usdg);
        assertEq(_bal(usdg, alice), 50_000e6);
        assertEq(_bal(usdc, alice), 150_000e6);
        assertEq(_bal(usdt, alice), 0);
        // bob's 100k: USDC has 150k left, so the paused coin is still untouched.
        vm.prank(bob);
        dist.redeem(usdt); // paused preferred means no preference
        assertEq(_bal(usdc, bob), 100_000e6);
        assertEq(_bal(usdt, bob), 0);
    }

    function test_allCoinsPausedStillPays() public {
        _issueMixed();
        _distribute(1, usdc, 3_000e6);
        _settle(usdt, 300_000e6);
        vm.startPrank(deployer);
        multi.setCoinPaused(usdc, true);
        multi.setCoinPaused(usdt, true);
        multi.setCoinPaused(usdg, true);
        vm.stopPrank();
        vm.prank(alice);
        dist.claim(usdg);
        vm.prank(alice);
        dist.redeem(usdc);
        assertEq(token.balanceOf(alice), 0);
        assertEq(_bal(usdc, alice) + _bal(usdt, alice) + _bal(usdg, alice), 200_000e6 + 2_000e6);
    }

    function test_pausedPreferredHeldClaimStillPays() public {
        _issueMixed();
        _settle(usdt, 300_000e6);
        _release(1, usdg, 3_000e6);
        vm.prank(deployer);
        multi.setCoinPaused(usdg, true);
        vm.prank(alice);
        dist.claimProfit(usdg); // alice's 2k comes from the paused pool, there is nothing else
        assertEq(_bal(usdg, alice), 2_000e6);
    }

    function test_freeBalanceExcludesSubscriptionEscrow() public {
        _open();
        _sub(alice, usdc, 20_000e6);
        _sub(bob, usdt, 5_000e6);
        assertEq(multi.coinBalance(usdc), 20_000e6);
        assertEq(multi.freeBalance(usdc), 0);
        assertEq(multi.freeBalance(usdt), 0);
        _topUp(usdc, 7_000e6);
        assertEq(multi.freeBalance(usdc), 7_000e6, "a top-up is free, the escrow is not");
        // after the sale closes (proceeds leave), and a cancel keeps escrow reserved until refunded
        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription(); // 25k < 100k minimum: cancelled
        assertEq(multi.freeBalance(usdc), 7_000e6);
        vm.prank(alice);
        dist.refund();
        assertEq(multi.freeBalance(usdc), 7_000e6);
        assertEq(_bal(usdc, alice), 20_000e6);
    }
}
