// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { DeployExtra } from "./DeployExtra.s.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { DistributionCheckpointModule } from "../src/sukuk/DistributionCheckpointModule.sol";
import { IBalanceCheckpoint } from "../src/sukuk/IBalanceCheckpoint.sol";
import { ScfInvestorLimitModule } from "../src/scf/ScfInvestorLimitModule.sol";
import { LedgerLeaf } from "../src/lib/LedgerLeaf.sol";

/**
 * @notice Deploy one securities crowdfunding (SCF, "Layanan Urun Dana") sharia sukuk offering
 *         next to the live demo, reusing the shared identity registry and mUSDC recorded in
 *         tokenization.deployments.json.
 *
 * @dev What it deploys and wires, all owned by the broadcaster (the operator):
 *        - an operator-gated LedgerAnchor for this offering's facts (single-leaf roots, so every
 *          proof is empty)
 *        - the ScfInvestorLimitModule (POJK 57/2020 investor limit and offering cap)
 *        - a T-REX token with its own compliance, a DistributionCheckpointModule and a
 *          SukukDistributor (issuer treasury = operator, standing in for the SME issuer)
 *      It then anchors the approval and reserve facts and opens the subscription, so the offering
 *      is live straight after the deploy. Writes the scf* keys and leaves every other key.
 *
 *      PRIVATE_KEY=.. forge script script/DeployScf.s.sol:DeployScf --sig "runScf()" \
 *          --rpc-url arbitrum_sepolia --broadcast
 *      Optional: SCF_FACE (default 50,000 USDC), SCF_MATURITY (default now + 365 days),
 *      SCF_MIN_RAISE (500 USDC), SCF_MIN_SUBSCRIPTION (10 USDC), SCF_SUBSCRIPTION_PERIOD (30 days).
 */
contract DeployScf is DeployExtra {
    bytes32 internal constant SCF_ID = keccak256("tawf.scf.umkm.1");

    struct Scf {
        address anchor;
        address limitModule;
        address token;
        address compliance;
        address distributor;
        uint40 maturity;
        uint256 face;
    }

    function runScf() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(key);
        _loadShared();
        uint256 ledgerChainId = vm.parseJsonUint(vm.readFile(PATH), ".ledgerChainId");

        vm.startBroadcast(key);
        Scf memory s = _deployScf(operator, ledgerChainId);
        _open(s, ledgerChainId);
        vm.stopBroadcast();

        vm.writeJson(vm.toString(s.anchor), PATH, ".scfAnchor");
        vm.writeJson(vm.toString(s.limitModule), PATH, ".scfLimitModule");
        vm.writeJson(vm.toString(s.token), PATH, ".scfToken");
        vm.writeJson(vm.toString(s.compliance), PATH, ".scfCompliance");
        vm.writeJson(vm.toString(s.distributor), PATH, ".scfDistributor");
        vm.writeJson(vm.toString(SCF_ID), PATH, ".scfId");
        vm.writeJson(vm.toString(uint256(s.maturity)), PATH, ".scfMaturity");
    }

    function _deployScf(address operator, uint256 ledgerChainId) internal returns (Scf memory s) {
        s.face = vm.envOr("SCF_FACE", uint256(50_000e6));
        s.maturity = uint40(vm.envOr("SCF_MATURITY", block.timestamp + 365 days));

        s.anchor = deployCode("LedgerAnchor.sol:LedgerAnchor", abi.encode(ledgerChainId, operator));

        ScfInvestorLimitModule limit = new ScfInvestorLimitModule(_sharedIdentityRegistry);
        limit.setAgent(operator, true);
        s.limitModule = address(limit);

        ModularCompliance mc = new ModularCompliance();
        mc.init();
        Token token = new Token();
        token.init(
            _sharedIdentityRegistry, address(mc), "Sukuk Mudharabah UMKM SCF Demo 2026", "tSCF-UMKM-2026", 6, address(0)
        );
        s.token = address(token);
        s.compliance = address(mc);

        DistributionCheckpointModule checkpoint = new DistributionCheckpointModule();
        s.distributor = deployCode(
            "SukukDistributor.sol:SukukDistributor",
            abi.encode(
                _sukukUsdc,
                s.anchor,
                _sharedIdentityRegistry,
                address(token),
                address(checkpoint),
                // Terms { sukukId, faceValue, maturity, minRaise, minSubscription, subscriptionPeriod, issuerTreasury }
                SCF_ID,
                s.face,
                s.maturity,
                vm.envOr("SCF_MIN_RAISE", uint256(500e6)),
                vm.envOr("SCF_MIN_SUBSCRIPTION", uint256(10e6)),
                uint40(vm.envOr("SCF_SUBSCRIPTION_PERIOD", uint256(30 days))),
                operator,
                operator
            )
        );

        limit.initOffering(address(mc), operator, s.face);
        mc.addModule(address(limit));
        checkpoint.setHook(address(mc), IBalanceCheckpoint(s.distributor));
        mc.addModule(address(checkpoint));
        token.addAgent(s.distributor);
        token.addAgent(operator);
        token.unpause();
        IScfDistributor(s.distributor).setMaxReserveAge(45 days);
    }

    /// @dev Anchor the approval and the reserve as single-leaf roots, then open the sale.
    function _open(Scf memory s, uint256 ledgerChainId) internal {
        bytes32[] memory noProof;
        uint256 epoch = IScfAnchor(s.anchor).push(
            LedgerLeaf.hash(ledgerChainId, LedgerLeaf.SUKUK_APPROVED, SCF_ID, s.face, s.maturity)
        );
        IScfDistributor(s.distributor).openSubscription(epoch, noProof);

        uint64 at = uint64(block.timestamp);
        epoch = IScfAnchor(s.anchor).push(LedgerLeaf.hash(ledgerChainId, LedgerLeaf.SUKUK_RESERVE, SCF_ID, at, s.face));
        IScfDistributor(s.distributor).updateReserve(at, s.face, epoch, noProof);
    }
}

interface IScfAnchor {
    function push(bytes32 root) external returns (uint256 epoch);
}

interface IScfDistributor {
    function openSubscription(uint256 epoch, bytes32[] calldata proof) external;
    function updateReserve(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] calldata proof) external;
    function setMaxReserveAge(uint64 maxAge) external;
}
