// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { IAccessControl } from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import { MockUSDC } from "../../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../../src/DealRegistry.sol";
import { BondReceiptNFT } from "../../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../../src/RedemptionVault.sol";
import { IdentityRegistry } from "../../src/IdentityRegistry.sol";
import { Compliance } from "../../src/Compliance.sol";

/// @notice Role-separated deployment for the synthetic evaluation. Unlike
///         test/Base.t.sol, every role sits on its own key, so the tests
///         measure what role separation actually stops.
abstract contract EvalBase is Test {
    MockUSDC internal usdc;
    BondReceiptNFT internal nft;
    DealRegistry internal registry;
    RedemptionVault internal vault;
    IdentityRegistry internal identityRegistry;
    Compliance internal compliance;

    address internal admin = makeAddr("admin");
    address internal originator = makeAddr("bprs_officer"); // ORIGINATOR_ROLE
    address internal shariah = makeAddr("sharia_board"); // SHARIAH_ROLE
    address internal agent = makeAddr("ai_agent_signer"); // OPS_ROLE on registry and vault
    address internal auditor = makeAddr("auditor"); // no role, observer
    address internal stranger = makeAddr("stranger");
    address internal client = makeAddr("client"); // named borrower, never an on-chain caller

    uint96 internal constant MIN_INVEST = 10e6;
    uint96 internal constant TICKET = 100e6;

    uint256[6] internal deployGas; // usdc, nft, registry, vault, identity, compliance
    string[6] internal deployNames = ["MockUSDC", "BondReceiptNFT", "DealRegistry", "RedemptionVault", "IdentityRegistry", "Compliance"];

    function _deployAll() internal {
        uint256 g = gasleft();
        usdc = new MockUSDC();
        deployGas[0] = g - gasleft();
        g = gasleft();
        nft = new BondReceiptNFT(admin);
        deployGas[1] = g - gasleft();
        g = gasleft();
        registry = new DealRegistry(admin);
        deployGas[2] = g - gasleft();
        g = gasleft();
        vault = new RedemptionVault(admin);
        deployGas[3] = g - gasleft();
        g = gasleft();
        identityRegistry = new IdentityRegistry(admin);
        deployGas[4] = g - gasleft();
        g = gasleft();
        compliance = new Compliance(identityRegistry, admin);
        deployGas[5] = g - gasleft();

        vm.startPrank(admin);
        registry.setVault(address(vault));
        nft.setVault(address(vault));
        vault.configure(IERC20(address(usdc)), registry, nft);
        nft.setCompliance(compliance);
        registry.grantRole(registry.ORIGINATOR_ROLE(), originator);
        registry.grantRole(registry.SHARIAH_ROLE(), shariah);
        registry.grantRole(registry.OPS_ROLE(), agent);
        vault.grantRole(vault.OPS_ROLE(), agent);
        vm.stopPrank();
    }

    function _investor(uint256 i) internal pure returns (address) {
        return address(uint160(0x10000 + i));
    }

    function _yield(uint96 principal, uint96 apyBps, uint32 days_) internal pure returns (uint96) {
        return uint96((uint256(principal) * apyBps * days_) / (10_000 * 365));
    }

    function _newDeal(bytes32 hash, uint96 target) internal returns (uint256 id) {
        vm.prank(originator);
        id = registry.createDeal(hash, "Micro-Trade Segment", "BPRS Synthetic", originator, 1200, 30, MIN_INVEST, target);
    }

    function _fundAs(address who, uint256 dealId, uint96 amount) internal {
        vm.startPrank(who);
        usdc.faucet(amount);
        usdc.approve(address(vault), amount);
        vault.invest(dealId, amount);
        vm.stopPrank();
    }

    function _selectorName(bytes4 s) internal pure returns (string memory) {
        if (s == IAccessControl.AccessControlUnauthorizedAccount.selector) return "AccessControlUnauthorizedAccount";
        if (s == DealRegistry.NotVault.selector) return "NotVault()";
        if (s == DealRegistry.InvalidTransition.selector) return "InvalidTransition";
        if (s == DealRegistry.NotMatured.selector) return "NotMatured(uint256)";
        if (s == RedemptionVault.FundingClosed.selector) return "FundingClosed";
        if (s == RedemptionVault.RepaymentBelowPrincipal.selector) return "RepaymentBelowPrincipal";
        if (s == RedemptionVault.AlreadyConfigured.selector) return "AlreadyConfigured";
        if (s == RedemptionVault.NotMatured.selector) return "NotMatured";
        if (s == RedemptionVault.NotDefaulted.selector) return "NotDefaulted";
        if (s == RedemptionVault.NotInvestor.selector) return "NotInvestor";
        if (s == RedemptionVault.AlreadyRedeemed.selector) return "AlreadyRedeemed";
        if (s == BondReceiptNFT.Soulbound.selector) return "Soulbound";
        return "unknown";
    }
}
