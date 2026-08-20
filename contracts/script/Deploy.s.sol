// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";

/**
 * @notice Deploys the full Warung Economy Sukuk stack to the broadcast chain
 *         (Arbitrum Sepolia for the buildathon) and wires the contracts.
 *
 * @dev Usage:
 *      forge script script/Deploy.s.sol:Deploy --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast --verify -vvvv
 *
 *      To use real test USDC instead of MockUSDC, pass the USDC address as
 *      the first script argument: --sig "run(address)" $TEST_USDC.
 */
contract Deploy is Script {
    function run() external returns (MockUSDC usdc, BondReceiptNFT nft, DealRegistry registry, RedemptionVault vault) {
        (usdc, nft, registry, vault) = _run(address(0));
    }

    function run(address usdcAddress) external returns (MockUSDC usdc, BondReceiptNFT nft, DealRegistry registry, RedemptionVault vault) {
        (usdc, nft, registry, vault) = _run(usdcAddress);
    }

    function _run(address usdcAddress) internal returns (MockUSDC usdc, BondReceiptNFT nft, DealRegistry registry, RedemptionVault vault) {
        vm.startBroadcast();

        if (usdcAddress == address(0)) {
            usdc = new MockUSDC();
        } else {
            usdc = MockUSDC(usdcAddress);
        }

        nft = new BondReceiptNFT();
        registry = new DealRegistry();
        vault = new RedemptionVault();

        registry.setVault(address(vault));
        nft.setVault(address(vault));
        vault.configure(IERC20(address(usdc)), registry, nft);

        vm.stopBroadcast();

        console2.log("MockUSDC:       ", address(usdc));
        console2.log("BondReceiptNFT: ", address(nft));
        console2.log("DealRegistry:   ", address(registry));
        console2.log("RedemptionVault:", address(vault));
        console2.log("Owner:          ", registry.owner());
    }
}
