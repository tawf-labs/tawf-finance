// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { ModuleAdmin } from "./ModuleAdmin.sol";

/**
 * @title ModuleUpgradeBatch
 * @notice Builds the Safe MultiSend batch for a module upgrade that needs a reinitializer.
 *
 *         A beacon upgrade moves every instance at once, but a reinitializer runs once PER INSTANCE and a
 *         beacon has no upgradeAndCall. The Governance Safe therefore sends ONE MultiSend transaction:
 *         `beacon.upgradeTo(newImpl)` first, then the reinitializer call on every instance of that beacon,
 *         so nothing can run (or be front-run) in between. List every instance: a missed one keeps old
 *         state until someone with the owner role initialises it.
 *
 *         The encoding is the Safe MultiSend one: per transaction
 *         `operation (1 byte) | to (20) | value (32) | dataLength (32) | data`.
 */
library ModuleUpgradeBatch {
    /// @notice Every instance must be owned by `governance`, since reinitializers are `onlyOwner`.
    function requireGoverned(address[] memory instances, address governance) internal view {
        for (uint256 i; i < instances.length; i++) {
            require(ModuleAdmin(instances[i]).owner() == governance, "instance not owned by governance");
        }
    }

    /// @notice The MultiSend payload: upgradeTo on the beacon, then `reinit` on each instance.
    function build(UpgradeableBeacon beacon, address newImplementation, address[] memory instances, bytes memory reinit)
        internal
        pure
        returns (bytes memory packed)
    {
        packed = tx_(address(beacon), abi.encodeCall(UpgradeableBeacon.upgradeTo, (newImplementation)));
        for (uint256 i; i < instances.length; i++) {
            packed = bytes.concat(packed, tx_(instances[i], reinit));
        }
    }

    /// @notice `build` after checking that every instance is governed by the Safe that will send it.
    function buildChecked(
        UpgradeableBeacon beacon,
        address newImplementation,
        address[] memory instances,
        bytes memory reinit,
        address governance
    ) internal view returns (bytes memory) {
        requireGoverned(instances, governance);
        require(beacon.owner() == governance, "beacon not owned by governance");
        return build(beacon, newImplementation, instances, reinit);
    }

    function tx_(address to, bytes memory data) private pure returns (bytes memory) {
        return abi.encodePacked(uint8(0), to, uint256(0), uint256(data.length), data);
    }
}
