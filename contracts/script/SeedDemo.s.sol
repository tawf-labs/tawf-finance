// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { DealRegistry } from "../src/DealRegistry.sol";

/**
 * @notice Seeds three realistic warung deals into the registry and brings
 *         them to Mintable so the investor portal has a populated market.
 *
 * @dev Must be run by the registry owner (same key as Deploy).
 *
 *      Usage:
 *      forge script script/SeedDemo.s.sol:SeedDemo --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast -vvvv \
 *          --sig "run(address)" $DEAL_REGISTRY
 *
 *      Deal economics are taken from the tawf-finance roadmap: 8-18%
 *      annualized yield, 30-90 day cycles, USD 10 minimum, Indomaret /
 *      Alfamart / distributor anchor buyers.
 */
contract SeedDemo is Script {
    function run(address registry_) external {
        DealRegistry registry = DealRegistry(registry_);

        // Placeholder BMT originator (cooperative underwriter).
        address bmt = vm.addr(12345);

        // Invoice hashes would normally be SHA-256 of the pinned invoice doc.
        bytes32 invoice1 = keccak256("tawf-demo/warung-sari-rejeki/indomaret/PO-2026-001");
        bytes32 invoice2 = keccak256("tawf-demo/jamu-bu-rini/alfamart/PO-2026-002");
        bytes32 invoice3 = keccak256("tawf-demo/keripik-mbak-yuli/cv-sumber-berkah/PO-2026-003");

        vm.startBroadcast();

        // 1. Warung Sari Rejeki — 12% APY, 30 days, $10 min, $2,500 target.
        uint256 id1 = registry.createDeal(
            invoice1,
            "Warung Sari Rejeki",
            "Indomaret",
            bmt,
            1200,          // 12.00% annualized
            30,            // 30 days
            10 * 10 ** 6,  // $10.00 min (USDC 6 decimals)
            2_500 * 10 ** 6 // $2,500 target
        );
        registry.approveDeal(id1);
        registry.markMintable(id1);

        // 2. Jamu Bu Rini — 15% APY, 45 days, $10 min, $1,800 target.
        uint256 id2 = registry.createDeal(
            invoice2,
            "Jamu Bu Rini",
            "Alfamart",
            bmt,
            1500,
            45,
            10 * 10 ** 6,
            1_800 * 10 ** 6
        );
        registry.approveDeal(id2);
        registry.markMintable(id2);

        // 3. Keripik Mbak Yuli — 9% APY, 60 days, $10 min, $3,000 target.
        uint256 id3 = registry.createDeal(
            invoice3,
            "Keripik Mbak Yuli",
            "CV Sumber Berkah",
            bmt,
            900,
            60,
            10 * 10 ** 6,
            3_000 * 10 ** 6
        );
        registry.approveDeal(id3);
        registry.markMintable(id3);

        vm.stopBroadcast();

        console2.log("Seeded deals:", id1, id2, id3);
        console2.log("Registry:   ", address(registry));
    }
}
