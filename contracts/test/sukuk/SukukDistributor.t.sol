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

uint256 constant LEDGER_CHAIN_ID = 99_999;
uint256 constant FACE = 500_000e6;
uint256 constant MIN_RAISE = 100_000e6;
uint256 constant MIN_SUB = 10e6;
uint40 constant WINDOW = 14 days;

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
    function subscribe(uint256 amount) external;
    function closeSubscription() external;
    function refund() external;
    function distribute(uint16 period, uint256 amount, uint256 epoch, bytes32[] calldata proof) external;
    function claim() external;
    function claimable(address) external view returns (uint256);
    function profitPerToken() external view returns (uint256);
    function lastPeriod() external view returns (uint16);
    function settleMaturity(uint256 amount, uint256 epoch, bytes32[] calldata proof) external;
    function settleDefault(uint256 recovery, uint256 epoch, bytes32[] calldata proof) external;
    function redeem() external;
    function updateReserve(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] calldata proof) external;
    function reserveOf() external view returns (uint256);
    function isFullyBacked() external view returns (bool);
}

/// @dev Minimal MockUSDC / MockLedgerAnchor views.
interface IMockUSDC {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
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
            deployCode(
                "SukukDistributor.sol:SukukDistributor",
                abi.encode(
                    usdc,
                    anchor,
                    address(ir),
                    address(token),
                    address(module),
                    SUKUK, FACE, maturity, MIN_RAISE, MIN_SUB, WINDOW, treasury,
                    deployer
                )
            )
        );
        _wireDistributor(token, mc, module, address(dist));

        // Verified investors.
        _registerVerified(alice, 360);
        _registerVerified(bob, 360);

        vm.prank(bank);
        IMockUSDC(usdc).approve(address(dist), type(uint256).max);
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
    }

    function _subscribe(address investor, uint256 amount) internal {
        vm.startPrank(investor);
        IMockUSDC(usdc).faucet(amount);
        IMockUSDC(usdc).approve(address(dist), amount);
        dist.subscribe(amount);
        vm.stopPrank();
    }

    function _issue() internal {
        _open();
        _subscribe(alice, 300_000e6);
        _subscribe(bob, 100_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(deployer);
        dist.closeSubscription();
    }

    function _distribute(uint16 period, uint256 amount) internal {
        uint256 epoch = _anchor(DISTRIBUTION, period, amount);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(amount);
        dist.distribute(period, amount, epoch, noProof);
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
        dist.subscribe(MIN_SUB);
    }

    function test_subscribeRequiresKyc() public {
        _open();
        vm.startPrank(carol);
        IMockUSDC(usdc).faucet(MIN_SUB);
        IMockUSDC(usdc).approve(address(dist), MIN_SUB);
        vm.expectRevert(abi.encodeWithSignature("NotEligible(address)", carol));
        dist.subscribe(MIN_SUB);
        vm.stopPrank();
    }

    function test_subscribeBounds() public {
        _open();
        vm.startPrank(alice);
        IMockUSDC(usdc).faucet(FACE + 1);
        IMockUSDC(usdc).approve(address(dist), FACE + 1);
        vm.expectRevert(bytes4(keccak256("BelowMinimum()")));
        dist.subscribe(MIN_SUB - 1);
        vm.expectRevert(bytes4(keccak256("ExceedsFaceValue()")));
        dist.subscribe(FACE + 1);
        vm.stopPrank();

        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(bytes4(keccak256("SubscriptionClosed()")));
        vm.prank(alice);
        dist.subscribe(MIN_SUB);
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
        dist.subscribe(MIN_SUB);
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
        dist.distribute(1, 9_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(dist.profitPerToken(), 0);
    }

    function test_distributePaysProRata() public {
        _issue();
        _distribute(1, 8_000e6);
        assertEq(dist.claimable(alice), 6_000e6);
        assertEq(dist.claimable(bob), 2_000e6);

        vm.prank(alice);
        dist.claim();
        assertEq(IMockUSDC(usdc).balanceOf(alice), 6_000e6);
        assertEq(dist.claimable(alice), 0);

        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(alice);
        dist.claim();
    }

    function test_periodsAreSequentialAndNotReplayable() public {
        _issue();
        uint256 epoch2 = _anchor(DISTRIBUTION, 2, 8_000e6);
        vm.prank(bank);
        vm.expectRevert(abi.encodeWithSignature("PeriodNotSequential(uint16,uint16)", uint16(1), uint16(2)));
        dist.distribute(2, 8_000e6, epoch2, noProof);

        uint256 epoch1 = _anchor(DISTRIBUTION, 1, 8_000e6);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(16_000e6);
        dist.distribute(1, 8_000e6, epoch1, noProof);
        vm.expectRevert(abi.encodeWithSignature("PeriodNotSequential(uint16,uint16)", uint16(2), uint16(1)));
        dist.distribute(1, 8_000e6, epoch1, noProof);
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
        dist.distribute(1, 8_000e6, epoch, proof);
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
        dist.settleMaturity(400_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Matured));

        vm.prank(alice);
        dist.redeem();
        assertEq(IMockUSDC(usdc).balanceOf(alice), 300_000e6 + 6_000e6);
        assertEq(token.balanceOf(alice), 0);

        vm.expectRevert(bytes4(keccak256("NothingToClaim()")));
        vm.prank(alice);
        dist.redeem();

        vm.prank(bob);
        dist.redeem();
        assertEq(IMockUSDC(usdc).balanceOf(bob), 100_000e6 + 2_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(address(dist)), 0);
    }

    function test_redeemBeforeSettlementReverts() public {
        _issue();
        vm.expectRevert(abi.encodeWithSignature("WrongStatus(uint8)", uint8(ISukukDistributor.Status.Active)));
        vm.prank(alice);
        dist.redeem();
    }

    function test_settleMaturityRequiresProof() public {
        _issue();
        uint256 epoch = _anchor(REDEMPTION, 400_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(400_000e6);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        dist.settleMaturity(1e6, epoch, noProof);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        dist.settleDefault(400_000e6, epoch, noProof);
        vm.stopPrank();
    }

    function test_defaultPaysRecoveryProRata() public {
        _issue();
        uint256 epoch = _anchor(DEFAULT, 100_000e6, 0);
        vm.startPrank(bank);
        IMockUSDC(usdc).faucet(100_000e6);
        dist.settleDefault(100_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(ISukukDistributor.Status.Defaulted));

        vm.prank(alice);
        dist.redeem();
        vm.prank(bob);
        dist.redeem();
        assertEq(IMockUSDC(usdc).balanceOf(alice), 75_000e6);
        assertEq(IMockUSDC(usdc).balanceOf(bob), 25_000e6);
    }

    function test_noDistributionAfterSettlement() public {
        _issue();
        uint256 epoch = _anchor(DEFAULT, 0, 0);
        vm.prank(bank);
        dist.settleDefault(0, epoch, noProof);

        uint256 epoch1 = _anchor(DISTRIBUTION, 1, 1e6);
        vm.expectRevert(abi.encodeWithSignature("WrongStatus(uint8)", uint8(ISukukDistributor.Status.Defaulted)));
        vm.prank(bank);
        dist.distribute(1, 1e6, epoch1, noProof);
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
        dist.settleMaturity(redemption, epoch, noProof);
        vm.stopPrank();

        // Profit accrued before a transfer stays claimable by the sender even at zero balance.
        if (dist.claimable(alice) > 0) {
            vm.prank(alice);
            dist.claim();
        }
        if (dist.claimable(bob) > 0) {
            vm.prank(bob);
            dist.claim();
        }
        // Check balances before pranking: vm.prank applies to the very next call, balanceOf included.
        if (token.balanceOf(alice) > 0) {
            vm.prank(alice);
            dist.redeem();
        }
        if (token.balanceOf(bob) > 0) {
            vm.prank(bob);
            dist.redeem();
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
            deployCode(
                "SukukDistributor.sol:SukukDistributor",
                abi.encode(
                    usdc, anchor, address(ir), address(token), address(module),
                    keccak256("S"), uint256(100e6), maturity, uint256(10e6), uint256(1e6), uint40(1 days), deployer,
                    deployer
                )
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

        vm.startPrank(alice);
        IReentrantUSDC(usdc).faucet(100e6);
        IReentrantUSDC(usdc).approve(address(dist), 100e6);
        dist.subscribe(100e6);
        vm.stopPrank();

        vm.startPrank(deployer);
        dist.closeSubscription();
        IReentrantUSDC(usdc).faucet(5e6);
        IReentrantUSDC(usdc).approve(address(dist), 5e6);
        dist.distribute(
            1, 5e6, IMockLedgerAnchor(anchor).push(dist.leafHash(1, keccak256("tawf.sukuk.distribution"), keccak256("S"), 1, 5e6)), noProof
        );
        vm.stopPrank();

        IReentrantUSDC(usdc).arm(address(dist));
        // SukukDistributor uses OZ v5 ReentrancyGuard -> custom error.
        vm.expectRevert(bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        vm.prank(alice);
        dist.claim();
    }
}
