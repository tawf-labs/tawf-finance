// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BaseSetup } from "./Base.t.sol";

/// @notice An investor who invests twice in the same deal must be able to
///         redeem the sum of both investments.
contract RepeatInvestTest is BaseSetup {
    uint96 internal constant HUNDRED = 100 * 10 ** 6;
    uint96 internal constant FIFTY = 50 * 10 ** 6;

    function test_RepeatInvest_receiptTracksTotalPrincipal() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        _fund(id, alice, FIFTY);

        assertEq(registry.investorPrincipal(id, alice), HUNDRED + FIFTY, "registry principal");
        assertEq(nft.getReceiptMeta(id, alice).principal, HUNDRED + FIFTY, "receipt principal");
        assertEq(nft.balanceOf(alice, id), 1, "one receipt token");
        assertEq(nft.mintedCount(id), 1, "one receipt counted");
    }

    function test_RepeatInvest_unverifiedTopUpReverts() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        identityRegistry.setVerified(alice, false);

        vm.startPrank(alice);
        usdc.faucet(FIFTY);
        usdc.approve(address(vault), FIFTY);
        vm.expectRevert();
        vault.invest(id, FIFTY);
        vm.stopPrank();
    }

    function test_RepeatInvest_redeemPaysBothInvestments() public {
        uint256 id = _mintableDeal();
        _fund(id, alice, HUNDRED);
        _fund(id, alice, FIFTY);
        _repay(id, HUNDRED + FIFTY);

        vm.prank(alice);
        vault.redeem(id);
        assertEq(usdc.balanceOf(alice), HUNDRED + FIFTY, "alice gets all her principal back");
        assertEq(usdc.balanceOf(address(vault)), 0, "nothing stranded in the vault");
        assertEq(nft.balanceOf(alice, id), 0, "receipt burned");
        assertTrue(nft.isFullyRedeemed(id), "deal fully redeemed");
    }
}
