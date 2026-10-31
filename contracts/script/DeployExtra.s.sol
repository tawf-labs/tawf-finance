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
 *      Optional: OUT_KEY (json key prefix, default tawfSeries2 / sukuk2),
 *      FEE_RECIPIENT + TAWF_NISBAH_BPS (Tawf's nisbah, set before the sale opens).
 *
 *      Sukuk:   PRIVATE_KEY=.. LEDGER_ANCHOR=.. SUKUK_ID=.. SUKUK_FACE=.. SUKUK_MATURITY=.. \
 *               forge script script/DeployExtra.s.sol:DeployExtra --sig "runSukuk()" --broadcast
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

    function runSeries() external {
        _initBeaconOwner();
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        address anchor = vm.envAddress("LEDGER_ANCHOR");
        bytes32 seriesId = vm.envBytes32("TAWF_SERIES_ID");
        (address usdc, address usdt) = _loadShared();

        vm.startBroadcast(key);
        (address token, address series, address sandbox) = _deployTawfSeries(operator, usdc, usdt, anchor, seriesId);
        vm.stopBroadcast();

        _setShare(key, series);
        string memory k = vm.envOr("OUT_KEY", string("tawfSeries2"));
        vm.writeJson(vm.toString(series), PATH, string.concat(".", k));
        vm.writeJson(vm.toString(token), PATH, string.concat(".", k, "Token"));
        vm.writeJson(vm.toString(sandbox), PATH, string.concat(".", k, "Sandbox"));
        vm.writeJson(vm.toString(seriesId), PATH, string.concat(".", k, "Id"));
    }

    function runSukuk() external {
        _initBeaconOwner();
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        address anchor = vm.envAddress("LEDGER_ANCHOR");
        _loadShared();
        _loadSukukTerms();

        vm.startBroadcast(key);
        (address token, address distributor) = _deploySukuk(operator, anchor);
        vm.stopBroadcast();

        _setShare(key, distributor);
        string memory k = vm.envOr("OUT_KEY", string("sukuk2"));
        vm.writeJson(vm.toString(distributor), PATH, string.concat(".", k, "Distributor"));
        vm.writeJson(vm.toString(token), PATH, string.concat(".", k, "Token"));
        vm.writeJson(vm.toString(_sukukId), PATH, string.concat(".", k, "Id"));
        vm.writeJson(vm.toString(uint256(_sukukMaturity)), PATH, string.concat(".", k, "Maturity"));
    }

    /// @dev Set Tawf's nisbah (TAWF_NISBAH_BPS, default 1500) and fee wallet
    ///      (FEE_RECIPIENT) before the sale opens. Skipped when FEE_RECIPIENT is unset.
    function _setShare(uint256 key, address product) internal {
        address feeRecipient = vm.envOr("FEE_RECIPIENT", address(0));
        if (feeRecipient == address(0)) return;
        uint16 bps = uint16(vm.envOr("TAWF_NISBAH_BPS", uint256(1500)));
        vm.broadcast(key);
        ITawfShare(product).setTawfShare(bps, feeRecipient);
    }
}

interface ITawfShare {
    function setTawfShare(uint16 nisbahBps, address recipient) external;
}
