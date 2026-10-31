// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Full-lifecycle tests for TawfDepositoSeries (Model B) against a real MockLedgerAnchor with real
// single-leaf proofs. Pinned to 0.8.17 for the concrete T-REX + onchain-id contracts; the series
// (^0.8.24), MockLedgerAnchor and MockUSDC/MockUSDT (^0.8.20) are reached via vm.deployCode and
// interfaces.
//
// Covers: subscribe + eligibility in both coins, allocate within the anchored balance converting
// each coin at its own rate, ReserveInsufficient above it, stale-rate rejection per coin, non-
// allowlisted token rejection, removing a coin blocks new subscriptions but existing pending can
// still be cancelled, distribute accrues exactly the anchored profit sen, wrong-proof rejection,
// pro-rata claims in USDC vs USDT, maturity + redeem in either coin, and a fuzz that total payouts
// (valued back in sen at the payout rates) never exceed anchored profit + principal.

import { ModuleProxies } from "../../src/proxy/ModuleProxies.sol";
import {TrexFixture} from "../trex/TrexFixture.sol";
import {SandboxModule} from "../../src/deposito/SandboxModule.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";
import {IBalanceCheckpoint} from "../../src/sukuk/IBalanceCheckpoint.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";

bytes32 constant DEPOSITO_RESERVE = keccak256("tawf.deposito.reserve");
bytes32 constant DEPOSITO_PROFIT = keccak256("tawf.deposito.profit");
bytes32 constant DEPOSITO_MATURITY = keccak256("tawf.deposito.maturity");
uint256 constant LEDGER_CHAIN_ID = 42;
// Two-decimal precision, idr per 1 stablecoin. No 1:1 peg between the coins.
uint256 constant RATE_USDC = 1_625_000; // 16,250.00 IDR per USDC
uint256 constant RATE_USDT = 1_624_000; // 16,240.00 IDR per USDT

interface IAnchor {
    function ledgerChainId() external view returns (uint256);
    function push(bytes32 root) external returns (uint256 epoch);
}

interface ISeries {
    function subscribe(address token, uint256 coinAmount) external;
    function cancelSubscription(address token) external;
    function allocate(address[] calldata investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] calldata proof) external;
    function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] calldata proof) external;
    function settleMaturity(uint64 at, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] calldata proof) external;
    function claim(address token) external;
    function redeem(address token) external;
    function addStablecoin(address token) external;
    function removeStablecoin(address token) external;
    function postRate(address token, uint256 idrPerToken) external;
    function grantRole(bytes32 role, address account) external;
    function pending(address investor, address token) external view returns (uint256);
    function claimableSen(address investor) external view returns (uint256);
    function quote(address token, uint256 sen) external view returns (uint256);
    function reserve() external view returns (uint256);
    function isFullyBacked() external view returns (bool);
    function allowedStablecoins() external view returns (address[] memory);
    function isStablecoin(address token) external view returns (bool);
    function rateOf(address token) external view returns (uint256);
    function setTawfShare(uint16 nisbahBps, address recipient) external;
    function claimTawfShare(address token) external;
    function tawfShareAccruedSen() external view returns (uint256);
    function tawfSharePaidSen() external view returns (uint256);
}

