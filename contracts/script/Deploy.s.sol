// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";
import { IdentityRegistry } from "../src/IdentityRegistry.sol";
import { Compliance } from "../src/Compliance.sol";
import { PooledFinancingVault } from "../src/PooledFinancingVault.sol";

/**
 * @notice Deploys the full Tawf stack to the broadcast chain (Arbitrum
 *         Sepolia for the buildathon) and wires the contracts, including
 *         the AccessControl role split, the shared identity/compliance
 *         layer, and the pooled ERC-4626 vault.
 *
 * @dev Usage:
 *      forge script script/Deploy.s.sol:Deploy --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast --verify -vvvv
 *
 *      To use real test USDC instead of MockUSDC, pass the USDC address as
 *      the first script argument: --sig "run(address)" $TEST_USDC.
 *
 *      Every role (ORIGINATOR_ROLE, SHARIAH_ROLE, OPS_ROLE, ADMIN_ROLE,
 *      REGISTRAR_ROLE, POLICY_ROLE) is granted to the single broadcaster
 *      here, matching the previous single-owner testnet posture so the
 *      existing SeedDemo.s.sol script (which calls createDeal, approveDeal,
 *      and markMintable back to back) keeps working without changes. This
 *      is a deliberate testnet simplification, not a recommendation:
 *      production deployment should grant each role to its own Safe
 *      multisig per regulation.md §1.1 and the plan this deploy script was
 *      built against, splitting a single key into per-role multisigs is a
 *      later config change, not a redeploy, since AccessControl roles are
 *      grantable/revocable independently of the constructor.
 */
contract Deploy is Script {
    function run()
        external
        returns (
            MockUSDC usdc,
            BondReceiptNFT nft,
            DealRegistry registry,
            RedemptionVault vault,
            IdentityRegistry identityRegistry,
            Compliance compliance,
            PooledFinancingVault pooledVault
        )
    {
        (usdc, nft, registry, vault, identityRegistry, compliance, pooledVault) = _run(address(0));
    }

    function run(address usdcAddress)
        external
        returns (
            MockUSDC usdc,
            BondReceiptNFT nft,
            DealRegistry registry,
            RedemptionVault vault,
            IdentityRegistry identityRegistry,
            Compliance compliance,
            PooledFinancingVault pooledVault
        )
    {
        (usdc, nft, registry, vault, identityRegistry, compliance, pooledVault) = _run(usdcAddress);
    }

    function _run(address usdcAddress)
        internal
        returns (
            MockUSDC usdc,
            BondReceiptNFT nft,
            DealRegistry registry,
            RedemptionVault vault,
            IdentityRegistry identityRegistry,
            Compliance compliance,
            PooledFinancingVault pooledVault
        )
    {
        vm.startBroadcast();
        address admin = msg.sender;

        if (usdcAddress == address(0)) {
            usdc = new MockUSDC();
        } else {
            usdc = MockUSDC(usdcAddress);
        }

        nft = new BondReceiptNFT(admin);
        registry = new DealRegistry(admin);
        vault = new RedemptionVault(admin);
        identityRegistry = new IdentityRegistry(admin);
        compliance = new Compliance(identityRegistry, admin);
        pooledVault = new PooledFinancingVault(IERC20(address(usdc)), admin);

        // Per-deal product wiring (unchanged shape from the original deploy).
        registry.setVault(address(vault));
        nft.setVault(address(vault));
        vault.configure(IERC20(address(usdc)), registry, nft);
        nft.setCompliance(compliance);
        pooledVault.setCompliance(compliance);

        // Testnet role grants: one broadcaster holds every role. See the
        // contract-level note above before treating this as a production
        // pattern.
        registry.grantRole(registry.ORIGINATOR_ROLE(), admin);
        registry.grantRole(registry.SHARIAH_ROLE(), admin);
        registry.grantRole(registry.OPS_ROLE(), admin);
        vault.grantRole(vault.OPS_ROLE(), admin);
        pooledVault.grantRole(pooledVault.OPS_ROLE(), admin);
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), admin);
        compliance.grantRole(compliance.POLICY_ROLE(), admin);

        vm.stopBroadcast();

        console2.log("MockUSDC:            ", address(usdc));
        console2.log("BondReceiptNFT:      ", address(nft));
        console2.log("DealRegistry:        ", address(registry));
        console2.log("RedemptionVault:     ", address(vault));
        console2.log("IdentityRegistry:    ", address(identityRegistry));
        console2.log("Compliance:          ", address(compliance));
        console2.log("PooledFinancingVault:", address(pooledVault));
        console2.log("Admin (all roles):   ", admin);
    }
}
