// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { IAccessControl } from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import { MerkleProof } from "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { MockUSDC } from "../../src/mocks/MockUSDC.sol";
import { IdentityRegistry } from "../../src/IdentityRegistry.sol";
import { Compliance } from "../../src/Compliance.sol";
import { ILedgerAnchor } from "../../src/sukuk/ILedgerAnchor.sol";
import { SukukToken } from "../../src/sukuk/SukukToken.sol";
import { SukukDistributor } from "../../src/sukuk/SukukDistributor.sol";

/// @dev Stands in for tawf-network's LedgerAnchor: same verify semantics
///      (OpenZeppelin MerkleProof against a stored root), no access control.
contract MockLedgerAnchor is ILedgerAnchor {
    uint256 public immutable ledgerChainId;
    bytes32[] public roots;

    constructor(uint256 ledgerChainId_) {
        ledgerChainId = ledgerChainId_;
    }

    function push(bytes32 root) external returns (uint256 epoch) {
        epoch = roots.length;
        roots.push(root);
    }

    function verify(uint256 epoch, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        return MerkleProof.verifyCalldata(proof, roots[epoch], leaf);
    }
}

contract SukukDistributorTest is Test {
    MockUSDC usdc;
    IdentityRegistry identityRegistry;
    Compliance compliance;
    MockLedgerAnchor anchor;
    SukukDistributor dist;
    SukukToken token;

    address owner = makeAddr("owner");
    address bank = makeAddr("bank");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address stranger = makeAddr("stranger");

    uint256 constant LEDGER_CHAIN_ID = 99_999;
    bytes32 constant SUKUK = keccak256("SUKUK-001");
    uint256 constant FACE = 500_000e6;
    uint256 constant MIN_RAISE = 100_000e6;
    uint256 constant MIN_SUB = 10e6;
    uint40 constant WINDOW = 14 days;

    bytes32 constant APPROVED = keccak256("tawf.sukuk.approved");
    bytes32 constant DISTRIBUTION = keccak256("tawf.sukuk.distribution");
    bytes32 constant REDEMPTION = keccak256("tawf.sukuk.redemption");
    bytes32 constant DEFAULT = keccak256("tawf.sukuk.default");

    uint40 maturity;
    bytes32[] noProof;

    function setUp() public {
        maturity = uint40(block.timestamp + 365 days);

        vm.startPrank(owner);
        usdc = new MockUSDC();
        identityRegistry = new IdentityRegistry(owner);
        compliance = new Compliance(identityRegistry, owner);
        anchor = new MockLedgerAnchor(LEDGER_CHAIN_ID);
        dist = new SukukDistributor(
            IERC20(address(usdc)),
            anchor,
            compliance,
            SukukDistributor.Terms({
                sukukId: SUKUK,
                faceValue: FACE,
                maturity: maturity,
                minRaise: MIN_RAISE,
                minSubscription: MIN_SUB,
                subscriptionPeriod: WINDOW,
                issuerTreasury: treasury
            }),
            "Tawf Sukuk Ijarah 001",
            "TSI001",
            owner
        );
        token = dist.token();
        identityRegistry.registerIdentity(alice, 360, 0);
        identityRegistry.registerIdentity(bob, 360, 0);
        vm.stopPrank();

        vm.prank(bank);
        usdc.approve(address(dist), type(uint256).max);
    }

    // --- helpers ---------------------------------------------------------

    function _leaf(bytes32 kind, uint256 a, uint256 b) internal view returns (bytes32) {
        return dist.leafHash(LEDGER_CHAIN_ID, kind, SUKUK, a, b);
    }

    /// @dev Anchor a single-leaf epoch: the root is the leaf, the proof is empty.
    function _anchor(bytes32 kind, uint256 a, uint256 b) internal returns (uint256) {
        return anchor.push(_leaf(kind, a, b));
    }

    function _open() internal {
        uint256 epoch = _anchor(APPROVED, FACE, maturity);
        vm.prank(owner);
        dist.openSubscription(epoch, noProof);
    }

    function _subscribe(address investor, uint256 amount) internal {
        vm.startPrank(investor);
        usdc.faucet(amount);
        usdc.approve(address(dist), amount);
        dist.subscribe(amount);
        vm.stopPrank();
    }

    /// @dev Alice 300k, Bob 100k, sale closed and proceeds released.
    function _issue() internal {
        _open();
        _subscribe(alice, 300_000e6);
        _subscribe(bob, 100_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(owner);
        dist.closeSubscription();
    }

    function _distribute(uint16 period, uint256 amount) internal {
        uint256 epoch = _anchor(DISTRIBUTION, period, amount);
        vm.startPrank(bank);
        usdc.faucet(amount);
        dist.distribute(period, amount, epoch, noProof);
        vm.stopPrank();
    }

    function _makeTransferable() internal {
        uint256 instrumentId = token.INSTRUMENT_ID();
        vm.prank(owner);
        compliance.setPolicy(address(token), instrumentId, Compliance.TransferPolicy.Transferable);
    }

    // --- leaf encoding ---------------------------------------------------

    /// @dev Golden vector. tawf-network/contracts/test/LedgerAnchor.t.sol
    ///      asserts the same value against LedgerLeaf.hash.
    function test_goldenLeaf() public view {
        assertEq(
            dist.leafHash(LEDGER_CHAIN_ID, DISTRIBUTION, SUKUK, 1, 1_000e6),
            0x1a6c2c36d0ef5264983245b9eb2d892fbbae01358bb9c2369ce126444eeadb95
        );
    }

    // --- subscription ----------------------------------------------------

    function test_openRequiresAnchoredApprovalWithExactTerms() public {
        // Approval anchored for a different face value does not open this sale.
        uint256 epoch = _anchor(APPROVED, FACE + 1, maturity);
        vm.expectRevert(SukukDistributor.ProofInvalid.selector);
        vm.prank(owner);
        dist.openSubscription(epoch, noProof);
    }

    function test_openIsAdminOnly() public {
        uint256 epoch = _anchor(APPROVED, FACE, maturity);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, dist.ADMIN_ROLE()
            )
        );
        vm.prank(stranger);
        dist.openSubscription(epoch, noProof);
    }

    function test_subscribeMintsOneForOne() public {
        _open();
        _subscribe(alice, 300_000e6);
        assertEq(token.balanceOf(alice), 300_000e6);
        assertEq(usdc.balanceOf(address(dist)), 300_000e6);
        assertEq(token.decimals(), 6);
    }

    function test_subscribeBeforeOpenReverts() public {
        vm.expectRevert(abi.encodeWithSelector(SukukDistributor.WrongStatus.selector, SukukDistributor.Status.Pending));
        vm.prank(alice);
        dist.subscribe(MIN_SUB);
    }

    function test_subscribeRequiresKyc() public {
        _open();
        vm.startPrank(carol);
        usdc.faucet(MIN_SUB);
        usdc.approve(address(dist), MIN_SUB);
        vm.expectRevert(abi.encodeWithSelector(SukukDistributor.NotEligible.selector, carol));
        dist.subscribe(MIN_SUB);
        vm.stopPrank();
    }

    function test_subscribeBounds() public {
        _open();
        vm.startPrank(alice);
        usdc.faucet(FACE + 1);
        usdc.approve(address(dist), FACE + 1);
        vm.expectRevert(SukukDistributor.BelowMinimum.selector);
        dist.subscribe(MIN_SUB - 1);
        vm.expectRevert(SukukDistributor.ExceedsFaceValue.selector);
        dist.subscribe(FACE + 1);
        vm.stopPrank();

        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(SukukDistributor.SubscriptionClosed.selector);
        vm.prank(alice);
        dist.subscribe(MIN_SUB);
    }

    function test_closeReleasesProceedsToIssuer() public {
        _issue();
        assertEq(uint8(dist.status()), uint8(SukukDistributor.Status.Active));
        assertEq(usdc.balanceOf(treasury), 400_000e6);
        assertEq(usdc.balanceOf(address(dist)), 0);
    }

    function test_closeEarlyOnlyWhenFullySubscribed() public {
        _open();
        _subscribe(alice, 300_000e6);
        vm.expectRevert(SukukDistributor.SubscriptionStillOpen.selector);
        vm.prank(owner);
        dist.closeSubscription();

        _subscribe(bob, 200_000e6);
        vm.prank(owner);
        dist.closeSubscription();
        assertEq(usdc.balanceOf(treasury), FACE);
    }

    function test_missedMinimumCancelsAndRefundsAtPar() public {
        _open();
        _subscribe(alice, 50_000e6);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(owner);
        dist.closeSubscription();
        assertEq(uint8(dist.status()), uint8(SukukDistributor.Status.Cancelled));
        assertEq(usdc.balanceOf(treasury), 0);

        vm.prank(alice);
        dist.refund();
        assertEq(usdc.balanceOf(alice), 50_000e6);
        assertEq(token.totalSupply(), 0);

        vm.expectRevert(SukukDistributor.NothingToClaim.selector);
        vm.prank(alice);
        dist.refund();
    }

    // --- transfers -------------------------------------------------------

    function test_nonTransferableByDefault() public {
        _issue();
        vm.expectRevert(SukukToken.TransferBlocked.selector);
        vm.prank(alice);
        token.transfer(bob, 1e6);
    }

    function test_transferableOnlyBetweenEligibleHolders() public {
        _issue();
        _makeTransferable();

        vm.prank(alice);
        token.transfer(bob, 50_000e6);
        assertEq(token.balanceOf(bob), 150_000e6);

        vm.expectRevert(SukukToken.TransferBlocked.selector);
        vm.prank(alice);
        token.transfer(carol, 1e6);

        vm.prank(owner);
        identityRegistry.revokeIdentity(bob);
        vm.expectRevert(SukukToken.TransferBlocked.selector);
        vm.prank(alice);
        token.transfer(bob, 1e6);
    }

    function test_onlyDistributorMintsAndBurns() public {
        vm.expectRevert(SukukToken.OnlyDistributor.selector);
        token.mint(alice, 1);
        vm.expectRevert(SukukToken.OnlyDistributor.selector);
        token.burn(alice, 1);
        vm.expectRevert(SukukDistributor.OnlyToken.selector);
        dist.beforeBalanceChange(alice, bob);
    }

    // --- distribution ----------------------------------------------------

    function test_distributeRequiresProofOfDeclaredAmount() public {
        _issue();
        uint256 epoch = _anchor(DISTRIBUTION, 1, 8_000e6);
        vm.startPrank(bank);
        usdc.faucet(9_000e6);
        // Right period, wrong amount.
        vm.expectRevert(SukukDistributor.ProofInvalid.selector);
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
        assertEq(usdc.balanceOf(alice), 6_000e6);
        assertEq(dist.claimable(alice), 0);

        vm.expectRevert(SukukDistributor.NothingToClaim.selector);
        vm.prank(alice);
        dist.claim();
    }

    function test_periodsAreSequentialAndNotReplayable() public {
        _issue();
        uint256 epoch2 = _anchor(DISTRIBUTION, 2, 8_000e6);
        vm.prank(bank);
        vm.expectRevert(abi.encodeWithSelector(SukukDistributor.PeriodNotSequential.selector, 1, 2));
        dist.distribute(2, 8_000e6, epoch2, noProof);

        uint256 epoch1 = _anchor(DISTRIBUTION, 1, 8_000e6);
        vm.startPrank(bank);
        usdc.faucet(16_000e6);
        dist.distribute(1, 8_000e6, epoch1, noProof);
        vm.expectRevert(abi.encodeWithSelector(SukukDistributor.PeriodNotSequential.selector, 2, 1));
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
        _makeTransferable();
        _distribute(1, 8_000e6);

        // Alice sells half her position to Bob after period 1.
        vm.prank(alice);
        token.transfer(bob, 150_000e6);
        // Period 1 stays with whoever held then.
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
        uint256 epoch = anchor.push(root);
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = sibling;

        vm.startPrank(bank);
        usdc.faucet(8_000e6);
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
        usdc.faucet(400_000e6);
        dist.settleMaturity(400_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(SukukDistributor.Status.Matured));

        vm.prank(alice);
        dist.redeem();
        assertEq(usdc.balanceOf(alice), 300_000e6 + 6_000e6);
        assertEq(token.balanceOf(alice), 0);

        vm.expectRevert(SukukDistributor.NothingToClaim.selector);
        vm.prank(alice);
        dist.redeem();

        vm.prank(bob);
        dist.redeem();
        assertEq(usdc.balanceOf(bob), 100_000e6 + 2_000e6);
        assertEq(usdc.balanceOf(address(dist)), 0);
    }

    function test_redeemBeforeSettlementReverts() public {
        _issue();
        vm.expectRevert(abi.encodeWithSelector(SukukDistributor.WrongStatus.selector, SukukDistributor.Status.Active));
        vm.prank(alice);
        dist.redeem();
    }

    function test_settleMaturityRequiresProof() public {
        _issue();
        uint256 epoch = _anchor(REDEMPTION, 400_000e6, 0);
        vm.startPrank(bank);
        usdc.faucet(400_000e6);
        vm.expectRevert(SukukDistributor.ProofInvalid.selector);
        dist.settleMaturity(1e6, epoch, noProof);
        // A redemption leaf is not a default leaf.
        vm.expectRevert(SukukDistributor.ProofInvalid.selector);
        dist.settleDefault(400_000e6, epoch, noProof);
        vm.stopPrank();
    }

    function test_defaultPaysRecoveryProRata() public {
        _issue();
        uint256 epoch = _anchor(DEFAULT, 100_000e6, 0);
        vm.startPrank(bank);
        usdc.faucet(100_000e6);
        dist.settleDefault(100_000e6, epoch, noProof);
        vm.stopPrank();
        assertEq(uint8(dist.status()), uint8(SukukDistributor.Status.Defaulted));

        vm.prank(alice);
        dist.redeem();
        vm.prank(bob);
        dist.redeem();
        assertEq(usdc.balanceOf(alice), 75_000e6);
        assertEq(usdc.balanceOf(bob), 25_000e6);
    }

    function test_noDistributionAfterSettlement() public {
        _issue();
        uint256 epoch = _anchor(DEFAULT, 0, 0);
        vm.prank(bank);
        dist.settleDefault(0, epoch, noProof);

        uint256 epoch1 = _anchor(DISTRIBUTION, 1, 1e6);
        vm.expectRevert(
            abi.encodeWithSelector(SukukDistributor.WrongStatus.selector, SukukDistributor.Status.Defaulted)
        );
        vm.prank(bank);
        dist.distribute(1, 1e6, epoch1, noProof);
    }

    // --- fuzz ------------------------------------------------------------

    /// @dev Whatever the split and the amounts, the contract never owes
    ///      more than it holds, and rounding dust stays below one base unit
    ///      per holder per event.
    function testFuzz_payoutsNeverExceedFunding(uint256 aliceUnits, uint256 profit, uint256 redemption) public {
        aliceUnits = bound(aliceUnits, MIN_SUB, FACE - MIN_RAISE);
        uint256 bobUnits = FACE - aliceUnits;
        profit = bound(profit, 0, 50_000e6);
        redemption = bound(redemption, 0, FACE);

        _open();
        _subscribe(alice, aliceUnits);
        _subscribe(bob, bobUnits);
        vm.prank(owner);
        dist.closeSubscription();

        _distribute(1, profit);
        uint256 epoch = _anchor(REDEMPTION, redemption, 0);
        vm.startPrank(bank);
        usdc.faucet(redemption);
        dist.settleMaturity(redemption, epoch, noProof);
        vm.stopPrank();

        vm.prank(alice);
        dist.redeem();
        vm.prank(bob);
        dist.redeem();

        uint256 paid = usdc.balanceOf(alice) + usdc.balanceOf(bob);
        assertLe(paid, profit + redemption);
        assertLe(profit + redemption - paid, 4);
        assertEq(usdc.balanceOf(address(dist)), profit + redemption - paid);
    }
}

