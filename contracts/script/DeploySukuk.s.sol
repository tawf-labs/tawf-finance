// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { Compliance } from "../src/Compliance.sol";
import { ILedgerAnchor } from "../src/sukuk/ILedgerAnchor.sol";
import { SukukDistributor } from "../src/sukuk/SukukDistributor.sol";

/**
 * @notice Deploys one sukuk issuance (SukukDistributor, which deploys its
 *         SukukToken) against an existing Compliance module and the
 *         LedgerAnchor from tawf-network.
 *
 * @dev Usage:
 *      forge script script/DeploySukuk.s.sol:DeploySukuk --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast
 *
 *      Environment:
 *        USDC, LEDGER_ANCHOR, COMPLIANCE   deployed addresses
 *        SUKUK_ID                          bytes32 id in the Tawf Network SukukLedger
 *        FACE_VALUE, MATURITY              must equal the ledger record exactly,
 *                                          openSubscription proves against them
 *        MIN_RAISE, MIN_SUBSCRIPTION       USDC base units
 *        SUBSCRIPTION_PERIOD               seconds
 *        ISSUER_TREASURY                   the bank's receiving wallet
 *        SUKUK_NAME, SUKUK_SYMBOL          token metadata
 *        ADMIN                             optional, defaults to the broadcaster;
 *                                          a Safe multisig in production
 *
 *      The token is NonTransferable until POLICY_ROLE sets a policy for
 *      (token, INSTRUMENT_ID) in Compliance, per the DPS ruling on its akad.
 */
contract DeploySukuk is Script {
    function run() external returns (SukukDistributor distributor) {
        SukukDistributor.Terms memory terms = SukukDistributor.Terms({
            sukukId: vm.envBytes32("SUKUK_ID"),
            faceValue: vm.envUint("FACE_VALUE"),
            maturity: uint40(vm.envUint("MATURITY")),
            minRaise: vm.envUint("MIN_RAISE"),
            minSubscription: vm.envUint("MIN_SUBSCRIPTION"),
            subscriptionPeriod: uint40(vm.envUint("SUBSCRIPTION_PERIOD")),
            issuerTreasury: vm.envAddress("ISSUER_TREASURY")
        });

        vm.startBroadcast();
        distributor = new SukukDistributor(
            IERC20(vm.envAddress("USDC")),
            ILedgerAnchor(vm.envAddress("LEDGER_ANCHOR")),
            Compliance(vm.envAddress("COMPLIANCE")),
            terms,
            vm.envString("SUKUK_NAME"),
            vm.envString("SUKUK_SYMBOL"),
            vm.envOr("ADMIN", msg.sender)
        );
        vm.stopBroadcast();

        console2.log("SUKUK_DISTRIBUTOR=%s", address(distributor));
        console2.log("SUKUK_TOKEN=%s", address(distributor.token()));
    }
}
