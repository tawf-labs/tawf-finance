// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT, IDealPrincipalLedger } from "../src/BondReceiptNFT.sol";
import { RedemptionVault, ISwapRouter } from "../src/RedemptionVault.sol";
import { PooledFinancingVault } from "../src/PooledFinancingVault.sol";
import { MockSwapRouter } from "../src/MockSwapRouter.sol";

/**
 * @notice Deploys the per-deal Tawf stack (DealRegistry, BondReceiptNFT,
 *         RedemptionVault) plus the pooled ERC-4626 vault to the broadcast
 *         chain and wires the AccessControl role split.
 *
 * @dev Usage:
 *      forge script script/Deploy.s.sol:Deploy --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast --verify -vvvv
 *
 *      To use real test USDC instead of MockUSDC, pass the USDC address as
 *      the first script argument: --sig "run(address)" $TEST_USDC.
 *
 *      Identity model (post ERC-3643 migration): receipts and pooled shares
 *      are soulbound by default, so the base per-deal product needs no
 *      identity registry wired. A secondary market is opened later, per akad,
 *      by an admin calling `setIdentityRegistry` + `setTransferPolicy` with the
 *      shared T-REX IdentityRegistry (deployed by DeployTokenization.s.sol).
 *
 *      Every role (ORIGINATOR_ROLE, SHARIAH_ROLE, OPS_ROLE, ADMIN_ROLE) is
 *      granted to the single broadcaster here, matching the previous
 *      single-owner testnet posture so SeedDemo.s.sol keeps working. This is a
 *      deliberate testnet simplification: production should grant each role to
 *      its own Safe multisig, a later config change, not a redeploy.
 */
contract Deploy is Script {
    function run()
        external
        returns (
            MockUSDC usdc,
            BondReceiptNFT nft,
            DealRegistry registry,
            RedemptionVault vault,
            PooledFinancingVault pooledVault
        )
    {
        (usdc, nft, registry, vault, pooledVault) = _run(address(0));
    }

    function run(address usdcAddress)
        external
        returns (
            MockUSDC usdc,
            BondReceiptNFT nft,
            DealRegistry registry,
            RedemptionVault vault,
            PooledFinancingVault pooledVault
        )
    {
        (usdc, nft, registry, vault, pooledVault) = _run(usdcAddress);
    }

    function _run(address usdcAddress)
        internal
        returns (
            MockUSDC usdc,
            BondReceiptNFT nft,
            DealRegistry registry,
            RedemptionVault vault,
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
        pooledVault = new PooledFinancingVault(IERC20(address(usdc)), admin);

        // Per-deal product wiring (unchanged shape from the original deploy).
        registry.setVault(address(vault));
        nft.setVault(address(vault));
        nft.setDealRegistry(IDealPrincipalLedger(address(registry)));
        registry.setReceiptNft(address(nft));
        MockUSDC usdt = new MockUSDC();
        MockUSDC usdg = new MockUSDC();
        MockSwapRouter router = new MockSwapRouter();
        vault.configure(IERC20(address(usdc)), IERC20(address(usdt)), IERC20(address(usdg)), registry, nft);
        vault.setSwapRouter(ISwapRouter(address(router)), 3000, 50);

        // Testnet role grants: one broadcaster holds every role.
        registry.grantRole(registry.ORIGINATOR_ROLE(), admin);
        registry.grantRole(registry.SHARIAH_ROLE(), admin);
        registry.grantRole(registry.OPS_ROLE(), admin);
        vault.grantRole(vault.OPS_ROLE(), admin);
        pooledVault.grantRole(pooledVault.OPS_ROLE(), admin);

        vm.stopBroadcast();

        console2.log("MockUSDC:            ", address(usdc));
        console2.log("BondReceiptNFT:      ", address(nft));
        console2.log("DealRegistry:        ", address(registry));
        console2.log("RedemptionVault:     ", address(vault));
        console2.log("PooledFinancingVault:", address(pooledVault));
        console2.log("Admin (all roles):   ", admin);
    }
}
