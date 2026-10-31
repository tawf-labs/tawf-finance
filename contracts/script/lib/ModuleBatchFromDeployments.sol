// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "forge-std/Test.sol";
import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { ModuleProxies } from "../../src/proxy/ModuleProxies.sol";
import { ModuleUpgradeBatch } from "../../src/proxy/ModuleUpgradeBatch.sol";

/**
 * @title ModuleBatchFromDeployments
 * @notice Builds the Safe MultiSend upgrade batch for a module beacon from the instance list the deploy script
 *         recorded in deployments.json, so the batch always names every instance. The deploy script writes
 *         `<module>Instances` next to `<module>Beacon`, one address per `xProxy` it made.
 *
 *         An instance missing from the file cannot be seen on chain, so `requireMatchesLogs` compares the file
 *         with the `InstanceCreated` events of the deploy (record them with `vm.recordLogs()`): the script
 *         fails when the lists differ in either direction.
 */
abstract contract ModuleBatchFromDeployments is Test {
    using stdJson for string;

    /// @param key e.g. ".scfLimitModuleInstances"
    function instancesFromJson(string memory json, string memory key) internal pure returns (address[] memory) {
        return json.readAddressArray(key);
    }

    /// @notice Fail when `instances` is not exactly the set of instances created behind `beacon` in `logs`.
    function requireMatchesLogs(Vm.Log[] memory logs, address beacon, address[] memory instances) internal pure {
        bytes32 topic = ModuleProxies.InstanceCreated.selector;
        uint256 seen;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics.length != 3 || logs[i].topics[0] != topic) continue;
            if (address(uint160(uint256(logs[i].topics[1]))) != beacon) continue;
            address created = address(uint160(uint256(logs[i].topics[2])));
            bool found;
            for (uint256 j; j < instances.length; j++) {
                if (instances[j] == created) {
                    found = true;
                    break;
                }
            }
            require(found, "instance created on chain but missing from deployments.json");
            seen++;
        }
        require(seen == instances.length, "deployments.json names an instance that was not created");
    }

    /// @notice The upgrade batch for `key`'s instances, checked against the Governance Safe.
    function batchFromJson(
        string memory json,
        string memory key,
        UpgradeableBeacon beacon,
        address newImplementation,
        bytes memory reinit,
        address governance
    ) internal view returns (bytes memory) {
        return ModuleUpgradeBatch.buildChecked(beacon, newImplementation, instancesFromJson(json, key), reinit, governance);
    }
}
