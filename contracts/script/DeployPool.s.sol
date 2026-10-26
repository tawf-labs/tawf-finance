// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT, IDealPrincipalLedger } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";
import { ITawfIdentityRegistry } from "../src/interfaces/ITawfIdentityRegistry.sol";
import { ISwapRouter } from "../src/RedemptionVault.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { MockSwapRouter } from "../src/mocks/MockSwapRouter.sol";
import { Proxies } from "../src/proxy/Proxies.sol";

/**
 * @notice Redeploys the per-deal financing pool (DealRegistry, BondReceiptNFT,
 *         RedemptionVault) against the shared T-REX IdentityRegistry and
 *         MockUSDC already recorded in tokenization.deployments.json, seeds the
 *         three demo BPRS pools to Mintable, and writes the new addresses back
 *         to that file for the app.
 *
 * @dev The identity registry is wired before any deal opens, so only wallets
 *      with a verified ONCHAINID KYC claim can invest (BondReceiptNFT gates
 *      every mint). Run with the tokenization operator key so the same wallet
 *      holds the pool roles the admin page checks.
 *
 *      Tawf's nisbah: FEE_RECIPIENT (Tawf fee wallet) and TAWF_NISBAH_BPS
 *      (default 1500 = 15% of each deal's profit) are set on every seeded deal
 *      before it opens. SERVICER (default: the operator) receives
 *      disbursements and remits recoveries; NEGLIGENCE_SIGNER (the DPS /
 *      auditor, never the operator) is the only role that can find Tawf liable
 *      for a loss. The previous pool's addresses are kept as legacyPool*.
 *
 *      Settlement token (USDG): set USDG_ADDRESS to the real USDG (Arbitrum Sepolia:
 *      0xFFC95faa3d63Cde504a05B567C600B78C0b41892) or MOCK_USDG=1 to deploy a mock one
 *      (chains with no USDG, e.g. Robinhood Chain testnet). Deals are then denominated in
 *      USDG; mockUsdc/mockUsdt from the deployments file are accepted as inputs and swapped
 *      to USDG through a MockSwapRouter that this script funds with ROUTER_USDG_LIQUIDITY
 *      base units (mock mode mints it; with real USDG the operator must hold it). Surplus
 *      USDG (rewards, dust) is swept to YIELD_RECIPIENT (default: FEE_RECIPIENT). With
 *      neither variable set the pool settles in mockUsdc as before.
 *      DEPLOYMENTS_PATH overrides the deployments file (e.g. the Robinhood one).
 *
 *      forge script script/DeployPool.s.sol:DeployPool --rpc-url arbitrum_sepolia \
 *          --private-key $OPERATOR_KEY --broadcast
 */
