// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BeaconProxy } from "openzeppelin-contracts/contracts/proxy/beacon/BeaconProxy.sol";
import { UpgradeableBeacon } from "openzeppelin-contracts/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { DealRegistry } from "../DealRegistry.sol";
import { BondReceiptNFT } from "../BondReceiptNFT.sol";
import { RedemptionVault } from "../RedemptionVault.sol";
import { PooledFinancingVault } from "../PooledFinancingVault.sol";
import { LedgerAnchor } from "../LedgerAnchor.sol";

/**
 * @title Proxies
 * @notice Deploys each upgradeable contract as an implementation behind an
 *         UpgradeableBeacon plus a BeaconProxy, initialised in the same transaction. The plain
 *         functions create a fresh beacon owned by `admin` (tests and one-off scripts). The `*On`
 *         functions reuse a beacon, so every instance of a type shares one and a single beacon
 *         upgrade covers them all.
 *         Internal functions only, so this library adds no deployed bytecode.
 *         Used by the deploy scripts and the tests so both exercise the same path.
 */
library Proxies {
    function beacon(address impl, address owner) internal returns (UpgradeableBeacon) {
        return new UpgradeableBeacon(impl, owner);
    }

    function _proxy(address beacon_, bytes memory data) private returns (address) {
        return address(new BeaconProxy(beacon_, data));
    }

    // ---- DealRegistry ----
    function dealRegistry(address admin) internal returns (DealRegistry) {
        return dealRegistryOn(address(beacon(address(new DealRegistry()), admin)), admin);
    }

    function dealRegistryOn(address beacon_, address admin) internal returns (DealRegistry) {
        return DealRegistry(_proxy(beacon_, abi.encodeCall(DealRegistry.initialize, (admin))));
    }

    // ---- BondReceiptNFT ----
    function nft(address admin) internal returns (BondReceiptNFT) {
        return nftOn(address(beacon(address(new BondReceiptNFT()), admin)), admin);
    }

    function nftOn(address beacon_, address admin) internal returns (BondReceiptNFT) {
        return BondReceiptNFT(_proxy(beacon_, abi.encodeCall(BondReceiptNFT.initialize, (admin))));
    }

    // ---- RedemptionVault ----
    function vault(address admin) internal returns (RedemptionVault) {
        return vaultOn(address(beacon(address(new RedemptionVault()), admin)), admin);
    }

    function vaultOn(address beacon_, address admin) internal returns (RedemptionVault) {
        return RedemptionVault(_proxy(beacon_, abi.encodeCall(RedemptionVault.initialize, (admin))));
    }

    // ---- PooledFinancingVault ----
    function pooledVault(IERC20 asset, address admin) internal returns (PooledFinancingVault) {
        return pooledVaultOn(address(beacon(address(new PooledFinancingVault()), admin)), asset, admin);
    }

    function pooledVaultOn(address beacon_, IERC20 asset, address admin) internal returns (PooledFinancingVault) {
        return PooledFinancingVault(_proxy(beacon_, abi.encodeCall(PooledFinancingVault.initialize, (asset, admin))));
    }

    // ---- LedgerAnchor ----
    function ledgerAnchor(uint256 ledgerChainId, address operator, address beaconOwner) internal returns (LedgerAnchor) {
        return ledgerAnchorOn(address(beacon(address(new LedgerAnchor()), beaconOwner)), ledgerChainId, operator);
    }

    function ledgerAnchorOn(address beacon_, uint256 ledgerChainId, address operator) internal returns (LedgerAnchor) {
        return LedgerAnchor(_proxy(beacon_, abi.encodeCall(LedgerAnchor.initialize, (ledgerChainId, operator))));
    }
}
