// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Upgrade tests for the three T-REX compliance modules behind ModuleProxy: state survives an
// upgrade, only the owner can upgrade (the timelock after the hand-over), the implementation
// cannot be initialised directly and initialize cannot run twice.

import "forge-std/Test.sol";
import { ModuleProxy } from "@erc3643org/erc-3643/contracts/compliance/modular/modules/ModuleProxy.sol";
import { ModuleProxies } from "../src/proxy/ModuleProxies.sol";
import { SandboxModule } from "../src/deposito/SandboxModule.sol";
import { DistributionCheckpointModule, IBalanceCheckpoint } from "../src/sukuk/DistributionCheckpointModule.sol";
import { ScfInvestorLimitModule } from "../src/scf/ScfInvestorLimitModule.sol";

contract SandboxModuleV2 is SandboxModule {
    uint256 public newField;

    function setNewField(uint256 v) external {
        newField = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract CheckpointModuleV2 is DistributionCheckpointModule {
    uint256 public newField;

    function setNewField(uint256 v) external {
        newField = v;
    }
}

contract ScfModuleV2 is ScfInvestorLimitModule {
    uint256 public newField;

    function setNewField(uint256 v) external {
        newField = v;
    }
}

contract ModuleUpgradeTest is Test {
    address internal operator = makeAddr("operator");
    address internal timelock = makeAddr("timelock");
    address internal stranger = makeAddr("stranger");
    address internal compliance = makeAddr("compliance");
    address internal treasury = makeAddr("treasury");
    address internal ir = makeAddr("identityRegistry");

    function _handOver(address module) internal {
        vm.prank(operator);
        SandboxModule(module).transferOwnership(timelock); // same Ownable ABI for every module
    }

    // -------------------------------------------------------------- Sandbox
    function test_sandbox_upgradeKeepsState() public {
        vm.startPrank(operator);
        SandboxModule m = ModuleProxies.sandbox();
        m.initConfig(compliance, SandboxModule.Mode.PILOT_ONLY, treasury, address(0), 0, 0, 0, uint64(block.timestamp + 90 days));
        vm.stopPrank();
        (, address t,,,,,,) = m.configOf(compliance);
        assertEq(t, treasury);
        _handOver(address(m));

        address impl2 = address(new SandboxModuleV2());
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        m.upgradeTo(impl2);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        m.upgradeTo(impl2);

        vm.prank(timelock);
        m.upgradeTo(impl2);
        SandboxModuleV2 m2 = SandboxModuleV2(address(m));
        (, address t2,,,,,,) = m2.configOf(compliance);
        assertEq(t2, treasury);
        assertEq(m2.owner(), timelock);
        assertEq(m2.version(), 2);
        m2.setNewField(7);
        assertEq(m2.newField(), 7);
    }

    function test_sandbox_initGuards() public {
        SandboxModule m = ModuleProxies.sandbox();
        vm.expectRevert("Initializable: contract is already initialized");
        m.initialize();
        SandboxModule impl = new SandboxModule();
        vm.expectRevert("Initializable: contract is already initialized");
        impl.initialize();
    }

    // ----------------------------------------------------------- Checkpoint
    function test_checkpoint_upgradeKeepsState() public {
        vm.startPrank(operator);
        DistributionCheckpointModule m = ModuleProxies.checkpoint();
        m.setHook(compliance, IBalanceCheckpoint(treasury));
        vm.stopPrank();
        _handOver(address(m));

        address impl2 = address(new CheckpointModuleV2());
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        m.upgradeTo(impl2);
        vm.prank(timelock);
        m.upgradeTo(impl2);

        CheckpointModuleV2 m2 = CheckpointModuleV2(address(m));
        assertEq(address(m2.hookOf(compliance)), treasury);
        assertEq(m2.owner(), timelock);
        m2.setNewField(3);
        assertEq(m2.newField(), 3);
        // The old owner can no longer configure.
        vm.prank(operator);
        vm.expectRevert(DistributionCheckpointModule.OnlyOwner.selector);
        m2.setHook(compliance, IBalanceCheckpoint(stranger));
    }

    function test_checkpoint_initGuards() public {
        DistributionCheckpointModule m = ModuleProxies.checkpoint();
        vm.expectRevert("Initializable: contract is already initialized");
        m.initialize();
        DistributionCheckpointModule impl = new DistributionCheckpointModule();
        vm.expectRevert("Initializable: contract is already initialized");
        impl.initialize();
    }

    // ------------------------------------------------------------------ SCF
    function test_scf_upgradeKeepsState() public {
        vm.startPrank(operator);
        ScfInvestorLimitModule m = ModuleProxies.scfLimit(ir);
        m.setAgent(stranger, true);
        m.initOffering(compliance, treasury, 1000e6);
        vm.stopPrank();
        uint64 start = m.periodStart();
        _handOver(address(m));

        vm.warp(block.timestamp + 30 days);
        address impl2 = address(new ScfModuleV2());
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        m.upgradeTo(impl2);
        vm.prank(timelock);
        m.upgradeTo(impl2);

        ScfModuleV2 m2 = ScfModuleV2(address(m));
        assertEq(m2.identityRegistry(), ir);
        assertEq(m2.periodStart(), start);
        assertTrue(m2.isAgent(stranger));
        (address tr, uint256 cap, bool configured) = m2.offeringOf(compliance);
        assertEq(tr, treasury);
        assertEq(cap, 1000e6);
        assertTrue(configured);
        assertEq(m2.owner(), timelock);
        m2.setNewField(9);
        assertEq(m2.newField(), 9);
    }

    function test_scf_initGuards() public {
        ScfInvestorLimitModule m = ModuleProxies.scfLimit(ir);
        vm.expectRevert("Initializable: contract is already initialized");
        m.initialize(ir);
        ScfInvestorLimitModule impl = new ScfInvestorLimitModule();
        vm.expectRevert("Initializable: contract is already initialized");
        impl.initialize(ir);
    }

    function test_scf_zeroRegistryReverts() public {
        ScfInvestorLimitModule impl = new ScfInvestorLimitModule();
        vm.expectRevert();
        new ModuleProxy(address(impl), abi.encodeCall(ScfInvestorLimitModule.initialize, (address(0))));
    }

    function test_upgradeToNonUupsReverts() public {
        vm.startPrank(operator);
        SandboxModule m = ModuleProxies.sandbox();
        vm.expectRevert();
        m.upgradeTo(address(0xdead));
        vm.stopPrank();
    }
}
