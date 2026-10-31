// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { LedgerAnchor } from "../LedgerAnchor.sol";
import { DepositoPoolLedger } from "../deposito/DepositoPoolLedger.sol";
import { TawfDepositoSeries } from "../deposito/TawfDepositoSeries.sol";
import { SukukDistributor } from "../sukuk/SukukDistributor.sol";
import { DealRegistry } from "../DealRegistry.sol";
import { BondReceiptNFT } from "../BondReceiptNFT.sol";
import { RedemptionVault } from "../RedemptionVault.sol";
import { PooledFinancingVault } from "../PooledFinancingVault.sol";

/// @dev Stand-ins for a future release of each contract: same layout, one appended field and one
///      new function, used by the upgrade tests. The new field sits in a fresh slot after the base
///      contract's gap, which is what a real next version must do (consume the gap, never reorder).
contract LedgerAnchorV2 is LedgerAnchor {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract DepositoPoolLedgerV2 is DepositoPoolLedger {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract TawfDepositoSeriesV2 is TawfDepositoSeries {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract SukukDistributorV2 is SukukDistributor {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract DealRegistryV2 is DealRegistry {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract BondReceiptNFTV2 is BondReceiptNFT {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract RedemptionVaultV2 is RedemptionVault {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}

contract PooledFinancingVaultV2 is PooledFinancingVault {
    uint256 public extra;

    function setExtra(uint256 v) external {
        extra = v;
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}
