// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Mirrors the DeployTokenization wiring and asserts the operator-only KYC + deposito + sukuk flows
// the demo backend performs. Pinned to 0.8.17 for the same reasons as DeployTokenization.

import "forge-std/Test.sol";

import {DeployTokenization} from "../script/DeployTokenization.s.sol";

import {IdentityRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";

interface IAnchorMut {
    function push(bytes32 root) external returns (uint256 epoch);
}

interface IDepControllerT {
    function tokenizePlacement(
        bytes32 productId, bytes32 placementId, uint256 nominal, uint64 maturity, uint256 epoch, bytes32[] calldata proof, address investor
    ) external;
    function updateReserve(bytes32 productId, uint64 snapshotAt, uint256 totalPlaced, uint256 epoch, bytes32[] calldata proof) external;
}

interface IDepDistributorT {
    function openRedemption() external;
    function fundPrincipal(uint256 amount) external;
    function redeem(uint256 amount) external;
}

interface ISukukT {
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external;
    function subscribe(uint256 amount) external;
    function updateReserve(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] calldata proof) external;
    function token() external view returns (address);
}

interface IMintable {
    function faucet(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

contract DeployTokenizationTest is Test, DeployTokenization {
    uint256 internal operatorKey = 0xA11CE;
    address internal operator;
    uint256 internal userKey = 0xBEEF;
    address internal user;
    address internal outsider = makeAddr("outsider");

    address internal anchor;
    DeployTokenization.Deployment internal d;

    bytes32 constant DEPOSITO_PLACEMENT = keccak256("tawf.deposito.placement");
    bytes32 constant DEPOSITO_RESERVE = keccak256("tawf.deposito.reserve");
    bytes32 constant SUKUK_APPROVED = keccak256("tawf.sukuk.approved");

    function setUp() public {
        operator = vm.addr(operatorKey);
        user = vm.addr(userKey);

        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(uint256(1)));

        vm.startPrank(operator);
        d = _deployAll(operator, anchor, 1);
        vm.stopPrank();
    }

    /// @dev Register `wallet` as verified, operator-only (operator is ClaimIssuer management key).
    function _verify(address wallet) internal {
        vm.startPrank(operator);
        bytes memory proxyCode = vm.getCode("IdentityProxy.sol:IdentityProxy");
        bytes memory initCode = abi.encodePacked(proxyCode, abi.encode(d.shared.implementationAuthority, operator));
        address identity;
        assembly {
            identity := create(0, add(initCode, 0x20), mload(initCode))
        }
        bytes memory claimData = abi.encodePacked("KYC-OK");
        bytes32 dataHash = keccak256(abi.encode(identity, KYC_TOPIC, claimData));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);
        Identity(identity).addClaim(KYC_TOPIC, 1, d.shared.claimIssuer, sig, claimData, "");
        IdentityRegistry(d.shared.identityRegistry).registerIdentity(wallet, IIdentity(identity), COUNTRY_ID);
        vm.stopPrank();
    }

