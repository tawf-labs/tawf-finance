// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// One script for the whole fresh Sepolia stack. Every contract that is ours is a BeaconProxy (one
// UpgradeableBeacon per type, owned by the Governance Safe), the T-REX suite sits behind its
// TREXImplementationAuthority, and every duty has its own Gnosis Safe. DRY RUN FIRST:
//
//   PRIVATE_KEY=.. LEDGER_CHAIN_ID=.. DEPLOYMENTS_PATH=/tmp/deployments.dryrun.json \
//   GOV_SAFE=0x.. TREASURY_SAFE=0x.. MINTING_SAFE=0x.. COMPLIANCE_SAFE=0x.. GUARDIAN_SAFE=0x.. \
//   [ALLOW_EOA_SAFES=true for a dry run with placeholder addresses] \
//   [LEDGER_ANCHOR=0x.. to reuse an existing anchor] [SUKUK_MATURITY=..] [FEE_RECIPIENT=.. TAWF_NISBAH_BPS=..] \
//     forge script script/DeployAll.s.sol:DeployAll --sig "runAll()" --rpc-url arbitrum_sepolia    (no --broadcast)
//
// Add --broadcast --slow only when the lead says deploy. The Safes come from script/DeploySafes.s.sol or
// are existing Safes. This script never generates or holds Safe signer keys.
//
// In one broadcast it deploys the shared T-REX suite, mock settlement coins, the legacy series, sukuk and
// per-deal pool, the Jawa Barat Deposito Pool and the multi-coin SCF offering, then the hand-over (owners
// to the Governance Safe, every ModularCompliance included), then a readback that reverts the
// whole deploy if anything is not where the role table says. The previous addresses are copied to *V1 keys.

import { DeployScf } from "./DeployScf.s.sol";
import { DeployDepositoPool } from "./DeployDepositoPool.s.sol";
import { ITawfShare } from "./DeployExtra.s.sol";