/// @dev USDC stand-in that re-enters the distributor from inside transfer.
contract ReentrantUSDC is MockUSDC {
    SukukDistributor public target;
    bool public armed;

    function arm(SukukDistributor target_) external {
        target = target_;
        armed = true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            target.claim();
        }
        return super.transfer(to, value);
    }
}

contract SukukReentrancyTest is Test {
    function test_claimCannotBeReentered() public {
        address owner = makeAddr("owner");
        address alice = makeAddr("alice");
        uint40 maturity = uint40(block.timestamp + 365 days);

        vm.startPrank(owner);
        ReentrantUSDC usdc = new ReentrantUSDC();
        IdentityRegistry identityRegistry = new IdentityRegistry(owner);
        Compliance compliance = new Compliance(identityRegistry, owner);
        MockLedgerAnchor anchor = new MockLedgerAnchor(1);
        SukukDistributor dist = new SukukDistributor(
            IERC20(address(usdc)),
            anchor,
            compliance,
            SukukDistributor.Terms({
                sukukId: keccak256("S"),
                faceValue: 100e6,
                maturity: maturity,
                minRaise: 10e6,
                minSubscription: 1e6,
                subscriptionPeriod: 1 days,
                issuerTreasury: owner
            }),
            "S",
            "S",
            owner
        );
        identityRegistry.registerIdentity(alice, 360, 0);
        bytes32[] memory noProof;
        dist.openSubscription(
            anchor.push(dist.leafHash(1, keccak256("tawf.sukuk.approved"), keccak256("S"), 100e6, maturity)), noProof
        );
        vm.stopPrank();

        vm.startPrank(alice);
        usdc.faucet(100e6);
        usdc.approve(address(dist), 100e6);
        dist.subscribe(100e6);
        vm.stopPrank();

        vm.startPrank(owner);
        dist.closeSubscription();
        usdc.faucet(5e6);
        usdc.approve(address(dist), 5e6);
        dist.distribute(
            1, 5e6, anchor.push(dist.leafHash(1, keccak256("tawf.sukuk.distribution"), keccak256("S"), 1, 5e6)), noProof
        );
        vm.stopPrank();

        usdc.arm(dist);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(alice);
        dist.claim();
    }
}
