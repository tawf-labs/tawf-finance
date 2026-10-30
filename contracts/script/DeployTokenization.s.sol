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
import { AuthorityGuard } from "../src/governance/AuthorityGuard.sol";
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
    bytes4 internal constant DIST_INIT = bytes4(keccak256("initialize(address[],address,address,address,address,(bytes32,uint256,uint40,uint256,uint256,uint40,address),address,address)"));
    bytes4 internal constant SERIES_INIT = bytes4(keccak256("initialize(address,address,address,address,address,(bytes32,uint8,uint16),address,address,address,uint64,address)"));

    /// @dev One TREXImplementationAuthority per deploy, shared by every T-REX proxy. The deployer owns it
    ///      until the governance hand-over moves it to the timelock. TREX_AUTHORITY reuses an existing one.
    address internal _trexAuthority;
    AuthorityGuard internal _authorityGuard;

    /// @dev Contracts whose `owner` moves to the timelock in the governance hand-over (T-REX owners,
    ///      compliance modules, the ONCHAINID authority and factory). Filled as they are deployed.
    address[] internal _owned;

    function _own(address c) internal {
        _owned.push(c);
    }

    /// @dev A compliance with a SandboxModule is driven by operator-run admin controls (mode, caps, series end
    ///      through callModuleFunction, which only the compliance owner may call), so by default its owner stays
    ///      with the operator. Set KEEP_SANDBOX_COMPLIANCE=false to move it to the timelock too.
    function _ownCompliance(address mc, bool sandboxed) internal {
        if (sandboxed && vm.envOr("KEEP_SANDBOX_COMPLIANCE", true)) return;
        _own(mc);
    }

    /// @dev Deploys the TawfTimelock. Delay: TIMELOCK_DELAY seconds (default 1 hour, use 2 to 7 days on
    ///      mainnet). Proposer and canceller: SAFE_ADDRESS, or the operator on testnet until a Safe exists.
    ///      Executors are open (anyone may execute a ready operation) unless EXECUTOR_OPEN=false, in which
    ///      case only the proposer executes. There is no admin: the timelock administers itself.
    function _deployTimelock(address operator) internal returns (address timelock, address safe) {
        safe = vm.envOr("SAFE_ADDRESS", address(0));
        uint256 delay = vm.envOr("TIMELOCK_DELAY", uint256(1 hours));
        address proposer = safe != address(0) ? safe : operator;
        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        address[] memory executors = new address[](1);
        executors[0] = vm.envOr("EXECUTOR_OPEN", true) ? address(0) : proposer;
        timelock = vm.deployCode("TawfTimelock.sol:TawfTimelock", abi.encode(delay, proposers, executors));
    }

    /// @dev Compliance modules: two-step ownership (transferOwnership, then acceptOwnership by the new
    ///      owner), no renounce. The timelock has to accept, so that is a timelock operation, see
    ///      _handoverToTimelock. The operator stays the configurer for setHook, initOffering, setAgent
    ///      and the other module settings, so day-to-day configuration is unaffected.
    address[] internal _modules;

    function _ownModule(address m) internal {
        _modules.push(m);
    }

    address[] internal _tokens;
    /// @dev UUPS contracts that gave UPGRADER_ROLE to the operator at initialize (the pool contracts).
    address[] internal _operatorUups;

    function _ownToken(address t) internal {
        _own(t);
        _tokens.push(t);
    }

    /// @dev Governance hand-over, run last and with the same broadcaster that deployed everything:
    ///      1. The Safe becomes a guardian (agent) on every token, so it can pause in an emergency.
    ///      2. Every registered owner (T-REX authority, registries, tokens, compliance modules, ONCHAINID
    ///         authority and factory) moves to the timelock.
    ///      3. UPGRADER_ROLE on the operator-initialised UUPS contracts moves to the timelock.
    ///      The operator keeps its agent and day-to-day roles. After this only the timelock can upgrade.
    function _handoverToTimelock(address operator, address timelock, address safe) internal {
        bytes32 upgrader = keccak256("UPGRADER_ROLE");
        if (safe != address(0)) {
            for (uint256 i; i < _tokens.length; i++) IAgentLike(_tokens[i]).addAgent(safe);
        }
        for (uint256 i; i < _owned.length; i++) IOwnableLike(_owned[i]).transferOwnership(timelock);
        _handoverModules(timelock, safe);
        for (uint256 i; i < _operatorUups.length; i++) {
            IUupsRoleLike(_operatorUups[i]).grantRole(upgrader, timelock);
            IUupsRoleLike(_operatorUups[i]).renounceRole(upgrader, operator);
        }
    }

    /// @dev Start the two-step transfer on every module, then queue the timelock's acceptance. With no Safe
    ///      the operator is the proposer, so the batch is scheduled here and anyone can execute it after the
    ///      delay (open executors). With a Safe, the Safe must schedule the same batch, so the call data is
    ///      logged.
    function _handoverModules(address timelock, address safe) internal {
        // The AuthorityGuard is two-step too, so the timelock accepts it in the same batch as the modules.
        bool guarded = address(_authorityGuard) != address(0);
        uint256 n = _modules.length + (guarded ? 1 : 0);
        if (n == 0) return;
        address[] memory targets = new address[](n);
        uint256[] memory values = new uint256[](n);
        bytes[] memory datas = new bytes[](n);
        for (uint256 i; i < _modules.length; i++) {
            IOwnableLike(_modules[i]).transferOwnership(timelock);
            targets[i] = _modules[i];
            datas[i] = abi.encodeWithSignature("acceptOwnership()");
        }
        if (guarded) {
            _authorityGuard.transferOwnership(timelock);
            targets[n - 1] = address(_authorityGuard);
            datas[n - 1] = abi.encodeWithSignature("acceptOwnership()");
        }
        bytes32 salt = keccak256("tawf.accept-module-ownership");
        if (safe == address(0)) {
            ITimelockBatch(timelock).scheduleBatch(
                targets, values, datas, bytes32(0), salt, ITimelockBatch(timelock).getMinDelay()
            );
            console.log("Module acceptOwnership batch scheduled. Execute after the delay, salt keccak256('tawf.accept-module-ownership').");
        } else {
            console.log("The Safe must schedule acceptOwnership() on each module as one batch (salt below):");
            console.logBytes32(salt);
            for (uint256 i; i < n; i++) console.log(targets[i]);
        }
    }

    function _authority() internal returns (address) {
        if (_trexAuthority == address(0)) {
            address existing = vm.envOr("TREX_AUTHORITY", address(0));
            if (existing != address(0)) {
                _trexAuthority = existing;
            } else {
                // The authority is owned by an AuthorityGuard (two-step, no renounce) which the timelock owns.
                address ia = address(TrexProxies.authority());
                _authorityGuard = new AuthorityGuard(TREXImplementationAuthority(ia));
                TREXImplementationAuthority(ia).transferOwnership(address(_authorityGuard));
                _trexAuthority = ia;
            }
        }
        return _trexAuthority;
    }

    function _upgrader(address operator) internal view returns (address) {
        return vm.envOr("UPGRADER", operator);
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

        DistributionCheckpointModule checkpoint = ModuleProxies.checkpoint();
        SandboxModule sandbox = ModuleProxies.sandbox();
        _ownToken(address(token));
        _ownCompliance(address(mc), true);
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
                operator, // treasury (demo: the operator wallet is the Tawf treasury)
                operator, // admin
                operator, // operator
                uint64(1 days), // maxRateAge
                _upgrader(operator)))
        );

        // Configure and bind the SandboxModule first: mode PILOT_ONLY, treasury = operator,
        // default caps, seriesEnd = now + 90 days. Then bind the checkpoint module.
        sandbox.initConfig(
            address(mc),
            SandboxModule.Mode.PILOT_ONLY,
            operator, // treasury
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
        IApprove(usdc).approve(series, type(uint256).max);
        IApprove(usdt).approve(series, type(uint256).max);

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

        DistributionCheckpointModule module = ModuleProxies.checkpoint();
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
                operator,
                    _upgrader(operator)))
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
        bondReceiptNft = _deployProxy("BondReceiptNFT.sol:BondReceiptNFT", operator);
        dealRegistry = _deployProxy("DealRegistry.sol:DealRegistry", operator);
        redemptionVault = _deployProxy("RedemptionVault.sol:RedemptionVault", operator);
        _operatorUups.push(bondReceiptNft);
        _operatorUups.push(dealRegistry);
        _operatorUups.push(redemptionVault);

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

    /// @dev The pool contracts are UUPS-upgradeable: deploy the implementation, then an ERC1967 proxy
    ///      that calls `initialize(operator)`. Callers use the returned proxy address everywhere.
    function _deployProxy(string memory artifact, address admin) internal returns (address proxy) {
        address impl = deployCode(artifact);
        proxy = deployCode(
            "ERC1967Proxy.sol:ERC1967Proxy", abi.encode(impl, abi.encodeWithSignature("initialize(address)", admin))
        );
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
}

interface IAgentLike {
    function addAgent(address agent) external;
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
