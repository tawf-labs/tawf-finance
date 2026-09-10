// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { DealRegistry } from "../src/DealRegistry.sol";

/**
 * @notice Seeds three realistic BPRS financing pools into the registry and
 *         brings them to Mintable so the investor portal has a populated market.
 *
 * @dev Must be run by the registry owner (same key as Deploy).
 *
 *      Usage:
 *      forge script script/SeedDemo.s.sol:SeedDemo --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast -vvvv \
 *          --sig "run(address)" $DEAL_REGISTRY
 *
 *      Each "deal" is a financing sell-down pool: a licensed BPRS originates
 *      and services a pool of Shariah financing, and an outside investor pool
 *      takes economic exposure through a wakalah bil istithmar / musyarakah
 *      akad. Economics: 30-90 day cycles, USD 10 minimum. The `supplierName`
 *      field carries the financing segment; `anchorBuyer` carries the
 *      originating BPRS.
 */
contract SeedDemo is Script {
    function run(address registry_) external {
        DealRegistry registry = DealRegistry(registry_);

        // Placeholder BPRS originator (the licensed servicing bank).
        // (Struct field is `bmtOriginator` to mirror the deployed Solidity.)
        address bprs = vm.addr(12345);

        // Pool reference hashes would normally be SHA-256 of the pinned
        // akad + pool-composition document.
        bytes32 pool1 = keccak256("tawf-demo/bprs-amanah/micro-trade/POOL-2026-001");
        bytes32 pool2 = keccak256("tawf-demo/bprs-barokah/agri/POOL-2026-002");
        bytes32 pool3 = keccak256("tawf-demo/bprs-sejahtera/sme/POOL-2026-003");

        vm.startBroadcast();

        // 1. BPRS Amanah — Micro-Trade Pool — 12% target, 30 days, $10 min, $2,500 target.
        uint256 id1 = registry.createDeal(
            pool1,
            "Micro-Trade Financing Segment",
            "BPRS Amanah Ummah",
            bprs,
            1200,          // 12.00% annualized profit rate
            30,            // 30 days
            10 * 10 ** 6,  // $10.00 min (USDC 6 decimals)
            2_500 * 10 ** 6 // $2,500 target
        );
        registry.approveDeal(id1);
        registry.markMintable(id1);

        // 2. BPRS Barokah — Agri Pool — 15% target, 45 days, $10 min, $1,800 target.
        uint256 id2 = registry.createDeal(
            pool2,
            "Agri Financing Segment",
            "BPRS Barokah Sejahtera",
            bprs,
            1500,
            45,
            10 * 10 ** 6,
            1_800 * 10 ** 6
        );
        registry.approveDeal(id2);
        registry.markMintable(id2);

        // 3. BPRS Sejahtera — SME Pool — 9% target, 60 days, $10 min, $3,000 target.
        uint256 id3 = registry.createDeal(
            pool3,
            "SME Financing Segment",
            "BPRS Insan Cita",
            bprs,
            900,
            60,
            10 * 10 ** 6,
            3_000 * 10 ** 6
        );
        registry.approveDeal(id3);
        registry.markMintable(id3);

        vm.stopBroadcast();

        console2.log("Seeded pools:", id1, id2, id3);
        console2.log("Registry:   ", address(registry));
    }
}
