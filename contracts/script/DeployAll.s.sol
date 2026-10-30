// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// One script for the whole fresh Sepolia stack, every contract behind a proxy and governed by the
// TawfTimelock. DRY RUN FIRST:
//
//   PRIVATE_KEY=.. LEDGER_CHAIN_ID=.. DEPLOYMENTS_PATH=/tmp/deployments.dryrun.json \
//   [SAFE_ADDRESS=0x..] [TIMELOCK_DELAY=3600] [LEDGER_ANCHOR=0x.. to reuse an existing anchor] \
//   [SUKUK_MATURITY=..] [FEE_RECIPIENT=.. TAWF_NISBAH_BPS=..] \
//     forge script script/DeployAll.s.sol:DeployAll --sig "runAll()" --rpc-url arbitrum_sepolia   (no --broadcast: simulation)
//
// Add --broadcast --slow only when the lead says deploy. DEPLOYMENTS_PATH keeps the dry run away from the
// app's tokenization.deployments.json. Without a RPC the same command simulates in memory.
//
// What it does, in one broadcast:
//   1. TawfTimelock (no admin, proposer = Safe or the operator on testnet, open executors).
//   2. LedgerAnchor proxy (or LEDGER_ANCHOR), shared T-REX identity suite behind T-REX proxies with one
//      TREXImplementationAuthority, mock settlement coins (USDC, USDT, USDG), the legacy series, sukuk and
//      per-deal pool, the Jawa Barat Deposito Pool (ledger, series), and the multi-coin SCF offering.
//   3. Hand-over to the timelock: UPGRADER_ROLE on every UUPS contract, ownership of the T-REX authority
//      (through the AuthorityGuard), the registries, the tokens, the compliance modules, the ONCHAINID
//      authority and factory, and the sandbox compliances (through a ComplianceGuard each). Two-step
//      owners are queued as one scheduled timelock batch (acceptOwnership), see the console output.
//   4. The previous addresses are copied to *V1 keys, then the new ones are written to the deployments JSON.

import { DeployScf } from "./DeployScf.s.sol";
import { DeployDepositoPool } from "./DeployDepositoPool.s.sol";
import { ITawfShare } from "./DeployExtra.s.sol";

contract DeployAll is DeployScf, DeployDepositoPool {
    address internal _timelock;

    /// @dev Every proxied contract is initialised with the timelock as its upgrader.
    function _upgrader(address) internal view override returns (address) {
        return _timelock;
    }

    function runAll() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        string memory old = vm.exists(PATH) ? vm.readFile(PATH) : "";
        uint256 ledgerChainId = vm.envOr("LEDGER_CHAIN_ID", _oldLedgerChainId(old));
        require(ledgerChainId != 0, "set LEDGER_CHAIN_ID");

        vm.startBroadcast(key);

        // 1. Governance first, so every contract is born with the timelock as upgrader.
        address safe;
        (_timelock, safe) = _deployTimelock(operator);

        // 2. Ledger anchor, shared suite and the products.
        address anchor = vm.envOr("LEDGER_ANCHOR", address(0));
        if (anchor == address(0)) {
            anchor = _deployProxy(
                "LedgerAnchor.sol:LedgerAnchor",
                abi.encodeWithSignature("initialize(uint256,address,address)", ledgerChainId, operator, _timelock)
            );
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

        // 3. Hand everything over to the timelock. Last, after every owner-only setup call above.
        _handoverToTimelock(operator, _timelock, safe);

        vm.stopBroadcast();

        // 4. Record. Old addresses go to *V1 keys first, because _writeDeployments rewrites the file.
        _writeAll(old, d, usdg, pLedger, pToken, pSeries, pSandbox, scf, safe);
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
        address safe
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
        vm.writeJson(vm.toString(scf.distributor), PATH, ".scfDistributor");

        // Governance addresses the app, the API and the upgrade scripts need.
        vm.writeJson(vm.toString(_timelock), PATH, ".timelock");
        vm.writeJson(vm.toString(safe), PATH, ".safe");
        vm.writeJson(vm.toString(_trexAuthority), PATH, ".trexImplementationAuthority");
        vm.writeJson(vm.toString(address(_authorityGuard)), PATH, ".trexAuthorityGuard");
        for (uint256 i; i < _sandboxGuards.length; i++) {
            vm.writeJson(vm.toString(_sandboxGuards[i]), PATH, string.concat(".sandboxComplianceGuard", vm.toString(i)));
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
}
