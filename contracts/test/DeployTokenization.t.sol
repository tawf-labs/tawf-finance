// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Mirrors the DeployTokenization wiring and asserts the operator-only KYC + Tawf deposito series
// (Model B) + sukuk flows the demo backend performs. Pinned to 0.8.17 for the same reasons as
// DeployTokenization. The Tawf contracts (TawfDepositoSeries 0.8.24, SukukDistributor 0.8.20) are
// reached via vm.deployCode-created addresses through minimal interfaces.

import "forge-std/Test.sol";

import {DeployTokenization} from "../script/DeployTokenization.s.sol";
import {SandboxModule} from "../src/deposito/SandboxModule.sol";

import {IdentityRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";

interface IAnchorMut {
    function push(bytes32 root) external returns (uint256 epoch);
}

interface ISeriesT {
    function subscribe(uint256 usdcAmount) external;
    function cancelSubscription() external;
    function allocate(address[] calldata investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] calldata proof) external;
    function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] calldata proof) external;
    function settleMaturity(uint64 at, uint256 principalSen, uint256 epoch, bytes32[] calldata proof) external;
    function claim() external;
    function redeem() external;
    function pending(address investor) external view returns (uint256);
    function claimable(address investor) external view returns (uint256);
    function reserve() external view returns (uint256);
    function isFullyBacked() external view returns (bool);
    function grantRole(bytes32 role, address account) external;
}

interface ISukukT {
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external;
    function subscribe(uint256 amount) external;
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

    bytes32 constant DEPOSITO_RESERVE = keccak256("tawf.deposito.reserve");
    bytes32 constant DEPOSITO_PROFIT = keccak256("tawf.deposito.profit");
    bytes32 constant DEPOSITO_MATURITY = keccak256("tawf.deposito.maturity");
    bytes32 constant SUKUK_APPROVED = keccak256("tawf.sukuk.approved");

    function setUp() public {
        operator = vm.addr(operatorKey);
        user = vm.addr(userKey);

        anchor = deployCode("MockLedgerAnchor.sol:MockLedgerAnchor", abi.encode(uint256(1)));

        vm.setEnv("SUKUK_ID", vm.toString(bytes32(keccak256("sukuk.demo.2026"))));
        vm.setEnv("SUKUK_FACE", vm.toString(uint256(500_000e6)));
        vm.setEnv("SUKUK_MATURITY", vm.toString(uint256(block.timestamp + 365 days)));

        vm.startPrank(operator);
        d = _deployAll(operator, anchor, 1);
        vm.stopPrank();
    }

    /// @dev Register `wallet` as verified (KYC topic 1), operator-only.
    function _verify(address wallet) internal returns (address identity) {
        identity = _deployIdentity(wallet);
        _addClaim(identity, KYC_TOPIC);
        vm.prank(operator);
        IdentityRegistry(d.shared.identityRegistry).registerIdentity(wallet, IIdentity(identity), COUNTRY_ID);
    }

    function _deployIdentity(address) internal returns (address identity) {
        vm.startPrank(operator);
        bytes memory proxyCode = vm.getCode("IdentityProxy.sol:IdentityProxy");
        bytes memory initCode = abi.encodePacked(proxyCode, abi.encode(d.shared.implementationAuthority, operator));
        assembly {
            identity := create(0, add(initCode, 0x20), mload(initCode))
        }
        vm.stopPrank();
    }

    /// @dev Add an operator-signed claim of `topic` to `identity` (topic 1 KYC,
    ///      2 TAWF_SCREENED, 3 OJK_SANDBOX_PARTICIPANT). Same mechanics as the
    ///      app's _lib/identity.ts.
    function _addClaim(address identity, uint256 topic) internal {
        bytes memory claimData = abi.encodePacked("OK");
        bytes32 dataHash = keccak256(abi.encode(identity, topic, claimData));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(operator);
        Identity(identity).addClaim(topic, 1, d.shared.claimIssuer, sig, claimData, "");
    }

