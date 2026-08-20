// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC1155Errors } from "openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";

contract BondReceiptNFTTest is Test {
    BondReceiptNFT public nft;

    address public vault = makeAddr("vault");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public mallory = makeAddr("mallory");

    uint256 public constant DEAL_ID = 1;
    uint96 public constant PRINCIPAL = 100 * 10 ** 6; // $100

    function setUp() public {
        nft = new BondReceiptNFT();
        nft.setVault(vault);
    }

    function _mint(address investor) internal {
        vm.prank(vault);
        nft.mint(investor, DEAL_ID, PRINCIPAL, 1200, 30, "Warung Sari Rejeki", "Indomaret");
    }

    function _mature() internal {
        vm.prank(vault);
        nft.markDealMatured(DEAL_ID, 20 * 10 ** 6, PRINCIPAL);
    }

    // ------------------------------------------------------------------
    // Minting
    // ------------------------------------------------------------------

    function test_Mint_createsReceipt() public {
        _mint(alice);

        assertEq(nft.balanceOf(alice, DEAL_ID), 1);
        assertEq(nft.mintedCount(DEAL_ID), 1);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(DEAL_ID, alice);
        assertEq(meta.principal, PRINCIPAL);
        assertEq(meta.apyBps, 1200);
        assertEq(meta.durationDays, 30);
        assertEq(uint8(meta.status), uint8(BondReceiptNFT.ReceiptStatus.Active));
        assertGt(meta.mintedAt, 0);
    }

    function test_Mint_accumulatesPerInvestor() public {
        _mint(alice);
        _mint(bob);
        assertEq(nft.mintedCount(DEAL_ID), 2);
    }

    function test_Mint_onlyVault() public {
        vm.expectRevert(BondReceiptNFT.NotVault.selector);
        vm.prank(mallory);
        nft.mint(alice, DEAL_ID, PRINCIPAL, 1200, 30, "Warung", "Indomaret");
    }

    // ------------------------------------------------------------------
    // Soulbound enforcement
    // ------------------------------------------------------------------

    function test_Soulbound_transferReverts() public {
        _mint(alice);
        vm.expectRevert(BondReceiptNFT.Soulbound.selector);
        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, DEAL_ID, 1, "");
    }

    function test_Soulbound_batchTransferReverts() public {
        _mint(alice);
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = DEAL_ID;
        amounts[0] = 1;

        vm.expectRevert(BondReceiptNFT.Soulbound.selector);
        vm.prank(alice);
        nft.safeBatchTransferFrom(alice, bob, ids, amounts, "");
    }

    function test_Soulbound_setApprovalForAllReverts() public {
        vm.expectRevert(BondReceiptNFT.Soulbound.selector);
        nft.setApprovalForAll(mallory, true);
    }

    function test_Soulbound_operatorCannotTransfer() public {
        _mint(alice);
        // setApprovalForAll always reverts, so an operator call fails at the
        // approval check before ever reaching the soulbound _update.
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155MissingApprovalForAll.selector,
                mallory,
                alice
            )
        );
        vm.prank(mallory);
        nft.safeTransferFrom(alice, bob, DEAL_ID, 1, "");
    }

    // ------------------------------------------------------------------
    // Maturity / status derivation
    // ------------------------------------------------------------------

    function test_MarkDealMatured_derivesMaturedStatus() public {
        _mint(alice);
        _mature();

        BondReceiptNFT.DealSnapshot memory snap = nft.getDealSnapshot(DEAL_ID);
        assertTrue(snap.matured);
        assertEq(snap.yieldPool, 20 * 10 ** 6);
        assertEq(snap.totalFunded, PRINCIPAL);
        assertGt(snap.maturedAt, 0);

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(DEAL_ID, alice);
        assertEq(uint8(meta.status), uint8(BondReceiptNFT.ReceiptStatus.Matured));
    }

    function test_MarkDealMatured_zeroTotalFunded_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(BondReceiptNFT.ZeroTotalFunded.selector, DEAL_ID));
        vm.prank(vault);
        nft.markDealMatured(DEAL_ID, 1, 0);
    }

    function test_MarkDealMatured_twice_reverts() public {
        _mature();
        vm.expectRevert(abi.encodeWithSelector(BondReceiptNFT.DealAlreadyMatured.selector, DEAL_ID));
        vm.prank(vault);
        nft.markDealMatured(DEAL_ID, 1, 1);
    }

    function test_MarkDealMatured_onlyVault() public {
        vm.expectRevert(BondReceiptNFT.NotVault.selector);
        vm.prank(mallory);
        nft.markDealMatured(DEAL_ID, 1, 1);
    }

    // ------------------------------------------------------------------
    // Burning / redemption
    // ------------------------------------------------------------------

    function test_BurnOnRedemption_burnsAndFlags() public {
        _mint(alice);
        _mature();

        vm.prank(vault);
        nft.burnOnRedemption(DEAL_ID, alice);

        assertEq(nft.balanceOf(alice, DEAL_ID), 0);
        assertEq(nft.burnedCount(DEAL_ID), 1);
        assertTrue(nft.isFullyRedeemed(DEAL_ID));

        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(DEAL_ID, alice);
        assertEq(uint8(meta.status), uint8(BondReceiptNFT.ReceiptStatus.Redeemed));
    }

    function test_BurnOnRedemption_onlyVault() public {
        _mint(alice);
        vm.expectRevert(BondReceiptNFT.NotVault.selector);
        vm.prank(mallory);
        nft.burnOnRedemption(DEAL_ID, alice);
    }

    function test_BurnOnRedemption_notInvestor_reverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(BondReceiptNFT.NotInvestor.selector, DEAL_ID, alice)
        );
        vm.prank(vault);
        nft.burnOnRedemption(DEAL_ID, alice);
    }

    function test_BurnOnRedemption_twice_reverts() public {
        _mint(alice);
        vm.startPrank(vault);
        nft.burnOnRedemption(DEAL_ID, alice);
        vm.expectRevert(
            abi.encodeWithSelector(BondReceiptNFT.AlreadyRedeemed.selector, DEAL_ID, alice)
        );
        nft.burnOnRedemption(DEAL_ID, alice);
        vm.stopPrank();
    }

    function test_IsFullyRedeemed_falseWhileOutstanding() public {
        _mint(alice);
        _mint(bob);
        vm.prank(vault);
        nft.burnOnRedemption(DEAL_ID, alice);
        assertFalse(nft.isFullyRedeemed(DEAL_ID));
    }

    // ------------------------------------------------------------------
    // Metadata
    // ------------------------------------------------------------------

    function test_Uri_isOnChainDataJson() public {
        _mint(alice);
        string memory u = nft.uri(DEAL_ID);
        assertTrue(_startsWith(u, "data:application/json;base64,"), "uri should be base64 JSON");
    }

    function test_GetReceiptMeta_unknownInvestor_returnsEmpty() public {
        BondReceiptNFT.ReceiptMeta memory meta = nft.getReceiptMeta(DEAL_ID, alice);
        assertEq(meta.principal, 0);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _startsWith(string memory s, string memory prefix) internal pure returns (bool) {
        bytes memory sb = bytes(s);
        bytes memory pb = bytes(prefix);
        if (sb.length < pb.length) return false;
        for (uint256 i = 0; i < pb.length; i++) {
            if (sb[i] != pb[i]) return false;
        }
        return true;
    }
}
