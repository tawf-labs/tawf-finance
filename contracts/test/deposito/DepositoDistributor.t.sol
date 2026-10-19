// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Pinned to 0.8.17 for the concrete T-REX token + ONCHAINID identities. DepositoDistributor and
// DepositoReserveController (^0.8.24), MockIDRX (^0.8.20), and MockLedgerAnchor (^0.8.20) are
// reached via vm.deployCode and minimal interfaces.

import {TrexFixture} from "../trex/TrexFixture.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";

bytes32 constant INSTITUTION = keccak256("bprs.demo");
bytes32 constant DEPOSITO_PLACEMENT = keccak256("tawf.deposito.placement");
uint256 constant LEDGER_CHAIN_ID = 7;
uint8 constant TENOR = 6;

interface IDepController {
    function addProduct(bytes32 productId, address token, uint8 tenorMonths, uint16 nisbahBps) external;
    function tokenizePlacement(
        bytes32 productId, bytes32 placementId, uint256 nominal, uint64 maturity, uint256 epoch, bytes32[] calldata proof, address investor
    ) external;
}

interface IDepDistributor {
    function fundPeriod(uint16 period, uint256 amount) external;
    function claim() external;
    function claimable(address) external view returns (uint256);
    function profitPerToken() external view returns (uint256);
    function openRedemption() external;
    function fundPrincipal(uint256 amount) external;
    function redeem(uint256 amount) external;
    function redemptionOpen() external view returns (bool);
    function principalEscrow() external view returns (uint256);
    function lastPeriod() external view returns (uint16);
}

interface IIDRX {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

interface IAnchor2 {
    function push(bytes32 root) external returns (uint256 epoch);
}

contract DepositoDistributorTest is TrexFixture {
    address anchor;
    address idrx;
    IDepController controller;
    IDepDistributor dist;
    Token token;
    ModularCompliance mc;
    DistributionCheckpointModule module;

    address operator;
    address bank = makeAddr("bank");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 productId;
    bytes32[] noProof;
    uint64 maturity;

    function setUp() public {
        operator = deployer;
        maturity = uint64(block.timestamp + 180 days);
        _setUpTrex();

        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(LEDGER_CHAIN_ID));
        idrx = deployCode("MockIDRX.sol:MockIDRX");
        controller = IDepController(
            deployCode("DepositoReserveController.sol:DepositoReserveController", abi.encode(anchor, INSTITUTION, operator, operator))
        );

        // Token + compliance + module, distributor wired after deploy.
        (token, mc, module) = _deployTrexToken("Tawf Deposito BPRS Demo 6M", "tDEP-DEMO-6M", 2);

        dist = IDepDistributor(
            deployCode(
                "DepositoDistributor.sol:DepositoDistributor",
                abi.encode(idrx, address(token), address(module), operator, bank)
            )
        );
        _wireDistributor(token, mc, module, address(dist));

        // Controller also mints placements, so it is a token agent too.
        vm.startPrank(operator);
        token.addAgent(address(controller));
        vm.stopPrank();

        productId = keccak256(abi.encode(INSTITUTION, TENOR));
        vm.prank(operator);
        controller.addProduct(productId, address(token), TENOR, 5000);

        _registerVerified(alice, 360);
        _registerVerified(bob, 360);

        // Mint placements: alice 300 sen, bob 100 sen (small numbers keep the math readable).
        _tokenize(keccak256("PA"), 300, alice);
        _tokenize(keccak256("PB"), 100, bob);

        vm.startPrank(bank);
        IIDRX(idrx).approve(address(dist), type(uint256).max);
        vm.stopPrank();
    }

    function _tokenize(bytes32 placementId, uint256 nominal, address investor) internal {
        bytes32 inner = keccak256(abi.encode(LEDGER_CHAIN_ID, DEPOSITO_PLACEMENT, placementId, uint256(nominal), uint256(maturity)));
        bytes32 leaf = keccak256(bytes.concat(inner));
        uint256 epoch = IAnchor2(anchor).push(leaf);
        vm.prank(operator);
        controller.tokenizePlacement(productId, placementId, nominal, maturity, epoch, noProof, investor);
    }

