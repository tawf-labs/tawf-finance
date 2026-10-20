// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { DealRegistry } from "../src/DealRegistry.sol";
import { BondReceiptNFT, IDealPrincipalLedger as BondReceiptNFTDealRegistry } from "../src/BondReceiptNFT.sol";
import { RedemptionVault } from "../src/RedemptionVault.sol";
import { PooledFinancingVault } from "../src/PooledFinancingVault.sol";
import { ITawfIdentityRegistry } from "../src/interfaces/ITawfIdentityRegistry.sol";

/// @notice An in-memory stand-in for the shared T-REX IdentityRegistry's
///         verification view. The production registry answers isVerified by
///         inspecting ONCHAINID KYC claims (exercised directly in the sukuk,
///         deposito, and DeployTokenization suites); here the per-deal and
///         pooled products only need a controllable isVerified to drive their
///         VerifiedOnly transfer policy, so a settable whitelist is both
///         sufficient and faster. Satisfies ITawfIdentityRegistry exactly.
contract MockIdentityRegistry is ITawfIdentityRegistry {
    mapping(address => bool) public verified;

    function setVerified(address account, bool v) external {
        verified[account] = v;
    }

    function isVerified(address account) external view override returns (bool) {
        return verified[account];
    }
}

/**
 * @notice Shared deployment + helpers for the Tawf contract test suite.
 *
 * @dev The whole stack is deployed under a dedicated owner EOA holding
 *      every AccessControl role (ORIGINATOR_ROLE, SHARIAH_ROLE, OPS_ROLE,
 *      ADMIN_ROLE), the same single-key testnet posture Deploy.s.sol uses,
 *      so role-gated behavior is tested against a real external caller and
 *      investors are distinct EOAs. Identity now lives in a shared registry
 *      (T-REX IdentityRegistry in production, MockIdentityRegistry here); the
 *      per-deal receipts and pooled shares are soulbound by default and open
 *      to verified holders only when an admin sets a VerifiedOnly policy.
 */
abstract contract BaseSetup is Test {
    MockUSDC public usdc;
    BondReceiptNFT public nft;
    DealRegistry public registry;
    RedemptionVault public vault;
    MockIdentityRegistry public identityRegistry;
    PooledFinancingVault public pooledVault;

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
        nft = new BondReceiptNFT(owner);
        registry = new DealRegistry(owner);
        vault = new RedemptionVault(owner);
        identityRegistry = new MockIdentityRegistry();
        pooledVault = new PooledFinancingVault(IERC20(address(usdc)), owner);

        registry.setVault(address(vault));
        nft.setVault(address(vault));
        vault.configure(IERC20(address(usdc)), registry, nft);
        nft.setIdentityRegistry(identityRegistry);
        nft.setDealRegistry(BondReceiptNFTDealRegistry(address(registry)));
        registry.setReceiptNft(address(nft));
        pooledVault.setIdentityRegistry(identityRegistry);

        registry.grantRole(registry.ORIGINATOR_ROLE(), owner);
        registry.grantRole(registry.SHARIAH_ROLE(), owner);
        registry.grantRole(registry.OPS_ROLE(), owner);
        vault.grantRole(vault.OPS_ROLE(), owner);
        pooledVault.grantRole(pooledVault.OPS_ROLE(), owner);
        vm.stopPrank();

        // The named investors passed KYC; `stranger` did not.
        identityRegistry.setVerified(alice, true);
        identityRegistry.setVerified(bob, true);
        identityRegistry.setVerified(carol, true);
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