interface IMintableCoin {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

contract TawfDepositoSeriesTest is TrexFixture {
    uint256 internal constant TAWF_SCREENED = 2;
    bytes32 internal constant SERIES_ID = keccak256("tawf.series.1");

    address internal anchor;
    address internal series;
    address internal usdc;
    address internal usdt;
    Token internal token;
    ModularCompliance internal mc;
    SandboxModule internal sandbox;

    address internal operator; // deployer; treasury + ops + fx
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    bytes32[] internal noProof;

    function setUp() public {
        operator = deployer;
        _setUpTrex();
        // Trust the shared ClaimIssuer for the screening topic too.
        vm.startPrank(deployer);
        uint256[] memory topics = new uint256[](2);
        topics[0] = KYC_TOPIC;
        topics[1] = TAWF_SCREENED;
        tir.removeTrustedIssuer(claimIssuer);
        tir.addTrustedIssuer(claimIssuer, topics);
        vm.stopPrank();

        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(LEDGER_CHAIN_ID));
        usdc = deployCode("MockUSDC.sol:MockUSDC");
        usdt = deployCode("MockUSDT.sol:MockUSDT");

        (token, mc,) = _deployTrexToken("Tawf Deposito Series 1 (BPRS Demo)", "tDEP-TAWF-S1", 2);

        vm.startPrank(deployer);
        sandbox = ModuleProxies.sandbox();
        DistributionCheckpointModule checkpoint = ModuleProxies.checkpoint();

        series = _deployProxy(
            "TawfDepositoSeries.sol:TawfDepositoSeries",
            abi.encodePacked(SERIES_INIT, abi.encode(
                anchor, address(token), address(checkpoint), address(sandbox), address(mc),
                SERIES_ID, uint8(3), uint16(6000), operator, operator, operator, uint64(1 days)))
        );

        // SCREENED_GROUP so investors with a screening claim can subscribe.
        sandbox.initConfig(
            address(mc), SandboxModule.Mode.SCREENED_GROUP, operator, address(claimIssuer),
            0, 0, 0, uint64(block.timestamp + 90 days)
        );
        mc.addModule(address(sandbox));
        checkpoint.setHook(address(mc), IBalanceCheckpoint(series));
        mc.addModule(address(checkpoint));

        token.addAgent(series);
        token.addAgent(operator);
        token.unpause();
        vm.stopPrank();

        // Allowlist both coins, grant FX role, post both rates, and have the
        // treasury (operator) pre-approve the series to pull either coin.
        vm.startPrank(operator);
        ISeries(series).addStablecoin(usdc);
        ISeries(series).addStablecoin(usdt);
        ISeries(series).grantRole(keccak256("FX_ROLE"), operator);
        ISeries(series).postRate(usdc, RATE_USDC);
        ISeries(series).postRate(usdt, RATE_USDT);
        IMintableCoin(usdc).approve(series, type(uint256).max);
        IMintableCoin(usdt).approve(series, type(uint256).max);
        vm.stopPrank();

        _registerVerified(operator, 360); // treasury must be a verified holder too
        _screen(alice);
        _screen(bob);
    }

