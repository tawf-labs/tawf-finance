// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Pinned to 0.8.17 because it drives the concrete T-REX token + ONCHAINID identities. The
// SukukDistributor (^0.8.20), MockUSDC (^0.8.20), and a MerkleProof-based MockLedgerAnchor
// (^0.8.20) are reached via vm.deployCode and minimal interfaces.

import {TrexFixture} from "../trex/TrexFixture.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";

bytes32 constant SUKUK = keccak256("SUKUK-001");
bytes32 constant APPROVED = keccak256("tawf.sukuk.approved");
bytes32 constant DISTRIBUTION = keccak256("tawf.sukuk.distribution");
bytes32 constant REDEMPTION = keccak256("tawf.sukuk.redemption");
bytes32 constant DEFAULT = keccak256("tawf.sukuk.default");
bytes32 constant RESERVE = keccak256("tawf.sukuk.reserve");
bytes32 constant RESOLUTION = keccak256("tawf.sukuk.profit-resolution");
bytes32 constant SWEEP_DEST = keccak256("tawf.sukuk.sweep-destination");

uint256 constant LEDGER_CHAIN_ID = 99_999;
uint256 constant FACE = 500_000e6;
uint256 constant MIN_RAISE = 100_000e6;
uint256 constant MIN_SUB = 10e6;
uint40 constant WINDOW = 14 days;

function _coins1(address c) pure returns (address[] memory a) {
    a = new address[](1);
    a[0] = c;
}

/// @dev Minimal view of the deployCode'd SukukDistributor (^0.8.20).
interface ISukukDistributor {
    enum Status {
        Pending,
        Subscription,
        Active,
        Matured,
        Defaulted,
        Cancelled
    }

    function status() external view returns (Status);
    function token() external view returns (address);
    function ADMIN_ROLE() external view returns (bytes32);
    function leafHash(uint256, bytes32, bytes32, uint256, uint256) external pure returns (bytes32);
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external;
    function subscribe(address coin, uint256 amount) external;
    function closeSubscription() external;
    function refund() external;
    function distribute(uint16 period, address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof) external;
    function claim(address coin) external;
    function claimable(address) external view returns (uint256);
    function profitPerToken() external view returns (uint256);
    function lastPeriod() external view returns (uint16);
    function settleMaturity(address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof) external;
    function releaseHeldProfit(uint16 index, address coin, uint256 amount, uint256 epoch, bytes32[] calldata proof) external;
    function claimProfit(address coin) external;
    function claimableHeldProfit(address holder) external view returns (uint256);
    function entitledUnits(address holder) external view returns (uint256);
    function totalUnitsAtMaturity() external view returns (uint256);
    function totalHeldReleased() external view returns (uint256);
    function totalHeldClaimed() external view returns (uint256);
    function totalHeldSwept() external view returns (uint256);
    function heldBalance() external view returns (uint256);
    function setSweepDestination(address destination, uint256 epoch, bytes32[] calldata proof) external;
    function sweepUnclaimed() external;
    function sweepDestination() external view returns (address);
    function setClaimWindow(uint256 window) external;
    function settleDefault(address coin, uint256 recovery, uint256 epoch, bytes32[] calldata proof) external;
    function redeem(address coin) external;
    function updateReserve(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] calldata proof) external;
    function reserveSnapshotAt() external view returns (uint64);
    function maxReserveAge() external view returns (uint64);
    function setMaxReserveAge(uint64 maxAge) external;
    function reserveOf() external view returns (uint256);
    function isFullyBacked() external view returns (bool);
    function setTawfShare(uint16 nisbahBps, address recipient) external;
    function tawfNisbahBps() external view returns (uint16);
    function totalTawfShare() external view returns (uint256);
}

