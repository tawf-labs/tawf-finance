// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { Script, console } from "forge-std/Script.sol";
import { DisbursementVerifier } from "../../src/prototype/DisbursementVerifier.sol";

/**
 * @title DeployVerifier (LOCAL ANVIL PROTOTYPE DEPLOY — NOT PRODUCTION)
 *
 * @notice Deploys ONLY the prototype DisbursementVerifier to a local Anvil
 *         chain and grants AGENT_ROLE / OFFICER_ROLE / SHARIAH_ROLE to three
 *         DISTINCT accounts (demonstrating role separation). This script is
 *         completely separate from the production contracts/script/Deploy.s.sol
 *         and must NEVER be pointed at a testnet or mainnet.
 *
 * @dev Reads addresses from environment variables (set by anvil_up.sh from the
 *      well-known Anvil dev accounts):
 *        ADMIN_ADDR, AGENT_ADDR, OFFICER_ADDR, SHARIAH_ADDR
 *      Broadcasts with DEPLOYER_PK (an Anvil dev key only). The admin grants
 *      each role to its distinct account.
 */
contract DeployVerifier is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address admin = vm.envAddress("ADMIN_ADDR");
        address agent = vm.envAddress("AGENT_ADDR");
        address officer = vm.envAddress("OFFICER_ADDR");
        address shariah = vm.envAddress("SHARIAH_ADDR");

        require(admin != agent && agent != officer && officer != shariah && admin != shariah, "roles must be distinct");

        vm.startBroadcast(deployerPk);
        DisbursementVerifier verifier = new DisbursementVerifier(admin);
        verifier.grantRole(verifier.AGENT_ROLE(), agent);
        verifier.grantRole(verifier.OFFICER_ROLE(), officer);
        verifier.grantRole(verifier.SHARIAH_ROLE(), shariah);
        vm.stopBroadcast();

        console.log("DisbursementVerifier (LOCAL PROTOTYPE):", address(verifier));
        console.log("admin:", admin);
        console.log("agent:", agent);
        console.log("officer:", officer);
        console.log("shariah:", shariah);
    }
}
