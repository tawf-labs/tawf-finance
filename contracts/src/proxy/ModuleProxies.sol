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
 *         `xBeacon()` deploys an implementation and its beacon (the caller owns the beacon).
 *         `xProxy(beacon, ...)` deploys a BeaconProxy and initialises it in the same transaction,
 *         so the caller becomes the module owner and configurer. `x()` does both for tests and
 *         one-off deploys. Pinned to 0.8.17 like the modules. Internal functions only.
 */
library ModuleProxies {
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
