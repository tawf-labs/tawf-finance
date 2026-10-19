// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// NOTE: This script imports the T-REX and onchain-id concrete contracts, which are pinned to
// `pragma solidity 0.8.17`. Therefore this file is pinned to 0.8.17. It reaches the 0.8.20/0.8.24
// Tawf contracts (DepositoReserveController, DepositoDistributor, SukukDistributor, MockIDRX,
// DealRegistry, BondReceiptNFT, RedemptionVault) only through vm.deployCode and minimal
// interfaces, never via direct imports of those sources. The DistributionCheckpointModule is
// itself 0.8.17 so it is imported directly.
//
// Purpose: a single-operator demo deployment for Arbitrum Sepolia (chainId 421614). ONE env var
// PRIVATE_KEY controls everything; the derived operator address holds every role. The shared
// T-REX identity suite is deployed once and reused across every deposito tenor token and the
// sukuk series token. LedgerAnchor is supplied via env (LEDGER_ANCHOR, LEDGER_CHAIN_ID) because
// the ledger lives in tawf-network.
//
// Identity model (same as tawf-gold-bsi DeployDemo): the off-chain faucet deploys an IdentityProxy
// with the OPERATOR as management key, adds an operator-signed KYC claim, then registerIdentity.
// The IdentityProxy creation bytecode and ImplementationAuthority are exported so the faucet can
// reproduce that off-chain via viem.

import "forge-std/Script.sol";

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

/// @notice Minimal view of DepositoReserveController (`^0.8.24`), reached via vm.deployCode.
interface IDepositoController {
    function addProduct(bytes32 productId, address token, uint8 tenorMonths, uint16 nisbahBps) external;
}

