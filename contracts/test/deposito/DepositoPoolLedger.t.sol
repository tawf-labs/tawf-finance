// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Regional Tawf Deposito Pool: a DepositoPoolLedger holding Tawf's balances at several BPRS is the
// anchor of an unmodified TawfDepositoSeries. Covers the ledger's own rules (operator only, bank
// listing, the total over all banks, per-bank leaves) and the series consuming its facts:
// allocation against the total, rejection above it, profit and maturity.

import {TrexFixture} from "../trex/TrexFixture.sol";
import {SandboxModule} from "../../src/deposito/SandboxModule.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";
import {IBalanceCheckpoint} from "../../src/sukuk/IBalanceCheckpoint.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ISeries, IMintableCoin} from "./TawfDepositoSeries.t.sol";

interface IPoolLedger {
    function addBank(bytes32 bankId, string calldata name, string calldata accountRef) external;
    function postReserve(uint64 at, bytes32[] calldata bankIds, uint256[] calldata balances) external returns (uint256);
    function postProfit(uint32 period, bytes32[] calldata bankIds, uint256[] calldata profits) external returns (uint256, uint256);
    function postMaturity(uint64 at, uint32 finalPeriod, uint256 principal) external returns (uint256);
    function verify(uint256 epoch, bytes32 leaf, bytes32[] calldata proof) external view returns (bool);
    function totalBalance() external view returns (uint256);
    function balanceOf(bytes32 bankId) external view returns (uint256);
    function bankCount() external view returns (uint256);
    function banks() external view returns (bytes32[] memory, string[] memory, string[] memory, uint256[] memory);
    function transferOperator(address newOperator) external;
}

