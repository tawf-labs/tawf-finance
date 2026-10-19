// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { EvalBase } from "./EvalBase.sol";

/// @notice Scale runs: N financings, 3 to 5 fundings each (tranche proxy),
///         full lifecycle through redemption. Gas is summed from
///         vm.lastCallGas per top-level call (isolate mode, one tx per call).
contract ScaleEval is EvalBase {
    uint256 internal constant SEED = 20260101;
    string internal constant OUT = "../eval/raw/scale.csv";

    uint256 internal g;
    uint256 internal gCreate;
    uint256 internal gFund;
    uint256 internal gRepay;
    uint256 internal gRedeem;
    uint256 internal txs;

    function _acc() internal view returns (uint256) {
        return vm.lastCallGas().gasTotalUsed;
    }

    function _run(uint256 count) internal {
        _deployAll();
        delete gCreate;
        delete gFund;
        delete gRepay;
        delete gRedeem;
        delete txs;
        uint256 fundings;

        // Investors are pre-funded once, outside the measured calls.
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(_investor(i));
            usdc.faucet(type(uint96).max);
            usdc.approve(address(vault), type(uint256).max);
            vm.stopPrank();
        }
        vm.startPrank(agent);
        usdc.faucet(type(uint96).max);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        for (uint256 d = 0; d < count; d++) {
            uint256 k = 3 + (uint256(keccak256(abi.encode(SEED, d))) % 3); // 3..5
            uint96 target = uint96(k) * TICKET;

            vm.prank(originator);
            uint256 id = registry.createDeal(keccak256(abi.encode("fin", d)), "Micro-Trade Segment", "BPRS Synthetic", originator, 1200, 30, MIN_INVEST, target);
            gCreate += _acc();
            vm.prank(shariah);
            registry.approveDeal(id);
            gCreate += _acc();
            vm.prank(agent);
            registry.markMintable(id);
            gCreate += _acc();
            txs += 3;

            for (uint256 i = 0; i < k; i++) {
                vm.prank(_investor(i));
                vault.invest(id, TICKET);
                gFund += _acc();
            }
            fundings += k;

            vm.prank(agent);
            vault.repay(id, target + _yield(target, 1200, 30));
            gRepay += _acc();

            for (uint256 i = 0; i < k; i++) {
                vm.prank(_investor(i));
                vault.redeem(id);
                gRedeem += _acc();
            }
            txs += 2 * k + 1;
        }

        uint256 total = gCreate + gFund + gRepay + gRedeem;
        string memory row = string.concat(
            vm.toString(count), ",", vm.toString(fundings), ",", vm.toString(txs), ",", vm.toString(total), ",", vm.toString(total / count), ","
        );
        row = string.concat(row, vm.toString(gCreate / count), ",", vm.toString(gFund / count), ",", vm.toString(gRepay / count), ",", vm.toString(gRedeem / count));
        vm.writeLine(OUT, row);
    }

    function test_scale() public {
        vm.writeFile(OUT, "financings,fundings,txs,total_gas,gas_per_financing,register_approve_gas,fund_gas,repay_gas,redeem_gas\n");
        _run(100);
        _run(1000);
    }
}
