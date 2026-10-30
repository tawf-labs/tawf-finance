// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// The operator may run the sandbox settings through the guard and nothing else. Changing the investor
// rules (addModule, removeModule, bindToken) takes the timelock.

import { TrexFixture } from "../trex/TrexFixture.sol";
import { ComplianceGuard } from "../../src/governance/ComplianceGuard.sol";
import { ModuleProxies } from "../../src/proxy/ModuleProxies.sol";
import { SandboxModule } from "../../src/deposito/SandboxModule.sol";
import { DistributionCheckpointModule } from "../../src/sukuk/DistributionCheckpointModule.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";

contract ComplianceGuardTest is TrexFixture {
    address internal operator = address(0x0BE7A);
    address internal stranger = address(0xBAD);
    address internal tl = address(0x71AE);

    Token internal token;
    ModularCompliance internal mc;
    SandboxModule internal sandbox;
    ComplianceGuard internal guard;

    function setUp() public {
        _setUpTrex();
        (token, mc,) = _deployTrexToken("Guarded", "tGRD", 2);
        vm.startPrank(deployer);
        sandbox = ModuleProxies.sandbox();
        sandbox.setConfigurer(operator);
        vm.stopPrank();
        vm.prank(operator);
        sandbox.initConfig(address(mc), SandboxModule.Mode.PILOT_ONLY, operator, address(claimIssuer), 0, 0, 0, uint64(block.timestamp + 90 days));
        vm.prank(deployer);
        mc.addModule(address(sandbox));

        // Hand-over: the guard owns the compliance, the timelock owns the guard (two-step).
        guard = new ComplianceGuard(mc, address(sandbox), operator);
        vm.prank(deployer);
        mc.transferOwnership(address(guard));
        guard.transferOwnership(tl);
        vm.prank(tl);
        guard.acceptOwnership();
    }

    function _setMode(SandboxModule.Mode m) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(SandboxModule.setMode.selector, m);
    }

    function test_operatorCanRunTheThreeSandboxSettings() public {
        vm.startPrank(operator);
        guard.callModuleFunction(_setMode(SandboxModule.Mode.SCREENED_GROUP), address(sandbox));
        guard.callModuleFunction(abi.encodeWithSelector(SandboxModule.setCaps.selector, 5, 10_000, 20_000), address(sandbox));
        guard.callModuleFunction(abi.encodeWithSelector(SandboxModule.setSeriesEnd.selector, uint64(block.timestamp + 30 days)), address(sandbox));
        vm.stopPrank();
        (SandboxModule.Mode m,,,,,,,) = sandbox.configOf(address(mc));
        assertEq(uint8(m), uint8(SandboxModule.Mode.SCREENED_GROUP));
    }

    function test_operatorCannotReachMoneyOrTrustSettersOrOtherModules() public {
        vm.startPrank(operator);
        vm.expectRevert("ComplianceGuard: selector not allowed");
        guard.callModuleFunction(abi.encodeWithSelector(SandboxModule.setTreasury.selector, operator), address(sandbox));
        vm.expectRevert("ComplianceGuard: selector not allowed");
        guard.callModuleFunction(abi.encodeWithSelector(SandboxModule.setClaimIssuer.selector, operator), address(sandbox));
        // Another module is out of reach even with an allowed selector.
        DistributionCheckpointModule other = DistributionCheckpointModule(address(0x1234));
        vm.expectRevert("ComplianceGuard: not the sandbox");
        guard.callModuleFunction(_setMode(SandboxModule.Mode.SCREENED_GROUP), address(other));
        vm.stopPrank();
    }

    function test_operatorCannotChangeTheInvestorRules() public {
        DistributionCheckpointModule extra;
        vm.prank(deployer);
        extra = ModuleProxies.checkpoint();

        // addModule, removeModule, bindToken, setTokenBound: not on the guard, and not callable on the
        // compliance directly (the guard is its owner).
        vm.startPrank(operator);
        vm.expectRevert(); // "only owner or token can call"
        mc.addModule(address(extra));
        vm.expectRevert();
        mc.removeModule(address(sandbox));
        vm.expectRevert();
        mc.bindToken(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        mc.transferOwnership(operator);
        // Through the guard it is not reachable either: forward is owner only.
        vm.expectRevert("Ownable: caller is not the owner");
        guard.forward(abi.encodeWithSelector(mc.removeModule.selector, address(sandbox)));
        vm.stopPrank();
        assertTrue(mc.isModuleBound(address(sandbox)));
    }

    function test_deployerAlsoLostDirectControl() public {
        vm.prank(deployer);
        vm.expectRevert();
        mc.removeModule(address(sandbox));
    }

    function test_timelockCanForwardAnyOwnerCall() public {
        vm.startPrank(tl);
        guard.forward(abi.encodeWithSelector(mc.removeModule.selector, address(sandbox)));
        assertFalse(mc.isModuleBound(address(sandbox)));
        guard.forward(abi.encodeWithSelector(mc.addModule.selector, address(sandbox)));
        assertTrue(mc.isModuleBound(address(sandbox)));
        vm.stopPrank();
    }

    function test_forwardBubblesRevertData() public {
        vm.prank(tl);
        vm.expectRevert();
        guard.forward(abi.encodeWithSelector(mc.removeModule.selector, address(0xDEAD)));
    }

    function test_ownershipIsTwoStep_noRenounce_operatorSetByOwnerOnly() public {
        vm.prank(tl);
        vm.expectRevert("ComplianceGuard: renounce disabled");
        guard.renounceOwnership();
        vm.prank(tl);
        guard.transferOwnership(stranger);
        assertEq(guard.owner(), tl);
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        guard.setOperator(stranger);
        vm.prank(tl);
        guard.setOperator(stranger);
        vm.prank(operator);
        vm.expectRevert("ComplianceGuard: not operator");
        guard.callModuleFunction(_setMode(SandboxModule.Mode.SCREENED_GROUP), address(sandbox));
    }
}
