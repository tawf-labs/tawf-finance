// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { EvalBase } from "./EvalBase.sol";
import { DealRegistry } from "../../src/DealRegistry.sol";
import { Compliance } from "../../src/Compliance.sol";

/// @notice Adversarial scenarios against the deployed contracts. Each row is
///         attack, expected (blocked or allowed), observed, mechanism. Rows
///         expected "allowed" document known gaps and count as a match when
///         the gap is confirmed, they are not security passes.
contract AdversarialEval is EvalBase {

    string internal constant OUT = "../eval/raw/adversarial.csv";

    function _row(string memory attack, address target, bool expectBlocked, bool ok, bytes memory ret) internal {
        // State reverts wipe storage, so the counter lives in the environment and rows go straight to disk.
        uint256 id = vm.envOr("EVAL_ADV_N", uint256(0)) + 1;
        vm.setEnv("EVAL_ADV_N", vm.toString(id));
        bool match_ = (expectBlocked == !ok);
        if (!match_) vm.setEnv("EVAL_ADV_MISMATCH", vm.toString(vm.envOr("EVAL_ADV_MISMATCH", uint256(0)) + 1));
        string memory mech = ok ? "none (no on-chain check)" : _selectorName(bytes4(ret));
        vm.writeLine(
            OUT,
            string.concat(
                vm.toString(id), ",\"", attack, "\",", _label(target), ",", expectBlocked ? "blocked" : "allowed (known gap)", ",", ok ? "allowed" : "blocked", ",", match_ ? "yes" : "NO", ",", mech
            )
        );
    }

    function _label(address a) internal view returns (string memory) {
        if (a == address(registry)) return "DealRegistry";
        if (a == address(vault)) return "RedemptionVault";
        if (a == address(nft)) return "BondReceiptNFT";
        if (a == address(compliance)) return "Compliance";
        return "other";
    }

    function _try(string memory attack, bool expectBlocked, address caller, address target, bytes memory data) internal {
        uint256 snap = vm.snapshotState();
        vm.prank(caller);
        (bool ok, bytes memory ret) = target.call(data);
        _row(attack, target, expectBlocked, ok, ret);
        vm.revertToState(snap);
    }

    /// @dev Drives a deal to the given stage. 0 Submitted, 1 Approved, 2 Mintable, 3 Active.
    function _deal(uint256 stage) internal returns (uint256 id) {
        id = _newDeal(keccak256(abi.encode("deal", stage)), 2 * TICKET);
        if (stage >= 1) {
            vm.prank(shariah);
            registry.approveDeal(id);
        }
        if (stage >= 2) {
            vm.prank(agent);
            registry.markMintable(id);
        }
        if (stage >= 3) {
            _fundAs(_investor(0), id, TICKET);
            _fundAs(_investor(1), id, TICKET);
        }
    }

    function test_adversarial() public {
        vm.setEnv("EVAL_ADV_N", "0");
        vm.setEnv("EVAL_ADV_MISMATCH", "0");
        vm.writeFile(OUT, "id,attack,target,expected,observed,match,enforcing_mechanism\n");
        _deployAll();
        bytes32 ADM = 0x00;

        // Role bypass and agent key misuse
        uint256 d0 = _deal(0);
        _try("BPRS officer approves own deal (skips Sharia board)", true, originator, address(registry), abi.encodeCall(registry.approveDeal, (d0)));
        _try("AI agent key approves deal (Sharia action)", true, agent, address(registry), abi.encodeCall(registry.approveDeal, (d0)));
        _try("AI agent key registers a financing", true, agent, address(registry), abi.encodeCall(registry.createDeal, (keccak256("x"), "a", "b", agent, 1200, 30, MIN_INVEST, TICKET)));
        _try("Stranger registers a financing", true, stranger, address(registry), abi.encodeCall(registry.createDeal, (keccak256("x"), "a", "b", stranger, 1200, 30, MIN_INVEST, TICKET)));
        _try("Sharia board marks mintable (ops action)", true, shariah, address(registry), abi.encodeCall(registry.markMintable, (d0)));

        // State machine
        _try("Mark mintable before Sharia approval", true, agent, address(registry), abi.encodeCall(registry.markMintable, (d0)));
        uint256 d1 = _deal(1);
        _try("Approve an already approved deal", true, shariah, address(registry), abi.encodeCall(registry.approveDeal, (d1)));
        _try("Invest before deal is Mintable", true, _investor(5), address(vault), abi.encodeCall(vault.invest, (d1, TICKET)));
        uint256 d2 = _deal(2);
        _try("Repay with no funding (release without verification proxy)", true, agent, address(vault), abi.encodeCall(vault.repay, (d2, TICKET)));
        _try("Stranger forces early maturity", true, stranger, address(registry), abi.encodeCall(registry.markMatured, (d2)));

        // Repayment integrity (the highest-risk function)
        uint256 d3 = _deal(3);
        _try("Stranger calls repay", true, stranger, address(vault), abi.encodeCall(vault.repay, (d3, 2 * TICKET)));
        _try("Agent repays below principal", true, agent, address(vault), abi.encodeCall(vault.repay, (d3, TICKET)));
        // Agent repays exactly principal, zero yield, no proof of collection.
        vm.prank(agent);
        usdc.faucet(0);
        _try("Agent key matures pool at zero yield with no collection proof", false, agent, address(vault), abi.encodeCall(vault.repay, (d3, 2 * TICKET)));
        // Agent claims inflated repayment funded by itself, still no check against real collection.
        vm.startPrank(agent);
        usdc.faucet(1_000_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        _try("Agent key reports arbitrary repayment amount (no oracle)", false, agent, address(vault), abi.encodeCall(vault.repay, (d3, 3 * TICKET)));
        _try("Agent key defaults any Active pool unilaterally", false, agent, address(registry), abi.encodeCall(registry.defaultDeal, (d3)));
        _try("Stranger defaults an Active pool", true, stranger, address(registry), abi.encodeCall(registry.defaultDeal, (d3)));

        // Evidence hash reuse (invoiceHash is the only evidence anchor)
        uint256 snap = vm.snapshotState();
        bytes32 h = keccak256("reused-akad");
        _newDeal(h, TICKET);
        vm.prank(originator);
        (bool ok, bytes memory ret) = address(registry).call(abi.encodeCall(registry.createDeal, (h, "a", "b", originator, 1200, 30, MIN_INVEST, TICKET)));
        _row("Reuse the same document hash for a second financing", address(registry), false, ok, ret);
        vm.revertToState(snap);

        // Single-key collusion
        snap = vm.snapshotState();
        vm.startPrank(admin);
        registry.grantRole(registry.ORIGINATOR_ROLE(), admin);
        registry.grantRole(registry.SHARIAH_ROLE(), admin);
        registry.grantRole(registry.OPS_ROLE(), admin);
        vm.stopPrank();
        vm.startPrank(admin);
        bool allOk = true;
        (ok, ret) = address(registry).call(abi.encodeCall(registry.createDeal, (keccak256("solo"), "a", "b", admin, 1200, 30, MIN_INVEST, TICKET)));
        allOk = allOk && ok;
        uint256 solo = registry.dealCount();
        (ok, ret) = address(registry).call(abi.encodeCall(registry.approveDeal, (solo)));
        allOk = allOk && ok;
        (ok, ret) = address(registry).call(abi.encodeCall(registry.markMintable, (solo)));
        allOk = allOk && ok;
        vm.stopPrank();
        _row("One key holding officer, Sharia and ops roles passes all gates", address(registry), false, allOk, "");
        vm.revertToState(snap);
        // Same collusion with only officer + agent keys colluding (two of three roles)
        _try("Officer and agent colluding cannot approve without Sharia key", true, agent, address(registry), abi.encodeCall(registry.approveDeal, (d0)));

        // Governance
        _try("Non-admin grants itself Sharia role", true, stranger, address(registry), abi.encodeCall(registry.grantRole, (registry.SHARIAH_ROLE(), stranger)));
        _try("Agent grants itself admin role", true, agent, address(registry), abi.encodeCall(registry.grantRole, (ADM, agent)));
        _try("Non-admin repoints registry vault", true, stranger, address(registry), abi.encodeCall(registry.setVault, (stranger)));
        _try("Admin re-configures vault after go-live", true, admin, address(vault), abi.encodeCall(vault.configure, (usdc, registry, nft)));
        _try("Non-admin sets transfer policy", true, stranger, address(compliance), abi.encodeCall(compliance.setPolicy, (address(nft), d3, Compliance.TransferPolicy.Transferable)));
        _try("Direct fundDeal call bypassing vault", true, stranger, address(registry), abi.encodeCall(registry.fundDeal, (d2, stranger, TICKET)));
        _try("Direct receipt mint bypassing vault", true, stranger, address(nft), abi.encodeWithSignature("mint(address,uint256,uint96,uint96,uint32,string,string)", stranger, d2, uint96(TICKET), uint96(1200), uint32(30), "a", "b"));
        _try("Stranger completes a deal", true, stranger, address(registry), abi.encodeCall(registry.completeDeal, (d3)));

        // Redemption
        _try("Redeem before maturity", true, _investor(0), address(vault), abi.encodeCall(vault.redeem, (d3)));
        _try("Claim default on a non-defaulted deal", true, _investor(0), address(vault), abi.encodeCall(vault.claimDefault, (d3)));
        vm.startPrank(agent);
        vault.repay(d3, 2 * TICKET);
        vm.stopPrank();
        _try("Non-investor redeems", true, stranger, address(vault), abi.encodeCall(vault.redeem, (d3)));
        vm.prank(_investor(0));
        vault.redeem(d3);
        _try("Double redeem", true, _investor(0), address(vault), abi.encodeCall(vault.redeem, (d3)));
        _try("Transfer soulbound receipt to another wallet", true, _investor(1), address(nft), abi.encodeWithSignature("safeTransferFrom(address,address,uint256,uint256,bytes)", _investor(1), stranger, d3, uint256(1), ""));

        emit log_named_uint("scenarios", vm.envUint("EVAL_ADV_N"));
        emit log_named_uint("mismatches", vm.envUint("EVAL_ADV_MISMATCH"));
    }
}
