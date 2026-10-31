// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import { CommonBase } from "forge-std/Base.sol";

/// @notice Deploys an upgradeable contract as a BeaconProxy and initialises it in the same transaction.
///         One UpgradeableBeacon per contract type (artifact), created on first use and reused for every
///         later instance, so a single beacon upgrade covers all instances. The beacon owner is
///         `beaconOwner`, which a deploy sets to the Governance Safe (tests use a stand-in) before the first
///         proxy is made. Artifacts are reached by name so scripts and tests that cannot import a contract
///         (compiler pragma split with the 0.8.17 T-REX code) still go through the beacon path.
abstract contract ProxyDeployer is CommonBase {
    string internal constant BEACON = "lib/openzeppelin-contracts/contracts/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon";
    string internal constant BEACON_PROXY = "lib/openzeppelin-contracts/contracts/proxy/beacon/BeaconProxy.sol:BeaconProxy";

    /// @dev Owner of every beacon created here: the Governance Safe in a deploy.
    address internal beaconOwner;
    mapping(bytes32 => address) internal _beaconOf;
    address[] internal _allBeacons;
    string[] internal _beaconArtifacts;
    /// @dev Every instance made per artifact, so the deploy can record <type>Instances next to <type>Beacon.
    mapping(bytes32 => address[]) internal _instances;

    /// @param artifact e.g. "DepositoPoolLedger.sol:DepositoPoolLedger"
    function _beaconFor(string memory artifact) internal returns (address b) {
        bytes32 k = keccak256(bytes(artifact));
        b = _beaconOf[k];
        if (b == address(0)) {
            require(beaconOwner != address(0), "ProxyDeployer: set beaconOwner (the Governance Safe) first");
            address impl = vm.deployCode(artifact);
            b = vm.deployCode(BEACON, abi.encode(impl, beaconOwner));
            _beaconOf[k] = b;
            _allBeacons.push(b);
            _beaconArtifacts.push(artifact);
        }
    }

    /// @param artifact e.g. "DepositoPoolLedger.sol:DepositoPoolLedger"
    /// @param initData abi.encodeWithSignature("initialize(...)", ...)
    function _deployProxy(string memory artifact, bytes memory initData) internal returns (address proxy) {
        proxy = vm.deployCode(BEACON_PROXY, abi.encode(_beaconFor(artifact), initData));
        _instances[keccak256(bytes(artifact))].push(proxy);
    }
}