/// @title DeployTokenization
/// @notice Single-operator ("everything") demo deployment of the Tawf tokenization suite:
///         shared T-REX identity, deposito (4 tenors) and one sukuk series on Arbitrum Sepolia.
contract DeployTokenization is Script {
    uint256 internal constant KYC_TOPIC = 1;
    uint16 internal constant COUNTRY_ID = 360; // Indonesia

    bytes32 internal constant INSTITUTION_ID = keccak256("bprs.demo");
    bytes32 internal constant SUKUK_ID = keccak256("sukuk.demo.2026");

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
        address idrx;
        address depositoController;
        Shared shared;
        // per-tenor arrays, index-aligned with [1,3,6,12]
        uint8[4] tenors;
        address[4] depositoTokens;
        address[4] depositoDistributors;
        bytes32[4] productIds;
        // sukuk
        address sukukToken;
        address sukukDistributor;
        // per-deal product
        address dealRegistry;
        address bondReceiptNft;
        address redemptionVault;
        address mockUsdc;
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
        d.tenors = [uint8(1), 3, 6, 12];

        // 1. Shared T-REX identity suite (operator owns everything).
        d.shared = _deployShared(operator);
        _sharedIdentityRegistry = d.shared.identityRegistry;

        // 2. MockIDRX settlement token (2 decimals) and MockUSDC (sukuk + per-deal use it).
        d.idrx = deployCode("MockIDRX.sol:MockIDRX");
        d.mockUsdc = deployCode("MockUSDC.sol:MockUSDC");
        _sukukUsdc = d.mockUsdc;

        // 3. Deposito reserve controller (admin + issuer = operator).
        d.depositoController = deployCode(
            "DepositoReserveController.sol:DepositoReserveController",
            abi.encode(anchor, INSTITUTION_ID, operator, operator)
        );

        // 4. One token + compliance + module + distributor per tenor.
        for (uint256 i = 0; i < 4; i++) {
            uint8 tenor = d.tenors[i];
            (address token, address distributor, bytes32 productId) =
                _deployDepositoTenor(operator, d.idrx, d.depositoController, anchor, tenor);
            d.depositoTokens[i] = token;
            d.depositoDistributors[i] = distributor;
            d.productIds[i] = productId;
        }

        // 5. Sukuk series token + compliance + module + distributor.
        (d.sukukToken, d.sukukDistributor) = _deploySukuk(operator, anchor);

        // 6. Per-deal product (DealRegistry / BondReceiptNFT / RedemptionVault), wired to the
        //    shared T-REX IdentityRegistry so a secondary market can be opened later.
        (d.dealRegistry, d.bondReceiptNft, d.redemptionVault) =
            _deployPerDeal(operator, d.shared.identityRegistry, d.mockUsdc);

        d.deployBlock = block.number;
    }

    function _deployShared(address operator) internal returns (Shared memory s) {
        ClaimTopicsRegistry ctr = new ClaimTopicsRegistry();
        ctr.init();
        TrustedIssuersRegistry tir = new TrustedIssuersRegistry();
        tir.init();
        IdentityRegistryStorage irs = new IdentityRegistryStorage();
        irs.init();
        IdentityRegistry ir = new IdentityRegistry();
        ir.init(address(tir), address(ctr), address(irs));
        irs.bindIdentityRegistry(address(ir));
        ctr.addClaimTopic(KYC_TOPIC);

        Identity identityImpl = new Identity(operator, true); // library mode
        ImplementationAuthority implAuth = new ImplementationAuthority(address(identityImpl));
        IdFactory idFactory = new IdFactory(address(implAuth));

        ClaimIssuer claimIssuer = new ClaimIssuer(operator);
        uint256[] memory topics = new uint256[](1);
        topics[0] = KYC_TOPIC;
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

    function _deployDepositoTenor(
        address operator,
        address idrx,
        address controller,
        address anchor,
        uint8 tenor
    ) internal returns (address tokenAddr, address distributor, bytes32 productId) {
        ModularCompliance mc = new ModularCompliance();
        mc.init();
        Token token = new Token();
        string memory suffix = _tenorSuffix(tenor);
        token.init(
            _sharedIdentityRegistry,
            address(mc),
            string(abi.encodePacked("Tawf Deposito BPRS Demo ", suffix)),
            string(abi.encodePacked("tDEP-DEMO-", suffix)),
            2,
            address(0)
        );

        DistributionCheckpointModule module = new DistributionCheckpointModule();

        distributor = deployCode(
            "DepositoDistributor.sol:DepositoDistributor",
            abi.encode(idrx, address(token), address(module), operator, operator)
        );

        module.setHook(address(mc), IBalanceCheckpoint(distributor));
        mc.addModule(address(module));

        // Controller mints placements; distributor burns on redeem. Both are token agents.
        token.addAgent(controller);
        token.addAgent(distributor);
        token.addAgent(operator);
        token.unpause();

        productId = keccak256(abi.encode(INSTITUTION_ID, tenor));
        IDepositoController(controller).addProduct(productId, address(token), tenor, _nisbahBps(tenor));

        tokenAddr = address(token);
    }

    function _deploySukuk(address operator, address anchor)
        internal
        returns (address tokenAddr, address distributor)
    {
        ModularCompliance mc = new ModularCompliance();
        mc.init();
        Token token = new Token();
        token.init(_sharedIdentityRegistry, address(mc), "Tawf Sukuk BPRS Demo 2026", "tSUKUK-DEMO-2026", 6, address(0));

        DistributionCheckpointModule module = new DistributionCheckpointModule();

        uint40 maturity = uint40(block.timestamp + 365 days);
        distributor = deployCode(
            "SukukDistributor.sol:SukukDistributor",
            abi.encode(
                _sukukUsdc,
                anchor,
                _sharedIdentityRegistry,
                address(token),
                address(module),
                // Terms { sukukId, faceValue, maturity, minRaise, minSubscription, subscriptionPeriod, issuerTreasury }
                SUKUK_ID,
                uint256(500_000e6),
                maturity,
                uint256(100_000e6),
                uint256(10e6),
                uint40(14 days),
                operator,
                operator
            )
        );

        module.setHook(address(mc), IBalanceCheckpoint(distributor));
        mc.addModule(address(module));

        token.addAgent(distributor);
        token.addAgent(operator);
        token.unpause();

        tokenAddr = address(token);
    }

    function _deployPerDeal(address operator, address identityRegistry, address mockUsdc)
        internal
        returns (address dealRegistry, address bondReceiptNft, address redemptionVault)
    {
        bondReceiptNft = deployCode("BondReceiptNFT.sol:BondReceiptNFT", abi.encode(operator));
        dealRegistry = deployCode("DealRegistry.sol:DealRegistry", abi.encode(operator));
        redemptionVault = deployCode("RedemptionVault.sol:RedemptionVault", abi.encode(operator));

        IDealRegistry(dealRegistry).setVault(redemptionVault);
        IBondReceiptNFT(bondReceiptNft).setVault(redemptionVault);
        IBondReceiptNFT(bondReceiptNft).setIdentityRegistry(identityRegistry);
        IRedemptionVault(redemptionVault).configure(mockUsdc, dealRegistry, bondReceiptNft);

        IDealRegistry(dealRegistry).grantRole(keccak256("ORIGINATOR_ROLE"), operator);
        IDealRegistry(dealRegistry).grantRole(keccak256("SHARIAH_ROLE"), operator);
        IDealRegistry(dealRegistry).grantRole(keccak256("OPS_ROLE"), operator);
        IRedemptionVault(redemptionVault).grantRole(keccak256("OPS_ROLE"), operator);
    }

    // --- transient operator-scoped wiring values ---------------------------------
    // deployCode-created contracts cannot be referenced by their 0.8.20/0.8.24 types from this
    // 0.8.17 unit, so a couple of addresses needed deep in the per-tenor loop are kept here.
    address internal _sharedIdentityRegistry;
    address internal _sukukUsdc;

    function _tenorSuffix(uint8 tenor) internal pure returns (string memory) {
        if (tenor == 1) return "1M";
        if (tenor == 3) return "3M";
        if (tenor == 6) return "6M";
        return "12M";
    }

    function _nisbahBps(uint8 tenor) internal pure returns (uint16) {
        // Illustrative demo profit-sharing ratios by tenor.
        if (tenor == 1) return 4000;
        if (tenor == 3) return 4500;
        if (tenor == 6) return 5000;
        return 5500;
    }

    function _writeDeployments(Deployment memory d) internal {
        string memory path = "../tawf-finance/src/web3/tokenization.deployments.json";
        bytes memory proxyCode = vm.getCode("IdentityProxy.sol:IdentityProxy");

        string memory obj = "tokenization";
        vm.serializeUint(obj, "chainId", d.chainId);
        vm.serializeUint(obj, "ledgerChainId", d.ledgerChainId);
        vm.serializeAddress(obj, "anchor", d.anchor);
        vm.serializeAddress(obj, "operator", d.operator);
        vm.serializeAddress(obj, "idrx", d.idrx);
        vm.serializeAddress(obj, "depositoController", d.depositoController);
        vm.serializeAddress(obj, "identityRegistry", d.shared.identityRegistry);
        vm.serializeAddress(obj, "identityRegistryStorage", d.shared.identityRegistryStorage);
        vm.serializeAddress(obj, "trustedIssuersRegistry", d.shared.trustedIssuersRegistry);
        vm.serializeAddress(obj, "claimTopicsRegistry", d.shared.claimTopicsRegistry);
        vm.serializeAddress(obj, "claimIssuer", d.shared.claimIssuer);
        vm.serializeAddress(obj, "idFactory", d.shared.idFactory);
        vm.serializeAddress(obj, "implementationAuthority", d.shared.implementationAuthority);
        vm.serializeUint(obj, "kycClaimTopic", KYC_TOPIC);

        uint256[] memory tenors = new uint256[](4);
        address[] memory tokens = new address[](4);
        address[] memory dists = new address[](4);
        bytes32[] memory pids = new bytes32[](4);
        for (uint256 i = 0; i < 4; i++) {
            tenors[i] = d.tenors[i];
            tokens[i] = d.depositoTokens[i];
            dists[i] = d.depositoDistributors[i];
            pids[i] = d.productIds[i];
        }
        vm.serializeUint(obj, "depositoTenors", tenors);
        vm.serializeAddress(obj, "depositoTokens", tokens);
        vm.serializeAddress(obj, "depositoDistributors", dists);
        vm.serializeBytes32(obj, "depositoProductIds", pids);

        vm.serializeAddress(obj, "sukukToken", d.sukukToken);
        vm.serializeAddress(obj, "sukukDistributor", d.sukukDistributor);
        vm.serializeBytes32(obj, "sukukId", SUKUK_ID);

        vm.serializeAddress(obj, "dealRegistry", d.dealRegistry);
        vm.serializeAddress(obj, "bondReceiptNft", d.bondReceiptNft);
        vm.serializeAddress(obj, "redemptionVault", d.redemptionVault);
        vm.serializeAddress(obj, "mockUsdc", d.mockUsdc);
        vm.serializeUint(obj, "deployBlock", d.deployBlock);
        string memory json = vm.serializeBytes(obj, "identityProxyBytecode", proxyCode);

        vm.writeJson(json, path);
    }

    function _log(Deployment memory d) internal view {
        console.log("=== Tawf tokenization demo suite deployed (single operator) ===");
        console.log("chainId:            ", d.chainId);
        console.log("operator:           ", d.operator);
        console.log("MockIDRX:           ", d.idrx);
        console.log("DepositoController: ", d.depositoController);
        console.log("IdentityRegistry:   ", d.shared.identityRegistry);
        console.log("SukukToken:         ", d.sukukToken);
        console.log("SukukDistributor:   ", d.sukukDistributor);
        console.log("DealRegistry:       ", d.dealRegistry);
        console.log("RedemptionVault:    ", d.redemptionVault);
        console.log("deployBlock:        ", d.deployBlock);
    }
}

// --- Minimal interfaces for the per-deal product (0.8.20 units via deployCode) ---------------

interface IDealRegistry {
    function setVault(address vault_) external;
    function grantRole(bytes32 role, address account) external;
}

interface IBondReceiptNFT {
    function setVault(address vault_) external;
    function setIdentityRegistry(address identityRegistry_) external;
}

interface IRedemptionVault {
    function configure(address usdc_, address registry_, address nft_) external;
    function grantRole(bytes32 role, address account) external;
}
