// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Upgrade tests for the three T-REX compliance modules behind beacon proxies: one beacon upgrade moves
// every instance, state survives, only the beacon owner (the Governance Safe) can upgrade, the
// implementation cannot be initialised directly and initialize cannot run twice.

import "forge-std/Test.sol";
import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { ModuleAdmin } from "../src/proxy/ModuleAdmin.sol";
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
    address internal timelock = makeAddr("governanceSafe");
    address internal stranger = makeAddr("stranger");
    address internal compliance = makeAddr("compliance");
    address internal treasury = makeAddr("treasury");
    address internal ir = makeAddr("identityRegistry");

    function _handOver(address module) internal {
        vm.prank(operator);
        SandboxModule(module).transferOwnership(timelock); // same ModuleAdmin ABI for every module
        assertEq(SandboxModule(module).owner(), operator, "still operator until accepted");
        vm.prank(timelock);
        SandboxModule(module).acceptOwnership();
    }

    function _toGovernance(UpgradeableBeacon b) internal {
        vm.prank(operator);
        b.transferOwnership(timelock);
    }

    function _assertOnlyGovernanceUpgrades(UpgradeableBeacon b, address impl2) internal {
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        b.upgradeTo(impl2);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        b.upgradeTo(impl2);
        vm.prank(timelock);
        b.upgradeTo(impl2);
    }

    // -------------------------------------------------------------- Sandbox
    function test_sandbox_beaconUpgradeMovesAllInstancesAndKeepsState() public {
        vm.startPrank(operator);
        UpgradeableBeacon b = ModuleProxies.sandboxBeacon();
        SandboxModule m = ModuleProxies.sandboxProxy(address(b));
        SandboxModule n = ModuleProxies.sandboxProxy(address(b));
        uint64 end = uint64(block.timestamp + 90 days);
        m.initConfig(compliance, SandboxModule.Mode.PILOT_ONLY, treasury, address(0), 0, 0, 0, end);
        n.initConfig(makeAddr("c2"), SandboxModule.Mode.PILOT_ONLY, stranger, address(0), 0, 0, 0, end);
        vm.stopPrank();
        _toGovernance(b);
        _handOver(address(m));

        _assertOnlyGovernanceUpgrades(b, address(new SandboxModuleV2()));
        SandboxModuleV2 m2 = SandboxModuleV2(address(m));
        SandboxModuleV2 n2 = SandboxModuleV2(address(n));
        (, address t,,,,,,) = m2.configOf(compliance);
        assertEq(t, treasury);
        (, address t2,,,,,,) = n2.configOf(makeAddr("c2"));
        assertEq(t2, stranger);
        assertEq(m2.owner(), timelock);
        assertEq(n2.owner(), operator);
        assertEq(m2.version(), 2);
        assertEq(n2.version(), 2);
        vm.prank(operator);
        m2.setNewField(7);
        assertEq(m2.newField(), 7);
        assertEq(n2.newField(), 0);
    }

    function test_sandbox_initGuards() public {
        SandboxModule m = ModuleProxies.sandbox();
        vm.expectRevert("Initializable: contract is already initialized");
        m.initialize();
        SandboxModule impl = new SandboxModule();
        vm.expectRevert("Initializable: contract is already initialized");
        impl.initialize();
    }

    function test_noUpgradeCodeInModule() public {
        SandboxModule m = ModuleProxies.sandbox();
        (bool ok,) = address(m).call(abi.encodeWithSignature("upgradeTo(address)", address(1)));
        assertFalse(ok);
        (ok,) = address(m).call(abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(1), ""));
        assertFalse(ok);
    }

    // ----------------------------------------------------------- Checkpoint
    function test_checkpoint_beaconUpgradeKeepsState() public {
        vm.startPrank(operator);
        UpgradeableBeacon b = ModuleProxies.checkpointBeacon();
        DistributionCheckpointModule m = ModuleProxies.checkpointProxy(address(b));
        m.setHook(compliance, IBalanceCheckpoint(treasury));
        vm.stopPrank();
        _toGovernance(b);
        _handOver(address(m));

        _assertOnlyGovernanceUpgrades(b, address(new CheckpointModuleV2()));
        CheckpointModuleV2 m2 = CheckpointModuleV2(address(m));
        assertEq(address(m2.hookOf(compliance)), treasury);
        assertEq(m2.owner(), timelock);
        m2.setNewField(3);
        assertEq(m2.newField(), 3);
        // Wiring a hook is Governance (the owner). The operator keeps no say after the hand-over.
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        m2.setHook(compliance, IBalanceCheckpoint(stranger));
        vm.prank(timelock);
        m2.setHook(compliance, IBalanceCheckpoint(stranger));
        assertEq(address(m2.hookOf(compliance)), stranger);
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
    function test_scf_beaconUpgradeKeepsState() public {
        vm.startPrank(operator);
        UpgradeableBeacon b = ModuleProxies.scfLimitBeacon();
        ScfInvestorLimitModule m = ModuleProxies.scfLimitProxy(address(b), ir);
        m.setAgent(stranger, true);
        m.initOffering(compliance, treasury, 1000e6);
        vm.stopPrank();
        uint64 start = m.periodStart();
        _toGovernance(b);
        _handOver(address(m));

        vm.warp(block.timestamp + 30 days);
        _assertOnlyGovernanceUpgrades(b, address(new ScfModuleV2()));
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
        address beacon = address(ModuleProxies.scfLimitBeacon());
        vm.expectRevert();
        new BeaconProxy(beacon, abi.encodeCall(ScfInvestorLimitModule.initialize, (address(0))));
    }

    function test_beaconToNonContractReverts() public {
        UpgradeableBeacon b = ModuleProxies.sandboxBeacon();
        vm.expectRevert("UpgradeableBeacon: implementation is not a contract");
        b.upgradeTo(address(0xdead));
    }

    // ------------------------------------------------------- admin split
    function test_scf_operatorKeepsNothingAfterHandOver() public {
        vm.startPrank(operator);
        UpgradeableBeacon b = ModuleProxies.scfLimitBeacon();
        ScfInvestorLimitModule m = ModuleProxies.scfLimitProxy(address(b), ir);
        m.setConfigurer(stranger); // stranger plays the Compliance Safe here
        vm.stopPrank();
        _toGovernance(b);
        _handOver(address(m));
        address impl2 = address(new ScfModuleV2());
        vm.startPrank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        b.upgradeTo(impl2);
        vm.expectRevert("Ownable: caller is not the owner");
        m.setConfigurer(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        m.initOffering(compliance, treasury, 1e6);
        vm.expectRevert(ModuleAdmin.NotConfigurer.selector);
        m.setAgent(operator, true);
        vm.stopPrank();
        vm.prank(timelock);
        vm.expectRevert(ModuleAdmin.ZeroAddress.selector);
        m.setConfigurer(address(0));
    }

    function test_sandboxAndCheckpointConfigAreGovernanceOnly() public {
        vm.startPrank(operator);
        SandboxModule sb = ModuleProxies.sandbox();
        DistributionCheckpointModule ck = ModuleProxies.checkpoint();
        vm.stopPrank();
        _handOver(address(sb));
        _handOver(address(ck));
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        sb.initConfig(compliance, SandboxModule.Mode.PILOT_ONLY, treasury, address(0), 0, 0, 0, 1);
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        ck.setHook(compliance, IBalanceCheckpoint(treasury));
        vm.prank(timelock);
        sb.initConfig(compliance, SandboxModule.Mode.PILOT_ONLY, treasury, address(0), 0, 0, 0, 1);
        vm.prank(timelock);
        ck.setHook(compliance, IBalanceCheckpoint(treasury));
    }

    function test_twoStepOwnership() public {
        vm.startPrank(operator);
        SandboxModule m = ModuleProxies.sandbox();
        m.transferOwnership(stranger); // a wrong address is only pending
        assertEq(m.owner(), operator);
        assertEq(m.pendingOwner(), stranger);
        m.transferOwnership(timelock); // owner corrects it
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(ModuleAdmin.NotPendingOwner.selector);
        m.acceptOwnership();
        vm.prank(timelock);
        m.acceptOwnership();
        assertEq(m.owner(), timelock);
        assertEq(m.pendingOwner(), address(0));
        vm.prank(timelock);
        vm.expectRevert(ModuleAdmin.ZeroAddress.selector);
        m.transferOwnership(address(0));
    }

    function test_renounceDisabled() public {
        vm.startPrank(operator);
        SandboxModule m = ModuleProxies.sandbox();
        vm.expectRevert(ModuleAdmin.RenounceDisabled.selector);
        m.renounceOwnership();
        vm.stopPrank();
        assertEq(m.owner(), operator);
    }
}

/// @dev V2 with a reinitializer, as a future release would ship it.
contract ScfModuleV2Init is ScfInvestorLimitModule {
    uint256 public newField;

    function initializeV2(uint256 v) external reinitializer(2) onlyOwner {
        newField = v;
    }
}

contract ModuleBeaconHandOverTest is Test {
    address internal operator = makeAddr("operator");
    address internal safe = makeAddr("governanceSafe");
    address internal stranger = makeAddr("stranger");
    address internal ir = makeAddr("identityRegistry");

    // Harness so the internal library is called with this contract as the deployer.
    function _beacons() internal returns (ModuleProxies.Beacons memory b) {
        b = ModuleProxies.beacons();
    }

    function test_handOverAll_movesEveryBeaconAndReadsBack() public {
        ModuleProxies.Beacons memory b = _beacons();
        vm.etch(safe, hex"00"); // a deployed contract stands in for the Safe
        ModuleProxies.handOverAll(b, safe);
        assertEq(b.sandbox.owner(), safe);
        assertEq(b.checkpoint.owner(), safe);
        assertEq(b.scfLimit.owner(), safe);
    }

    function test_handOver_refusesZeroAndEoa() public {
        ModuleProxies.Beacons memory b = _beacons();
        vm.expectRevert("governance is zero");
        this.callHandOver(b.sandbox, address(0));
        vm.expectRevert("governance is not a contract");
        this.callHandOver(b.sandbox, safe); // an EOA, e.g. a typo or the operator
        assertEq(b.sandbox.owner(), address(this), "still the deployer, nothing moved");
    }

    function callHandOver(UpgradeableBeacon b, address g) external {
        ModuleProxies.handOver(b, g);
    }

    function test_oneBeaconPerType_instancesShareIt() public {
        ModuleProxies.Beacons memory b = _beacons();
        ScfInvestorLimitModule a = ModuleProxies.scfLimitProxy(address(b.scfLimit), ir);
        ScfInvestorLimitModule c = ModuleProxies.scfLimitProxy(address(b.scfLimit), ir);
        vm.etch(safe, hex"00");
        ModuleProxies.handOverAll(b, safe);
        address v2 = address(new ScfModuleV2Init());
        vm.expectRevert("Ownable: caller is not the owner");
        b.scfLimit.upgradeTo(v2); // the deployer lost upgrade rights in the same run
        vm.prank(safe);
        b.scfLimit.upgradeTo(v2);
        assertEq(ScfModuleV2Init(address(a)).newField(), 0);
        assertEq(ScfModuleV2Init(address(c)).newField(), 0);
    }

    function test_reinitializer_isOwnerOnly_andRunsInOneBatch() public {
        ModuleProxies.Beacons memory b = _beacons();
        ScfInvestorLimitModule m = ModuleProxies.scfLimitProxy(address(b.scfLimit), ir);
        vm.etch(safe, hex"00");
        ModuleProxies.handOverAll(b, safe);
        m.transferOwnership(safe);
        vm.prank(safe);
        m.acceptOwnership();

        address v2 = address(new ScfModuleV2Init());
        // Batch: both calls come from the Safe in one transaction, nothing in between.
        vm.startPrank(safe);
        b.scfLimit.upgradeTo(v2);
        ScfModuleV2Init(address(m)).initializeV2(42);
        vm.stopPrank();
        assertEq(ScfModuleV2Init(address(m)).newField(), 42);

        // Front-run attempt on a second instance after the upgrade: strangers and the old operator lose.
        ScfInvestorLimitModule m2 = ModuleProxies.scfLimitProxy(address(b.scfLimit), ir);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        ScfModuleV2Init(address(m2)).initializeV2(1);
        // And it runs only once per instance.
        vm.prank(safe);
        vm.expectRevert("Initializable: contract is already initialized");
        ScfModuleV2Init(address(m)).initializeV2(2);
    }
}
