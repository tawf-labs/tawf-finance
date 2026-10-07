// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { EvalBase } from "./EvalBase.sol";
import { DealRegistry } from "../../src/DealRegistry.sol";

/// @notice One full synthetic financing lifecycle, gas per step written to
///         ../eval/raw/gas_per_op.csv. Funding is a proxy for tranche release.
contract LifecycleEval is EvalBase {
    uint256 internal constant K = 4; // investor fundings per financing
    string internal csv = "scenario,operation,gas\n";

    function _rec(string memory scenario, string memory op) internal {
        csv = string.concat(csv, scenario, ",", op, ",", vm.toString(vm.lastCallGas().gasTotalUsed), "\n");
    }

    function test_lifecycle_gas() public {
        _deployAll();
        for (uint256 i = 0; i < 6; i++) {
            csv = string.concat(csv, "deploy,", deployNames[i], ",", vm.toString(deployGas[i]), "\n");
        }

        uint96 target = uint96(K) * TICKET;

        // 1. register
        vm.prank(originator);
        uint256 id = registry.createDeal(keccak256("synthetic-akad-1"), "Micro-Trade Segment", "BPRS Synthetic", originator, 1200, 30, MIN_INVEST, target);
        _rec("happy", "createDeal");
        // 2. approve
        vm.prank(shariah);
        registry.approveDeal(id);
        _rec("happy", "approveDeal");
        vm.prank(agent);
        registry.markMintable(id);
        _rec("happy", "markMintable");

        // 3. funding (tranche proxy)
        for (uint256 i = 0; i < K; i++) {
            address inv = _investor(i);
            vm.startPrank(inv);
            usdc.faucet(TICKET);
            usdc.approve(address(vault), TICKET);
            vault.invest(id, TICKET);
            vm.stopPrank();
            _rec("happy", i == 0 ? "invest_first" : (i == K - 1 ? "invest_last_activates" : "invest_middle"));
        }
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Active));

        // 4. repay
        uint96 total = target + _yield(target, 1200, 30);
        vm.startPrank(agent);
        usdc.faucet(total);
        usdc.approve(address(vault), total);
        vault.repay(id, total);
        vm.stopPrank();
        _rec("happy", "repay");

        // 5. redeem
        for (uint256 i = 0; i < K; i++) {
            vm.prank(_investor(i));
            vault.redeem(id);
            _rec("happy", i == K - 1 ? "redeem_last_completes" : "redeem");
        }
        assertEq(uint8(registry.getDeal(id).status), uint8(DealRegistry.DealStatus.Completed));

        // Default branch
        vm.prank(originator);
        uint256 d = registry.createDeal(keccak256("synthetic-akad-2"), "Micro-Trade Segment", "BPRS Synthetic", originator, 1200, 30, MIN_INVEST, target);
        vm.prank(shariah);
        registry.approveDeal(d);
        vm.prank(agent);
        registry.markMintable(d);
        for (uint256 i = 0; i < K; i++) _fundAs(_investor(i), d, TICKET);
        vm.prank(agent);
        registry.defaultDeal(d);
        _rec("default", "defaultDeal");
        vm.prank(_investor(0));
        vault.claimDefault(d);
        _rec("default", "claimDefault");

        vm.writeFile("../eval/raw/gas_per_op.csv", csv);
    }
}
