// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// End-to-end SCF sukuk offering: a SukukDistributor whose token binds both the
// DistributionCheckpointModule and the ScfInvestorLimitModule, verified against an
// operator-gated LedgerAnchor where every fact is a single-leaf root (empty proof).
// Covers open, subscribe within and over the investor limit, close, distribute, claim,
// settle and redeem.

import {TrexFixture} from "../trex/TrexFixture.sol";
import {ScfInvestorLimitModule} from "../../src/scf/ScfInvestorLimitModule.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ISukukDistributor, IMockUSDC} from "../sukuk/SukukDistributor.t.sol";

interface ILedgerAnchorOp {
    function push(bytes32 root) external returns (uint256 epoch);
}

contract ScfSukukFlowTest is TrexFixture {
    bytes32 internal constant SCF_ID = keccak256("tawf.scf.umkm.1");
    bytes32 internal constant APPROVED = keccak256("tawf.sukuk.approved");
    bytes32 internal constant DISTRIBUTION = keccak256("tawf.sukuk.distribution");
    bytes32 internal constant REDEMPTION = keccak256("tawf.sukuk.redemption");
    bytes32 internal constant RESERVE = keccak256("tawf.sukuk.reserve");
    uint256 internal constant LEDGER_CHAIN_ID = 7_142_026;
    uint256 internal constant FACE = 50_000e6;
    uint256 internal constant MIN_RAISE = 500e6;
    uint40 internal constant WINDOW = 30 days;

    address internal usdc;
    address internal anchor;
    ISukukDistributor internal dist;
    ScfInvestorLimitModule internal scf;
    Token internal token;
    ModularCompliance internal mc;

    address internal issuer = makeAddr("smeIssuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    Identity internal aliceId;
    Identity internal bobId;
    uint40 internal maturity;
    bytes32[] internal noProof;

    function setUp() public {
        maturity = uint40(block.timestamp + 365 days);
        _setUpTrex();
        usdc = deployCode("MockUSDC.sol:MockUSDC");
        anchor = deployCode("LedgerAnchor.sol:LedgerAnchor", abi.encode(LEDGER_CHAIN_ID, deployer));

        DistributionCheckpointModule module;
        (token, mc, module) = _deployTrexToken("Sukuk Mudharabah UMKM SCF Demo 2026", "tSCF-UMKM-2026", 6);
        dist = ISukukDistributor(
            deployCode(
                "SukukDistributor.sol:SukukDistributor",
                abi.encode(
                    usdc, anchor, address(ir), address(token), address(module),
                    SCF_ID, FACE, maturity, MIN_RAISE, uint256(10e6), WINDOW, issuer,
                    deployer
                )
            )
        );

        vm.startPrank(deployer);
        scf = new ScfInvestorLimitModule(address(ir));
        scf.initOffering(address(mc), issuer, FACE);
        mc.addModule(address(scf));
        vm.stopPrank();
        _wireDistributor(token, mc, module, address(dist));

        aliceId = _registerVerified(alice, 360);
        bobId = _registerVerified(bob, 360);
        vm.startPrank(deployer);
        scf.setProfile(address(aliceId), 300e6, 1, ScfInvestorLimitModule.Exemption.NONE);
        scf.setProfile(address(bobId), 0, 3, ScfInvestorLimitModule.Exemption.CAPITAL_MARKET_2Y);
        vm.stopPrank();
    }

    function _fact(bytes32 kind, uint256 a, uint256 b) internal returns (uint256 epoch) {
        bytes32 leaf = dist.leafHash(LEDGER_CHAIN_ID, kind, SCF_ID, a, b);
        vm.prank(deployer);
        epoch = ILedgerAnchorOp(anchor).push(leaf);
    }

    function _subscribe(address who, uint256 amount) internal {
        vm.startPrank(who);
        IMockUSDC(usdc).faucet(amount);
        IMockUSDC(usdc).approve(address(dist), amount);
        dist.subscribe(amount);
        vm.stopPrank();
    }

    function _open() internal {
        uint256 e = _fact(APPROVED, FACE, maturity);
        vm.prank(deployer);
        dist.openSubscription(e, noProof);
        uint64 at = uint64(block.timestamp);
        dist.updateReserve(at, FACE, _fact(RESERVE, at, FACE), noProof);
        vm.prank(deployer);
        dist.setMaxReserveAge(45 days);
    }

    function test_anchorIsOperatorGated() public {
        vm.prank(alice);
        vm.expectRevert();
        ILedgerAnchorOp(anchor).push(bytes32(uint256(1)));
    }

    function test_fullFlow_withinLimit() public {
        _open();
        _subscribe(alice, 300e6);
        _subscribe(bob, 700e6);

        vm.startPrank(alice);
        IMockUSDC(usdc).faucet(10e6);
        IMockUSDC(usdc).approve(address(dist), 10e6);
        vm.expectRevert("Compliance not followed");
        dist.subscribe(10e6);
        vm.stopPrank();

        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Active));
        assertEq(IMockUSDC(usdc).balanceOf(issuer), 1_000e6);

        // The SME issuer pays a 50 USDC profit distribution.
        uint256 e = _fact(DISTRIBUTION, 1, 50e6);
        vm.startPrank(issuer);
        IMockUSDC(usdc).faucet(50e6);
        IMockUSDC(usdc).approve(address(dist), type(uint256).max);
        dist.distribute(1, 50e6, e, noProof);
        vm.stopPrank();
        assertEq(dist.claimable(alice), 15e6);
        vm.prank(alice);
        dist.claim();
        assertEq(IMockUSDC(usdc).balanceOf(alice), 15e6 + 10e6);

        // Maturity at par, then redemption.
        vm.warp(maturity);
        e = _fact(REDEMPTION, 1_000e6, 0);
        vm.startPrank(issuer);
        IMockUSDC(usdc).faucet(1_000e6);
        dist.settleMaturity(1_000e6, e, noProof);
        vm.stopPrank();
        vm.prank(bob);
        dist.redeem();
        assertEq(token.balanceOf(bob), 0);
    }
}
