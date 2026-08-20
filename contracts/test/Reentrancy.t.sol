// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";

/**
 * @notice A USDC-shaped token that tries to re-enter the vault from inside
 *         `transfer`/`transferFrom`, the classic reentrancy attack surface.
 */
contract MaliciousToken is ERC20 {
    RedemptionVault public vault;
    uint256 public attackDealId;
    bool public armed;

    constructor() ERC20("Malicious", "MAL") {}

    function setVault(address vault_) external {
        vault = RedemptionVault(vault_);
    }

    function arm(uint256 dealId) external {
        attackDealId = dealId;
        armed = true;
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function _update(address from, address to, uint256 amount) internal virtual override {
        super._update(from, to, amount);
        // Re-enter the vault mid-transfer if armed and the vault is the caller.
        if (armed && msg.sender == address(vault)) {
            vault.redeem(attackDealId);
        }
    }
}

contract ReentrancyTest is Test {
    MaliciousToken public token;
    BondReceiptNFT public nft;
    DealRegistry public registry;
    RedemptionVault public vault;

    address public owner = makeAddr("owner");
    address public bmt = makeAddr("bmt");
    address public alice = makeAddr("alice");

    function setUp() public {
        vm.startPrank(owner);
        token = new MaliciousToken();
        nft = new BondReceiptNFT();
        registry = new DealRegistry();
        vault = new RedemptionVault();

        token.setVault(address(vault));
        registry.setVault(address(vault));
        nft.setVault(address(vault));
        vault.configure(IERC20(address(token)), registry, nft);
        vm.stopPrank();
    }

    function _mintableDeal() internal returns (uint256) {
        vm.startPrank(owner);
        uint256 id = registry.createDeal(
            keccak256("reentrancy-deal"),
            "Warung",
            "Indomaret",
            bmt,
            1200,
            30,
            10 * 10 ** 6,
            2_500 * 10 ** 6
        );
        registry.approveDeal(id);
        registry.markMintable(id);
        vm.stopPrank();
        return id;
    }

    function test_ReentrantRedeem_isBlocked() public {
        uint256 id = _mintableDeal();

        // Alice invests $100.
        vm.startPrank(alice);
        token.faucet(100 * 10 ** 6);
        token.approve(address(vault), 100 * 10 ** 6);
        vault.invest(id, 100 * 10 ** 6);
        vm.stopPrank();

        // Owner repays $110 ($100 principal + $10 yield).
        vm.startPrank(owner);
        token.faucet(10 * 10 ** 6);
        token.approve(address(vault), 10 * 10 ** 6);
        vault.repay(id, 110 * 10 ** 6);
        vm.stopPrank();

        // Arm the token: the payout transfer will try to re-enter redeem().
        token.arm(id);

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vault.redeem(id);
    }
}
