// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { ModuleProxies } from "../src/proxy/ModuleProxies.sol";
import { TrexProxies } from "../src/proxy/TrexProxies.sol";
import { DeployExtra } from "./DeployExtra.s.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { DistributionCheckpointModule } from "../src/sukuk/DistributionCheckpointModule.sol";
import { IBalanceCheckpoint } from "../src/sukuk/IBalanceCheckpoint.sol";
import { ScfInvestorLimitModule } from "../src/scf/ScfInvestorLimitModule.sol";
import { LedgerLeaf } from "../src/lib/LedgerLeaf.sol";

/**
 * @notice The multi-coin SCF offering (anchor, limit module, token with its compliance, checkpoint module,
 *         SukukDistributor) and opening it. Internal building block of script/DeployAll.s.sol, the only supported
 *         deploy. No standalone entry point.
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



    function _writeScf(Scf memory s) internal {
        vm.writeJson(vm.toString(s.anchor), PATH, ".scfAnchor");
        vm.writeJson(vm.toString(s.limitModule), PATH, ".scfLimitModule");
        vm.writeJson(vm.toString(s.token), PATH, ".scfToken");
        vm.writeJson(vm.toString(s.compliance), PATH, ".scfCompliance");
        vm.writeJson(vm.toString(s.distributor), PATH, ".scfDistributor");
        vm.writeJson(vm.toString(SCF_ID), PATH, ".scfId");
        vm.writeJson(vm.toString(uint256(s.maturity)), PATH, ".scfMaturity");
    }

    address[] internal _coinList;

    /// @dev Keep the previous offering under the V1 keys, once.


    function _deployScf(address operator, uint256 ledgerChainId) internal returns (Scf memory s) {
        s.face = vm.envOr("SCF_FACE", uint256(50_000e6));
        s.maturity = uint40(vm.envOr("SCF_MATURITY", block.timestamp + 365 days));

        s.anchor = _deployProxy(
            "LedgerAnchor.sol:LedgerAnchor",
            abi.encodeWithSignature("initialize(uint256,address,address)", ledgerChainId, operator, operator)
        );

        ScfInvestorLimitModule limit = _newScfLimit(_sharedIdentityRegistry);
        s.limitModule = address(limit);

        ModularCompliance mc = TrexProxies.modularCompliance(_authority());
        Token token = TrexProxies.token(
            _authority(), _sharedIdentityRegistry, address(mc), "Sukuk Mudharabah UMKM SCF Demo 2026", "tSCF-UMKM-2026", 6, address(0)
        );
        _ownToken(address(token));
        _ownCompliance(address(mc), false);
        _ownModule(address(limit));
        s.token = address(token);
        s.compliance = address(mc);

        DistributionCheckpointModule checkpoint = _newCheckpoint();
        _ownModule(address(checkpoint));
        s.distributor = _deployProxy(
            "SukukDistributor.sol:SukukDistributor",
            abi.encodePacked(
                DIST_INIT,
                abi.encode(
                    _coinList,
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
