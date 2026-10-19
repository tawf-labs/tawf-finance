// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Full-lifecycle tests for TawfDepositoSeries (Model B) against a real MockLedgerAnchor with real
// single-leaf proofs. Pinned to 0.8.17 for the concrete T-REX + onchain-id contracts; the series
// (^0.8.24), MockLedgerAnchor and MockUSDC (^0.8.20) are reached via vm.deployCode and interfaces.
//
// Covers: subscribe + eligibility, allocate within the anchored balance, ReserveInsufficient above
// it, stale-rate rejection, distribute exactly the anchored profit, wrong-proof rejection, pro-rata
// claims including after a secondary transfer, maturity + redeem, and a fuzz that payouts never
// exceed the funded USDC.

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
uint256 constant RATE = 1_600_000; // 16,000.00 IDR per USDC (two-decimal precision)

interface IAnchor {
    function ledgerChainId() external view returns (uint256);
    function push(bytes32 root) external returns (uint256 epoch);
}

interface ISeries {
    function subscribe(uint256 usdcAmount) external;
    function cancelSubscription() external;
    function allocate(address[] calldata investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] calldata proof) external;
    function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] calldata proof) external;
    function settleMaturity(uint64 at, uint256 principalSen, uint256 epoch, bytes32[] calldata proof) external;
    function claim() external;
    function redeem() external;
    function postRate(uint256 idrPerUsdc) external;
    function grantRole(bytes32 role, address account) external;
    function pending(address investor) external view returns (uint256);
    function claimable(address investor) external view returns (uint256);
    function reserve() external view returns (uint256);
    function isFullyBacked() external view returns (bool);
}

interface IMintableUsdc {
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

        (token, mc,) = _deployTrexToken("Tawf Deposito Series 1 (BPRS Demo)", "tDEP-TAWF-S1", 2);

        vm.startPrank(deployer);
        sandbox = new SandboxModule();
        DistributionCheckpointModule checkpoint = new DistributionCheckpointModule();

