// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { DeployTokenization } from "./DeployTokenization.s.sol";

/**
 * @notice Shared helpers for the deploy scripts (deployments path, shared coin loading). DEPLOYMENT NOTE: this file is an internal building block of script/DeployAll.s.sol, which is the ONLY
supported deploy. It has no standalone entry point. Every Tawf contract goes behind a beacon owned by the
Governance Safe, every duty has its own Safe, and the operator EOA ends with FX and data posts only.
 */
contract DeployExtra is DeployTokenization {
    /// @dev DEPLOYMENTS_PATH lets a dry run or a second chain write elsewhere, so the app JSON is not touched.
    string internal PATH = vm.envOr("DEPLOYMENTS_PATH", string("../tawf-finance/src/web3/tokenization.deployments.json"));

    function _loadShared() internal returns (address usdc, address usdt) {
        string memory json = vm.readFile(PATH);
        _sharedIdentityRegistry = vm.parseJsonAddress(json, ".identityRegistry");
        _sharedClaimIssuer = vm.parseJsonAddress(json, ".claimIssuer");
        usdc = vm.parseJsonAddress(json, ".mockUsdc");
        usdt = vm.parseJsonAddress(json, ".mockUsdt");
        _sukukUsdc = usdc;
    }





    /// @dev Set Tawf's nisbah (TAWF_NISBAH_BPS, default 1500) and fee wallet
    ///      (FEE_RECIPIENT) before the sale opens. Skipped when FEE_RECIPIENT is unset.

}

interface ITawfShare {
    function setTawfShare(uint16 nisbahBps, address recipient) external;
}
