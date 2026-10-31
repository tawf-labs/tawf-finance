// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// One script for the whole fresh Sepolia stack. Every contract that is ours is a BeaconProxy (one
// UpgradeableBeacon per type, owned by the Governance Safe), the T-REX suite sits behind its
// TREXImplementationAuthority, and every duty has its own Gnosis Safe. DRY RUN FIRST:
//
//   PRIVATE_KEY=.. LEDGER_CHAIN_ID=.. DEPLOYMENTS_PATH=/tmp/deployments.dryrun.json \
//   GOV_SAFE=0x.. TREASURY_SAFE=0x.. MINTING_SAFE=0x.. COMPLIANCE_SAFE=0x.. GUARDIAN_SAFE=0x.. \
//   [ALLOW_EOA_SAFES=true for a dry run with placeholder addresses] \
//   [SUKUK_MATURITY=..] [FEE_RECIPIENT=.. TAWF_NISBAH_BPS=..] \
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

        // The anchor is always ours, behind its beacon. An external anchor (not upgradeable by us, not Safe governed) is not supported.
        address anchor =
            _deployProxy("LedgerAnchor.sol:LedgerAnchor", abi.encodeWithSignature("initialize(uint256,address,address)", ledgerChainId, operator, operator));
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
        _wireRoles(operator, d, pLedger, pSeries, scf, anchor);
        _handoverToSafes(operator);
        _verifyOwnership(_allBeacons);
        _verifyRoles(operator, d, pLedger, pSeries, scf, anchor);
        if (_moduleBeaconsSet) {
            require(_moduleBeacons.sandbox.owner() == _safes.governance, "module beacon not owned by GOV_SAFE");
            require(_moduleBeacons.checkpoint.owner() == _safes.governance, "module beacon not owned by GOV_SAFE");
            require(_moduleBeacons.scfLimit.owner() == _safes.governance, "module beacon not owned by GOV_SAFE");
        }

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
        vm.writeJson(vm.toString(address(_moduleBeacons.sandbox)), PATH, ".sandboxModuleBeacon");
        vm.writeJson(vm.toString(address(_moduleBeacons.checkpoint)), PATH, ".distributionCheckpointBeacon");
        vm.writeJson(vm.toString(address(_moduleBeacons.scfLimit)), PATH, ".scfLimitModuleBeacon");
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

    // ---------------------------------------------------------------------------------------------
    // Role table. Each duty has one Safe. After this the operator EOA holds FX_ROLE and the data posts and nothing
    // else. MINTER and FUNDER sit on different Safes (and the contracts refuse both on one address).
    // ---------------------------------------------------------------------------------------------

    bytes32 internal constant R_ADMIN = keccak256("ADMIN_ROLE");
    bytes32 internal constant R_MINTER = keccak256("MINTER_ROLE");
    bytes32 internal constant R_FUNDER = keccak256("FUNDER_ROLE");
    bytes32 internal constant R_GUARDIAN = keccak256("GUARDIAN_ROLE");
    bytes32 internal constant R_OPS = keccak256("OPS_ROLE");
    bytes32 internal constant R_ORIGINATOR = keccak256("ORIGINATOR_ROLE");
    bytes32 internal constant R_SHARIAH = keccak256("SHARIAH_ROLE");

    function _wireRoles(
        address operator,
        Deployment memory d,
        address pLedger,
        address pSeries,
        Scf memory scf,
        address anchor
    ) internal {
        // Deposito series (legacy and pool): mint = Minting Safe, money commitments = Treasury Safe.
        address[2] memory seriesList = [d.series, pSeries];
        for (uint256 i; i < 2; i++) {
            IRoles s = IRoles(seriesList[i]);
            s.grantRole(R_MINTER, _safes.minting);
            s.grantRole(R_FUNDER, _safes.treasury);
            s.grantRole(R_GUARDIAN, _safes.guardian);
            s.grantRole(DEFAULT_ADMIN, _safes.governance);
            s.grantRole(R_ADMIN, _safes.governance);
            s.revokeRole(R_ADMIN, operator);
            s.renounceRole(DEFAULT_ADMIN, operator); // the operator keeps FX_ROLE only
        }
        // Distributors (sukuk and SCF): money out = Treasury Safe.
        address[2] memory dists = [d.sukukDistributor, scf.distributor];
        for (uint256 i; i < 2; i++) {
            IRoles s = IRoles(dists[i]);
            s.grantRole(R_FUNDER, _safes.treasury);
            s.grantRole(R_GUARDIAN, _safes.guardian);
            s.grantRole(DEFAULT_ADMIN, _safes.governance);
            s.grantRole(R_ADMIN, _safes.governance);
            s.revokeRole(R_FUNDER, operator);
            s.revokeRole(R_ADMIN, operator);
            s.renounceRole(DEFAULT_ADMIN, operator);
        }
        // Ledger and anchors: governance administers, the operator only posts data.
        IRoles led = IRoles(pLedger);
        led.grantRole(R_GUARDIAN, _safes.guardian);
        led.grantRole(DEFAULT_ADMIN, _safes.governance);
        led.renounceRole(DEFAULT_ADMIN, operator);
        address[2] memory anchors = [anchor, scf.anchor];
        for (uint256 i; i < 2; i++) {
            IRoles(anchors[i]).grantRole(DEFAULT_ADMIN, _safes.governance);
            IRoles(anchors[i]).renounceRole(DEFAULT_ADMIN, operator);
        }
        // Financing pool: governance admin, vault operations = Treasury Safe, deal approvals = Compliance Safe.
        IRoles reg = IRoles(d.dealRegistry);
        reg.grantRole(R_ORIGINATOR, _safes.compliance);
        reg.grantRole(R_SHARIAH, _safes.compliance);
        reg.grantRole(R_OPS, _safes.compliance);
        reg.revokeRole(R_ORIGINATOR, operator);
        reg.revokeRole(R_SHARIAH, operator);
        reg.revokeRole(R_OPS, operator);
        IRoles vault = IRoles(d.redemptionVault);
        vault.grantRole(R_OPS, _safes.treasury);
        vault.revokeRole(R_OPS, operator);
        address[3] memory pool = [d.dealRegistry, d.bondReceiptNft, d.redemptionVault];
        for (uint256 i; i < 3; i++) {
            IRoles(pool[i]).grantRole(DEFAULT_ADMIN, _safes.governance);
            IRoles(pool[i]).grantRole(R_ADMIN, _safes.governance);
            IRoles(pool[i]).revokeRole(R_ADMIN, operator);
            IRoles(pool[i]).renounceRole(DEFAULT_ADMIN, operator);
        }
    }

    /// @dev Readback of the role table. Reverts the deploy unless the operator holds no admin, mint or money role
    ///      anywhere, the Governance Safe is the admin, and the mint and money Safes hold their one duty each.
    function _verifyRoles(
        address operator,
        Deployment memory d,
        address pLedger,
        address pSeries,
        Scf memory scf,
        address anchor
    ) internal view {
        address[2] memory seriesList = [d.series, pSeries];
        for (uint256 i; i < 2; i++) {
            IRoles s = IRoles(seriesList[i]);
            require(s.hasRole(R_MINTER, _safes.minting) && !s.hasRole(R_FUNDER, _safes.minting), "roles: minting safe");
            require(s.hasRole(R_FUNDER, _safes.treasury) && !s.hasRole(R_MINTER, _safes.treasury), "roles: treasury safe");
            require(!s.hasRole(R_MINTER, operator) && !s.hasRole(R_FUNDER, operator), "roles: operator holds mint or fund");
            require(!s.hasRole(R_MINTER, _safes.guardian) && !s.hasRole(R_FUNDER, _safes.guardian), "roles: guardian holds mint or fund");
            require(!s.hasRole(R_ADMIN, operator) && !s.hasRole(DEFAULT_ADMIN, operator), "roles: operator is an admin");
            require(s.hasRole(DEFAULT_ADMIN, _safes.governance) && s.hasRole(R_GUARDIAN, _safes.guardian), "roles: governance or guardian");
        }
        address[2] memory dists = [d.sukukDistributor, scf.distributor];
        for (uint256 i; i < 2; i++) {
            IRoles s = IRoles(dists[i]);
            require(s.hasRole(R_FUNDER, _safes.treasury) && !s.hasRole(R_FUNDER, operator), "roles: distributor funder");
            require(!s.hasRole(R_ADMIN, operator) && !s.hasRole(DEFAULT_ADMIN, operator), "roles: operator is an admin");
            require(s.hasRole(DEFAULT_ADMIN, _safes.governance) && s.hasRole(R_GUARDIAN, _safes.guardian), "roles: governance or guardian");
        }
        require(!IRoles(pLedger).hasRole(DEFAULT_ADMIN, operator) && IRoles(pLedger).hasRole(DEFAULT_ADMIN, _safes.governance), "roles: ledger admin");
        require(!IRoles(scf.anchor).hasRole(DEFAULT_ADMIN, operator) && IRoles(scf.anchor).hasRole(DEFAULT_ADMIN, _safes.governance), "roles: scf anchor admin");
        require(!IRoles(anchor).hasRole(DEFAULT_ADMIN, operator) && IRoles(anchor).hasRole(DEFAULT_ADMIN, _safes.governance), "roles: anchor admin");
        address[3] memory pool = [d.dealRegistry, d.bondReceiptNft, d.redemptionVault];
        for (uint256 i; i < 3; i++) {
            require(!IRoles(pool[i]).hasRole(DEFAULT_ADMIN, operator) && !IRoles(pool[i]).hasRole(R_ADMIN, operator), "roles: pool admin");
            require(IRoles(pool[i]).hasRole(DEFAULT_ADMIN, _safes.governance), "roles: pool governance");
        }
        require(!IRoles(d.dealRegistry).hasRole(R_OPS, operator) && !IRoles(d.redemptionVault).hasRole(R_OPS, operator), "roles: operator ops");
    }

    bytes32 internal constant DEFAULT_ADMIN = 0x00;
}

interface IRoles {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
}
