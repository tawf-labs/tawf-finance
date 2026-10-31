// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { SandboxModule } from "../deposito/SandboxModule.sol";
import { DistributionCheckpointModule } from "../sukuk/DistributionCheckpointModule.sol";
import { ScfInvestorLimitModule } from "../scf/ScfInvestorLimitModule.sol";

/**
 * @title ModuleProxies
 * @notice Deploys the T-REX compliance modules as beacon proxies. There is one
 *         `UpgradeableBeacon` per module type, so one `upgradeTo` on a beacon upgrades every
 *         instance of that module. A deploy script hands each beacon to the Governance Safe with
 *         `beacon.transferOwnership(governanceSafe)`.
 *
 *         Deploy scripts call `beacons()` once, make every instance with `xProxy(beacon, ...)`
 *         (the caller becomes the module owner and configurer) and finish with `handOverAll`.
 *         `x()` makes a private beacon per call: tests and throwaway deploys only, never a script. Pinned to 0.8.17 like the modules. Internal functions only.
 */
library ModuleProxies {
    /// @dev One beacon per module type for a whole deployment.
    struct Beacons {
        UpgradeableBeacon sandbox;
        UpgradeableBeacon checkpoint;
        UpgradeableBeacon scfLimit;
    }

    /// @notice Deploy the three module beacons once. Make every instance with `xProxy(beacon, ...)`.
    function beacons() internal returns (Beacons memory b) {
        b.sandbox = sandboxBeacon();
        b.checkpoint = checkpointBeacon();
        b.scfLimit = scfLimitBeacon();
    }

    /// @notice Hand one beacon to the Governance Safe and read the owner back. The OZ v4 beacon owner
    ///         moves in one step and can renounce, so a wrong address would be permanent: refuse the
    ///         zero address and anything that is not a deployed contract (a Safe is one), then require
    ///         the stored owner to equal `governance`.
    function handOver(UpgradeableBeacon beacon, address governance) internal {
        require(governance != address(0), "governance is zero");
        require(governance.code.length > 0, "governance is not a contract");
        beacon.transferOwnership(governance);
        require(beacon.owner() == governance, "beacon owner not governance");
    }

    /// @notice Hand all three beacons over in the same run, so the deployer never keeps upgrade rights.
    function handOverAll(Beacons memory b, address governance) internal {
        handOver(b.sandbox, governance);
        handOver(b.checkpoint, governance);
        handOver(b.scfLimit, governance);
    }

    function sandboxBeacon() internal returns (UpgradeableBeacon) {
        return new UpgradeableBeacon(address(new SandboxModule()));
    }

    function sandboxProxy(address beacon) internal returns (SandboxModule) {
        return SandboxModule(address(new BeaconProxy(beacon, abi.encodeCall(SandboxModule.initialize, ()))));
    }

    function sandbox() internal returns (SandboxModule) {
        return sandboxProxy(address(sandboxBeacon()));
    }

    function checkpointBeacon() internal returns (UpgradeableBeacon) {
        return new UpgradeableBeacon(address(new DistributionCheckpointModule()));
    }

    function checkpointProxy(address beacon) internal returns (DistributionCheckpointModule) {
        return DistributionCheckpointModule(
            address(new BeaconProxy(beacon, abi.encodeCall(DistributionCheckpointModule.initialize, ())))
        );
    }

    function checkpoint() internal returns (DistributionCheckpointModule) {
        return checkpointProxy(address(checkpointBeacon()));
    }

    function scfLimitBeacon() internal returns (UpgradeableBeacon) {
        return new UpgradeableBeacon(address(new ScfInvestorLimitModule()));
    }

    function scfLimitProxy(address beacon, address identityRegistry) internal returns (ScfInvestorLimitModule) {
        return ScfInvestorLimitModule(
            address(new BeaconProxy(beacon, abi.encodeCall(ScfInvestorLimitModule.initialize, (identityRegistry))))
        );
    }

    function scfLimit(address identityRegistry) internal returns (ScfInvestorLimitModule) {
        return scfLimitProxy(address(scfLimitBeacon()), identityRegistry);
    }
}
