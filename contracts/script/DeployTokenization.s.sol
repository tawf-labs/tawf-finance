// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// NOTE: This script imports the T-REX and onchain-id concrete contracts, which are pinned to
// `pragma solidity 0.8.17`. Therefore this file is pinned to 0.8.17. It reaches the 0.8.20/0.8.24
// Tawf contracts (TawfDepositoSeries, SukukDistributor, MockUSDC, DealRegistry, BondReceiptNFT,
// RedemptionVault) only through vm.deployCode and minimal interfaces, never via direct imports of
// those sources. The DistributionCheckpointModule and SandboxModule are themselves 0.8.17 so they
// are imported directly.
//
// Purpose: a single-operator demo deployment for Arbitrum Sepolia (chainId 421614). ONE env var
// PRIVATE_KEY controls everything; the derived operator address holds every role. The shared
// T-REX identity suite is deployed once and reused across the Tawf deposito series token and the
// sukuk series token. LedgerAnchor is supplied via env (LEDGER_ANCHOR, LEDGER_CHAIN_ID) because
// the ledger lives in tawf-network.
//
// Model B (wrapped Tawf deposit): instead of four per-tenor deposito tokens, there is ONE Tawf
// deposito series token (tDEP-TAWF-S1, 2 decimals, sen) backed by Tawf's single dedicated account
// at the BPRS. Its compliance carries a DistributionCheckpointModule (so profit follows holders)
// and a SandboxModule (the regulated eligibility + caps gate, default mode PILOT_ONLY). The
// TawfDepositoSeries contract is the token's only minter/burner.
//
// Claim topics 2 (TAWF_SCREENED) and 3 (OJK_SANDBOX_PARTICIPANT): these are deliberately NOT added
// to the shared ClaimTopicsRegistry, since every identity in the shared IdentityRegistry would then
// be required to carry them (and the sukuk/KYC holders do not). The SandboxModule reads those
// claims itself off each holder's ONCHAINID, so the gate is per-series, not registry-wide.

import { ModuleProxies } from "../src/proxy/ModuleProxies.sol";
import { TrexProxies } from "../src/proxy/TrexProxies.sol";
import { TREXImplementationAuthority } from "@erc3643org/erc-3643/contracts/proxy/authority/TREXImplementationAuthority.sol";
import "forge-std/Script.sol";
import {ProxyDeployer} from "./lib/ProxyDeployer.sol";