contract DepositoPoolLedgerTest is TrexFixture {
    uint256 internal constant TAWF_SCREENED = 2;
    uint256 internal constant LEDGER_CHAIN_ID = 42;
    bytes32 internal constant SERIES_ID = keccak256("tawf.pool.jabar.1");
    bytes32 internal constant RESERVE = keccak256("tawf.deposito.reserve");
    bytes32 internal constant BANK_BALANCE = keccak256("tawf.deposito.bank-balance");
    bytes32 internal constant BANDUNG = keccak256("bprs.demo.bandung");
    bytes32 internal constant BOGOR = keccak256("bprs.demo.bogor");
    bytes32 internal constant CIREBON = keccak256("bprs.demo.cirebon");
    uint256 internal constant RATE_USDC = 1_625_000;

    IPoolLedger internal ledger;
    address internal series;
    address internal usdc;
    address internal usdt;
    Token internal token;
    ModularCompliance internal mc;
    address internal operator;
    address internal alice = makeAddr("alice");
    bytes32[] internal noProof;

    function setUp() public {
        operator = deployer;
        _setUpTrex();
        vm.startPrank(deployer);
        uint256[] memory topics = new uint256[](2);
        topics[0] = KYC_TOPIC;
        topics[1] = TAWF_SCREENED;
        tir.removeTrustedIssuer(claimIssuer);
        tir.addTrustedIssuer(claimIssuer, topics);
        vm.stopPrank();

        ledger = IPoolLedger(deployCode("DepositoPoolLedger.sol:DepositoPoolLedger", abi.encode(LEDGER_CHAIN_ID, SERIES_ID, operator)));
        usdc = deployCode("MockUSDC.sol:MockUSDC");
        usdt = deployCode("MockUSDT.sol:MockUSDT");
        (token, mc,) = _deployTrexToken("Tawf Deposito Pool: Jawa Barat", "tDEP-JABAR-1", 2);

        vm.startPrank(deployer);
        SandboxModule sandbox = new SandboxModule();
        DistributionCheckpointModule checkpoint = new DistributionCheckpointModule();
        series = deployCode(
            "TawfDepositoSeries.sol:TawfDepositoSeries",
            abi.encode(
                address(ledger), address(token), address(checkpoint), address(sandbox), address(mc),
                SERIES_ID, uint8(3), uint16(6000), operator, operator, operator, uint64(1 days)
            )
        );
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

        ledger.addBank(BANDUNG, "BPRS Demo Bandung", "TAWF-JB-BDG");
        ledger.addBank(BOGOR, "BPRS Demo Bogor", "TAWF-JB-BGR");
        ledger.addBank(CIREBON, "BPRS Demo Cirebon", "TAWF-JB-CRB");

        ISeries(series).addStablecoin(usdc);
        ISeries(series).grantRole(keccak256("FX_ROLE"), operator);
        ISeries(series).postRate(usdc, RATE_USDC);
        IMintableCoin(usdc).approve(series, type(uint256).max);
        vm.stopPrank();

        _registerVerified(operator, 360);
        _screen(alice);
    }

    function _screen(address wallet) internal {
        _registerVerified(wallet, 360);
        address id = address(ir.identity(wallet));
        bytes memory data = abi.encodePacked("SCREENED");
        bytes32 dataHash = keccak256(abi.encode(id, TAWF_SCREENED, data));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(claimIssuerKey, prefixed);
        vm.prank(wallet);
        Identity(id).addClaim(TAWF_SCREENED, 1, address(claimIssuer), abi.encodePacked(r, s, v), data, "");
    }

    function _leaf(bytes32 kind, bytes32 subject, uint256 a, uint256 b) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(LEDGER_CHAIN_ID, kind, subject, a, b))));
    }

    function _reserve(uint256 bdg, uint256 bgr, uint256 crb) internal returns (uint256 epoch, uint64 at) {
        bytes32[] memory ids = new bytes32[](3);
        ids[0] = BANDUNG;
        ids[1] = BOGOR;
        ids[2] = CIREBON;
        uint256[] memory bals = new uint256[](3);
        bals[0] = bdg;
        bals[1] = bgr;
        bals[2] = crb;
        at = uint64(block.timestamp);
        vm.prank(operator);
        epoch = ledger.postReserve(at, ids, bals);
    }

    function _one(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    // --- ledger rules -------------------------------------------------------

    function test_onlyOperator() public {
        bytes32[] memory ids = new bytes32[](0);
        uint256[] memory bals = new uint256[](0);
        vm.startPrank(alice);
        vm.expectRevert();
        ledger.addBank(keccak256("x"), "X", "X");
        vm.expectRevert();
        ledger.postReserve(uint64(block.timestamp), ids, bals);
        vm.expectRevert();
        ledger.postMaturity(uint64(block.timestamp), 1, 1);
        vm.stopPrank();
    }

    function test_duplicateOrUnknownBankReverts() public {
        vm.startPrank(operator);
        vm.expectRevert();
        ledger.addBank(BANDUNG, "dup", "dup");
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = keccak256("unknown");
        uint256[] memory bals = new uint256[](1);
        vm.expectRevert();
        ledger.postReserve(uint64(block.timestamp), ids, bals);
        vm.stopPrank();
    }

    function test_totalIsSumAndLeavesVerify() public {
        (uint256 epoch, uint64 at) = _reserve(100_00, 250_00, 50_00);
        assertEq(ledger.totalBalance(), 400_00);
        assertTrue(ledger.verify(epoch, _leaf(RESERVE, SERIES_ID, at, 400_00), noProof));
        assertTrue(ledger.verify(epoch, _leaf(BANK_BALANCE, BOGOR, at, 250_00), noProof));
        assertFalse(ledger.verify(epoch, _leaf(RESERVE, SERIES_ID, at, 401_00), noProof));
        assertFalse(ledger.verify(epoch + 1, _leaf(RESERVE, SERIES_ID, at, 400_00), noProof));
        (bytes32[] memory ids,,, uint256[] memory bals) = ledger.banks();
        assertEq(ids.length, 3);
        assertEq(bals[1], 250_00);
    }

    function test_partialUpdateKeepsOtherBanks() public {
        _reserve(100_00, 250_00, 50_00);
        vm.warp(block.timestamp + 1 days);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = CIREBON;
        uint256[] memory bals = new uint256[](1);
        bals[0] = 150_00;
        vm.prank(operator);
        uint256 epoch = ledger.postReserve(uint64(block.timestamp), ids, bals);
        assertEq(ledger.totalBalance(), 500_00);
        assertTrue(ledger.verify(epoch, _leaf(BANK_BALANCE, BANDUNG, block.timestamp, 100_00), noProof));
    }

    function test_staleOrFutureSnapshotReverts() public {
        vm.warp(10 days);
        _reserve(1, 1, 1);
        bytes32[] memory ids = new bytes32[](0);
        uint256[] memory bals = new uint256[](0);
        vm.startPrank(operator);
        vm.expectRevert();
        ledger.postReserve(uint64(block.timestamp - 1), ids, bals);
        vm.expectRevert();
        ledger.postReserve(uint64(block.timestamp + 1), ids, bals);
        vm.stopPrank();
    }

    // --- series against the pool ledger -------------------------------------

    function test_seriesAllocatesAgainstTotalAndRejectsAbove() public {
        // 100 USDC = Rp1,625,000 = 162,500,000 sen.
        vm.startPrank(alice);
        IMintableCoin(usdc).faucet(100e6);
        IMintableCoin(usdc).approve(series, 100e6);
        ISeries(series).subscribe(usdc, 100e6);
        vm.stopPrank();

        // Total below the supply the allocation would mint: rejected.
        (uint256 low, uint64 atLow) = _reserve(50_000_000, 50_000_000, 50_000_000);
        vm.prank(operator);
        vm.expectRevert();
        ISeries(series).allocate(_one(alice), low, atLow, 150_000_000, noProof);

        // Enough across the three banks: allocated.
        (uint256 ok, uint64 at) = _reserve(100_000_000, 50_000_000, 50_000_000);
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), ok, at, 200_000_000, noProof);
        assertEq(token.balanceOf(alice), 162_500_000);
        assertEq(ISeries(series).reserve(), 200_000_000);

        // A balance the ledger never recorded does not verify.
        vm.prank(operator);
        vm.expectRevert();
        ISeries(series).allocate(_one(alice), ok, at, 999_000_000, noProof);
    }

    function test_profitAndMaturityFlowToSeries() public {
        vm.startPrank(alice);
        IMintableCoin(usdc).faucet(100e6);
        IMintableCoin(usdc).approve(series, 100e6);
        ISeries(series).subscribe(usdc, 100e6);
        vm.stopPrank();
        (uint256 e, uint64 at) = _reserve(100_000_000, 50_000_000, 50_000_000);
        vm.prank(operator);
        ISeries(series).allocate(_one(alice), e, at, 200_000_000, noProof);

        // Each bank credits profit for period 1: the pool total is distributed.
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = BANDUNG;
        ids[1] = BOGOR;
        uint256[] memory profits = new uint256[](2);
        profits[0] = 600_000;
        profits[1] = 400_000;
        vm.startPrank(operator);
        (uint256 pe, uint256 total) = ledger.postProfit(1, ids, profits);
        assertEq(total, 1_000_000);
        ISeries(series).distributeProfit(1, total, pe, noProof);
        vm.stopPrank();
        uint256 claimable = ISeries(series).claimableSen(alice);
        assertGt(claimable, 0);
        assertLe(claimable, 1_000_000);

        // Maturity at par across the pool.
        uint64 mAt = uint64(block.timestamp + 90 days);
        vm.warp(mAt);
        vm.startPrank(operator);
        uint256 me = ledger.postMaturity(mAt, 1, 162_500_000);
        ISeries(series).settleMaturity(mAt, 1, 162_500_000, me, noProof);
        IMintableCoin(usdc).faucet(1_000e6);
        ISeries(series).postRate(usdc, RATE_USDC); // a fresh rate for the payout
        vm.stopPrank();
        uint256 before = IMintableCoin(usdc).balanceOf(alice);
        vm.prank(alice);
        ISeries(series).redeem(usdc);
        assertEq(token.balanceOf(alice), 0);
        assertGt(IMintableCoin(usdc).balanceOf(alice), before);
    }

    function test_transferOperator() public {
        vm.prank(operator);
        ledger.transferOperator(alice);
        vm.prank(alice);
        ledger.addBank(keccak256("bprs.demo.depok"), "BPRS Demo Depok", "TAWF-JB-DPK");
        assertEq(ledger.bankCount(), 4);
    }
}
