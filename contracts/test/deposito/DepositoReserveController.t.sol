// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Pinned to 0.8.17 for the concrete T-REX token + ONCHAINID identities. The
// DepositoReserveController (^0.8.24) and MockLedgerAnchor (^0.8.20) are reached via
// vm.deployCode and minimal interfaces.

import {TrexFixture} from "../trex/TrexFixture.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {DistributionCheckpointModule} from "../../src/sukuk/DistributionCheckpointModule.sol";

bytes32 constant INSTITUTION = keccak256("bprs.demo");
bytes32 constant DEPOSITO_PLACEMENT = keccak256("tawf.deposito.placement");
bytes32 constant DEPOSITO_RESERVE = keccak256("tawf.deposito.reserve");
uint256 constant LEDGER_CHAIN_ID = 42;

interface IController {
    function addProduct(bytes32 productId, address token, uint8 tenorMonths, uint16 nisbahBps) external;
    function tokenizePlacement(
        bytes32 productId,
        bytes32 placementId,
        uint256 nominal,
        uint64 maturity,
        uint256 epoch,
        bytes32[] calldata proof,
        address investor
    ) external;
    function updateReserve(bytes32 productId, uint64 snapshotAt, uint256 totalPlaced, uint256 epoch, bytes32[] calldata proof) external;
    function reserveOf(bytes32 productId) external view returns (uint256);
    function reserveRatioBps(bytes32 productId) external view returns (uint256);
    function isFullyBacked(bytes32 productId) external view returns (bool);
    function placementUsed(bytes32 placementId) external view returns (bool);
    function products() external view returns (bytes32[] memory);
    function ISSUER_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
}

interface IAnchor {
    function ledgerChainId() external view returns (uint256);
    function push(bytes32 root) external returns (uint256 epoch);
}