    function _screen(address wallet) internal {
        _registerVerified(wallet, 360);
        address id = address(ir.identity(wallet));
        bytes memory data = abi.encodePacked("SCREENED");
        bytes32 dataHash = keccak256(abi.encode(id, TAWF_SCREENED, data));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(claimIssuerKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(wallet);
        Identity(id).addClaim(TAWF_SCREENED, 1, address(claimIssuer), sig, data, "");
    }

    function _leaf(bytes32 kind, uint256 a, uint256 b) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(LEDGER_CHAIN_ID, kind, SERIES_ID, a, b))));
    }

    function _subscribe(address who, address coin, uint256 coinAmount) internal {
        vm.startPrank(who);
        IMintableCoin(coin).faucet(coinAmount);
        IMintableCoin(coin).approve(series, coinAmount);
        ISeries(series).subscribe(coin, coinAmount);
        vm.stopPrank();
    }

    function _one(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    /// @dev Fund the treasury (operator) with `amount` of each coin so it can
    ///      pay claims and redemptions.
    function _fundTreasury(uint256 amount) internal {
        vm.startPrank(operator);
        IMintableCoin(usdc).faucet(amount);
        IMintableCoin(usdt).faucet(amount);
        vm.stopPrank();
    }

    // --- allowlist -------------------------------------------------------

    function test_allowlistContainsBoth() public {
        address[] memory coins = ISeries(series).allowedStablecoins();
        assertEq(coins.length, 2);
        assertTrue(ISeries(series).isStablecoin(usdc));
        assertTrue(ISeries(series).isStablecoin(usdt));
    }

    function test_subscribeNonAllowlistedReverts() public {
        address other = deployCode("MockUSDC.sol:MockUSDC"); // not allowlisted
        vm.startPrank(alice);
        IMintableCoin(other).faucet(10e6);
        IMintableCoin(other).approve(series, 10e6);
        vm.expectRevert(abi.encodeWithSignature("NotStablecoin(address)", other));
        ISeries(series).subscribe(other, 10e6);
        vm.stopPrank();
    }

    function test_addStablecoinWrongDecimalsReverts() public {
        // The T-REX token is 2 decimals, so adding it as a settlement coin fails.
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("BadDecimals(uint8)", uint8(2)));
        ISeries(series).addStablecoin(address(token));
    }

    function test_removeBlocksNewSubscriptionButAllowsCancel() public {
        // Alice escrows USDT, then USDT is removed.
        _subscribe(alice, usdt, 50e6);
        vm.prank(operator);
        ISeries(series).removeStablecoin(usdt);
        assertTrue(!ISeries(series).isStablecoin(usdt));

        // New subscription in USDT now reverts.
        vm.startPrank(alice);
        IMintableCoin(usdt).faucet(10e6);
        IMintableCoin(usdt).approve(series, 10e6);
        vm.expectRevert(abi.encodeWithSignature("NotStablecoin(address)", usdt));
        ISeries(series).subscribe(usdt, 10e6);
        // But the existing pending escrow can still be cancelled.
        uint256 before = IMintableCoin(usdt).balanceOf(alice);
        ISeries(series).cancelSubscription(usdt);
        vm.stopPrank();
        assertEq(IMintableCoin(usdt).balanceOf(alice), before + 50e6);
        assertEq(ISeries(series).pending(alice, usdt), 0);
    }

    // --- subscribe + allocate -------------------------------------------

    function test_subscribeRequiresEligibility() public {
        address mallory = makeAddr("mallory");
        _registerVerified(mallory, 360); // KYC but no screening claim
        vm.startPrank(mallory);
        IMintableCoin(usdc).faucet(10e6);
        IMintableCoin(usdc).approve(series, 10e6);
        vm.expectRevert(abi.encodeWithSignature("NotEligible(address)", mallory));
        ISeries(series).subscribe(usdc, 10e6);
        vm.stopPrank();
    }

    function test_allocateConvertsEachCoinAtItsRate() public {
        _subscribe(alice, usdc, 60e6);
        _subscribe(alice, usdt, 40e6);
        uint256 sen = (60e6 * RATE_USDC) / 1e6 + (40e6 * RATE_USDT) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
        assertEq(token.balanceOf(alice), sen);
        assertEq(ISeries(series).pending(alice, usdc), 0);
        assertEq(ISeries(series).pending(alice, usdt), 0);
        // Both escrows forwarded to the treasury.
        assertEq(IMintableCoin(usdc).balanceOf(operator), 60e6);
        assertEq(IMintableCoin(usdt).balanceOf(operator), 40e6);
        assertTrue(ISeries(series).isFullyBacked());
    }

    function test_allocateAboveBalanceReverts() public {
        _subscribe(alice, usdc, 100e6);
        uint256 sen = (100e6 * RATE_USDC) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen - 1));
        vm.expectRevert(abi.encodeWithSignature("ReserveInsufficient(uint256,uint256)", sen, sen - 1));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen - 1, noProof);
    }

    function test_allocateWrongReserveProofReverts() public {
        _subscribe(alice, usdc, 100e6);
        uint256 sen = (100e6 * RATE_USDC) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen + 123));
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
    }

    function test_allocateStaleRatePerCoinRejected() public {
        _subscribe(alice, usdt, 100e6);
        uint256 sen = (100e6 * RATE_USDT) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        // Age all rates beyond maxRateAge (1 day). Allocation reads the USDT rate.
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(abi.encodeWithSignature("RateStale(uint64,uint64)", uint64(block.timestamp - 2 days), uint64(1 days)));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
    }

    // --- profit ----------------------------------------------------------

    function _allocate(address who, address coin, uint256 coinAmount) internal returns (uint256 sen) {
        _subscribe(who, coin, coinAmount);
        sen = (coinAmount * ISeries(series).rateOf(coin)) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        vm.prank(operator);
        ISeries(series).allocate(_one(who), e, 1000, sen, noProof);
    }

    function test_distributeAccruesSenAndClaimInUsdc() public {
        _allocate(alice, usdc, 100e6);
        uint256 profitSen = RATE_USDC; // 1 USDC worth at the USDC rate
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, profitSen, e, noProof);
        assertEq(ISeries(series).claimableSen(alice), profitSen);

        _fundTreasury(10e6);
        uint256 before = IMintableCoin(usdc).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).claim(usdc);
        // profitSen / RATE_USDC * 1e6 == 1e6 USDC.
        assertEq(IMintableCoin(usdc).balanceOf(alice) - before, 1e6);
        assertEq(ISeries(series).claimableSen(alice), 0);
    }

    // --- Tawf nisbah ----------------------------------------------------------

    function test_nisbah_splitsProfitAndPaysFeeWallet() public {
        address tawfFee = makeAddr("tawfFee");
        vm.prank(operator);
        ISeries(series).setTawfShare(1500, tawfFee);
        _allocate(alice, usdc, 100e6);

        uint256 profitSen = 100 * RATE_USDC; // 100 USDC worth
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, profitSen, e, noProof);
        assertEq(ISeries(series).claimableSen(alice), (profitSen * 85) / 100);
        assertEq(ISeries(series).tawfShareAccruedSen(), (profitSen * 15) / 100);

        _fundTreasury(100e6);
        ISeries(series).claimTawfShare(usdc);
        assertEq(IMintableCoin(usdc).balanceOf(tawfFee), 15e6);
        assertEq(ISeries(series).tawfSharePaidSen(), ISeries(series).tawfShareAccruedSen());
        vm.expectRevert(abi.encodeWithSignature("NothingToClaim()"));
        ISeries(series).claimTawfShare(usdc);
    }

    function test_nisbah_lockedAfterFirstSubscription() public {
        _subscribe(alice, usdc, 10e6);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("TawfShareLocked()"));
        ISeries(series).setTawfShare(1500, makeAddr("tawfFee"));
    }

    function test_nisbah_capped() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidTerms()"));
        ISeries(series).setTawfShare(5001, makeAddr("tawfFee"));
    }

    function test_claimInUsdtPaysAtUsdtRate() public {
        _allocate(alice, usdc, 100e6);
        uint256 profitSen = RATE_USDT; // 1 USDT worth at the USDT rate
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, profitSen, e, noProof);

        _fundTreasury(10e6);
        uint256 before = IMintableCoin(usdt).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).claim(usdt);
        // profitSen / RATE_USDT * 1e6 == 1e6 USDT, less at most one unit: the
        // accumulator and the sen-to-coin conversion both round down, so the
        // payout can never exceed the anchored profit.
        uint256 paid = IMintableCoin(usdt).balanceOf(alice) - before;
        assertLe(paid, 1e6);
        assertGe(paid, 1e6 - 1);
    }

    function test_distributeWrongProfitProofReverts() public {
        _allocate(alice, usdc, 100e6);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, 999));
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, RATE_USDC, e, noProof);
    }

    function test_profitProRataAcrossTransfer() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        vm.prank(alice);
        token.transfer(bob, sen / 2);

        uint256 profitSen = 2 * RATE_USDC; // 2 USDC worth total
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, profitSen, e, noProof);

        // Each holds half the supply -> each accrues ~1 USDC worth of sen.
        assertEq(ISeries(series).claimableSen(alice), profitSen / 2);
        assertEq(ISeries(series).claimableSen(bob), profitSen / 2);
    }

    // --- maturity --------------------------------------------------------

    function test_maturityAndRedeemInUsdc() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 0), sen));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, 0, sen, e, noProof);

        _fundTreasury(200e6);
        uint256 before = IMintableCoin(usdc).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).redeem(usdc);
        assertEq(token.balanceOf(alice), 0);
        // principal sen -> USDC at the USDC rate == 100e6.
        assertEq(IMintableCoin(usdc).balanceOf(alice) - before, (sen * 1e6) / RATE_USDC);
    }

    function test_maturityAndRedeemInUsdt() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 0), sen));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, 0, sen, e, noProof);

        _fundTreasury(200e6);
        uint256 before = IMintableCoin(usdt).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).redeem(usdt);
        assertEq(token.balanceOf(alice), 0);
        // principal sen -> USDT at the USDT rate.
        assertEq(IMintableCoin(usdt).balanceOf(alice) - before, (sen * 1e6) / RATE_USDT);
    }

    /// @dev The bank returning more than face (e.g. nisbah left in the account)
    ///      must not pay holders more than face: profit is paid once, by
    ///      distributeProfit, never again inside principal.
    function test_maturityPrincipalCappedAtFace() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        uint256 returned = sen + 40_600_00; // face plus IDR 40,600 of nisbah
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 0), returned));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, 0, returned, e, noProof);

        _fundTreasury(200e6);
        uint256 before = IMintableCoin(usdc).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).redeem(usdc);
        assertEq(IMintableCoin(usdc).balanceOf(alice) - before, (sen * 1e6) / RATE_USDC);
    }

    /// @dev Below face, holders share the shortfall pro rata.
    function test_maturityShortfallSharedProRata() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        uint256 returned = sen / 2;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 0), returned));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, 0, returned, e, noProof);

        _fundTreasury(200e6);
        uint256 before = IMintableCoin(usdc).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).redeem(usdc);
        uint256 paid = IMintableCoin(usdc).balanceOf(alice) - before;
        assertLe(paid, (returned * 1e6) / RATE_USDC);
        assertGe(paid + 1, (returned * 1e6) / RATE_USDC);
    }

    // --- fuzz ------------------------------------------------------------

    /// @dev Across subscribe/allocate/profit/maturity, the total paid out,
    ///      valued back in sen at the payout rates, never exceeds the anchored
    ///      profit sen + principal sen.
    function testFuzz_payoutValuedInSenNeverExceedsAnchored(uint96 usdcAmt, uint96 usdtAmt, uint96 profitUsdc) public {
        // Keep within the default per-investor cap (Rp10,000,000 = 1e9 sen):
        // ~600 USDC max each at these rates stays comfortably below.
        usdcAmt = uint96(bound(usdcAmt, 0, 300e6));
        usdtAmt = uint96(bound(usdtAmt, 0, 300e6));
        vm.assume(uint256(usdcAmt) + uint256(usdtAmt) >= 1e6);
        profitUsdc = uint96(bound(profitUsdc, 0, 500e6));

        uint256 sen;
        if (usdcAmt > 0) _subscribe(alice, usdc, usdcAmt);
        if (usdtAmt > 0) _subscribe(alice, usdt, usdtAmt);
        sen = (uint256(usdcAmt) * RATE_USDC) / 1e6 + (uint256(usdtAmt) * RATE_USDT) / 1e6;
        vm.assume(sen > 0);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);

        uint256 profitSen;
        if (profitUsdc > 0) {
            profitSen = (uint256(profitUsdc) * RATE_USDC) / 1e6;
            uint256 ep = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
            vm.prank(operator);
            ISeries(series).distributeProfit(1, profitSen, ep, noProof);
        }

        // Settle maturity at the anchored principal (the minted sen).
        uint32 finalPeriod = profitUsdc > 0 ? 1 : 0;
        uint256 em = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, finalPeriod), sen));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, finalPeriod, sen, em, noProof);

        _fundTreasury(type(uint96).max);

        // Claim profit in USDT, then redeem principal in USDC.
        uint256 claimableSen = ISeries(series).claimableSen(alice);
        uint256 usdtBefore = IMintableCoin(usdt).balanceOf(alice);
        if (claimableSen > 0) {
            vm.prank(alice);
            ISeries(series).claim(usdt);
        }
        uint256 usdtPaid = IMintableCoin(usdt).balanceOf(alice) - usdtBefore;

        uint256 usdcBefore = IMintableCoin(usdc).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).redeem(usdc);
        uint256 usdcPaid = IMintableCoin(usdc).balanceOf(alice) - usdcBefore;

        // Value the payouts back in sen at each payout coin's rate.
        uint256 paidSen = (usdtPaid * RATE_USDT) / 1e6 + (usdcPaid * RATE_USDC) / 1e6;
        // Rounding may only lose base units; never pays more than anchored.
        assertLe(paidSen, profitSen + sen);
    }

    function _packMaturity(uint64 at, uint32 finalPeriod) internal pure returns (uint256) {
        return (uint256(finalPeriod) << 64) | uint256(at);
    }

    /// Maturity cannot open while an anchored profit period is undistributed.
    function test_maturityRequiresAllProfitDistributed() public {
        // The bank recorded one profit period before maturity, so the maturity
        // fact carries finalPeriod 1; it is not distributed here yet.
        uint256 sen = _allocate(alice, usdc, 100e6);
        uint256 em = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 1), sen));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("ProfitPeriodsOutstanding(uint32,uint32)", uint32(0), uint32(1)));
        ISeries(series).settleMaturity(2000, 1, sen, em, noProof);
    }

    /// A finalPeriod that the anchored fact does not carry is refused.
    function test_maturityFinalPeriodMustMatchAnchoredFact() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        // Anchored with finalPeriod 1, but the operator claims 0.
        uint256 em = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 1), sen));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("ProofInvalid()"));
        ISeries(series).settleMaturity(2000, 0, sen, em, noProof);
    }

    /// No profit can be distributed once redemption is open.
    function test_noProfitAfterMaturity() public {
        uint256 sen = _allocate(alice, usdc, 100e6);
        uint256 em = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, _packMaturity(2000, 0), sen));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, 0, sen, em, noProof);

        uint256 ep = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, 100));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("ProfitAfterMaturity()"));
        ISeries(series).distributeProfit(1, 100, ep, noProof);
    }
}