import {ClaimTopicsRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import {IdentityRegistryStorage} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import {IdentityRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";

import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {ImplementationAuthority} from "@onchain-id/solidity/contracts/proxy/ImplementationAuthority.sol";
import {IdFactory} from "@onchain-id/solidity/contracts/factory/IdFactory.sol";

import {DistributionCheckpointModule} from "../src/sukuk/DistributionCheckpointModule.sol";
import {IBalanceCheckpoint} from "../src/sukuk/IBalanceCheckpoint.sol";
import {SandboxModule} from "../src/deposito/SandboxModule.sol";

/// @title DeployTokenization
/// @notice Single-operator ("everything") demo deployment of the Tawf tokenization suite:
///         shared T-REX identity, the Tawf deposito series (Model B) and one sukuk series on
///         Arbitrum Sepolia.
contract DeployTokenization is Script, ProxyDeployer {
    /// @dev Holder of UPGRADER_ROLE on the proxied contracts: the TimelockController from the
    ///      UPGRADER env var. Falls back to the operator only for local and early testnet runs.
    bytes4 internal constant DIST_INIT = bytes4(keccak256("initialize(address[],address,address,address,address,(bytes32,uint256,uint40,uint256,uint256,uint40,address),address)"));
    bytes4 internal constant SERIES_INIT = bytes4(keccak256("initialize(address,address,address,address,address,(bytes32,uint8,uint16),address,address,address,uint64)"));

    // ---------------------------------------------------------------------------------------------
    // Governance: Gnosis Safes, one per duty. No custom multisig and no timelock of our own.
    //   Governance Safe: owns every beacon (upgrades), the T-REX and ONCHAINID authorities, the T-REX
    //                    owners and the compliance modules, and is the role admin everywhere.
    //   Treasury Safe:   money out (FUNDER_ROLE and the raise and sweep paths).
    //   Minting Safe:    MINTER_ROLE (series allocate).
    //   Compliance Safe: identity registry agent, claim issuer management, limit profiles, freezes, and the
    //                    (sandbox mode, caps and series end go through the Governance Safe, which owns every ModularCompliance).
    //   Guardian Safe:   pause only.
    //   operator EOA:    data posts only (FX rates, bank ledger snapshots and profit, ledger roots).
    // Safe addresses come from env. Signer keys are never generated here.
    // ---------------------------------------------------------------------------------------------

    struct Safes {
        address governance;
        address treasury;
        address minting;
        address compliance;
        address guardian;
    }

    Safes internal _safes;

    /// @dev GOV_SAFE, TREASURY_SAFE, MINTING_SAFE, COMPLIANCE_SAFE and GUARDIAN_SAFE. They must be
    ///      non-zero and pairwise distinct (one Safe per duty), and be contracts (real Safes), unless
    ///      ALLOW_EOA_SAFES=true, which a dry run or a local test may set. Sets the beacon owner.
    function _loadSafes() internal {
        _safes = Safes({
            governance: vm.envAddress("GOV_SAFE"),
            treasury: vm.envAddress("TREASURY_SAFE"),
            minting: vm.envAddress("MINTING_SAFE"),
            compliance: vm.envAddress("COMPLIANCE_SAFE"),
            guardian: vm.envAddress("GUARDIAN_SAFE")
        });
        address[5] memory all = [_safes.governance, _safes.treasury, _safes.minting, _safes.compliance, _safes.guardian];
        bool allowEoa = vm.envOr("ALLOW_EOA_SAFES", false);
        for (uint256 i; i < 5; i++) {
            require(all[i] != address(0), "a Safe address is unset");
            require(allowEoa || all[i].code.length > 0, "a Safe address has no code (set ALLOW_EOA_SAFES=true for a dry run)");
            for (uint256 j = i + 1; j < 5; j++) require(all[i] != all[j], "one Safe per duty: two duties share a Safe");
        }
        // The Governance Safe is the upgrade key for everything, so it must really be a multisig: at least 2 owners
        // and a threshold of at least 2 (the same check the module hand-over uses).
        if (!allowEoa) ModuleProxies.requireMultisig(_safes.governance);
        beaconOwner = _safes.governance; // every beacon is created owned by the Governance Safe
    }

    /// @dev Contracts whose single-step `owner` moves to the Governance Safe (T-REX owners, tokens, the
    ///      TREXImplementationAuthority, SCF and sukuk compliances, the ONCHAINID authority and factory).
    address[] internal _owned;
    /// @dev Compliance modules: two-step ownership. The Governance Safe must accept (a Safe transaction).
    address[] internal _modules;
    address[] internal _tokens;
    address internal _trexAuthority;

    /// @dev One beacon per compliance module type for the whole deployment (dev1's ModuleProxies), created on first
    ///      use and handed to the Governance Safe in the hand-over, with the owner read back.
    ModuleProxies.Beacons internal _moduleBeacons;
    bool internal _moduleBeaconsSet;

    function _mb() internal returns (ModuleProxies.Beacons memory) {
        if (!_moduleBeaconsSet) {
            _moduleBeacons = ModuleProxies.beacons();
            _moduleBeaconsSet = true;
        }
        return _moduleBeacons;
    }

    function _own(address c) internal {
        _owned.push(c);
    }

    function _ownModule(address m) internal {
        _modules.push(m);
    }

    function _ownToken(address t) internal {
        _own(t);
        _tokens.push(t);
    }

    function _ownCompliance(address mc, bool sandboxed) internal {
        sandboxed; // every compliance, sandboxed or not, is owned by the Governance Safe
        _own(mc);
    }

    /// @dev Hand-over, run last by the broadcaster that deployed everything:
    ///      1. Guardian Safe and Compliance Safe become agents on every token (pause, freeze).
    ///      2. Every registered owner moves to the Governance Safe (single step).
    ///      3. Modules start their two-step transfer to the Governance Safe.
    ///      The Governance Safe then accepts the two-step ones with one Safe transaction (logged).
    function _handoverToSafes(address operator) internal {
        // Every compliance module's configurer becomes the Compliance Safe (setHook, initOffering, setOfferingCap,
        // initConfig, agents). The operator keeps no module role. Owner-only, so it runs before the owner moves.
        for (uint256 i; i < _modules.length; i++) IConfigurerLike(_modules[i]).setConfigurer(_safes.compliance);
        // Token agents can mint, burn, force transfers, freeze and recover. So the Guardian Safe and the operator are NOT
        // agents. Only the Minting Safe is a token agent (the series and distributor contracts that mint keep their own
        // agent role), and the Compliance Safe becomes the identity registry agent below. Pausing the system is done
        // with pause() on our own contracts (GUARDIAN_ROLE), not through the token.
        for (uint256 i; i < _tokens.length; i++) {
            IAgentLike(_tokens[i]).addAgent(_safes.minting);
            IAgentLike(_tokens[i]).removeAgent(operator);
        }
        if (_sharedIdentityRegistry != address(0)) {
            IAgentLike(_sharedIdentityRegistry).addAgent(_safes.compliance);
            IAgentLike(_sharedIdentityRegistry).removeAgent(operator);
        }
        for (uint256 i; i < _owned.length; i++) IOwnableLike(_owned[i]).transferOwnership(_safes.governance);
        if (_moduleBeaconsSet) ModuleProxies.handOverAll(_moduleBeacons, _safes.governance); // owner read back inside
        for (uint256 i; i < _modules.length; i++) IOwnableLike(_modules[i]).transferOwnership(_safes.governance);
        operator; // the operator keeps only the data roles, see _wireRoles in DeployAll
        console.log("The Governance Safe must accept ownership (acceptOwnership) on these two-step contracts:");
        for (uint256 i; i < _modules.length; i++) console.log(_modules[i]);
    }

    /// @dev Readback. Reverts unless every single-step owner IS the Governance Safe, every two-step owner has
    ///      it as pending owner, each sandbox compliance is owned by its guard, and every beacon is owned by it.
    function _verifyOwnership(address[] memory beacons) internal view {
        address gov = _safes.governance;
        for (uint256 i; i < _owned.length; i++) {
            require(IOwnableLike(_owned[i]).owner() == gov, "hand-over: an owner is not the Governance Safe");
        }
        for (uint256 i; i < _modules.length; i++) {
            require(IPendingOwnerLike(_modules[i]).pendingOwner() == gov, "hand-over: a module is not pending the Governance Safe");
        }
        for (uint256 i; i < beacons.length; i++) {
            require(IOwnableLike(beacons[i]).owner() == gov, "hand-over: a beacon is not owned by the Governance Safe");
        }
    }

    /// @dev Standalone entry points (run, runSeries, runSukuk, runPool, runScf) deploy beacon proxies, so they
    ///      need the Governance Safe as beacon owner. DeployAll loads all five Safes instead.
    function _treasury(address operator) internal view returns (address) {
        return _safes.treasury != address(0) ? _safes.treasury : operator;
    }

    function _initBeaconOwner() internal {
        if (beaconOwner == address(0)) beaconOwner = vm.envAddress("GOV_SAFE");
    }

    function _authority() internal returns (address) {
        if (_trexAuthority == address(0)) {
            address existing = vm.envOr("TREX_AUTHORITY", address(0));
            _trexAuthority = existing != address(0) ? existing : address(TrexProxies.authority());
            if (existing == address(0)) _own(_trexAuthority); // the authority goes to the Governance Safe
        }
        return _trexAuthority;
    }

    uint256 internal constant KYC_TOPIC = 1;
    uint16 internal constant COUNTRY_ID = 360; // Indonesia

    bytes32 internal constant INSTITUTION_ID = keccak256("bprs.demo");
    bytes32 internal constant SUKUK_ID = keccak256("sukuk.demo.2026");
    bytes32 internal constant DEFAULT_SERIES_ID = keccak256("tawf.series.1");

    // Series terms (match the ReserveLedger registration in tawf-network's SetupTawfSeries).
    uint8 internal constant SERIES_TENOR = 3;
    uint16 internal constant SERIES_NISBAH = 6000;
    // Demo FX (two-decimal precision, idr per 1 stablecoin). USDC and USDT
    // carry their own posted rates: no 1:1 peg is assumed between them.
    // 1 USDC = 16,250.00 IDR -> 1_625_000; 1 USDT = 16,240.00 IDR -> 1_624_000.
    uint256 internal constant FX_INITIAL_RATE_USDC = 1_625_000;
    uint256 internal constant FX_INITIAL_RATE_USDT = 1_624_000;
    uint64 internal constant SERIES_END_OFFSET = 90 days;

    struct Shared {
        address identityRegistry;
        address identityRegistryStorage;
        address trustedIssuersRegistry;
        address claimTopicsRegistry;
        address claimIssuer;
        address idFactory;
        address implementationAuthority;
    }

    struct Deployment {
        uint256 chainId;
        uint256 ledgerChainId;
        address anchor;
        address operator;
        address mockUsdc;
        address mockUsdt;
        Shared shared;
        // Tawf deposito series (Model B)
        bytes32 seriesId;
        address seriesToken;
        address series; // TawfDepositoSeries
        address sandboxModule;
        uint256 fxInitialRateUsdc;
        uint256 fxInitialRateUsdt;
        // sukuk
        address sukukToken;
        address sukukDistributor;
        // per-deal product
        address dealRegistry;
        address bondReceiptNft;
        address redemptionVault;
        uint256 deployBlock;
    }

    function run() external {
        _initBeaconOwner();
        uint256 operatorKey = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(operatorKey);
        address anchor = vm.envAddress("LEDGER_ANCHOR");
        uint256 ledgerChainId = vm.envUint("LEDGER_CHAIN_ID");

        vm.startBroadcast(operatorKey);
        Deployment memory d = _deployAll(operator, anchor, ledgerChainId);
        vm.stopBroadcast();

        _writeDeployments(d);
        _log(d);
    }

    /// @dev Deploys and wires the whole suite with `operator` holding every role. Assumes the
    ///      caller context is already broadcasting/pranking as `operator`.
    function _deployAll(address operator, address anchor, uint256 ledgerChainId)
        internal
        returns (Deployment memory d)
    {
        d.chainId = block.chainid;
        d.ledgerChainId = ledgerChainId;
        d.anchor = anchor;
        d.operator = operator;
        d.seriesId = vm.envOr("TAWF_SERIES_ID", DEFAULT_SERIES_ID);
        d.fxInitialRateUsdc = FX_INITIAL_RATE_USDC;
        d.fxInitialRateUsdt = FX_INITIAL_RATE_USDT;

        _loadSukukTerms();

        // 1. Shared T-REX identity suite (operator owns everything).
        d.shared = _deployShared(operator);
        _sharedIdentityRegistry = d.shared.identityRegistry;
        _sharedClaimIssuer = d.shared.claimIssuer;

        // 2. MockUSDC + MockUSDT settlement tokens (both 6 decimals) for the
        //    series; the sukuk + per-deal product settle in MockUSDC.
        d.mockUsdc = deployCode("MockUSDC.sol:MockUSDC");
        d.mockUsdt = deployCode("MockUSDT.sol:MockUSDT");
        _sukukUsdc = d.mockUsdc;

        // 3. Tawf deposito series token + compliance + modules + series contract.
        (d.seriesToken, d.series, d.sandboxModule) =
            _deployTawfSeries(operator, d.mockUsdc, d.mockUsdt, anchor, d.seriesId);

        // 4. Sukuk series token + compliance + module + distributor.
        (d.sukukToken, d.sukukDistributor) = _deploySukuk(operator, anchor);

        // 5. Per-deal product (DealRegistry / BondReceiptNFT / RedemptionVault).
        (d.dealRegistry, d.bondReceiptNft, d.redemptionVault) =
            _deployPerDeal(operator, d.shared.identityRegistry, d.mockUsdc);

        // On Arbitrum, block.number is the Ethereum L1 block number, not the
        // Arbitrum block, so it must not be used as a getLogs starting point.
        d.deployBlock = block.number;
    }

    function _deployShared(address operator) internal returns (Shared memory s) {
        address ia = _authority();
        ClaimTopicsRegistry ctr = TrexProxies.claimTopicsRegistry(ia);
        TrustedIssuersRegistry tir = TrexProxies.trustedIssuersRegistry(ia);
        IdentityRegistryStorage irs = TrexProxies.identityRegistryStorage(ia);
        IdentityRegistry ir = TrexProxies.identityRegistry(ia, address(tir), address(ctr), address(irs));
        _own(address(ctr));
        _own(address(tir));
        _own(address(irs));
        _own(address(ir));
        irs.bindIdentityRegistry(address(ir));
        // Only KYC (topic 1) is registry-wide required. TAWF_SCREENED (2) and
        // OJK_SANDBOX_PARTICIPANT (3) are checked by the SandboxModule itself,
        // so they are NOT added here.
        ctr.addClaimTopic(KYC_TOPIC);

        Identity identityImpl = new Identity(operator, true); // library mode
        ImplementationAuthority implAuth = new ImplementationAuthority(address(identityImpl));
        IdFactory idFactory = new IdFactory(address(implAuth));
        _own(address(implAuth));
        _own(address(idFactory));

        ClaimIssuer claimIssuer = new ClaimIssuer(operator);
        // The Tawf ClaimIssuer is trusted for KYC and for the screening/sandbox
        // claims the SandboxModule reads (topics 2 and 3).
        uint256[] memory topics = new uint256[](3);
        topics[0] = KYC_TOPIC;
        topics[1] = 2; // TAWF_SCREENED
        topics[2] = 3; // OJK_SANDBOX_PARTICIPANT
        tir.addTrustedIssuer(claimIssuer, topics);

        ir.addAgent(operator); // operator registers verified holders

        s = Shared({
            identityRegistry: address(ir),
            identityRegistryStorage: address(irs),
            trustedIssuersRegistry: address(tir),
            claimTopicsRegistry: address(ctr),
            claimIssuer: address(claimIssuer),
            idFactory: address(idFactory),
            implementationAuthority: address(implAuth)
        });
    }

    function _deployTawfSeries(address operator, address usdc, address usdt, address anchor, bytes32 seriesId)
        internal
        returns (address tokenAddr, address series, address sandboxAddr)
    {
        return _deployTawfSeries(operator, usdc, usdt, anchor, seriesId, "Tawf Deposito Series 1 (BPRS Demo)", "tDEP-TAWF-S1");
    }

    /// @dev Same as above with the token name and symbol given, e.g. for a regional Deposito Pool.
    function _deployTawfSeries(
        address operator,
        address usdc,
        address usdt,
        address anchor,
        bytes32 seriesId,
        string memory name_,
        string memory symbol_
    ) internal returns (address tokenAddr, address series, address sandboxAddr) {
        ModularCompliance mc = TrexProxies.modularCompliance(_authority());
        Token token = TrexProxies.token(_authority(), _sharedIdentityRegistry, address(mc), name_, symbol_, 2, address(0));

        DistributionCheckpointModule checkpoint = ModuleProxies.checkpointProxy(address(_mb().checkpoint));
        SandboxModule sandbox = ModuleProxies.sandboxProxy(address(_mb().sandbox));
        _ownToken(address(token));
        _own(address(mc)); // series compliance: the Governance Safe owns it directly
        _ownModule(address(checkpoint));
        _ownModule(address(sandbox));

        // TawfDepositoSeries: (anchor, token, checkpointModule, sandbox, compliance,
        // Terms{seriesId, tenorMonths, nisbahBps}, treasury, admin, operator, maxRateAge).
        // Settlement stablecoins are added after construction via addStablecoin.
        series = _deployProxy(
            "TawfDepositoSeries.sol:TawfDepositoSeries",
            abi.encodePacked(SERIES_INIT, abi.encode(
                anchor,
                address(token),
                address(checkpoint),
                address(sandbox),
                address(mc),
                seriesId,
                SERIES_TENOR,
                SERIES_NISBAH,
                _treasury(operator), // treasury: the Treasury Safe in a Safe deploy, else the operator (local runs)
                operator, // admin
                operator, // operator
                uint64(1 days) // maxRateAge
            ))
        );

        // Configure and bind the SandboxModule first: mode PILOT_ONLY, treasury = operator,
        // default caps, seriesEnd = now + 90 days. Then bind the checkpoint module.
        sandbox.initConfig(
            address(mc),
            SandboxModule.Mode.PILOT_ONLY,
            _treasury(operator), // treasury
            _sharedClaimIssuer, // Tawf ClaimIssuer for topic 2/3 claims
            0, // maxInvestors -> default 50
            0, // maxBalancePerInvestor -> default Rp10,000,000
            0, // seriesCap -> default Rp500,000,000
            uint64(block.timestamp) + SERIES_END_OFFSET
        );
        mc.addModule(address(sandbox));

        checkpoint.setHook(address(mc), IBalanceCheckpoint(series));
        mc.addModule(address(checkpoint));

        // The series contract is the only minter/burner.
        token.addAgent(series);
        token.addAgent(operator);
        token.unpause();

        // Allowlist both settlement stablecoins (USDC + USDT, both 6 decimals).
        ISeriesConfig(series).addStablecoin(usdc);
        ISeriesConfig(series).addStablecoin(usdt);

        // Grant FX_ROLE to the operator so the demo backend can post rates, and
        // post the initial demo rate for each coin (no 1:1 peg assumed).
        ISeriesConfig(series).grantRole(keccak256("FX_ROLE"), operator);
        ISeriesConfig(series).postRate(usdc, FX_INITIAL_RATE_USDC);
        ISeriesConfig(series).postRate(usdt, FX_INITIAL_RATE_USDT);

        // The treasury (operator) pre-approves the series to pull both coins
        // for profit and principal payouts at claim/redeem time.
        // Only when the operator IS the treasury (local runs). With a Treasury Safe, the Safe approves later.
        if (_treasury(operator) == operator) {
            IApprove(usdc).approve(series, type(uint256).max);
            IApprove(usdt).approve(series, type(uint256).max);
        }

        tokenAddr = address(token);
        sandboxAddr = address(sandbox);
    }

    function _deploySukuk(address operator, address anchor)
        internal
        returns (address tokenAddr, address distributor)
    {
        ModularCompliance mc = TrexProxies.modularCompliance(_authority());
        Token token = TrexProxies.token(
            _authority(), _sharedIdentityRegistry, address(mc), "Tawf Sukuk BPRS Demo 2026", "tSUKUK-DEMO-2026", 6, address(0)
        );

        DistributionCheckpointModule module = ModuleProxies.checkpointProxy(address(_mb().checkpoint));
        _ownToken(address(token));
        _ownCompliance(address(mc), false);
        _ownModule(address(module));

        distributor = _deployProxy(
                "SukukDistributor.sol:SukukDistributor",
                abi.encodePacked(DIST_INIT, abi.encode(
                _singleCoin(_sukukUsdc),
                anchor,
                _sharedIdentityRegistry,
                address(token),
                address(module),
                // Terms { sukukId, faceValue, maturity, minRaise, minSubscription, subscriptionPeriod, issuerTreasury }
                _sukukId,
                _sukukFace,
                _sukukMaturity,
                _sukukMinRaise,
                _sukukMinSubscription,
                _sukukSubscriptionPeriod,
                operator,
                operator))
            );

        module.setHook(address(mc), IBalanceCheckpoint(distributor));
        mc.addModule(address(module));

        token.addAgent(distributor);
        token.addAgent(operator);
        token.unpause();

        tokenAddr = address(token);
    }

    /// @dev Load the sukuk terms from env into instance fields, applying demo
    ///      defaults for everything except the required maturity.
    function _loadSukukTerms() internal {
        _sukukId = vm.envOr("SUKUK_ID", SUKUK_ID);
        _sukukFace = vm.envOr("SUKUK_FACE", uint256(5000e6));
        _sukukMaturity = uint40(vm.envUint("SUKUK_MATURITY"));
        _sukukMinRaise = vm.envOr("SUKUK_MIN_RAISE", uint256(1000e6));
        _sukukMinSubscription = vm.envOr("SUKUK_MIN_SUBSCRIPTION", uint256(10e6));
        _sukukSubscriptionPeriod = uint40(vm.envOr("SUKUK_SUBSCRIPTION_PERIOD", uint256(1 days)));
    }

    function _deployPerDeal(address operator, address identityRegistry, address mockUsdc)
        internal
        returns (address dealRegistry, address bondReceiptNft, address redemptionVault)
    {
        bytes memory initOperator = abi.encodeWithSignature("initialize(address)", operator);
        bondReceiptNft = _deployProxy("BondReceiptNFT.sol:BondReceiptNFT", initOperator);
        dealRegistry = _deployProxy("DealRegistry.sol:DealRegistry", initOperator);
        redemptionVault = _deployProxy("RedemptionVault.sol:RedemptionVault", initOperator);

        IDealRegistry(dealRegistry).setVault(redemptionVault);
        IBondReceiptNFT(bondReceiptNft).setVault(redemptionVault);
        IBondReceiptNFT(bondReceiptNft).setDealRegistry(dealRegistry);
        IDealRegistry(dealRegistry).setReceiptNft(bondReceiptNft);
        IBondReceiptNFT(bondReceiptNft).setIdentityRegistry(identityRegistry);
        IRedemptionVault(redemptionVault).configure(mockUsdc, dealRegistry, bondReceiptNft);

        IDealRegistry(dealRegistry).grantRole(keccak256("ORIGINATOR_ROLE"), operator);
        IDealRegistry(dealRegistry).grantRole(keccak256("SHARIAH_ROLE"), operator);
        IDealRegistry(dealRegistry).grantRole(keccak256("OPS_ROLE"), operator);
        IRedemptionVault(redemptionVault).grantRole(keccak256("OPS_ROLE"), operator);
    }

    // --- transient operator-scoped wiring values ---------------------------------
    // deployCode-created contracts cannot be referenced by their 0.8.20/0.8.24 types from this
    // 0.8.17 unit, so a couple of addresses needed deep in the deploy flow are kept here.
    address internal _sharedIdentityRegistry;
    address internal _sharedClaimIssuer;
    address internal _sukukUsdc;

    // --- sukuk terms, resolved from env in _loadSukukTerms -----------------------
    bytes32 internal _sukukId;
    uint256 internal _sukukFace;
    uint40 internal _sukukMaturity;
    uint256 internal _sukukMinRaise;
    uint256 internal _sukukMinSubscription;
    uint40 internal _sukukSubscriptionPeriod;

    function _writeDeployments(Deployment memory d) internal {
        // DEPLOYMENTS_PATH lets a second chain (e.g. Robinhood Chain) write its own file instead of
        // overwriting the Arbitrum Sepolia addresses the live app reads.
        string memory path =
            vm.envOr("DEPLOYMENTS_PATH", string("../tawf-finance/src/web3/tokenization.deployments.json"));
        bytes memory proxyCode = vm.getCode("IdentityProxy.sol:IdentityProxy");

        string memory obj = "tokenization";
        vm.serializeUint(obj, "chainId", d.chainId);
        vm.serializeUint(obj, "ledgerChainId", d.ledgerChainId);
        vm.serializeAddress(obj, "anchor", d.anchor);
        vm.serializeAddress(obj, "operator", d.operator);
        vm.serializeAddress(obj, "mockUsdc", d.mockUsdc);
        vm.serializeAddress(obj, "mockUsdt", d.mockUsdt);
        vm.serializeAddress(obj, "identityRegistry", d.shared.identityRegistry);
        vm.serializeAddress(obj, "identityRegistryStorage", d.shared.identityRegistryStorage);
        vm.serializeAddress(obj, "trustedIssuersRegistry", d.shared.trustedIssuersRegistry);
        vm.serializeAddress(obj, "claimTopicsRegistry", d.shared.claimTopicsRegistry);
        vm.serializeAddress(obj, "claimIssuer", d.shared.claimIssuer);
        vm.serializeAddress(obj, "idFactory", d.shared.idFactory);
        vm.serializeAddress(obj, "implementationAuthority", d.shared.implementationAuthority);
        vm.serializeUint(obj, "kycClaimTopic", KYC_TOPIC);
        vm.serializeUint(obj, "tawfScreenedTopic", 2);
        vm.serializeUint(obj, "ojkSandboxTopic", 3);

        // Tawf deposito series (Model B).
        vm.serializeAddress(obj, "tawfSeries", d.series);
        vm.serializeAddress(obj, "tawfSeriesToken", d.seriesToken);
        vm.serializeBytes32(obj, "tawfSeriesId", d.seriesId);
        vm.serializeAddress(obj, "sandboxModule", d.sandboxModule);
        vm.serializeUint(obj, "fxInitialRateUsdc", d.fxInitialRateUsdc);
        vm.serializeUint(obj, "fxInitialRateUsdt", d.fxInitialRateUsdt);

        // Sukuk.
        vm.serializeAddress(obj, "sukukToken", d.sukukToken);
        vm.serializeAddress(obj, "sukukDistributor", d.sukukDistributor);
        vm.serializeBytes32(obj, "sukukId", _sukukId);
        vm.serializeUint(obj, "sukukFace", _sukukFace);
        vm.serializeUint(obj, "sukukMaturity", uint256(_sukukMaturity));

        // Per-deal product.
        vm.serializeAddress(obj, "dealRegistry", d.dealRegistry);
        vm.serializeAddress(obj, "bondReceiptNft", d.bondReceiptNft);
        vm.serializeAddress(obj, "redemptionVault", d.redemptionVault);
        vm.serializeUint(obj, "deployL1Block", d.deployBlock);
        string memory json = vm.serializeBytes(obj, "identityProxyBytecode", proxyCode);

        vm.writeJson(json, path);
    }

    function _log(Deployment memory d) internal view {
        console.log("=== Tawf tokenization demo suite deployed (single operator) ===");
        console.log("chainId:            ", d.chainId);
        console.log("operator:           ", d.operator);
        console.log("MockUSDC:           ", d.mockUsdc);
        console.log("MockUSDT:           ", d.mockUsdt);
        console.log("IdentityRegistry:   ", d.shared.identityRegistry);
        console.log("TawfSeriesToken:    ", d.seriesToken);
        console.log("TawfSeries:         ", d.series);
        console.log("SandboxModule:      ", d.sandboxModule);
        console.log("SukukToken:         ", d.sukukToken);
        console.log("SukukDistributor:   ", d.sukukDistributor);
        console.log("DealRegistry:       ", d.dealRegistry);
        console.log("RedemptionVault:    ", d.redemptionVault);
        console.log("deployL1Block:      ", d.deployBlock);
    }

    /// @dev The distributor takes a coin list. These scripts keep the single-coin setup.
    function _singleCoin(address c) internal pure returns (address[] memory a) {
        a = new address[](1);
        a[0] = c;
    }
}

// --- Minimal interfaces for deployCode-created contracts (0.8.20/0.8.24 units) ---------------

/// @dev TawfDepositoSeries role + stablecoin + rate config, reached via deployCode.
interface ISeriesConfig {
    function grantRole(bytes32 role, address account) external;
    function addStablecoin(address token) external;
    function postRate(address token, uint256 idrPerToken) external;
}

/// @dev Minimal ERC20 approve, used so the treasury pre-approves the series per coin.
interface IApprove {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IDealRegistry {
    function setVault(address vault_) external;
    function setReceiptNft(address receiptNft_) external;
    function grantRole(bytes32 role, address account) external;
}

interface IBondReceiptNFT {
    function setVault(address vault_) external;
    function setIdentityRegistry(address identityRegistry_) external;
    function setDealRegistry(address dealRegistry_) external;
}

interface IRedemptionVault {
    function configure(address usdc_, address registry_, address nft_) external;
    function grantRole(bytes32 role, address account) external;
}

interface IOwnableLike {
    function transferOwnership(address newOwner) external;
    function owner() external view returns (address);
}

interface IPendingOwnerLike {
    function pendingOwner() external view returns (address);
}

interface IHasRoleLike {
    function hasRole(bytes32 role, address account) external view returns (bool);
}

interface IConfigurerLike {
    function setConfigurer(address configurer) external;
}

interface IAgentLike {
    function addAgent(address agent) external;
    function removeAgent(address agent) external;
}

interface IUupsRoleLike {
    function grantRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address callerConfirmation) external;
}

interface ITimelockBatch {
    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external;
    function getMinDelay() external view returns (uint256);
}
