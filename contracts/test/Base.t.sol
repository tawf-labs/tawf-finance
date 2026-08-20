// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";

/**
 * @notice Shared deployment + helpers for the Tawf contract test suite.
 *
 * @dev The whole stack is deployed under a dedicated owner EOA so that
 *      onlyOwner behavior is tested against a real external caller, and
 *      investors are distinct EOAs.
 */
abstract contract BaseSetup is Test {
    MockUSDC public usdc;
    BondReceiptNFT public nft;
    DealRegistry public registry;
    RedemptionVault public vault;

    address public owner = makeAddr("owner");
    address public bmt = makeAddr("bmt");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public carol = makeAddr("carol");
    address public stranger = makeAddr("stranger");

    uint96 public constant MIN_INVEST = 10 * 10 ** 6; // $10.00 (USDC 6 decimals)
    uint96 public constant TARGET = 2_500 * 10 ** 6; // $2,500

    function setUp() public virtual {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        nft = new BondReceiptNFT();
        registry = new DealRegistry();
        vault = new RedemptionVault();

        registry.setVault(address(vault));
        nft.setVault(address(vault));
        vault.configure(IERC20(address(usdc)), registry, nft);
        vm.stopPrank();
    }

    /// @dev Create a deal and drive it to Mintable (as owner).
    function _createAndMintable(
        uint96 apyBps,
        uint32 durationDays,
        uint96 minInvest,
        uint96 target
    ) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.createDeal(
            keccak256(abi.encode(block.timestamp, apyBps)),
            "Warung Sari Rejeki",
            "Indomaret",
            bmt,
            apyBps,
            durationDays,
            minInvest,
            target
        );
        registry.approveDeal(id);
        registry.markMintable(id);
        vm.stopPrank();
    }

    /// @dev Default mintable deal: 12% APY, 30 days, $10 min, $2,500 target.
    function _mintableDeal() internal returns (uint256) {
        return _createAndMintable(1200, 30, MIN_INVEST, TARGET);
    }

    /// @dev Give `investor` test USDC and invest `amount` into `dealId`.
    function _fund(uint256 dealId, address investor, uint96 amount) internal {
        vm.startPrank(investor);
        usdc.faucet(amount);
        usdc.approve(address(vault), amount);
        vault.invest(dealId, amount);
        vm.stopPrank();
    }

    /// @dev Owner repays `totalRepayment` for `dealId` (pulls yield in).
    function _repay(uint256 dealId, uint96 totalRepayment) internal {
        vm.startPrank(owner);
        usdc.faucet(totalRepayment);
        usdc.approve(address(vault), totalRepayment);
        vault.repay(dealId, totalRepayment);
        vm.stopPrank();
    }
}
