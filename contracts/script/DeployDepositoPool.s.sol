// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { DeployExtra } from "./DeployExtra.s.sol";
import { SandboxModule } from "../src/deposito/SandboxModule.sol";

/**
 * @notice The regional Tawf Deposito Pool (DepositoPoolLedger with three demo BPRS in Jawa Barat, series token).
 *         Internal building block of script/DeployAll.s.sol, the only supported deploy. No standalone entry point.
 */
contract DeployDepositoPool is DeployExtra {
    bytes32 internal constant POOL_SERIES_ID = keccak256("tawf.pool.jabar.1");
    /// @dev Opening balances in sen: Rp200m, Rp150m and Rp150m (Rp500m, the default series cap).
    uint256 internal constant OPEN_BDG = 20_000_000_000;
    uint256 internal constant OPEN_BGR = 15_000_000_000;
    uint256 internal constant OPEN_CRB = 15_000_000_000;



    /// @dev The pool deploy itself, without its own broadcast, so a single-broadcast orchestrator can run it.
    function _deployPool(address operator, address usdc, address usdt, address usdg, uint256 ledgerChainId)
        internal
        returns (address ledger, address token, address series, address sandbox)
    {
        ledger = _deployProxy(
            "DepositoPoolLedger.sol:DepositoPoolLedger",
            abi.encodeWithSignature(
                "initialize(uint256,bytes32,address,address)", ledgerChainId, POOL_SERIES_ID, operator, operator
            )
        );
        bytes32[] memory ids = new bytes32[](3);
        ids[0] = keccak256("bprs.demo.bandung");
        ids[1] = keccak256("bprs.demo.bogor");
        ids[2] = keccak256("bprs.demo.cirebon");
        IPoolLedger(ledger).addBank(ids[0], "BPRS Demo Bandung", "TAWF-JB-BDG");
        IPoolLedger(ledger).addBank(ids[1], "BPRS Demo Bogor", "TAWF-JB-BGR");
        IPoolLedger(ledger).addBank(ids[2], "BPRS Demo Cirebon", "TAWF-JB-CRB");

        (token, series, sandbox) = _deployTawfSeries(
            operator, usdc, usdt, ledger, POOL_SERIES_ID, "Tawf Deposito Pool: Jawa Barat", "tDEP-JABAR-1"
        );

        // mUSDG as a third settlement coin, at the USDC demo rate.
        IPoolSeries(series).addStablecoin(usdg);
        IPoolSeries(series).postRate(usdg, FX_INITIAL_RATE_USDC);
        if (_treasury(operator) == operator) IPoolApprove(usdg).approve(series, type(uint256).max);

        // Same admission as series 1: wallets with a Tawf screening claim.
        address compliance = IPoolToken(token).compliance();
        IPoolCompliance(compliance).callModuleFunction(
            abi.encodeWithSelector(SandboxModule.setMode.selector, SandboxModule.Mode.SCREENED_GROUP), sandbox
        );
        // Room above the opening balances: series cap Rp1bn (sen), other caps unchanged.
        IPoolCompliance(compliance).callModuleFunction(
            abi.encodeWithSelector(SandboxModule.setCaps.selector, uint256(0), uint256(0), uint256(100_000_000_000)), sandbox
        );

        uint256[] memory balances = new uint256[](3);
        balances[0] = OPEN_BDG;
        balances[1] = OPEN_BGR;
        balances[2] = OPEN_CRB;
        IPoolLedger(ledger).postReserve(uint64(block.timestamp), ids, balances);
    }

    function _writePool(address ledger, address token, address series, address sandbox) internal {
        vm.writeJson(vm.toString(series), PATH, ".depositoPool");
        vm.writeJson(vm.toString(token), PATH, ".depositoPoolToken");
        vm.writeJson(vm.toString(sandbox), PATH, ".depositoPoolSandbox");
        vm.writeJson(vm.toString(ledger), PATH, ".depositoPoolLedger");
        vm.writeJson(vm.toString(POOL_SERIES_ID), PATH, ".depositoPoolId");
    }
}

interface IPoolLedger {
    function addBank(bytes32 bankId, string calldata name, string calldata accountRef) external;
    function postReserve(uint64 at, bytes32[] calldata bankIds, uint256[] calldata balances) external returns (uint256);
}

interface IPoolSeries {
    function addStablecoin(address token) external;
    function postRate(address token, uint256 idrPerToken) external;
}

interface IPoolApprove {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPoolToken {
    function compliance() external view returns (address);
}

interface IPoolCompliance {
    function callModuleFunction(bytes calldata callData, address module) external;
}