    function _leaf(bytes32 kind, bytes32 subject, uint256 a, uint256 b) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(uint256(1), kind, subject, a, b))));
    }

    // --- deposito flow ---------------------------------------------------

    function test_depositoFlow_tokenizeThenRedeem() public {
        _verify(user);
        bytes32 productId = d.productIds[0]; // 1M tenor
        address token = d.depositoTokens[0];
        address distributor = d.depositoDistributors[0];
        uint64 maturity = uint64(block.timestamp + 30 days);

        // Reserve snapshot covers the placement.
        uint256 er = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, productId, 100, 1_000_000));
        bytes32[] memory noProof;
        IDepControllerT(d.depositoController).updateReserve(productId, 100, 1_000_000, er, noProof);

        // Tokenize a 500,000 sen placement to the user.
        uint256 ep = IAnchorMut(anchor).push(_leaf(DEPOSITO_PLACEMENT, keccak256("PL1"), 500_000, maturity));
        vm.prank(operator);
        IDepControllerT(d.depositoController).tokenizePlacement(productId, keccak256("PL1"), 500_000, maturity, ep, noProof, user);
        assertEq(Token(token).balanceOf(user), 500_000);

        // Redeem at maturity: operator opens, funds principal, user redeems.
        vm.prank(operator);
        IDepDistributorT(distributor).openRedemption();
        vm.startPrank(operator);
        IMintable(d.idrx).faucet(500_000);
        IMintable(d.idrx).approve(distributor, 500_000);
        vm.stopPrank();
        // Funder role on the distributor is the operator (admin==funder in the script).
        vm.prank(operator);
        IDepDistributorT(distributor).fundPrincipal(500_000);

        vm.prank(user);
        IDepDistributorT(distributor).redeem(500_000);
        assertEq(IMintable(d.idrx).balanceOf(user), 500_000);
        assertEq(Token(token).balanceOf(user), 0);
    }

    function test_depositoPlacementNotOnLedgerReverts() public {
        _verify(user);
        bytes32 productId = d.productIds[0];
        uint64 maturity = uint64(block.timestamp + 30 days);
        bytes32[] memory noProof;
        // Anchor a different nominal; proving 500,000 fails.
        uint256 ep = IAnchorMut(anchor).push(_leaf(DEPOSITO_PLACEMENT, keccak256("PL1"), 1, maturity));
        vm.expectRevert(bytes4(keccak256("ProofInvalid()")));
        vm.prank(operator);
        IDepControllerT(d.depositoController).tokenizePlacement(productId, keccak256("PL1"), 500_000, maturity, ep, noProof, user);
    }

    function test_depositoSupplyAboveReserveReverts() public {
        _verify(user);
        bytes32 productId = d.productIds[1]; // 3M tenor
        uint64 maturity = uint64(block.timestamp + 90 days);
        bytes32[] memory noProof;

        uint256 er = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, productId, 10, 100_000));
        IDepControllerT(d.depositoController).updateReserve(productId, 10, 100_000, er, noProof);

        uint256 ep = IAnchorMut(anchor).push(_leaf(DEPOSITO_PLACEMENT, keccak256("PL2"), 500_000, maturity));
        vm.expectRevert(abi.encodeWithSignature("ReserveInsufficient(uint256,uint256)", uint256(500_000), uint256(100_000)));
        vm.prank(operator);
        IDepControllerT(d.depositoController).tokenizePlacement(productId, keccak256("PL2"), 500_000, maturity, ep, noProof, user);
    }

    function test_depositoTransferToUnverifiedReverts() public {
        _verify(user);
        bytes32 productId = d.productIds[0];
        address token = d.depositoTokens[0];
        uint64 maturity = uint64(block.timestamp + 30 days);
        bytes32[] memory noProof;

        uint256 ep = IAnchorMut(anchor).push(_leaf(DEPOSITO_PLACEMENT, keccak256("PL1"), 500_000, maturity));
        vm.prank(operator);
        IDepControllerT(d.depositoController).tokenizePlacement(productId, keccak256("PL1"), 500_000, maturity, ep, noProof, user);

        vm.expectRevert(bytes("Transfer not possible"));
        vm.prank(user);
        Token(token).transfer(outsider, 1);
    }

    // --- sukuk flow ------------------------------------------------------

    function test_sukukFlow_openAndSubscribe() public {
        _verify(user);
        address distributor = d.sukukDistributor;
        address token = ISukukT(distributor).token();
        bytes32[] memory noProof;

        // The script set faceValue 500_000e6 and maturity = deploy block.timestamp + 365 days. No
        // time passes between setUp and here, so we can reconstruct the exact approved terms.
        uint256 faceValue = 500_000e6;
        uint40 maturity = uint40(block.timestamp + 365 days);
        bytes32 sukukId = keccak256("sukuk.demo.2026");

        uint256 epoch = IAnchorMut(anchor).push(_leaf(SUKUK_APPROVED, sukukId, faceValue, maturity));
        vm.prank(operator);
        ISukukT(distributor).openSubscription(epoch, noProof);

        // Verified user subscribes with MockUSDC (6 decimals).
        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(10e6);
        IMintable(d.mockUsdc).approve(distributor, 10e6);
        ISukukT(distributor).subscribe(10e6);
        vm.stopPrank();
        assertEq(Token(token).balanceOf(user), 10e6);

        // An unverified outsider cannot subscribe.
        vm.startPrank(outsider);
        IMintable(d.mockUsdc).faucet(10e6);
        IMintable(d.mockUsdc).approve(distributor, 10e6);
        vm.expectRevert(abi.encodeWithSignature("NotEligible(address)", outsider));
        ISukukT(distributor).subscribe(10e6);
        vm.stopPrank();
    }

    function test_deploymentShape() public {
        assertEq(d.chainId, block.chainid);
        assertEq(d.operator, operator);
        assertEq(d.depositoTokens.length, 4);
        for (uint256 i = 0; i < 4; i++) {
            assertTrue(d.depositoTokens[i] != address(0), "deposito token");
            assertTrue(d.depositoDistributors[i] != address(0), "deposito distributor");
            assertEq(d.productIds[i], keccak256(abi.encode(keccak256("bprs.demo"), d.tenors[i])));
        }
        assertTrue(d.sukukToken != address(0));
        assertTrue(d.sukukDistributor != address(0));
        assertTrue(d.dealRegistry != address(0));
        assertTrue(d.redemptionVault != address(0));
    }
}