contract DeployPool is Script {
    string internal PATH = "../tawf-finance/src/web3/tokenization.deployments.json";

    function run() external returns (DealRegistry registry, BondReceiptNFT nft, RedemptionVault vault) {
        PATH = vm.envOr("DEPLOYMENTS_PATH", PATH);
        string memory json = vm.readFile(PATH);
        address identityRegistry = vm.parseJsonAddress(json, ".identityRegistry");
        address usdc = vm.parseJsonAddress(json, ".mockUsdc");
        address oldVault = vm.parseJsonAddress(json, ".redemptionVault");
        address oldRegistry = vm.parseJsonAddress(json, ".dealRegistry");
        address oldNft = vm.parseJsonAddress(json, ".bondReceiptNft");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint16 nisbahBps = uint16(vm.envOr("TAWF_NISBAH_BPS", uint256(1500)));
        address negligenceSigner = vm.envAddress("NEGLIGENCE_SIGNER");

        vm.startBroadcast();
        address admin = msg.sender;

        nft = Proxies.nft(admin);
        registry = Proxies.dealRegistry(admin);
        vault = Proxies.vault(admin);

        registry.setVault(address(vault));
        nft.setVault(address(vault));
        nft.setDealRegistry(IDealPrincipalLedger(address(registry)));
        registry.setReceiptNft(address(nft));
        nft.setIdentityRegistry(ITawfIdentityRegistry(identityRegistry));
        address settlement = _settlementToken(usdc);
        vault.configure(IERC20(settlement), registry, nft);

        // Testnet role grants: the operator holds every role.
        registry.grantRole(registry.ORIGINATOR_ROLE(), admin);
        registry.grantRole(registry.SHARIAH_ROLE(), admin);
        registry.grantRole(registry.OPS_ROLE(), admin);
        vault.grantRole(vault.OPS_ROLE(), admin);
        vault.grantRole(vault.SERVICER_ROLE(), vm.envOr("SERVICER", admin));
        require(negligenceSigner != admin, "the negligence signer must not be Tawf ops");
        vault.grantRole(vault.NEGLIGENCE_ROLE(), negligenceSigner);
        vault.setFeeRecipient(feeRecipient);
        if (settlement != usdc) _wireUsdg(vault, settlement, usdc, json, feeRecipient);

        _seed(registry, vault, nisbahBps);
        vm.stopBroadcast();

        vm.writeJson(vm.toString(oldRegistry), PATH, ".legacyPoolDealRegistry");
        vm.writeJson(vm.toString(oldNft), PATH, ".legacyPoolBondReceiptNft");
        vm.writeJson(vm.toString(oldVault), PATH, ".legacyPoolRedemptionVault");
        vm.writeJson(vm.toString(address(registry)), PATH, ".dealRegistry");
        vm.writeJson(vm.toString(address(nft)), PATH, ".bondReceiptNft");
        vm.writeJson(vm.toString(address(vault)), PATH, ".redemptionVault");
        if (settlement != usdc) {
            // A mock settlement token goes under mockUsdg so ".usdg" can keep pointing at the real token.
            vm.writeJson(vm.toString(settlement), PATH, vm.envOr("MOCK_USDG", false) ? ".mockUsdg" : ".usdg");
        }

        console2.log("IdentityRegistry:", identityRegistry);
        console2.log("MockUSDC:        ", usdc);
        console2.log("Settlement:      ", settlement);
        console2.log("DealRegistry:    ", address(registry));
        console2.log("BondReceiptNFT:  ", address(nft));
        console2.log("RedemptionVault: ", address(vault));
    }

    /// @dev Real USDG (USDG_ADDRESS), a fresh mock USDG (MOCK_USDG=1), or the legacy mockUsdc.
    ///      Must run inside the broadcast so the mock is deployed by the operator.
    function _settlementToken(address mockUsdc) internal returns (address) {
        address usdg = vm.envOr("USDG_ADDRESS", address(0));
        if (usdg != address(0)) return usdg;
        if (vm.envOr("MOCK_USDG", false)) return address(new MockUSDC());
        return mockUsdc;
    }

    /// @dev Accept mockUsdc/mockUsdt as inputs swapped to USDG, route yield to the foundation.
    function _wireUsdg(RedemptionVault vault, address usdg, address mockUsdc, string memory json, address feeRecipient)
        internal
    {
        address mockUsdt = vm.parseJsonAddress(json, ".mockUsdt");
        MockSwapRouter router = new MockSwapRouter();
        uint256 liquidity = vm.envOr("ROUTER_USDG_LIQUIDITY", uint256(100_000 * 10 ** 6));
        if (vm.envOr("MOCK_USDG", false)) MockUSDC(usdg).faucet(liquidity);
        IERC20(usdg).transfer(address(router), liquidity);

        vault.setInputToken(mockUsdc, true);
        vault.setInputToken(mockUsdt, true);
        vault.setSwapRouter(ISwapRouter(address(router)), 100, 50);
        vault.setYieldRecipient(vm.envOr("YIELD_RECIPIENT", feeRecipient));
        console2.log("MockSwapRouter:  ", address(router));
    }

    /// @dev The same three BPRS financing pools as SeedDemo.s.sol.
    function _seed(DealRegistry registry, RedemptionVault vault, uint16 nisbahBps) internal {
        address bprs = vm.addr(12345);
        _open(registry, vault, nisbahBps, "tawf-demo/bprs-amanah/micro-trade/POOL-2026-001", "Micro-Trade Financing Segment",
            "BPRS Amanah Ummah", bprs, 1200, 30, 2_500);
        _open(registry, vault, nisbahBps, "tawf-demo/bprs-barokah/agri/POOL-2026-002", "Agri Financing Segment",
            "BPRS Barokah Sejahtera", bprs, 1500, 45, 1_800);
        _open(registry, vault, nisbahBps, "tawf-demo/bprs-sejahtera/sme/POOL-2026-003", "SME Financing Segment",
            "BPRS Insan Cita", bprs, 900, 60, 3_000);
    }

    function _open(
        DealRegistry registry,
        RedemptionVault vault,
        uint16 nisbahBps,
        string memory ref,
        string memory segment,
        string memory originator,
        address bprs,
        uint96 apyBps,
        uint32 durationDays,
        uint96 targetUsd
    ) internal {
        uint256 id = registry.createDeal(
            keccak256(bytes(ref)), segment, originator, bprs, apyBps, durationDays, 10 * 10 ** 6, targetUsd * 10 ** 6
        );
        registry.approveDeal(id);
        vault.setDealNisbah(id, nisbahBps); // fixed before investors can fund
        registry.markMintable(id);
    }
}
