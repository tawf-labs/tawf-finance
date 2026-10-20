// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT, IDealPrincipalLedger } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";
import { ITawfIdentityRegistry } from "../src/interfaces/ITawfIdentityRegistry.sol";

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
 *      forge script script/DeployPool.s.sol:DeployPool --rpc-url arbitrum_sepolia \
 *          --private-key $OPERATOR_KEY --broadcast
 */
contract DeployPool is Script {
    string internal constant PATH = "../tawf-finance/src/web3/tokenization.deployments.json";

    function run() external returns (DealRegistry registry, BondReceiptNFT nft, RedemptionVault vault) {
        string memory json = vm.readFile(PATH);
        address identityRegistry = vm.parseJsonAddress(json, ".identityRegistry");
        address usdc = vm.parseJsonAddress(json, ".mockUsdc");

        vm.startBroadcast();
        address admin = msg.sender;

        nft = new BondReceiptNFT(admin);
        registry = new DealRegistry(admin);
        vault = new RedemptionVault(admin);

        registry.setVault(address(vault));
        nft.setVault(address(vault));
        nft.setDealRegistry(IDealPrincipalLedger(address(registry)));
        registry.setReceiptNft(address(nft));
        nft.setIdentityRegistry(ITawfIdentityRegistry(identityRegistry));
        vault.configure(IERC20(usdc), registry, nft);

        // Testnet role grants: the operator holds every role.
        registry.grantRole(registry.ORIGINATOR_ROLE(), admin);
        registry.grantRole(registry.SHARIAH_ROLE(), admin);
        registry.grantRole(registry.OPS_ROLE(), admin);
        vault.grantRole(vault.OPS_ROLE(), admin);

        _seed(registry);
        vm.stopBroadcast();

        vm.writeJson(vm.toString(address(registry)), PATH, ".dealRegistry");
        vm.writeJson(vm.toString(address(nft)), PATH, ".bondReceiptNft");
        vm.writeJson(vm.toString(address(vault)), PATH, ".redemptionVault");

        console2.log("IdentityRegistry:", identityRegistry);
        console2.log("MockUSDC:        ", usdc);
        console2.log("DealRegistry:    ", address(registry));
        console2.log("BondReceiptNFT:  ", address(nft));
        console2.log("RedemptionVault: ", address(vault));
    }

    /// @dev The same three BPRS financing pools as SeedDemo.s.sol.
    function _seed(DealRegistry registry) internal {
        address bprs = vm.addr(12345);
        _open(registry, "tawf-demo/bprs-amanah/micro-trade/POOL-2026-001", "Micro-Trade Financing Segment",
            "BPRS Amanah Ummah", bprs, 1200, 30, 2_500);
        _open(registry, "tawf-demo/bprs-barokah/agri/POOL-2026-002", "Agri Financing Segment",
            "BPRS Barokah Sejahtera", bprs, 1500, 45, 1_800);
        _open(registry, "tawf-demo/bprs-sejahtera/sme/POOL-2026-003", "SME Financing Segment",
            "BPRS Insan Cita", bprs, 900, 60, 3_000);
    }

    function _open(
        DealRegistry registry,
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
        registry.markMintable(id);
    }
}
