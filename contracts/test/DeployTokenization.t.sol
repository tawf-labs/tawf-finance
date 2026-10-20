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
    function subscribe(address token, uint256 coinAmount) external;
    function cancelSubscription(address token) external;
    function allocate(address[] calldata investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] calldata proof) external;
    function distributeProfit(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] calldata proof) external;
    function settleMaturity(uint64 at, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] calldata proof) external;
    function claim(address token) external;
    function redeem(address token) external;
    function pending(address investor, address token) external view returns (uint256);
    function claimableSen(address investor) external view returns (uint256);
    function reserve() external view returns (uint256);
    function isFullyBacked() external view returns (bool);
    function grantRole(bytes32 role, address account) external;
}

interface ISukukT {
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external;
    function updateReserve(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] calldata proof) external;
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
    bytes32 constant SUKUK_RESERVE = keccak256("tawf.sukuk.reserve");

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
        ISeriesT(d.series).subscribe(d.mockUsdc, 100e6);
        vm.stopPrank();
    }

    function test_seriesSubscribeAllocateWithinBalance() public {
        address id = _verify(user);
        _addClaim(id, 2); // TAWF_SCREENED
        _openScreenedGroup();

        // 60 USDC (rate 16,250.00) + 40 USDT (rate 16,240.00), converted at each
        // coin's own rate and summed in sen.
        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(60e6);
        IMintable(d.mockUsdc).approve(d.series, 60e6);
        ISeriesT(d.series).subscribe(d.mockUsdc, 60e6);
        IMintable(d.mockUsdt).faucet(40e6);
        IMintable(d.mockUsdt).approve(d.series, 40e6);
        ISeriesT(d.series).subscribe(d.mockUsdt, 40e6);
        vm.stopPrank();
        assertEq(ISeriesT(d.series).pending(user, d.mockUsdc), 60e6);
        assertEq(ISeriesT(d.series).pending(user, d.mockUsdt), 40e6);

        uint256 expectedSen =
            (60e6 * d.fxInitialRateUsdc) / 1e6 + (40e6 * d.fxInitialRateUsdt) / 1e6;

        // Anchor the account balance covering that supply.
        uint256 e = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, d.seriesId, 1000, expectedSen));
        bytes32[] memory noProof;
        vm.prank(operator);
        ISeriesT(d.series).allocate(_one(user), e, 1000, expectedSen, noProof);

        assertEq(Token(d.seriesToken).balanceOf(user), expectedSen);
        assertEq(ISeriesT(d.series).pending(user, d.mockUsdc), 0);
        assertEq(ISeriesT(d.series).pending(user, d.mockUsdt), 0);
        assertTrue(ISeriesT(d.series).isFullyBacked());
    }

    function test_seriesAllocateAboveBalanceReverts() public {
        address id = _verify(user);
        _addClaim(id, 2);
        _openScreenedGroup();

        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(d.mockUsdc, 100e6);
        vm.stopPrank();

        uint256 mintedSen = (100e6 * d.fxInitialRateUsdc) / 1e6;
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
        IMintable(d.mockUsdt).faucet(100e6);
        IMintable(d.mockUsdt).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(d.mockUsdt, 100e6);
        uint256 before = IMintable(d.mockUsdt).balanceOf(user);
        ISeriesT(d.series).cancelSubscription(d.mockUsdt);
        vm.stopPrank();
        assertEq(IMintable(d.mockUsdt).balanceOf(user), before + 100e6);
        assertEq(ISeriesT(d.series).pending(user, d.mockUsdt), 0);
    }

    function test_seriesProfitAndMaturity() public {
        address id = _verify(user);
        _addClaim(id, 2);
        _openScreenedGroup();

        vm.startPrank(user);
        IMintable(d.mockUsdc).faucet(100e6);
        IMintable(d.mockUsdc).approve(d.series, 100e6);
        ISeriesT(d.series).subscribe(d.mockUsdc, 100e6);
        vm.stopPrank();

        uint256 sen = (100e6 * d.fxInitialRateUsdc) / 1e6;
        bytes32[] memory noProof;
        uint256 er = IAnchorMut(anchor).push(_leaf(DEPOSITO_RESERVE, d.seriesId, 1000, sen));
        vm.prank(operator);
        ISeriesT(d.series).allocate(_one(user), er, 1000, sen, noProof);

        // Distribute profit for period 1: accrued in sen, no coin pulled up front.
        // profitSen chosen as 1 USDC worth at the USDC rate.
        uint256 profitSen = d.fxInitialRateUsdc; // 1 USDC at the USDC rate
        uint256 ep = IAnchorMut(anchor).push(_leaf(DEPOSITO_PROFIT, d.seriesId, 1, profitSen));
        vm.prank(operator);
        ISeriesT(d.series).distributeProfit(1, profitSen, ep, noProof);

        assertEq(ISeriesT(d.series).claimableSen(user), profitSen);
        // Fund the treasury (operator) so it can pay the claim; it pre-approved
        // the series for both coins at deploy.
        uint256 principalUsdc = (sen * 1e6) / d.fxInitialRateUsdc; // == 100e6
        vm.prank(operator);
        IMintable(d.mockUsdc).faucet(1e6 + principalUsdc);
        // Claim in USDC: the treasury (operator, pre-approved in deploy) pays.
        vm.prank(user);
        ISeriesT(d.series).claim(d.mockUsdc);
        assertEq(IMintable(d.mockUsdc).balanceOf(user), 1e6);

        // Settle maturity: principal = minted sen. Redeem in USDC, pulled from treasury.
        // Period 1 was distributed above, so the bank's maturity fact carries finalPeriod 1.
        uint256 em = IAnchorMut(anchor).push(_leaf(DEPOSITO_MATURITY, d.seriesId, (uint256(1) << 64) | 2000, sen));
        vm.prank(operator);
        ISeriesT(d.series).settleMaturity(2000, 1, sen, em, noProof);

        vm.prank(user);
        ISeriesT(d.series).redeem(d.mockUsdc);
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

        // Subscription needs a recent verified reserve snapshot covering supply.
        uint256 eR = IAnchorMut(anchor).push(_leaf(SUKUK_RESERVE, sukukId, block.timestamp, faceValue));
        ISukukT(distributor).updateReserve(uint64(block.timestamp), faceValue, eR, noProof);

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
        assertTrue(d.mockUsdc != address(0), "mock usdc");
        assertTrue(d.mockUsdt != address(0), "mock usdt");
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
