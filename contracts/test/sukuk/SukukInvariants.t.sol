// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
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

interface IInv {
    function coins() external view returns (address[] memory);
    function topUp(address coin, uint256 amount) external;
    function redemptionPerToken() external view returns (uint256);
    function totalRaised() external view returns (uint256);
    function setCoinPaused(address coin, bool paused) external;
    function heldBalanceOf(address) external view returns (uint256);
}

/// @dev Random claims, redemptions, top-ups and pauses by the two holders and a funder.
contract SukukHandler is Test {
    ISukukDistributor public dist;
    address[3] public coin;
    address[2] public holder;
    address public admin;
    uint256 public payouts;

    constructor(ISukukDistributor dist_, address[3] memory coin_, address[2] memory holder_, address admin_) {
        dist = dist_;
        coin = coin_;
        holder = holder_;
        admin = admin_;
    }

    function claim(uint8 who, uint8 c) external {
        vm.prank(holder[who % 2]);
        try dist.claim(coin[c % 3]) {
            payouts++;
        } catch {}
    }

    function redeem(uint8 who, uint8 c) external {
        vm.prank(holder[who % 2]);
        try dist.redeem(coin[c % 3]) {
            payouts++;
        } catch {}
    }

    function topUp(uint8 c, uint96 amt) external {
        address coin_ = coin[c % 3];
        uint256 a = bound(uint256(amt), 1, 50_000e6);
        IMockUSDC(coin_).faucet(a);
        IMockUSDC(coin_).approve(address(dist), a);
        try IInv(address(dist)).topUp(coin_, a) {} catch {}
    }

    function pause(uint8 c, bool paused) external {
        vm.prank(admin);
        try IInv(address(dist)).setCoinPaused(coin[c % 3], paused) {} catch {}
    }
}

/// @notice Stateful checks on the multi-coin distributor: whatever order holders claim and redeem in, and
///         whichever coin they prefer, the coin balances keep covering what is owed and no payout
///         ever touches a coin that is not accepted.
contract SukukInvariantTest is TrexFixture {
    address usdc;
    address usdt;
    address usdg;
    address rogue;
    address anchor;
    ISukukDistributor dist;
    SukukHandler handler;
    Token token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address bank = makeAddr("bank");
    address treasury = makeAddr("treasury");
    bytes32[] noProof;
    uint40 maturity;

    function setUp() public {
        maturity = uint40(block.timestamp + 365 days);
        _setUpTrex();
        usdc = deployCode("MockUSDC.sol:MockUSDC");
        usdt = deployCode("MockUSDC.sol:MockUSDC");
        usdg = deployCode("MockUSDC.sol:MockUSDC");
        rogue = deployCode("MockUSDC.sol:MockUSDC");
        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(LEDGER_CHAIN_ID));
        ModularCompliance mc;
        DistributionCheckpointModule module;
        (token, mc, module) = _deployTrexToken("Tawf Sukuk Inv", "TSI", 6);
        address[] memory list = new address[](3);
        list[0] = usdc;
        list[1] = usdt;
        list[2] = usdg;
        dist = ISukukDistributor(
            deployCode(
                "SukukDistributor.sol:SukukDistributor",
                abi.encode(
                    list, anchor, address(ir), address(token), address(module),
                    SUKUK, FACE, maturity, MIN_RAISE, MIN_SUB, WINDOW, treasury,
                    deployer
                )
            )
        );
        _wireDistributor(token, mc, module, address(dist));
        _registerVerified(alice, 360);
        _registerVerified(bob, 360);

        // open, subscribe in mixed coins, close
        uint256 openEpoch = _fact(APPROVED, FACE, maturity);
        vm.prank(deployer);
        dist.openSubscription(openEpoch, noProof);
        uint64 at = uint64(block.timestamp);
        dist.updateReserve(at, FACE, _fact(RESERVE, at, FACE), noProof);
        _sub(alice, usdc, 120_000e6);
        _sub(alice, usdt, 80_000e6);
        _sub(bob, usdg, 100_000e6);
        vm.warp(block.timestamp + WINDOW);
        at = uint64(block.timestamp);
        dist.updateReserve(at, FACE, _fact(RESERVE, at, FACE), noProof);
        vm.prank(deployer);
        dist.closeSubscription();

        // profit in USDC, maturity in USDT, plus an unaccepted coin sitting in the contract
        _fund(usdc, 6_000e6, true);
        _fund(usdt, 300_000e6, false);
        IMockUSDC(rogue).faucet(777e6);
        (bool okT,) = rogue.call(abi.encodeWithSignature("transfer(address,uint256)", address(dist), 777e6));
        require(okT);

        handler = new SukukHandler(dist, [usdc, usdt, usdg], [alice, bob], deployer);
        targetContract(address(handler));
    }

    function _fact(bytes32 kind, uint256 a, uint256 b) internal returns (uint256) {
        return IMockLedgerAnchor(anchor).push(dist.leafHash(LEDGER_CHAIN_ID, kind, SUKUK, a, b));
    }

    function _sub(address who, address c, uint256 amt) internal {
        vm.startPrank(who);
        IMockUSDC(c).faucet(amt);
        IMockUSDC(c).approve(address(dist), amt);
        dist.subscribe(c, amt);
        vm.stopPrank();
    }

    function _fund(address c, uint256 amt, bool profit) internal {
        bytes32 funder = keccak256("FUNDER_ROLE");
        vm.prank(deployer);
        (bool ok,) = address(dist).call(abi.encodeWithSignature("grantRole(bytes32,address)", funder, bank));
        require(ok);
        vm.startPrank(bank);
        IMockUSDC(c).faucet(amt);
        IMockUSDC(c).approve(address(dist), amt);
        if (profit) dist.distribute(1, c, amt, _fact(DISTRIBUTION, 1, amt), noProof);
        else dist.settleMaturity(c, amt, _fact(REDEMPTION, amt, 0), noProof);
        vm.stopPrank();
    }

    function _total() internal view returns (uint256) {
        return IMockUSDC(usdc).balanceOf(address(dist)) + IMockUSDC(usdt).balanceOf(address(dist))
            + IMockUSDC(usdg).balanceOf(address(dist));
    }

    /// The coin balances always cover unclaimed profit plus the principal still outstanding.
    function invariant_balancesCoverWhatIsOwed() public view {
        uint256 owed = dist.claimable(alice) + dist.claimable(bob)
            + (token.totalSupply() * IInv(address(dist)).redemptionPerToken()) / 1e18;
        assertGe(_total(), owed);
    }

    /// Nothing is ever paid in, or out of, a coin the distributor does not accept.
    function invariant_unacceptedCoinIsNeverTouched() public view {
        assertEq(IMockUSDC(rogue).balanceOf(address(dist)), 777e6);
    }

    /// The cumulative raise is fixed once the sale closed, whatever happens afterwards.
    function invariant_totalRaisedIsFixed() public view {
        assertEq(IInv(address(dist)).totalRaised(), 300_000e6);
    }
}