contract DepositoReserveControllerTest is TrexFixture {
    address anchor;
    IController controller;
    Token token;

    address operator; // deployer, holds every role
    address investor = makeAddr("depositoInvestor");
    address stranger = makeAddr("stranger");

    bytes32 productId;
    bytes32[] noProof;

    uint8 constant TENOR = 3;
    uint16 constant NISBAH = 4500;

    function setUp() public {
        operator = deployer;
        _setUpTrex();

        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(LEDGER_CHAIN_ID));
        controller = IController(
            deployCode(
                "DepositoReserveController.sol:DepositoReserveController",
                abi.encode(anchor, INSTITUTION, operator, operator)
            )
        );

        // One deposito product token (2 decimals, sen). No distributor needed for these tests, so
        // deploy the token wired with the controller as its only agent via a throwaway module hook.
        (token,,) = _deployTrexToken("Tawf Deposito BPRS Demo 3M", "tDEP-DEMO-3M", 2);
        vm.startPrank(operator);
        token.addAgent(address(controller));
        token.addAgent(operator);
        token.unpause();
        vm.stopPrank();

        productId = keccak256(abi.encode(INSTITUTION, TENOR));
        vm.prank(operator);
        controller.addProduct(productId, address(token), TENOR, NISBAH);

        _registerVerified(investor, 360);
    }

    function _leafPlacement(bytes32 placementId, uint256 nominal, uint64 maturity) internal pure returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(LEDGER_CHAIN_ID, DEPOSITO_PLACEMENT, placementId, uint256(nominal), uint256(maturity)));
        return keccak256(bytes.concat(inner));
    }

    function _leafReserve(uint64 snapshotAt, uint256 totalPlaced) internal view returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(LEDGER_CHAIN_ID, DEPOSITO_RESERVE, productId, uint256(snapshotAt), uint256(totalPlaced)));
        return keccak256(bytes.concat(inner));
    }

    function _anchorPlacement(bytes32 placementId, uint256 nominal, uint64 maturity) internal returns (uint256) {
        return IAnchor(anchor).push(_leafPlacement(placementId, nominal, maturity));
    }

    function _anchorReserve(uint64 snapshotAt, uint256 totalPlaced) internal returns (uint256) {
        return IAnchor(anchor).push(_leafReserve(snapshotAt, totalPlaced));
    }

    // --- products --------------------------------------------------------

    function test_addProductRegistersAndIsAdminOnly() public {
        bytes32[] memory ids = controller.products();
        assertEq(ids.length, 1);
        assertEq(ids[0], productId);

        vm.expectRevert(); // OZ v5 AccessControlUnauthorizedAccount
        vm.prank(stranger);
        controller.addProduct(keccak256("x"), address(token), 6, 5000);
    }

    function test_addProductDuplicateReverts() public {
        vm.expectRevert(abi.encodeWithSignature("ProductExists(bytes32)", productId));
        vm.prank(operator);
        controller.addProduct(productId, address(token), TENOR, NISBAH);
    }

    // --- tokenize --------------------------------------------------------

    function test_tokenizePlacementMintsToVerifiedInvestor() public {
        uint64 maturity = uint64(block.timestamp + 90 days);
        uint256 epoch = _anchorPlacement(keccak256("P1"), 1_000_000, maturity); // 10,000.00 IDR in sen

        vm.prank(operator);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, epoch, noProof, investor);

        assertEq(token.balanceOf(investor), 1_000_000);
        assertEq(token.totalSupply(), 1_000_000);
        assertTrue(controller.placementUsed(keccak256("P1")));
    }

    function test_tokenizePlacementNotOnLedgerReverts() public {
        uint64 maturity = uint64(block.timestamp + 90 days);
        // Anchor a placement for a different nominal; proving the real one fails.
        uint256 epoch = _anchorPlacement(keccak256("P1"), 999, maturity);
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(operator);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, epoch, noProof, investor);
    }

    function test_tokenizePlacementToUnverifiedReverts() public {
        uint64 maturity = uint64(block.timestamp + 90 days);
        uint256 epoch = _anchorPlacement(keccak256("P1"), 1_000_000, maturity);
        // T-REX mint rejects an unverified receiver.
        vm.expectRevert(bytes("Identity is not verified."));
        vm.prank(operator);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, epoch, noProof, stranger);
    }

    function test_tokenizePlacementOnlyIssuer() public {
        uint64 maturity = uint64(block.timestamp + 90 days);
        uint256 epoch = _anchorPlacement(keccak256("P1"), 1_000_000, maturity);
        vm.expectRevert();
        vm.prank(stranger);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, epoch, noProof, investor);
    }

    function test_placementCannotBeReused() public {
        uint64 maturity = uint64(block.timestamp + 90 days);
        uint256 epoch = _anchorPlacement(keccak256("P1"), 1_000_000, maturity);
        vm.startPrank(operator);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, epoch, noProof, investor);
        vm.expectRevert(abi.encodeWithSignature("PlacementAlreadyUsed(bytes32)", keccak256("P1")));
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, epoch, noProof, investor);
        vm.stopPrank();
    }

    // --- reserve ---------------------------------------------------------

    function test_updateReservePermissionlessAndStrictlyNewer() public {
        uint256 e1 = _anchorReserve(100, 5_000_000);
        // Anyone may submit the proof.
        vm.prank(stranger);
        controller.updateReserve(productId, 100, 5_000_000, e1, noProof);
        assertEq(controller.reserveOf(productId), 5_000_000);

        uint256 e2 = _anchorReserve(100, 6_000_000);
        vm.expectRevert(abi.encodeWithSignature("StaleReserve(uint64,uint64)", uint64(100), uint64(100)));
        controller.updateReserve(productId, 100, 6_000_000, e2, noProof);

        uint256 e3 = _anchorReserve(200, 6_000_000);
        controller.updateReserve(productId, 200, 6_000_000, e3, noProof);
        assertEq(controller.reserveOf(productId), 6_000_000);
    }

    function test_supplyAboveReserveReverts() public {
        // Reserve says only 500,000 sen placed.
        uint256 er = _anchorReserve(10, 500_000);
        controller.updateReserve(productId, 10, 500_000, er, noProof);

        // Minting 1,000,000 would exceed the verified reserve.
        uint64 maturity = uint64(block.timestamp + 90 days);
        uint256 ep = _anchorPlacement(keccak256("P1"), 1_000_000, maturity);
        vm.expectRevert(abi.encodeWithSignature("ReserveInsufficient(uint256,uint256)", uint256(1_000_000), uint256(500_000)));
        vm.prank(operator);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, ep, noProof, investor);
    }

    function test_reserveViews() public {
        assertEq(controller.reserveRatioBps(productId), 10_000); // zero supply -> 100%
        uint256 er = _anchorReserve(10, 2_000_000);
        controller.updateReserve(productId, 10, 2_000_000, er, noProof);

        uint64 maturity = uint64(block.timestamp + 90 days);
        uint256 ep = _anchorPlacement(keccak256("P1"), 1_000_000, maturity);
        vm.prank(operator);
        controller.tokenizePlacement(productId, keccak256("P1"), 1_000_000, maturity, ep, noProof, investor);

        // 2,000,000 reserve over 1,000,000 supply == 20000 bps.
        assertEq(controller.reserveRatioBps(productId), 20_000);
        assertTrue(controller.isFullyBacked(productId));
    }

    function test_rolesWired() public {
        assertTrue(controller.hasRole(controller.ISSUER_ROLE(), operator));
        assertTrue(controller.hasRole(controller.DEFAULT_ADMIN_ROLE(), operator));
        assertFalse(controller.hasRole(controller.ISSUER_ROLE(), stranger));
    }
}
