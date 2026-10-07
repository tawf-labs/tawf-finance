// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console } from "forge-std/Script.sol";
import { DisbursementVerifier } from "../../src/prototype/DisbursementVerifier.sol";

/**
 * @title DeployVerifierSepolia (PUBLIC TESTNET — ETHEREUM SEPOLIA ONLY)
 *
 * @notice Deploys the prototype DisbursementVerifier to Ethereum Sepolia for a
 *         single-key integration run that produces real testnet tx hashes and
 *         gas figures for the disbursement-verification layer.
 *
 *         This is a DELIBERATE, user-authorised testnet deploy. It is kept
 *         SEPARATE from the local-only DeployVerifier.s.sol so that the
 *         local-Anvil prototype path remains local-only by default. It is a
 *         synthetic prototype of the chapter's future-work layer and is NOT a
 *         production or audited deployment.
 *
 * @dev Single-key posture: all four roles (admin, agent, officer, shariah) are
 *      granted to the broadcasting account. Like the chapter's existing
 *      single-key Sepolia run, this therefore says NOTHING about role
 *      separation; it only exercises the function paths and measures gas on a
 *      public network. Broadcasts with PRIVATE_KEY (a funded burner).
 */
contract DeployVerifierSepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);

        vm.startBroadcast(pk);
        DisbursementVerifier verifier = new DisbursementVerifier(me);
        // Single-key testnet posture: grant every role to the deployer.
        verifier.grantRole(verifier.AGENT_ROLE(), me);
        verifier.grantRole(verifier.OFFICER_ROLE(), me);
        verifier.grantRole(verifier.SHARIAH_ROLE(), me);
        vm.stopBroadcast();

        console.log("DisbursementVerifier (SEPOLIA PROTOTYPE):", address(verifier));
        console.log("deployer / all roles (single-key):", me);
    }
}
