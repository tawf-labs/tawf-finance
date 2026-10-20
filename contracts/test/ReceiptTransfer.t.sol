// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BaseSetup } from "./Base.t.sol";
import { BondReceiptNFT } from "../src/BondReceiptNFT.sol";

/// @notice Under the VerifiedOnly policy a receipt token can move between
///         verified holders. Whoever holds it after the move must be able to
///         redeem, and no money may get stuck.
contract ReceiptTransferTest is BaseSetup {
    uint96 internal constant HUNDRED = 100 * 10 ** 6;

    function test_VerifiedOnlyTransfer_newHolderCanRedeem() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        vm.prank(owner);
        nft.setTransferPolicy(id, BondReceiptNFT.TransferPolicy.VerifiedOnly);
        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, id, 1, "");

        _repay(id, HUNDRED);

        // Bob holds the receipt, so Bob should be paid.
        vm.prank(bob);
        vault.redeem(id);
        assertEq(usdc.balanceOf(bob), HUNDRED, "new holder is paid");
        assertEq(usdc.balanceOf(address(vault)), 0, "nothing stranded");
    }

    function test_VerifiedOnlyTransfer_movesRegistryPrincipal() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        vm.prank(owner);
        nft.setTransferPolicy(id, BondReceiptNFT.TransferPolicy.VerifiedOnly);
        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, id, 1, "");

        assertEq(registry.investorPrincipal(id, alice), 0, "alice principal moved out");
        assertEq(registry.investorPrincipal(id, bob), HUNDRED, "bob principal moved in");
        assertEq(nft.getReceiptMeta(id, bob).principal, HUNDRED, "receipt follows token");
        assertEq(nft.getReceiptMeta(id, alice).principal, 0, "old holder has no receipt");
        assertEq(registry.getDeal(id).totalFunded, HUNDRED, "totalFunded unchanged");
    }

    function test_VerifiedOnlyTransfer_toExistingHolderReverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        _fund(id, bob, HUNDRED);
        vm.prank(owner);
        nft.setTransferPolicy(id, BondReceiptNFT.TransferPolicy.VerifiedOnly);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(BondReceiptNFT.ReceiptTransferInvalid.selector, id, alice, bob));
        nft.safeTransferFrom(alice, bob, id, 1, "");
    }

    function test_VerifiedOnlyTransfer_oldHolderCannotStrandFunds() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);

        vm.prank(owner);
        nft.setTransferPolicy(id, BondReceiptNFT.TransferPolicy.VerifiedOnly);
        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, id, 1, "");

        _repay(id, HUNDRED);

        // Alice no longer holds the token; her redeem must not succeed.
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(id);
    }
}