contract DeployAll is DeployScf, DeployDepositoPool {
    function runAll() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        require(operator == vm.envOr("OPERATOR_ADDRESS", operator), "PRIVATE_KEY is not OPERATOR_ADDRESS");
        string memory old = vm.exists(PATH) ? vm.readFile(PATH) : "";
        uint256 ledgerChainId = vm.envOr("LEDGER_CHAIN_ID", _oldLedgerChainId(old));
        require(ledgerChainId != 0, "set LEDGER_CHAIN_ID");
        _loadSafes();

        vm.startBroadcast(key);
        uint256 govStart = _arbBlock();

        address anchor = vm.envOr("LEDGER_ANCHOR", address(0));
        if (anchor == address(0)) {
            anchor = _deployProxy("LedgerAnchor.sol:LedgerAnchor", abi.encodeWithSignature("initialize(uint256,address)", ledgerChainId, operator));
        }
        _loadSukukTerms();
        Deployment memory d = _deployAll(operator, anchor, ledgerChainId);
        address usdg = deployCode("MockUSDC.sol:MockUSDC");
        (address pLedger, address pToken, address pSeries, address pSandbox) =
            _deployPool(operator, d.mockUsdc, d.mockUsdt, usdg, ledgerChainId);
        _coinList = new address[](3);
        _coinList[0] = d.mockUsdc;
        _coinList[1] = d.mockUsdt;
        _coinList[2] = usdg;
        Scf memory scf = _deployScf(operator, ledgerChainId);
        _open(scf, ledgerChainId);
        _setShareInBroadcast(d.series);
        _setShareInBroadcast(pSeries);

        // Hand everything over, last, after every owner-only setup call above.
        _handoverToSafes(operator);
        _verifyOwnership(_allBeacons);

        vm.stopBroadcast();

        _writeAll(old, d, usdg, pLedger, pToken, pSeries, pSandbox, scf, govStart);
    }

    function _oldLedgerChainId(string memory old) internal view returns (uint256) {
        if (bytes(old).length == 0 || !vm.keyExists(old, ".ledgerChainId")) return 0;
        return vm.parseJsonUint(old, ".ledgerChainId");
    }

    /// @dev Same as _setShare, but inside the orchestrator's single broadcast (no vm.broadcast).
    function _setShareInBroadcast(address product) internal {
        address feeRecipient = vm.envOr("FEE_RECIPIENT", address(0));
        if (feeRecipient == address(0)) return;
        ITawfShare(product).setTawfShare(uint16(vm.envOr("TAWF_NISBAH_BPS", uint256(1500))), feeRecipient);
    }

    function _writeAll(
        string memory old,
        Deployment memory d,
        address usdg,
        address pLedger,
        address pToken,
        address pSeries,
        address pSandbox,
        Scf memory scf,
        uint256 govStart
    ) internal {
        string[28] memory addrKeys = [
            "anchor", "identityRegistry", "identityRegistryStorage", "trustedIssuersRegistry", "claimTopicsRegistry",
            "claimIssuer", "idFactory", "implementationAuthority", "tawfSeries", "tawfSeriesToken", "sandboxModule",
            "sukukToken", "sukukDistributor", "dealRegistry", "bondReceiptNft", "redemptionVault", "mockUsdc",
            "mockUsdt", "mockUsdg", "depositoPool", "depositoPoolToken", "depositoPoolSandbox", "depositoPoolLedger",
            "scfAnchor", "scfLimitModule", "scfToken", "scfCompliance", "scfDistributor"
        ];
        string[4] memory idKeys = ["tawfSeriesId", "sukukId", "depositoPoolId", "scfId"];

        _writeDeployments(d);
        vm.writeJson(vm.toString(usdg), PATH, ".mockUsdg");
        _writePool(pLedger, pToken, pSeries, pSandbox);
        _writeScf(scf);

        // Governance addresses and the beacons. Naming: Safes end in Safe, beacons in Beacon, and no timelock.
        vm.writeJson(vm.toString(_safes.governance), PATH, ".govSafe");
        vm.writeJson(vm.toString(_safes.treasury), PATH, ".treasurySafe");
        vm.writeJson(vm.toString(_safes.minting), PATH, ".mintingSafe");
        vm.writeJson(vm.toString(_safes.compliance), PATH, ".complianceSafe");
        vm.writeJson(vm.toString(_safes.guardian), PATH, ".guardianSafe");
        vm.writeJson(vm.toString(govStart), PATH, ".governanceStartBlock");
        vm.writeJson(vm.toString(_trexAuthority), PATH, ".trexImplementationAuthority");
        for (uint256 i; i < _allBeacons.length; i++) {
            vm.writeJson(vm.toString(_allBeacons[i]), PATH, string.concat(".", _beaconKey(_beaconArtifacts[i])));
        }

        // Previous generation under the V1 keys (an existing V1 key is kept, so history never shrinks).
        if (bytes(old).length != 0) {
            for (uint256 i; i < addrKeys.length; i++) _keep(old, addrKeys[i], false);
            for (uint256 i; i < idKeys.length; i++) _keep(old, idKeys[i], true);
            if (vm.keyExists(old, ".deployL1Block")) {
                string memory k = vm.keyExists(old, ".deployL1BlockV1") ? ".deployL1BlockV1" : ".deployL1Block";
                vm.writeJson(vm.toString(vm.parseJsonUint(old, k)), PATH, ".deployL1BlockV1");
            }
        }
    }

    function _keep(string memory old, string memory key, bool isBytes32) internal {
        string memory src = string.concat(".", key);
        string memory v1 = string.concat(".", key, "V1");
        string memory use = vm.keyExists(old, v1) ? v1 : src;
        if (!vm.keyExists(old, use)) return;
        string memory value =
            isBytes32 ? vm.toString(vm.parseJsonBytes32(old, use)) : vm.toString(vm.parseJsonAddress(old, use));
        vm.writeJson(value, PATH, v1);
    }

    /// @dev Key for a beacon in the deployments JSON: <type>Beacon.
    function _beaconKey(string memory artifact) internal pure returns (string memory) {
        bytes32 h = keccak256(bytes(artifact));
        if (h == keccak256("LedgerAnchor.sol:LedgerAnchor")) return "ledgerAnchorBeacon";
        if (h == keccak256("DepositoPoolLedger.sol:DepositoPoolLedger")) return "depositoPoolLedgerBeacon";
        if (h == keccak256("TawfDepositoSeries.sol:TawfDepositoSeries")) return "depositoSeriesBeacon";
        if (h == keccak256("SukukDistributor.sol:SukukDistributor")) return "sukukDistributorBeacon";
        if (h == keccak256("DealRegistry.sol:DealRegistry")) return "dealRegistryBeacon";
        if (h == keccak256("BondReceiptNFT.sol:BondReceiptNFT")) return "bondReceiptNftBeacon";
        if (h == keccak256("RedemptionVault.sol:RedemptionVault")) return "redemptionVaultBeacon";
        if (h == keccak256("PooledFinancingVault.sol:PooledFinancingVault")) return "pooledFinancingVaultBeacon";
        revert("no beacon key for this artifact");
    }

    /// @dev First Arbitrum block of this deploy (block.number on Arbitrum is the L1 number). Falls back to
    ///      block.number off Arbitrum, for a local dry run.
    function _arbBlock() internal view returns (uint256) {
        (bool ok, bytes memory ret) = address(100).staticcall(abi.encodeWithSignature("arbBlockNumber()"));
        return ok && ret.length == 32 ? abi.decode(ret, (uint256)) : block.number;
    }
}