/// @dev Minimal MockUSDC / MockLedgerAnchor views.
interface IMockUSDC {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

interface IFunderRole {
    function FUNDER_ROLE() external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
}

interface IMockLedgerAnchor {
    function ledgerChainId() external view returns (uint256);
    function push(bytes32 root) external returns (uint256 epoch);
}

contract SukukDistributorTest is TrexFixture {
    address usdc;
    address anchor;
    ISukukDistributor dist;
    Token token;
    ModularCompliance mc;
    DistributionCheckpointModule module;

    address owner = address(0xA11CE); // reuse deployer as admin for simplicity
    address bank = makeAddr("bank");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address stranger = makeAddr("stranger");

    uint40 maturity;
    bytes32[] noProof;

    function setUp() public {
        maturity = uint40(block.timestamp + 365 days);
        _setUpTrex(); // deployer == owner == 0xA11CE holds every role

        usdc = deployCode("MockUSDC.sol:MockUSDC");
        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(LEDGER_CHAIN_ID));

        // Token + compliance + module (hook set after distributor exists).
        (token, mc, module) = _deployTrexToken("Tawf Sukuk Ijarah 001", "TSI001", 6);

        // Distributor (admin = deployer/owner).
        dist = ISukukDistributor(
            _deployProxy(
                "SukukDistributor.sol:SukukDistributor",
                abi.encodePacked(DIST_INIT, abi.encode(
                    _coins1(usdc),
                    anchor,
                    address(ir),
                    address(token),
                    address(module),
                    SUKUK, FACE, maturity, MIN_RAISE, MIN_SUB, WINDOW, treasury,
                    deployer))
            )
        );
        _wireDistributor(token, mc, module, address(dist));

        // Verified investors.
        _registerVerified(alice, 360);
        _registerVerified(bob, 360);

        vm.prank(bank);
        IMockUSDC(usdc).approve(address(dist), type(uint256).max);
        bytes32 funder = IFunderRole(address(dist)).FUNDER_ROLE();
        vm.prank(deployer);
        IFunderRole(address(dist)).grantRole(funder, bank);
    }

    // --- helpers ---------------------------------------------------------


    function _leaf(bytes32 kind, uint256 a, uint256 b) internal view returns (bytes32) {
        return dist.leafHash(LEDGER_CHAIN_ID, kind, SUKUK, a, b);
    }

    function _anchor(bytes32 kind, uint256 a, uint256 b) internal returns (uint256) {
        return IMockLedgerAnchor(anchor).push(_leaf(kind, a, b));
    }

    function _open() internal {
        uint256 epoch = _anchor(APPROVED, FACE, maturity);
        vm.prank(deployer);
        dist.openSubscription(epoch, noProof);
        _postReserve(FACE);
    }

    /// @dev Post a verified reserve snapshot taken now (subscription and
    ///      close require a recent snapshot that covers the supply).
    function _postReserve(uint256 outstanding) internal {
        uint64 at = uint64(block.timestamp);
        if (at <= dist.reserveSnapshotAt()) at = dist.reserveSnapshotAt() + 1;
        uint256 epoch = _anchor(RESERVE, at, outstanding);
        dist.updateReserve(at, outstanding, epoch, noProof);
    }

    function _subscribe(address investor, uint256 amount) internal {
        vm.startPrank(investor);
        IMockUSDC(usdc).faucet(amount);
        IMockUSDC(usdc).approve(address(dist), amount);
        dist.subscribe(usdc, amount);
        vm.stopPrank();
    }

    function _issue() internal {
        _open();
        _subscribe(alice, 300_000e6);
        _subscribe(bob, 100_000e6);
        vm.warp(block.timestamp + WINDOW);
        _postReserve(FACE);
        vm.prank(deployer);
        dist.closeSubscription();
    }

    function _distribute(uint16 period, uint256 amount) internal {
        uint256 epoch = _anchor(DISTRIBUTION, period, amount);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(amount);
        dist.distribute(period, usdc, amount, epoch, noProof);
        vm.stopPrank();
    }

    // --- leaf encoding ---------------------------------------------------

    /// @dev Golden vector. tawf-network asserts the same value against LedgerLeaf.hash.
    function test_goldenLeaf() public view {
        assertEq(
            dist.leafHash(LEDGER_CHAIN_ID, DISTRIBUTION, SUKUK, 1, 1_000e6),
            0x1a6c2c36d0ef5264983245b9eb2d892fbbae01358bb9c2369ce126444eeadb95
        );
    }

    // --- subscription ----------------------------------------------------

    function test_openRequiresAnchoredApprovalWithExactTerms() public {
        uint256 epoch = _anchor(APPROVED, FACE + 1, maturity);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(deployer);
        dist.openSubscription(epoch, noProof);
    }

    function test_openIsAdminOnly() public {
        uint256 epoch = _anchor(APPROVED, FACE, maturity);
        vm.expectRevert(); // OZ v5 AccessControlUnauthorizedAccount
        vm.prank(stranger);
        dist.openSubscription(epoch, noProof);
    }