    function _leaf(bytes32 kind, bytes32 subject, uint256 a, uint256 b) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(uint256(1), kind, subject, a, b))));
    }

    function _one(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    // --- Tawf deposito series (Model B) ----------------------------------
    // The default mode is PILOT_ONLY, so only the operator (treasury) may hold.
    // Switch the SandboxModule to SCREENED_GROUP and issue a screening claim so
    // the user can subscribe and be allocated.

    function _openScreenedGroup() internal {
        // Move mode to SCREENED_GROUP via the compliance owner (operator).
        // ModularCompliance.callModuleFunction executes onlyComplianceCall fns.
        vm.startPrank(operator);
        _callModule(abi.encodeWithSelector(SandboxModule.setMode.selector, SandboxModule.Mode.SCREENED_GROUP));
        vm.stopPrank();
    }

    function _callModule(bytes memory data) internal {
        // The series token's compliance owns the modules; use its
        // callModuleFunction to invoke an onlyComplianceCall setter.
        IModularComplianceCall(_complianceOfSeries()).callModuleFunction(data, d.sandboxModule);
    }

    function _complianceOfSeries() internal view returns (address) {
        return IHasCompliance(d.seriesToken).compliance();
    }

    function test_seriesPilotOnlyByDefault() public {
        // A verified user with no screening claim cannot subscribe under PILOT_ONLY.
        _verify(user);
        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        vm.expectRevert(abi.encodeWithSignature("NotEligible(address)", user));
        ISeriesT(d.series).subscribe(100e6);
        vm.stopPrank();
    }

    function test_seriesSubscribeAllocateWithinBalance() public {
        address id = _verify(user);
        _addClaim(id, 2); // TAWF_SCREENED
        _openScreenedGroup();

        // 100 USDC subscribed. Rate 16,000.00 IDR/USDC -> 1,600,000.00 sen = 160,000,000 sen.
        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(100e6);
        vm.stopPrank();
        assertEq(ISeriesT(d.series).pending(user), 100e6);

        uint256 expectedSen = (100e6 * d.fxInitialRate) / 1e6; // 160,000,000 sen

        // Anchor the account balance covering that supply.
        uint256 e = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, d.seriesId, 1000, expectedSen));
        bytes32[] memory noProof;
        vm.prank(operator);
        ISeriesT(d.series).allocate(_one(user), e, 1000, expectedSen, noProof);

        assertEq(Token(d.seriesToken).balanceOf(user), expectedSen);
        assertEq(ISeriesT(d.series).pending(user), 0);
        assertTrue(ISeriesT(d.series).isFullyBacked());
    }

    function test_seriesAllocateAboveBalanceReverts() public {
        address id = _verify(user);
        _addClaim(id, 2);
        _openScreenedGroup();

        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(100e6);
        vm.stopPrank();

        uint256 mintedSen = (100e6 * d.fxInitialRate) / 1e6;
        // Anchor a balance below what the allocation would mint.
        uint256 e = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, d.seriesId, 1000, mintedSen - 1));
        bytes32[] memory noProof;
        vm.expectRevert(abi.encodeWithSignature("ReserveInsufficient(uint256,uint256)", mintedSen, mintedSen - 1));
        vm.prank(operator);
        ISeriesT(d.series).allocate(_one(user), e, 1000, mintedSen - 1, noProof);
    }

    function test_seriesCancelBeforeAllocation() public {
        address id = _verify(user);
        _addClaim(id, 2);
        _openScreenedGroup();

        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(100e6);
        uint256 before = IMintable(d.mockUsdc).balanceOf(user);
        ISeriesT(d.series).cancelSubscription();
        vm.stopPrank();
        assertEq(IMintable(d.mockUsdc).balanceOf(user), before + 100e6);
        assertEq(ISeriesT(d.series).pending(user), 0);
    }

    function test_seriesProfitAndMaturity() public {
        address id = _verify(user);
        _addClaim(id, 2);
        _openScreenedGroup();

        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(100e6);
        vm.stopPrank();

        uint256 sen = (100e6 * d.fxInitialRate) / 1e6;
        bytes32[] memory noProof;
        uint256 er = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, d.seriesId, 1000, sen));
        vm.prank(operator);
        ISeriesT(d.series).allocate(_one(user), er, 1000, sen, noProof);

        // Distribute profit for period 1: profitSen -> USDC at the rate, funded by the treasury.
        uint256 profitSen = 1_600_000; // 16,000.00 IDR -> 1 USDC
        // Treasury (operator) funds + approves the series for the USDC equivalent.
        vm.startPrank(operator);
        IMintable(d.mockUsdc).faucet(1e6);
        IMintable(d.mockUsdc).approve(d.series, 1e6);
        vm.stopPrank();
        uint256 ep = IAnchorMut(anchor).push(_leaf(DEPOSITO_PROFIT, d.seriesId, 1, profitSen));
        vm.prank(operator);
        ISeriesT(d.series).distributeProfit(1, profitSen, ep, noProof);

        assertEq(ISeriesT(d.series).claimable(user), 1e6);
        vm.prank(user);
        ISeriesT(d.series).claim();
        assertEq(IMintable(d.mockUsdc).balanceOf(user), 1e6);

        // Settle maturity: principal = minted sen, funded in USDC by the treasury.
        uint256 principalUsdc = (sen * 1e6) / d.fxInitialRate; // == 100e6
        vm.startPrank(operator);
        IMintable(d.mockUsdc).faucet(principalUsdc);
        IMintable(d.mockUsdc).approve(d.series, principalUsdc);
        vm.stopPrank();
        uint256 em = IAnchorMut(anchor).push(_leaf(DEPOSITO_MATURITY, d.seriesId, 2000, sen));
        vm.prank(operator);
        ISeriesT(d.series).settleMaturity(2000, sen, em, noProof);

        vm.prank(user);
        ISeriesT(d.series).redeem();
        assertEq(Token(d.seriesToken).balanceOf(user), 0);
        // User received principal back (plus the already-claimed profit).
        assertEq(IMintable(d.mockUsdc).balanceOf(user), 1e6 + principalUsdc);
    }

    // --- sukuk flow ------------------------------------------------------

    function test_sukukFlow_openAndSubscribe() public {
        _verify(user);
        address distributor = d.sukukDistributor;
        address token = ISukukT(distributor).token();
        bytes32[] memory noProof;

        uint256 faceValue = 500_000e6;
        uint40 maturity = uint40(block.timestamp + 365 days);
        bytes32 sukukId = keccak256("sukuk.demo.2026");

        uint256 epoch = IAnchorMut(anchor).push(_leaf(SUKUK_APPROVED, sukukId, faceValue, maturity));
        vm.prank(operator);
        ISukukT(distributor).openSubscription(epoch, noProof);

        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(10e6);
        IMintable(d.mockUsdc).approve(distributor, 10e6);
        ISukukT(distributor).subscribe(10e6);
        vm.stopPrank();
        assertEq(Token(token).balanceOf(user), 10e6);
    }

    function test_deploymentShape() public {
        assertEq(d.chainId, block.chainid);
        assertEq(d.operator, operator);
        assertTrue(d.seriesToken != address(0), "series token");
        assertTrue(d.series != address(0), "series");
        assertTrue(d.sandboxModule != address(0), "sandbox module");
        assertEq(d.seriesId, keccak256("tawf.series.1"));
        assertTrue(d.sukukToken != address(0));
        assertTrue(d.sukukDistributor != address(0));
        assertTrue(d.dealRegistry != address(0));
        assertTrue(d.redemptionVault != address(0));
    }
}

interface IModularComplianceCall {
    function callModuleFunction(bytes calldata callData, address module) external;
}

interface IHasCompliance {
    function compliance() external view returns (address);
}
