// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC1967Proxy } from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { DealRegistry } from "../DealRegistry.sol";
import { BondReceiptNFT } from "../BondReceiptNFT.sol";
import { RedemptionVault } from "../RedemptionVault.sol";
import { PooledFinancingVault } from "../PooledFinancingVault.sol";
import { LedgerAnchor } from "../LedgerAnchor.sol";

/**
 * @title Proxies
 * @notice Deploys each upgradeable pool contract as an implementation behind
 *         an ERC1967 (UUPS) proxy and initialises it in the same transaction.
 *         Internal functions only, so this library adds no deployed bytecode.
 *         Used by the deploy scripts and the tests so both exercise the same path.
 */
library Proxies {
    function dealRegistry(address admin) internal returns (DealRegistry) {
        address impl = address(new DealRegistry());
        return DealRegistry(address(new ERC1967Proxy(impl, abi.encodeCall(DealRegistry.initialize, (admin)))));
    }

    function nft(address admin) internal returns (BondReceiptNFT) {
        address impl = address(new BondReceiptNFT());
        return BondReceiptNFT(address(new ERC1967Proxy(impl, abi.encodeCall(BondReceiptNFT.initialize, (admin)))));
    }

    function vault(address admin) internal returns (RedemptionVault) {
        address impl = address(new RedemptionVault());
        return RedemptionVault(address(new ERC1967Proxy(impl, abi.encodeCall(RedemptionVault.initialize, (admin)))));
    }

    function pooledVault(IERC20 asset, address admin) internal returns (PooledFinancingVault) {
        address impl = address(new PooledFinancingVault());
        return PooledFinancingVault(
            address(new ERC1967Proxy(impl, abi.encodeCall(PooledFinancingVault.initialize, (asset, admin))))
        );
    }

    function ledgerAnchor(uint256 ledgerChainId, address operator, address upgrader) internal returns (LedgerAnchor) {
        address impl = address(new LedgerAnchor());
        return LedgerAnchor(
            address(new ERC1967Proxy(impl, abi.encodeCall(LedgerAnchor.initialize, (ledgerChainId, operator, upgrader))))
        );
    }
}
