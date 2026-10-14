// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC20 } from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import { Compliance } from "../Compliance.sol";

/// @dev Implemented by SukukDistributor.
interface ISukukBalanceHook {
    function beforeBalanceChange(address from, address to) external;
}

/**
 * @title SukukToken
 * @notice The investor-facing unit of one sukuk issuance: a permissioned
 *         ERC-20 with 6 decimals, one unit per base unit of USDC subscribed.
 *
 * @dev ERC-3643-style, using the same Compliance module and shared
 *      IdentityRegistry as BondReceiptNFT and PooledFinancingVault. Every
 *      holder-to-holder transfer is checked there.
 *
 *      Whether a sukuk may trade at all is a Shariah question that depends
 *      on its akad, so it is a per-issuance policy, not a property of this
 *      contract: an asset-backed Ijarah or Musyarakah sukuk can be set
 *      Transferable, a Murabaha (debt) sukuk stays NonTransferable unless
 *      the DPS rules otherwise. The default, as everywhere in this product,
 *      is NonTransferable.
 *
 *      Mint and burn belong to the issuance's SukukDistributor alone.
 */
contract SukukToken is ERC20 {
    /// @notice Fixed instrument id this token is checked against in
    ///         Compliance, one share class per issuance.
    uint256 public constant INSTRUMENT_ID = 1;

    address public immutable distributor;
    Compliance public immutable compliance;

    error OnlyDistributor();
    error TransferBlocked();

    constructor(string memory name_, string memory symbol_, Compliance compliance_) ERC20(name_, symbol_) {
        distributor = msg.sender;
        compliance = compliance_;
    }

    modifier onlyDistributor() {
        if (msg.sender != distributor) revert OnlyDistributor();
        _;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyDistributor {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyDistributor {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            if (!compliance.canTransfer(address(this), INSTRUMENT_ID, from, to)) revert TransferBlocked();
        }
        // Settle each side's profit entitlement at its old balance first.
        ISukukBalanceHook(distributor).beforeBalanceChange(from, to);
        super._update(from, to, value);
    }
}
