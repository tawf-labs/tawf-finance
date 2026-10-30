// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import { CommonBase } from "forge-std/Base.sol";

/// @notice Deploys an upgradeable contract as implementation plus ERC1967 proxy through artifact
///         names, so scripts and tests that cannot import a contract (compiler pragma split with
///         the 0.8.17 T-REX code) still go through the proxy path. The proxy is initialised in the
///         same transaction.
abstract contract ProxyDeployer is CommonBase {
    /// @param artifact e.g. "DepositoPoolLedger.sol:DepositoPoolLedger"
    /// @param initData abi.encodeWithSignature("initialize(...)", ...)
    function _deployProxy(string memory artifact, bytes memory initData) internal returns (address proxy) {
        address impl = vm.deployCode(artifact);
        proxy = vm.deployCode("ERC1967Proxy.sol:ERC1967Proxy", abi.encode(impl, initData));
    }
}