        series = deployCode(
            "TawfDepositoSeries.sol:TawfDepositoSeries",
            abi.encode(
                usdc, anchor, address(token), address(checkpoint), address(sandbox), address(mc),
                SERIES_ID, uint8(3), uint16(6000), operator, operator, operator, uint64(1 days)
            )
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

        // FX role + initial rate.
        vm.startPrank(operator);
        ISeries(series).grantRole(keccak256("FX_ROLE"), operator);
        ISeries(series).postRate(RATE);
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

    function _subscribe(address who, uint256 usdcAmount) internal {
        vm.startPrank(who);
        IMintableUsdc(usdc).faucet(usdcAmount);
        IMintableUsdc(usdc).approve(series, usdcAmount);
        ISeries(series).subscribe(usdcAmount);
        vm.stopPrank();
    }

    function _one(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _two(address a, address b) internal pure returns (address[] memory arr) {
        arr = new address[](2);
        arr[0] = a;
        arr[1] = b;
    }

    function _fundTreasury(uint256 amount) internal {
        vm.startPrank(operator);
        IMintableUsdc(usdc).faucet(amount);
        IMintableUsdc(usdc).approve(series, amount);
        vm.stopPrank();
    }

    // --- subscribe + allocate -------------------------------------------

    function test_subscribeRequiresEligibility() public {
        address mallory = makeAddr("mallory");
        _registerVerified(mallory, 360); // KYC but no screening claim
        vm.startPrank(mallory);
        IMintableUsdc(usdc).faucet(10e6);
        IMintableUsdc(usdc).approve(series, 10e6);
        vm.expectRevert(abi.encodeWithSignature("NotEligible(address)", mallory));
        ISeries(series).subscribe(10e6);
        vm.stopPrank();
    }

    function test_allocateWithinBalance() public {
        _subscribe(alice, 100e6);
        uint256 sen = (100e6 * RATE) / 1e6; // 160,000,000
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
        assertEq(token.balanceOf(alice), sen);
        assertEq(ISeries(series).pending(alice), 0);
        assertEq(IMintableUsdc(usdc).balanceOf(operator), 100e6); // escrow forwarded to treasury
        assertTrue(ISeries(series).isFullyBacked());
    }

    function test_allocateAboveBalanceReverts() public {
        _subscribe(alice, 100e6);
        uint256 sen = (100e6 * RATE) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen - 1));
        vm.expectRevert(abi.encodeWithSignature("ReserveInsufficient(uint256,uint256)", sen, sen - 1));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen - 1, noProof);
    }

    function test_allocateWrongReserveProofReverts() public {
        _subscribe(alice, 100e6);
        uint256 sen = (100e6 * RATE) / 1e6;
        // Anchor a different balance; proving `sen` fails.
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen + 123));
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
    }

    function test_allocateStaleRateRejected() public {
        _subscribe(alice, 100e6);
        uint256 sen = (100e6 * RATE) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        // Age the rate beyond maxRateAge (1 day).
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(abi.encodeWithSignature("RateStale(uint64,uint64)", uint64(block.timestamp - 2 days), uint64(1 days)));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
    }

    // --- profit ----------------------------------------------------------

    function _allocateAlice(uint256 usdcAmount) internal returns (uint256 sen) {
        _subscribe(alice, usdcAmount);
        sen = (usdcAmount * RATE) / 1e6;
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_RESERVE, 1000, sen));
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, 1000, sen, noProof);
    }

    function test_distributeExactlyAnchoredProfit() public {
        _allocateAlice(100e6);
        uint256 profitSen = 1_600_000; // -> 1 USDC
        _fundTreasury(1e6);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, profitSen, e, noProof);
        assertEq(ISeries(series).claimable(alice), 1e6);
        vm.prank(alice);
        ISeries(series).claim();
        assertEq(IMintableUsdc(usdc).balanceOf(alice), 1e6);
    }

    function test_distributeWrongProfitProofReverts() public {
        _allocateAlice(100e6);
        _fundTreasury(1e6);
        // Anchor a different profit amount; proving 1_600_000 fails.
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, 999));
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, 1_600_000, e, noProof);
    }

    function test_profitProRataAcrossTransfer() public {
        // Alice allocated 100 USDC worth; she transfers half to Bob before profit.
        uint256 sen = _allocateAlice(100e6);
        vm.prank(alice);
        token.transfer(bob, sen / 2);

        uint256 profitSen = 3_200_000; // -> 2 USDC total
        _fundTreasury(2e6);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
        vm.prank(operator);
        ISeries(series).distributeProfit(1, profitSen, e, noProof);

        // Each holds half the supply -> each claims ~1 USDC.
        assertEq(ISeries(series).claimable(alice), 1e6);
        assertEq(ISeries(series).claimable(bob), 1e6);
    }

    // --- maturity --------------------------------------------------------

    function test_maturityAndRedeem() public {
        uint256 sen = _allocateAlice(100e6);
        uint256 principalUsdc = (sen * 1e6) / RATE; // 100e6
        _fundTreasury(principalUsdc);
        uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_MATURITY, 2000, sen));
        vm.prank(operator);
        ISeries(series).settleMaturity(2000, sen, e, noProof);

        vm.prank(alice);
        ISeries(series).redeem();
        assertEq(token.balanceOf(alice), 0);
        assertEq(IMintableUsdc(usdc).balanceOf(alice), principalUsdc);
    }

    // --- fuzz ------------------------------------------------------------

    /// @dev Across a subscribe/allocate/profit cycle, the USDC paid out can
    ///      never exceed the USDC funded for profit.
    function testFuzz_payoutNeverExceedsFunding(uint96 usdcAmount, uint96 profitUsdc) public {
        // Keep within the default per-investor cap (Rp10,000,000 = 1e9 sen):
        // 1e9 sen / RATE * 1e6 ~= 625 USDC, so bound comfortably below.
        usdcAmount = uint96(bound(usdcAmount, 1e6, 600e6));
        profitUsdc = uint96(bound(profitUsdc, 0, 1_000e6));
        uint256 sen = _allocateAlice(usdcAmount);
        assertGt(sen, 0);

        if (profitUsdc > 0) {
            uint256 profitSen = (uint256(profitUsdc) * RATE) / 1e6;
            _fundTreasury(profitUsdc);
            uint256 e = IAnchor(anchor).push(_leaf(DEPOSITO_PROFIT, 1, profitSen));
            vm.prank(operator);
            ISeries(series).distributeProfit(1, profitSen, e, noProof);
        }

        uint256 claimable = ISeries(series).claimable(alice);
        // Rounding may lose at most 1 base unit; never pays more than funded.
        assertLe(claimable, uint256(profitUsdc));
    }
}
