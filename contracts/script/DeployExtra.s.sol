// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { DeployTokenization } from "./DeployTokenization.s.sol";

/**
 * @notice Deploy one more Tawf deposito series or sukuk next to the live demo,
 *         reusing the shared identity registry, claim issuer and settlement
 *         coins recorded in tokenization.deployments.json. Used for maturity
 *         tests that must not close the testers' series or sukuk.
 *
 * @dev Same wiring as DeployTokenization (it reuses its internal deployers).
 *      Writes extra keys (tawfSeries2*, sukuk2*) and leaves the primary ones.
 *
 *      Series:  PRIVATE_KEY=.. LEDGER_ANCHOR=.. TAWF_SERIES_ID=<keccak("tawf.series.2")> \
 *               forge script script/DeployExtra.s.sol:DeployExtra --sig "runSeries()" --broadcast
 *      Sukuk:   PRIVATE_KEY=.. LEDGER_ANCHOR=.. SUKUK_ID=.. SUKUK_FACE=.. SUKUK_MATURITY=.. \
 *               forge script script/DeployExtra.s.sol:DeployExtra --sig "runSukuk()" --broadcast
 */
contract DeployExtra is DeployTokenization {
    string internal constant PATH = "../tawf-finance/src/web3/tokenization.deployments.json";

    function _loadShared() internal returns (address usdc, address usdt) {
        string memory json = vm.readFile(PATH);
        _sharedIdentityRegistry = vm.parseJsonAddress(json, ".identityRegistry");
        _sharedClaimIssuer = vm.parseJsonAddress(json, ".claimIssuer");
        usdc = vm.parseJsonAddress(json, ".mockUsdc");
        usdt = vm.parseJsonAddress(json, ".mockUsdt");
        _sukukUsdc = usdc;
    }

    function runSeries() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        address anchor = vm.envAddress("LEDGER_ANCHOR");
        bytes32 seriesId = vm.envBytes32("TAWF_SERIES_ID");
        (address usdc, address usdt) = _loadShared();

        vm.startBroadcast(key);
        (address token, address series, address sandbox) = _deployTawfSeries(operator, usdc, usdt, anchor, seriesId);
        vm.stopBroadcast();

        vm.writeJson(vm.toString(series), PATH, ".tawfSeries2");
        vm.writeJson(vm.toString(token), PATH, ".tawfSeries2Token");
        vm.writeJson(vm.toString(sandbox), PATH, ".tawfSeries2Sandbox");
        vm.writeJson(vm.toString(seriesId), PATH, ".tawfSeries2Id");
    }

    function runSukuk() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        address anchor = vm.envAddress("LEDGER_ANCHOR");
        _loadShared();
        _loadSukukTerms();

        vm.startBroadcast(key);
        (address token, address distributor) = _deploySukuk(operator, anchor);
        vm.stopBroadcast();

        vm.writeJson(vm.toString(distributor), PATH, ".sukuk2Distributor");
        vm.writeJson(vm.toString(token), PATH, ".sukuk2Token");
        vm.writeJson(vm.toString(_sukukId), PATH, ".sukuk2Id");
        vm.writeJson(vm.toString(uint256(_sukukMaturity)), PATH, ".sukuk2Maturity");
    }
}