    function test_subscribeMintsOneForOne() public {
        _open();
        _subscribe(alice, 300_000e6);
        assertEq(token.balanceOf(alice), 300_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(address(dist)), 300_000e6);
        assertEq(token.decimals(), 6);
    }

    function test_subscribeBeforeOpenReverts() public {
        vm.expectRevert(abi.encodeWithSignature("WrongStatus(uint8)", uint8(ISukukDistributor.Status.Pending)));
        vm.prank(alice);
        dist.subscribe(usdc, MIN_SUB);
    }

    function test_subscribeRequiresKyc() public {
        _open();
        vm.startPrank(carol);
        IMockUSDC(usdc).faucet(MIN_SUB);
        IMockUSDC(usdc).approve(address(dist), MIN_SUB);
        vm.expectRevert(abi.encodeWithSignature("NotEligible(address)", carol));
        dist.subscribe(usdc, MIN_SUB);
        vm.stopPrank();
    }

    function test_subscribeBounds() public {
        _open();
        vm.startPrank(alice);
        IMockUSDC(usdc).faucet(FACE + 1);
        IMockUSDC(usdc).approve(address(dist), FACE + 1);
        vm.expectRevert(bytes4(keccak256("BelowMinimum()")));
        dist.subscribe(usdc, MIN_SUB - 1);
        vm.expectRevert(bytes4(keccak256("ExceedsFaceValue()")));
        dist.subscribe(usdc, FACE + 1);
        vm.stopPrank();

        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(bytes4(keccak256("SubscriptionClosed()")));
        vm.prank(alice);
        dist.subscribe(usdc, MIN_SUB);
    }

