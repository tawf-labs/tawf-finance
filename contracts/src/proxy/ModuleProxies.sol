// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { ModuleProxy } from "@erc3643org/erc-3643/contracts/compliance/modular/modules/ModuleProxy.sol";
import { SandboxModule } from "../deposito/SandboxModule.sol";
import { DistributionCheckpointModule } from "../sukuk/DistributionCheckpointModule.sol";
import { ScfInvestorLimitModule } from "../scf/ScfInvestorLimitModule.sol";

/**
 * @title ModuleProxies
 * @notice Deploys each T-REX compliance module as an implementation behind a
 *         T-REX ModuleProxy (ERC1967/UUPS) and initialises it in the same
 *         transaction. The caller becomes the module owner, so a deploy script
 *         hands ownership to the timelock afterwards with `transferOwnership`.
 *         Pinned to 0.8.17 like the modules. Internal functions only.
 */
library ModuleProxies {
    function sandbox() internal returns (SandboxModule) {
        address impl = address(new SandboxModule());
        return SandboxModule(address(new ModuleProxy(impl, abi.encodeCall(SandboxModule.initialize, ()))));
    }

    function checkpoint() internal returns (DistributionCheckpointModule) {
        address impl = address(new DistributionCheckpointModule());
        return DistributionCheckpointModule(
            address(new ModuleProxy(impl, abi.encodeCall(DistributionCheckpointModule.initialize, ())))
        );
    }

    function scfLimit(address identityRegistry) internal returns (ScfInvestorLimitModule) {
        address impl = address(new ScfInvestorLimitModule());
        return ScfInvestorLimitModule(
            address(new ModuleProxy(impl, abi.encodeCall(ScfInvestorLimitModule.initialize, (identityRegistry))))
        );
    }
}
