// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// NOTE: This script imports the T-REX and onchain-id concrete contracts, which are pinned to
// `pragma solidity 0.8.17`. Therefore this file is pinned to 0.8.17. It reaches the
// SukukDistributor (`^0.8.20`) only through vm.deployCode and a minimal interface, never via a
// direct import of its 0.8.20 source. The DistributionCheckpointModule is itself 0.8.17 so it is
// imported directly.
//
// Purpose: deploy ONE sukuk series as a T-REX Token against an already-deployed shared T-REX
// identity suite (addresses from env) and an existing LedgerAnchor. For the full demo suite
// (identity + deposito + sukuk, written to deployments JSON), use DeployTokenization.s.sol.

import "forge-std/Script.sol";

import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {DistributionCheckpointModule} from "../src/sukuk/DistributionCheckpointModule.sol";
import {IBalanceCheckpoint} from "../src/sukuk/IBalanceCheckpoint.sol";

/**
 * @notice Deploy one sukuk series on ERC-3643: a T-REX Token with its own ModularCompliance and a
 *         DistributionCheckpointModule bound to a freshly deployed SukukDistributor.
 *
 * @dev Usage:
 *      forge script script/DeploySukuk.s.sol:DeploySukuk --rpc-url arbitrum_sepolia \
 *          --private-key $PRIVATE_KEY --broadcast
 *
 *      Environment:
 *        USDC, LEDGER_ANCHOR, IDENTITY_REGISTRY   deployed addresses
 *        SUKUK_ID                                 bytes32 id in the Tawf Network SukukLedger
 *        FACE_VALUE, MATURITY                     must equal the ledger record exactly
 *        MIN_RAISE, MIN_SUBSCRIPTION              USDC base units
 *        SUBSCRIPTION_PERIOD                      seconds
 *        ISSUER_TREASURY                          the bank's receiving wallet
 *        SUKUK_NAME, SUKUK_SYMBOL                 token metadata
 *
 *      The operator (broadcaster) is the token owner/agent, the distributor is a token agent, and
 *      the module is bound to the token's compliance with the distributor as its hook.
 */
contract DeploySukuk is Script {
    function run() external {
        address usdc = vm.envAddress("USDC");
        address anchor = vm.envAddress("LEDGER_ANCHOR");
        address identityRegistry = vm.envAddress("IDENTITY_REGISTRY");
        address operator = msg.sender;

        vm.startBroadcast();

        // 1. Series compliance + token (starts paused per T-REX init, zero onchainID, 6 decimals).
        ModularCompliance mc = new ModularCompliance();
        mc.init();
        Token token = new Token();
        token.init(identityRegistry, address(mc), vm.envString("SUKUK_NAME"), vm.envString("SUKUK_SYMBOL"), 6, address(0));

        // 2. Checkpoint module (operator is its deployer/owner so it can set the hook).
        DistributionCheckpointModule module = new DistributionCheckpointModule();

        // 3. SukukDistributor via deployCode (0.8.20 unit). The Terms struct has only static
        //    members, so its ABI encoding is byte-identical to the flattened field encoding.
        address distributor = deployCode(
            "SukukDistributor.sol:SukukDistributor",
            abi.encode(
                _singleCoin(usdc),
                anchor,
                identityRegistry,
                address(token),
                address(module),
                // Terms { sukukId, faceValue, maturity, minRaise, minSubscription, subscriptionPeriod, issuerTreasury }
                vm.envBytes32("SUKUK_ID"),
                vm.envUint("FACE_VALUE"),
                uint40(vm.envUint("MATURITY")),
                vm.envUint("MIN_RAISE"),
                vm.envUint("MIN_SUBSCRIPTION"),
                uint40(vm.envUint("SUBSCRIPTION_PERIOD")),
                vm.envAddress("ISSUER_TREASURY"),
                operator
            )
        );

        // 4. Point the module at the distributor for this compliance, then bind it.
        module.setHook(address(mc), IBalanceCheckpoint(distributor));
        mc.addModule(address(module));

        // 5. Distributor is the token mint/burn agent; operator keeps pause/freeze; unpause.
        token.addAgent(distributor);
        token.addAgent(operator);
        token.unpause();

        vm.stopBroadcast();

        console.log("SUKUK_DISTRIBUTOR=%s", distributor);
        console.log("SUKUK_TOKEN=%s", address(token));
        console.log("SUKUK_COMPLIANCE=%s", address(mc));
        console.log("SUKUK_MODULE=%s", address(module));
    }

    /// @dev The distributor takes a coin list. These scripts keep the single-coin setup.
    function _singleCoin(address c) internal pure returns (address[] memory a) {
        a = new address[](1);
        a[0] = c;
    }
}