    function test_closeReleasesProceedsToIssuer() public {
        _issue();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Active));
        assertEq(IMockUSDC(usdc).balanceOf(treasury), 400_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(address(dist)), 0);
    }

    function test_closeEarlyOnlyWhenFullySubscribed() public {
        _open();
        _subscribe(alice, 300_000e6);
        vm.expectRevert(bytes4(keccak256("SubscriptionStillOpen()")));
        vm.prank(deployer);
        dist.closeSubscription();

        _subscribe(bob, 200_000e6);
        vm.prank(deployer);
        dist.closeSubscription();
        assertEq(IMockUSDC(usdc).balanceOf(treasury), FACE);
    }

    function test_missedMinimumCancelsAndRefundsAtPar() public {
        _open();
        _subscribe(alice, 50_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Cancelled));
        assertEq(IMockUSDC(usdc).balanceOf(treasury), 0);

        vm.prank(alice);
        dist.refund();
        assertEq(IMockUSDC(usdc).balanceOf(alice), 50_000e6);
        assertEq(token.totalSupply(), 0);

        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(alice);
        dist.refund();
    }

    // --- reserve gating --------------------------------------------------

    function test_updateReserveStrictlyNewerAndCapsSupply() public {
        _open();
        // Reserve snapshot at t=100 with outstanding 250k caps the issue below face.
        uint256 epoch = _anchor(RESERVE, 100, 250_000e6);
        dist.updateReserve(100, 250_000e6, epoch, noProof);
        assertEq(dist.reserveOf(), 250_000e6);

        // Subscription beyond the reserve cap reverts.
        _subscribe(alice, 250_000e6);
        vm.startPrank(bob);
        IMockUSDC(usdc).faucet(MIN_SUB);
        IMockUSDC(usdc).approve(address(dist), MIN_SUB);
        vm.expectRevert(abi.encodeWithSignature("ReserveInsufficient(uint256,uint256)", 250_000e6 + MIN_SUB, 250_000e6));
        dist.subscribe(usdc, MIN_SUB);
        vm.stopPrank();

        // A stale snapshot (not strictly newer) reverts.
        uint256 epochStale = _anchor(RESERVE, 100, 300_000e6);
        vm.expectRevert(abi.encodeWithSignature("StaleReserve(uint64,uint64)", uint64(100), uint64(100)));
        dist.updateReserve(100, 300_000e6, epochStale, noProof);

        // A newer snapshot raising the cap is accepted.
        uint256 epochNew = _anchor(RESERVE, 200, 300_000e6);
        dist.updateReserve(200, 300_000e6, epochNew, noProof);
        assertEq(dist.reserveOf(), 300_000e6);
        assertTrue(dist.isFullyBacked());
    }


    // --- reserve freshness ------------------------------------------------

    function _openWithoutReserve() internal {
        uint256 epoch = _anchor(APPROVED, FACE, maturity);
        vm.prank(deployer);
        dist.openSubscription(epoch, noProof);
    }

    function _fundAndApprove(address investor, uint256 amount) internal {
        vm.startPrank(investor);
        IMockUSDC(usdc).faucet(amount);
        IMockUSDC(usdc).approve(address(dist), amount);
        vm.stopPrank();
    }

    function test_subscribeRequiresAReserveSnapshot() public {
        _openWithoutReserve();
        _fundAndApprove(alice, MIN_SUB);
        vm.expectRevert(abi.encodeWithSignature("NoReserveSnapshot()"));
        vm.prank(alice);
        dist.subscribe(usdc, MIN_SUB);
    }

    function test_subscribeRejectsAStaleSnapshot() public {
        _open(); // posts a snapshot taken now
        vm.warp(block.timestamp + 3 days + 1);
        _fundAndApprove(alice, 2 * MIN_SUB);
        uint64 at = dist.reserveSnapshotAt();
        vm.expectRevert(abi.encodeWithSignature("ReserveTooOld(uint64,uint64)", at, uint64(3 days)));
        vm.prank(alice);
        dist.subscribe(usdc, MIN_SUB);

        // A fresh snapshot lets subscriptions continue.
        _postReserve(FACE);
        vm.prank(alice);
        dist.subscribe(usdc, MIN_SUB);
    }

    function test_maxReserveAgeIsAdminConfigurable() public {
        vm.expectRevert();
        vm.prank(alice);
        dist.setMaxReserveAge(1 days);

        vm.prank(deployer);
        dist.setMaxReserveAge(1 days);
        assertEq(dist.maxReserveAge(), 1 days);

        vm.expectRevert(abi.encodeWithSignature("InvalidMaxAge()"));
        vm.prank(deployer);
        dist.setMaxReserveAge(0);
    }

    function test_closeRejectsAStaleSnapshotButCancelStillRefunds() public {
        _open();
        _subscribe(alice, 300_000e6);
        _subscribe(bob, 100_000e6);
        vm.warp(block.timestamp + WINDOW);
        // The snapshot from opening is now older than maxReserveAge.
        vm.expectRevert();
        vm.prank(deployer);
        dist.closeSubscription();
    }

    function test_cancelBelowMinRaiseNeedsNoReserve() public {
        _open();
        _subscribe(alice, MIN_SUB); // below MIN_RAISE
        vm.warp(block.timestamp + WINDOW + 30 days); // reserve long stale
        vm.prank(deployer);
        dist.closeSubscription(); // cancels; refunds must not depend on the reserve
        vm.prank(alice);
        dist.refund();
        assertEq(IMockUSDC(usdc).balanceOf(alice), MIN_SUB);
    }


    // --- Tawf nisbah ----------------------------------------------------------

    address tawfFee = makeAddr("tawfFee");

    function _setShare(uint16 bps) internal {
        vm.prank(deployer);
        dist.setTawfShare(bps, tawfFee);
    }

    function test_nisbah_splitsDistribution() public {
        _setShare(1500);
        _issue();
        _distribute(1, 1_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(tawfFee), 150e6);
        assertEq(dist.totalTawfShare(), 150e6);
        // Holders share the remaining 850 pro rata (3:1).
        assertEq(dist.claimable(alice), 637_500_000);
        assertEq(dist.claimable(bob), 212_500_000);
    }

    function test_nisbah_lockedOnceSubscriptionOpens() public {
        _open();
        vm.prank(deployer);
        vm.expectRevert();
        dist.setTawfShare(1500, tawfFee);
    }

    function test_nisbah_capped() public {
        vm.prank(deployer);
        vm.expectRevert();
        dist.setTawfShare(5001, tawfFee);
    }

    function test_nisbah_neverOnHeldProfit() public {
        _setShare(1500);
        _issue();
        _mature();
        _release(1, 1_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(tawfFee), 0);
        assertEq(_claim(alice) + _claim(bob), 1_000e6);
    }

    function test_nisbah_feeWalletCannotBeSweepDestination() public {
        _setShare(1500);
        _issue();
        _mature();
        uint256 epoch = _anchor(SWEEP_DEST, uint256(uint160(tawfFee)), 0);
        vm.expectRevert();
        dist.setSweepDestination(tawfFee, epoch, noProof);
    }

    // --- profit held at a flagged maturity --------------------------------

    function _mature() internal {
        uint256 epoch = _anchor(REDEMPTION, 400_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(400_000e6);
        dist.settleMaturity(usdc, 400_000e6, epoch, noProof);
        vm.stopPrank();
    }

    function _release(uint16 index, uint256 amount) internal {
        uint256 epoch = _anchor(RESOLUTION, amount, index);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(amount);
        dist.releaseHeldProfit(index, usdc, amount, epoch, noProof);
        vm.stopPrank();
    }

    function _claim(address who) internal returns (uint256 paid) {
        uint256 before = IMockUSDC(usdc).balanceOf(who);
        vm.prank(who);
        dist.claimProfit(usdc);
        paid = IMockUSDC(usdc).balanceOf(who) - before;
    }

    function test_transfersFreezeAtMaturity() public {
        _issue();
        _mature();
        assertEq(dist.totalUnitsAtMaturity(), 400_000e6);
        vm.expectRevert();
        vm.prank(alice);
        token.transfer(bob, 1e6);
    }

    function test_heldProfitIsProRataAndSurvivesRedemption() public {
        _issue();
        _mature();
        // Alice redeems before any release; her entitlement survives the burn.
        vm.prank(alice);
        dist.redeem(usdc);
        assertEq(token.balanceOf(alice), 0);
        assertEq(dist.entitledUnits(alice), 300_000e6);

        _release(1, 4_000e6);
        assertEq(_claim(alice), 3_000e6);
        assertEq(_claim(bob), 1_000e6);

        // A second, partial release adds to the accumulator.
        _release(2, 2_000e6);
        assertEq(_claim(alice), 1_500e6);
        assertEq(_claim(bob), 500e6);

        // Nobody can claim more than their pro-rata share.
        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(alice);
        dist.claimProfit(usdc);

        assertEq(dist.totalHeldReleased(), dist.totalHeldClaimed() + dist.heldBalance() + dist.totalHeldSwept());
    }

    function test_releaseIsSequentialAndProven() public {
        _issue();
        _mature();
        uint256 epoch = _anchor(RESOLUTION, 1_000e6, 2);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(1_000e6);
        vm.expectRevert(abi.encodeWithSignature("ReleaseNotSequential(uint16,uint16)", uint16(1), uint16(2)));
        dist.releaseHeldProfit(2, usdc, 1_000e6, epoch, noProof);
        // Index 1 with an amount the ledger did not record fails the proof.
        vm.expectRevert(abi.encodeWithSignature("ProofInvalid()"));
        dist.releaseHeldProfit(1, usdc, 1_000e6, epoch, noProof);
        vm.stopPrank();
    }

    function test_sweepOnlyAfterWindowAndOnlyToApprovedDestination() public {
        _issue();
        _mature();
        _release(1, 4_000e6);
        assertEq(_claim(alice), 3_000e6); // bob leaves his 1,000 unclaimed

        address waqf = makeAddr("waqf");
        // The issuer treasury is never an acceptable destination.
        uint256 eT = _anchor(SWEEP_DEST, uint256(uint160(treasury)), 0);
        vm.expectRevert(abi.encodeWithSignature("InvalidSweepDestination(address)", treasury));
        dist.setSweepDestination(treasury, eT, noProof);
        // A destination the board did not approve fails the proof.
        uint256 eW = _anchor(SWEEP_DEST, uint256(uint160(waqf)), 0);
        vm.expectRevert(abi.encodeWithSignature("ProofInvalid()"));
        dist.setSweepDestination(makeAddr("not-approved"), eW, noProof);
        dist.setSweepDestination(waqf, eW, noProof);

        vm.expectRevert();
        vm.prank(deployer);
        dist.sweepUnclaimed(); // window still open

        vm.warp(block.timestamp + 365 days);
        vm.prank(deployer);
        dist.sweepUnclaimed();
        assertEq(IMockUSDC(usdc).balanceOf(waqf), 1_000e6);
        assertEq(dist.heldBalance(), 0);

        // Swept profit is no longer claimable.
        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(bob);
        dist.claimProfit(usdc);
        assertEq(dist.totalHeldReleased(), dist.totalHeldClaimed() + dist.heldBalance() + dist.totalHeldSwept());
    }


    function testFuzz_heldClaimsNeverExceedReleased(uint96 a, uint96 b, uint96 r1, uint96 r2) public {
        uint256 aliceAmt = bound(uint256(a), MIN_SUB, 300_000e6);
        uint256 bobAmt = bound(uint256(b), MIN_SUB, 100_000e6);
        if (aliceAmt + bobAmt < MIN_RAISE) aliceAmt = MIN_RAISE;
        uint256 rel1 = bound(uint256(r1), 1, 50_000e6);
        uint256 rel2 = bound(uint256(r2), 1, 50_000e6);

        _open();
        _subscribe(alice, aliceAmt);
        _subscribe(bob, bobAmt);
        vm.warp(block.timestamp + WINDOW);
        _postReserve(FACE);
        vm.prank(deployer);
        dist.closeSubscription();

        uint256 total = aliceAmt + bobAmt;
        uint256 epoch = _anchor(REDEMPTION, total, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(total);
        dist.settleMaturity(usdc, total, epoch, noProof);
        vm.stopPrank();

        _release(1, rel1);
        vm.prank(bob);
        dist.redeem(usdc);
        _release(2, rel2);

        uint256 paid;
        if (dist.claimableHeldProfit(alice) > 0) paid += _claim(alice);
        if (dist.claimableHeldProfit(bob) > 0) paid += _claim(bob);

        assertLe(paid, rel1 + rel2, "claims exceeded releases");
        // Rounding dust is at most one unit per holder per release.
        assertLe(rel1 + rel2 - paid, 4, "more than rounding dust left unpaid");
        assertEq(dist.totalHeldReleased(), dist.totalHeldClaimed() + dist.heldBalance() + dist.totalHeldSwept());
    }

    function test_sweepNeedsADestination() public {
        _issue();
        _mature();
        _release(1, 4_000e6);
        vm.warp(block.timestamp + 365 days);
        vm.expectRevert(abi.encodeWithSignature("SweepDestinationNotSet()"));
        vm.prank(deployer);
        dist.sweepUnclaimed();
    }

    // --- transfers (T-REX verification) ---------------------------------

    function test_transferBetweenVerifiedHoldersWorks() public {
        _issue();
        vm.prank(alice);
        token.transfer(bob, 50_000e6);
        assertEq(token.balanceOf(bob), 150_000e6);
        assertEq(token.balanceOf(alice), 250_000e6);
    }

    function test_transferToUnverifiedReverts() public {
        _issue();
        vm.expectRevert(bytes("Transfer not possible"));
        vm.prank(alice);
        token.transfer(carol, 1e6);
    }

    // --- distribution ----------------------------------------------------

    function test_distributeRequiresProofOfDeclaredAmount() public {
        _issue();
        uint256 epoch = _anchor(DISTRIBUTION, 1, 8_000e6);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(9_000e6);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        dist.distribute(1, usdc, 9_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(dist.profitPerToken(), 0);
    }

    function test_distributePaysProRata() public {
        _issue();
        _distribute(1, 8_000e6);
        assertEq(dist.claimable(alice), 6_000e6);
        assertEq(dist.claimable(bob), 2_000e6);

        vm.prank(alice);
        dist.claim(usdc);
        assertEq(IMockUSDC(usdc).balanceOf(alice), 6_000e6);
        assertEq(dist.claimable(alice), 0);

        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(alice);
        dist.claim(usdc);
    }

    function test_periodsAreSequentialAndNotReplayable() public {
        _issue();
        uint256 epoch2 = _anchor(DISTRIBUTION, 2, 8_000e6);
        vm.prank(bank);
        vm.expectRevert(abi.encodeWithSignature("PeriodNotSequential(uint16,uint16)", uint16(1), uint16(2)));
        dist.distribute(2, usdc, 8_000e6, epoch2, noProof);

        uint256 epoch1 = _anchor(DISTRIBUTION, 1, 8_000e6);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(16_000e6);
        dist.distribute(1, usdc, 8_000e6, epoch1, noProof);
        vm.expectRevert(abi.encodeWithSignature("PeriodNotSequential(uint16,uint16)", uint16(2), uint16(1)));
        dist.distribute(1, usdc, 8_000e6, epoch1, noProof);
        vm.stopPrank();
    }

    function test_zeroProfitPeriodMovesNoCash() public {
        _issue();
        _distribute(1, 0);
        assertEq(dist.lastPeriod(), 1);
        assertEq(dist.claimable(alice), 0);
    }

    function test_profitFollowsHolderOfRecordAcrossTransfer() public {
        _issue();
        _distribute(1, 8_000e6);

        // Alice sells half her position to Bob (both verified) after period 1.
        vm.prank(alice);
        token.transfer(bob, 150_000e6);
        assertEq(dist.claimable(alice), 6_000e6);
        assertEq(dist.claimable(bob), 2_000e6);

        _distribute(2, 8_000e6);
        // Period 2: Alice 150k of 400k, Bob 250k of 400k.
        assertEq(dist.claimable(alice), 6_000e6 + 3_000e6);
        assertEq(dist.claimable(bob), 2_000e6 + 5_000e6);
    }

    function test_distributeWithMerkleProofInLargerEpoch() public {
        _issue();
        bytes32 leaf = _leaf(DISTRIBUTION, 1, 8_000e6);
        bytes32 sibling = keccak256("another ledger fact");
        bytes32 root =
            leaf < sibling ? keccak256(abi.encode(leaf, sibling)) : keccak256(abi.encode(sibling, leaf));
        uint256 epoch = IMockLedgerAnchor(anchor).push(root);
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = sibling;

        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(8_000e6);
        dist.distribute(1, usdc, 8_000e6, epoch, proof);
        vm.stopPrank();
        assertEq(dist.claimable(alice), 6_000e6);
    }

    // --- maturity and default --------------------------------------------

    function test_maturityRedeemsPrincipalAndUnclaimedProfit() public {
        _issue();
        _distribute(1, 8_000e6);

        uint256 epoch = _anchor(REDEMPTION, 400_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(400_000e6);
        dist.settleMaturity(usdc, 400_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Matured));

        vm.prank(alice);
        dist.redeem(usdc);
        assertEq(IMockUSDC(usdc).balanceOf(alice), 300_000e6 + 6_000e6);
        assertEq(token.balanceOf(alice), 0);

        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(alice);
        dist.redeem(usdc);

        vm.prank(bob);
        dist.redeem(usdc);
        assertEq(IMockUSDC(usdc).balanceOf(bob), 100_000e6 + 2_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(address(dist)), 0);
    }

    function test_redeemBeforeSettlementReverts() public {
        _issue();
        vm.expectRevert(abi.encodeWithSignature("WrongStatus(uint8)", uint8(ISukukDistributor.Status.Active)));
        vm.prank(alice);
        dist.redeem(usdc);
    }

    function test_settleMaturityRequiresProof() public {
        _issue();
        uint256 epoch = _anchor(REDEMPTION, 400_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(400_000e6);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        dist.settleMaturity(usdc, 1e6, epoch, noProof);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        dist.settleDefault(usdc, 400_000e6, epoch, noProof);
        vm.stopPrank();
    }

    function test_defaultPaysRecoveryProRata() public {
        _issue();
        uint256 epoch = _anchor(DEFAULT, 100_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(100_000e6);
        dist.settleDefault(usdc, 100_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Defaulted));

        vm.prank(alice);
        dist.redeem(usdc);
        vm.prank(bob);
        dist.redeem(usdc);
        assertEq(IMockUSDC(usdc).balanceOf(alice), 75_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(bob), 25_000e6);
    }

    function test_noDistributionAfterSettlement() public {
        _issue();
        uint256 epoch = _anchor(DEFAULT, 0, 0);
        vm.prank(bank);
        dist.settleDefault(usdc, 0, epoch, noProof);

        uint256 epoch1 = _anchor(DISTRIBUTION, 1, 1e6);
        vm.expectRevert(abi.encodeWithSignature("WrongStatus(uint8)", uint8(ISukukDistributor.Status.Defaulted)));
        vm.prank(bank);
        dist.distribute(1, usdc, 1e6, epoch1, noProof);
    }

    // --- fuzz ------------------------------------------------------------

    /// @dev Whatever the split and the amounts, the contract never owes more than it holds, and
    ///      rounding dust stays below one base unit per holder per event. Profit still follows the
    ///      holder of record across an arbitrary verified-to-verified transfer mid-life.
    function testFuzz_payoutsNeverExceedFunding(uint256 aliceUnits, uint256 profit, uint256 redemption, uint256 moveBps)
        public
    {
        aliceUnits = bound(aliceUnits, MIN_SUB, FACE - MIN_RAISE);
        uint256 bobUnits = FACE - aliceUnits;
        profit = bound(profit, 0, 50_000e6);
        redemption = bound(redemption, 0, FACE);
        moveBps = bound(moveBps, 0, 10_000);

        _open();
        _subscribe(alice, aliceUnits);
        _subscribe(bob, bobUnits);
        vm.prank(deployer);
        dist.closeSubscription();

        _distribute(1, profit);

        // Arbitrary verified-to-verified transfer: Alice moves a fraction of her units to Bob.
        uint256 move = (aliceUnits * moveBps) / 10_000;
        if (move != 0) {
            vm.prank(alice);
            token.transfer(bob, move);
        }

        uint256 epoch = _anchor(REDEMPTION, redemption, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(redemption);
        dist.settleMaturity(usdc, redemption, epoch, noProof);
        vm.stopPrank();

        // Profit accrued before a transfer stays claimable by the sender even at zero balance.
        if (dist.claimable(alice) > 0) {
            vm.prank(alice);
            dist.claim(usdc);
        }
        if (dist.claimable(bob) > 0) {
            vm.prank(bob);
            dist.claim(usdc);
        }
        // Check balances before pranking: vm.prank applies to the very next call, balanceOf included.
        if (token.balanceOf(alice) > 0) {
            vm.prank(alice);
            dist.redeem(usdc);
        }
        if (token.balanceOf(bob) > 0) {
            vm.prank(bob);
            dist.redeem(usdc);
        }

        uint256 paid = IMockUSDC(usdc).balanceOf(alice) + IMockUSDC(usdc).balanceOf(bob);
        assertLe(paid, profit + redemption);
        assertLe(profit + redemption - paid, 8);
    }
}

interface IReentrantUSDC {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function arm(address target_) external;
}

/// @dev Proves claim() cannot be re-entered through a malicious settlement token.
contract SukukReentrancyTest is TrexFixture {
    function test_claimCannotBeReentered() public {
        _setUpTrex();
        address alice = makeAddr("alice");
        uint40 maturity = uint40(block.timestamp + 365 days);

        address usdc = deployCode("ReentrantUSDC.sol:ReentrantUSDC");
        address anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(uint256(1)));

        (Token token, ModularCompliance mc, DistributionCheckpointModule module) =
            _deployTrexToken("S", "S", 6);

        ISukukDistributor dist = ISukukDistributor(
            _deployProxy(
                "SukukDistributor.sol:SukukDistributor",
                abi.encodePacked(DIST_INIT, abi.encode(
                    _coins1(usdc), anchor, address(ir), address(token), address(module),
                    keccak256("S"), uint256(100e6), maturity, uint256(10e6), uint256(1e6), uint40(1 days), deployer,
                    deployer))
            )
        );
        _wireDistributor(token, mc, module, address(dist));
        _registerVerified(alice, 360);

        bytes32[] memory noProof;
        uint256 e0 = IMockLedgerAnchor(anchor).push(
            dist.leafHash(1, keccak256("tawf.sukuk.approved"), keccak256("S"), 100e6, maturity)
        );
        vm.prank(deployer);
        dist.openSubscription(e0, noProof);
        uint256 eR = IMockLedgerAnchor(anchor).push(
            dist.leafHash(1, keccak256("tawf.sukuk.reserve"), keccak256("S"), block.timestamp, 100e6)
        );
        dist.updateReserve(uint64(block.timestamp), 100e6, eR, noProof);

        vm.startPrank(alice);
        IReentrantUSDC(usdc).faucet(100e6);
        IReentrantUSDC(usdc).approve(address(dist), 100e6);
        dist.subscribe(usdc, 100e6);
        vm.stopPrank();

        vm.startPrank(deployer);
        dist.closeSubscription();
        IReentrantUSDC(usdc).faucet(5e6);
        IReentrantUSDC(usdc).approve(address(dist), 5e6);
        dist.distribute(
            1, usdc, 5e6, IMockLedgerAnchor(anchor).push(dist.leafHash(1, keccak256("tawf.sukuk.distribution"), keccak256("S"), 1, 5e6)), noProof
        );
        vm.stopPrank();

        IReentrantUSDC(usdc).arm(address(dist));
        // SukukDistributor uses OZ v5 ReentrancyGuard -> custom error.
        vm.expectRevert(bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        vm.prank(alice);
        dist.claim(usdc);
    }
}
