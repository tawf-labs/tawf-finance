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
    function available(address) external view returns (uint256);
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
    }

    function _deploy(address[] memory list) internal returns (address) {
        return deployCode(
            "SukukDistributor.sol:SukukDistributor",
            abi.encode(
                list, anchor, address(ir), address(token), address(module),
                SUKUK, FACE, maturity, MIN_RAISE, MIN_SUB, WINDOW, treasury,
                deployer
            )
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
        assertEq(multi.available(stranger), 0);
    }

    function test_constructorRejectsBadCoinLists() public {
        address[] memory none = new address[](0);
        vm.expectRevert(bytes4(keccak256("InvalidCoins()")));
        this.deployExt(none);

        address[] memory dup = new address[](2);
        dup[0] = usdc;
        dup[1] = usdc;
        vm.expectRevert(bytes4(keccak256("InvalidCoins()")));
        this.deployExt(dup);

        address[] memory five = new address[](5);
        for (uint256 i; i < 5; ++i) five[i] = deployCode("MockUSDC.sol:MockUSDC");
        vm.expectRevert(bytes4(keccak256("InvalidCoins()")));
        this.deployExt(five);

        address[] memory zero = new address[](1);
        vm.expectRevert(bytes4(keccak256("InvalidCoins()")));
        this.deployExt(zero);
    }

    function test_constructorRejectsNonSixDecimals() public {
        address eighteen = deployCode("MockUSDC.sol:MockUSDC");
        vm.mockCall(eighteen, abi.encodeWithSignature("decimals()"), abi.encode(uint8(18)));
        address[] memory list = new address[](2);
        list[0] = usdc;
        list[1] = eighteen;
        vm.expectRevert(bytes4(keccak256("InvalidCoins()")));
        this.deployExt(list);
    }

    function deployExt(address[] memory list) external returns (address) {
        return _deploy(list);
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

        // The contract holds only USDC, so a USDT claim is short and says so.
        vm.expectRevert(abi.encodeWithSignature("InsufficientCoin(address,uint256,uint256)", usdt, 0, 20_000e6));
        vm.prank(alice);
        dist.claim(usdt);

        _topUp(usdt, 25_000e6);
        assertEq(multi.available(usdt), 25_000e6);
        vm.prank(alice);
        dist.claim(usdt);
        assertEq(_bal(usdt, alice), 20_000e6);

        vm.prank(bob);
        dist.claim(usdc);
        assertEq(_bal(usdc, bob), 10_000e6);
        assertEq(_bal(usdc, address(dist)), 20_000e6);
    }

    function test_distributeInAnUnacceptedCoinReverts() public {
        _issueMixed();
        address other = deployCode("MockUSDC.sol:MockUSDC");
        uint256 epoch = _anchorFact(DISTRIBUTION, 1, 1_000e6);
        vm.expectRevert(abi.encodeWithSignature("CoinNotAccepted(address)", other));
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

    function test_redeemRevertsWhenTheCoinCannotCoverIt() public {
        _issueMixed();
        _settle(usdc, 300_000e6);
        vm.expectRevert(abi.encodeWithSignature("InsufficientCoin(address,uint256,uint256)", usdg, 0, 100_000e6));
        vm.prank(bob);
        dist.redeem(usdg);
        // The same holder redeems in the funded coin instead.
        vm.prank(bob);
        dist.redeem(usdc);
        assertEq(_bal(usdc, bob), 100_000e6);
    }

    function test_totalCoinBalancesCoverWhatIsOwed() public {
        _issueMixed();
        _distribute(1, usdc, 6_000e6);
        _settle(usdt, 300_000e6);
        uint256 total = _bal(usdc, address(dist)) + _bal(usdt, address(dist)) + _bal(usdg, address(dist));
        // owed: 300k principal plus 6k profit
        assertEq(total, 306_000e6);
        assertEq(dist.claimable(alice) + dist.claimable(bob), 6_000e6);
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
}
