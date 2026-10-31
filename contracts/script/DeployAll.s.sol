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
import { IKeyLike } from "./DeployTokenization.s.sol";
import { TestClaimIssuerSetup } from "./lib/TestClaimIssuerSetup.sol";
import { TrustedIssuersRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import { IdentityRegistry } from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";

contract DeployAll is DeployScf, DeployDepositoPool {
    struct Out {
        Deployment d;
        address usdg;
        address pLedger;
        address pToken;
        address pSeries;
        address pSandbox;
        Scf scf;
        address anchor;
        address testClaimIssuer;
        address testRegistryAgent;
    }

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
        Out memory o = _runAll(operator, ledgerChainId);
        vm.stopBroadcast();

        _writeAll(old, o, govStart);
    }

    /// @dev The whole deploy, hand-over and read-backs, without its own broadcast, so a test can run exactly this.
    ///      `_loadSafes()` must have run.
    function _runAll(address operator, uint256 ledgerChainId) internal returns (Out memory o) {
        // The anchor is always ours, behind its beacon. An external anchor (not upgradeable by us, not Safe governed) is not supported.
        o.anchor =
            _deployProxy("LedgerAnchor.sol:LedgerAnchor", abi.encodeWithSignature("initialize(uint256,address,address)", ledgerChainId, operator, operator));
        _loadSukukTerms();
        o.d = _deployAll(operator, o.anchor, ledgerChainId);
        o.usdg = deployCode("MockUSDC.sol:MockUSDC");
        (o.pLedger, o.pToken, o.pSeries, o.pSandbox) =
            _deployPool(operator, o.d.mockUsdc, o.d.mockUsdt, o.usdg, ledgerChainId);
        _coinList = new address[](3);
        _coinList[0] = o.d.mockUsdc;
        _coinList[1] = o.d.mockUsdt;
        _coinList[2] = o.usdg;
        o.scf = _deployScf(operator, ledgerChainId);
        _open(o.scf, ledgerChainId);
        _setShareInBroadcast(o.d.series);
        _setShareInBroadcast(o.pSeries);

        // Testnet faucet (Arbitrum Sepolia only, refused elsewhere by the library): a TEST ClaimIssuer whose only claim key is
        // the API's TEST_CLAIM_SIGNER, trusted for KYC and TAWF_SCREENED only, and a TEST registry agent (TEST_REGISTRY_AGENT).
        // Both are EOAs the API holds. The operator never holds either role. Without TESTNET_FAUCET=false the faucet works
        // straight after a fresh deploy.
        if (block.chainid == 421614 && vm.envOr("TESTNET_FAUCET", true)) {
            address signer = vm.envAddress("TEST_CLAIM_SIGNER");
            o.testRegistryAgent = vm.envAddress("TEST_REGISTRY_AGENT");
            o.testClaimIssuer = address(
                TestClaimIssuerSetup.deployFor(TrustedIssuersRegistry(o.d.shared.trustedIssuersRegistry), signer, _safes.compliance, operator)
            );
            TestClaimIssuerSetup.addRegistryAgent(IdentityRegistry(o.d.shared.identityRegistry), o.testRegistryAgent);
        }

        // Hand everything over, last, after every owner-only setup call above.
        _wireRoles(operator, o.d, o.pLedger, o.pSeries, o.scf, o.anchor);
        _handoverToSafes(operator);
        _verifyOwnership(_allBeacons);
        _verifyRoles(operator, o.d, o.pLedger, o.pSeries, o.scf, o.anchor);
        _verifyTrex(operator, o.testRegistryAgent);
        if (_moduleBeaconsSet) {
            require(_moduleBeacons.sandbox.owner() == _safes.governance, "module beacon not owned by GOV_SAFE");
            require(_moduleBeacons.checkpoint.owner() == _safes.governance, "module beacon not owned by GOV_SAFE");
            require(_moduleBeacons.scfLimit.owner() == _safes.governance, "module beacon not owned by GOV_SAFE");
        }
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

    function _writeAll(string memory old, Out memory o, uint256 govStart) internal {
        Deployment memory d = o.d;
        address usdg = o.usdg;
        address pLedger = o.pLedger;
        address pToken = o.pToken;
        address pSeries = o.pSeries;
        address pSandbox = o.pSandbox;
        Scf memory scf = o.scf;
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
        if (o.testClaimIssuer != address(0)) {
            vm.writeJson(vm.toString(o.testClaimIssuer), PATH, ".testClaimIssuer");
            vm.writeJson(vm.toString(o.testRegistryAgent), PATH, ".testRegistryAgent");
        }
        vm.writeJson(vm.toString(address(_moduleBeacons.sandbox)), PATH, ".sandboxModuleBeacon");
        vm.writeJson(vm.toString(address(_moduleBeacons.checkpoint)), PATH, ".distributionCheckpointBeacon");
        vm.writeJson(vm.toString(address(_moduleBeacons.scfLimit)), PATH, ".scfLimitModuleBeacon");
        vm.writeJson(vm.toString(_trexAuthority), PATH, ".trexImplementationAuthority");
        for (uint256 i; i < _allBeacons.length; i++) {
            string memory bk = _beaconKey(_beaconArtifacts[i]);
            vm.writeJson(vm.toString(_allBeacons[i]), PATH, string.concat(".", bk));
            // <type>Instances next to <type>Beacon: every proxy made on that beacon. The upgrade batch is built from
            // these lists and checked against the deploy logs.
            _writeList(string.concat(".", _instancesKey(bk)), _instances[keccak256(bytes(_beaconArtifacts[i]))]);
        }
        _writeList(".sandboxModuleInstances", _sandboxInstances);
        _writeList(".distributionCheckpointInstances", _checkpointInstances);
        _writeList(".scfLimitModuleInstances", _scfLimitInstances);

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
        // RS4: the MINTER and FUNDER exclusion is enforced per contract (a contract refuses both on one address). Across
        // contracts it is this check: no Safe or the operator holds MINTER on any series and FUNDER anywhere, and the
        // two duties sit on different Safes.
        require(_safes.minting != _safes.treasury, "roles: minting and treasury are the same Safe");
        address[3] memory holders = [_safes.governance, _safes.guardian, _safes.compliance];
        for (uint256 i; i < 3; i++) {
            for (uint256 k; k < 2; k++) {
                require(!IRoles(seriesList[k]).hasRole(R_MINTER, holders[i]) && !IRoles(seriesList[k]).hasRole(R_FUNDER, holders[i]), "roles: a non-duty Safe holds mint or fund");
                require(!IRoles(dists[k]).hasRole(R_FUNDER, holders[i]), "roles: a non-duty Safe holds fund");
            }
        }
        for (uint256 k; k < 2; k++) {
            require(!IRoles(dists[k]).hasRole(R_FUNDER, _safes.minting), "roles: the minting safe can fund");
            require(!IRoles(seriesList[k]).hasRole(R_FUNDER, _safes.minting) && !IRoles(seriesList[k]).hasRole(R_MINTER, _safes.treasury), "roles: the duties are mixed");
        }
        require(!IRoles(d.dealRegistry).hasRole(R_OPS, operator) && !IRoles(d.redemptionVault).hasRole(R_OPS, operator), "roles: operator ops");
    }

    bytes32 internal constant DEFAULT_ADMIN = 0x00;

    /// @dev "ledgerAnchorBeacon" -> "ledgerAnchorInstances".
    function _instancesKey(string memory beaconKey) internal pure returns (string memory) {
        bytes memory b = bytes(beaconKey);
        bytes memory out = new bytes(b.length - 6 + 9); // "Beacon" (6) becomes "Instances" (9)
        for (uint256 i; i < b.length - 6; i++) out[i] = b[i];
        bytes memory suffix = bytes("Instances");
        for (uint256 i; i < 9; i++) out[b.length - 6 + i] = suffix[i];
        return string(out);
    }

    function _writeList(string memory key, address[] memory list) internal {
        string memory arr = "[";
        for (uint256 i; i < list.length; i++) {
            arr = string.concat(arr, i == 0 ? "" : ",", '"', vm.toString(list[i]), '"');
        }
        vm.writeJson(string.concat(arr, "]"), PATH, key);
    }

    /// @dev Read-back of the T-REX side: nobody but the Minting Safe is an agent on any token (the series and
    ///      distributor contracts keep their own agent role), the operator is no agent on any token or on the
    ///      identity registry, the Compliance Safe is the registry agent, and the ClaimIssuer's management and claim
    ///      keys belong to the Compliance Safe, not the operator. The faucet's TEST registry agent, when present, is
    ///      an agent and nothing else changed.
    function _verifyTrex(address operator, address testAgent) internal view {
        for (uint256 i; i < _tokens.length; i++) {
            require(!IAgentRead(_tokens[i]).isAgent(operator), "trex: the operator is a token agent");
            require(!IAgentRead(_tokens[i]).isAgent(_safes.guardian), "trex: the guardian is a token agent");
            require(IAgentRead(_tokens[i]).isAgent(_safes.minting), "trex: the minting safe is not a token agent");
        }
        address ir = _sharedIdentityRegistry;
        require(!IAgentRead(ir).isAgent(operator), "trex: the operator is a registry agent");
        require(IAgentRead(ir).isAgent(_safes.compliance), "trex: the compliance safe is not a registry agent");
        if (testAgent != address(0)) require(IAgentRead(ir).isAgent(testAgent), "trex: the test registry agent is missing");
        bytes32 comp = keccak256(abi.encode(_safes.compliance));
        bytes32 op = keccak256(abi.encode(operator));
        require(IKeyLike(_sharedClaimIssuer).keyHasPurpose(comp, 1) && IKeyLike(_sharedClaimIssuer).keyHasPurpose(comp, 3), "trex: claim issuer keys");
        require(!IKeyLike(_sharedClaimIssuer).keyHasPurpose(op, 1) && !IKeyLike(_sharedClaimIssuer).keyHasPurpose(op, 3), "trex: operator has a claim issuer key");
    }
}

interface IAgentRead {
    function isAgent(address account) external view returns (bool);
}

interface IRoles {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
}
