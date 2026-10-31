// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { DealRegistry } from "../../src/DealRegistry.sol";
import { BondReceiptNFT, IDealPrincipalLedger } from "../../src/BondReceiptNFT.sol";
import { RedemptionVault, ISwapRouter } from "../../src/RedemptionVault.sol";
import { ITawfIdentityRegistry } from "../../src/interfaces/ITawfIdentityRegistry.sol";
import { MockUSDC } from "../../src/mocks/MockUSDC.sol";
import { MockSwapRouter } from "../../src/mocks/MockSwapRouter.sol";
import { Proxies } from "../../src/proxy/Proxies.sol";

/// @notice ANVIL ONLY. Refuses to run on Arbitrum Sepolia (421614) or any chain but a local one. TEST ONLY. Minimal allow-list stand-in for the T-REX identity registry.
contract AllowListRegistry is ITawfIdentityRegistry {
    address public immutable owner;
    mapping(address => bool) private _verified;

    constructor(address owner_) {
        owner = owner_;
    }

    function setVerified(address account, bool ok) external {
        require(msg.sender == owner, "not owner");
        _verified[account] = ok;
    }

    function isVerified(address account) external view returns (bool) {
        return _verified[account];
    }
}

/**
 * @notice TEST stack for the upgrade end-to-end run: the same proxy stack as DeployPool, wired to an
 *         AllowListRegistry and a mock USDG. No deal is seeded and no deployments file is written.
 *         Env: MOCK_USDC, MOCK_USDT, FEE_RECIPIENT, NEGLIGENCE_SIGNER, INVESTOR (verified on deploy).
 *         forge script script/e2e/DeployTestStack.s.sol --rpc-url ... --private-key $POOL_ADMIN_KEY --broadcast --slow
 */
contract DeployTestStack is Script {
    function run() external {
        // ANVIL ONLY: the beacons here are owned by the deployer and the roles are not Safe-governed. Never a real network,
        // and in particular never Arbitrum Sepolia (421614). The supported deploy is script/DeployAll.s.sol.
        require(block.chainid == 31337, "DeployTestStack is Anvil only (chain 31337), refused on every other chain");
        address mockUsdc = vm.envAddress("MOCK_USDC");
        address mockUsdt = vm.envAddress("MOCK_USDT");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address negligenceSigner = vm.envAddress("NEGLIGENCE_SIGNER");
        address investor = vm.envAddress("INVESTOR");

        vm.startBroadcast();
        address admin = msg.sender;

        AllowListRegistry kyc = new AllowListRegistry(admin);
        kyc.setVerified(investor, true);
        MockUSDC usdg = new MockUSDC();

        BondReceiptNFT nft = Proxies.nft(admin);
        DealRegistry registry = Proxies.dealRegistry(admin);
        RedemptionVault vault = Proxies.vault(admin);

        registry.setVault(address(vault));
        nft.setVault(address(vault));
        nft.setDealRegistry(IDealPrincipalLedger(address(registry)));
        registry.setReceiptNft(address(nft));
        nft.setIdentityRegistry(ITawfIdentityRegistry(address(kyc)));
        vault.configure(IERC20(address(usdg)), registry, nft);

        registry.grantRole(registry.ORIGINATOR_ROLE(), admin);
        registry.grantRole(registry.SHARIAH_ROLE(), admin);
        registry.grantRole(registry.OPS_ROLE(), admin);
        vault.grantRole(vault.OPS_ROLE(), admin);
        vault.grantRole(vault.SERVICER_ROLE(), admin);
        vault.grantRole(vault.NEGLIGENCE_ROLE(), negligenceSigner);
        vault.setFeeRecipient(feeRecipient);

        MockSwapRouter router = new MockSwapRouter();
        usdg.faucet(100_000 * 10 ** 6);
        usdg.transfer(address(router), 100_000 * 10 ** 6);
        vault.setInputToken(mockUsdc, true);
        vault.setInputToken(mockUsdt, true);
        vault.setSwapRouter(ISwapRouter(address(router)), 100, 50);
        vault.setYieldRecipient(feeRecipient);
        vm.stopBroadcast();

        console2.log("kyc", address(kyc));
        console2.log("usdg", address(usdg));
        console2.log("router", address(router));
        console2.log("nft", address(nft));
        console2.log("registry", address(registry));
        console2.log("vault", address(vault));
    }
}