    function _fund(uint16 period, uint256 amount) internal {
        vm.startPrank(bank);
        IIDRX(idrx).faucet(amount);
        dist.fundPeriod(period, amount);
        vm.stopPrank();
    }

    // --- profit ----------------------------------------------------------

    function test_fundPeriodPaysProRata() public {
        _fund(1, 400); // 400 sen over 400 supply -> 1 sen per unit
        assertEq(dist.claimable(alice), 300);
        assertEq(dist.claimable(bob), 100);

        vm.prank(alice);
        dist.claim();
        assertEq(IIDRX(idrx).balanceOf(alice), 300);
        assertEq(dist.claimable(alice), 0);
    }

    function test_periodsSequential() public {
        vm.startPrank(bank);
        IIDRX(idrx).faucet(100);
        vm.expectRevert(abi.encodeWithSignature("PeriodNotSequential(uint16,uint16)", uint16(1), uint16(2)));
        dist.fundPeriod(2, 100);
        vm.stopPrank();
    }

    function test_fundPeriodOnlyFunder() public {
        vm.expectRevert();
        vm.prank(alice);
        dist.fundPeriod(1, 100);
    }

    function test_zeroPeriodMovesNoCash() public {
        _fund(1, 0);
        assertEq(dist.lastPeriod(), 1);
        assertEq(dist.claimable(alice), 0);
    }

    function test_profitFollowsHolderAcrossTransfer() public {
        _fund(1, 400);
        // Alice transfers 100 sen to Bob (both verified). Period 1 stays with holders of record.
        vm.prank(alice);
        token.transfer(bob, 100);
        assertEq(dist.claimable(alice), 300);
        assertEq(dist.claimable(bob), 100);

        _fund(2, 400); // now alice 200, bob 200
        assertEq(dist.claimable(alice), 300 + 200);
        assertEq(dist.claimable(bob), 100 + 200);
    }

    // --- redemption ------------------------------------------------------

    function test_redeemPaysPrincipalPlusProfit() public {
        _fund(1, 400);

        vm.prank(operator);
        dist.openRedemption();
        assertTrue(dist.redemptionOpen());

        vm.startPrank(bank);
        IIDRX(idrx).faucet(400);
        dist.fundPrincipal(400);
        vm.stopPrank();
        assertEq(dist.principalEscrow(), 400);

        vm.prank(alice);
        dist.redeem(300);
        // 300 principal + 300 profit.
        assertEq(IIDRX(idrx).balanceOf(alice), 600);
        assertEq(token.balanceOf(alice), 0);
        assertEq(dist.principalEscrow(), 100);
    }

    function test_redeemBeforeOpenReverts() public {
        vm.expectRevert(bytes4(keccak256("RedemptionNotOpen()")));
        vm.prank(alice);
        dist.redeem(1);
    }

    function test_redeemBeyondBalanceReverts() public {
        vm.prank(operator);
        dist.openRedemption();
        vm.startPrank(bank);
        IIDRX(idrx).faucet(1000);
        dist.fundPrincipal(1000);
        vm.stopPrank();

        vm.expectRevert(bytes4(keccak256("InsufficientBalance()")));
        vm.prank(alice);
        dist.redeem(301);
    }

    function test_redeemWithoutEscrowReverts() public {
        vm.prank(operator);
        dist.openRedemption();
        vm.expectRevert(abi.encodeWithSignature("PrincipalEscrowShort(uint256,uint256)", uint256(300), uint256(0)));
        vm.prank(alice);
        dist.redeem(300);
    }

    function test_openRedemptionOnlyAdminAndOnce() public {
        vm.expectRevert();
        vm.prank(alice);
        dist.openRedemption();

        vm.startPrank(operator);
        dist.openRedemption();
        vm.expectRevert(bytes4(keccak256("RedemptionAlreadyOpen()")));
        dist.openRedemption();
        vm.stopPrank();
    }
}
