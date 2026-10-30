// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";

/**
 * @title ComplianceGuard
 * @notice Owns a ModularCompliance that has a SandboxModule, and is itself owned by the timelock.
 *
 *         The compliance owner can do two very different things. It can run the sandbox's day-to-day
 *         settings (mode, caps, series end) through `callModuleFunction`, which the admin screens do. It
 *         can also change the investor rules themselves: `addModule`, `removeModule`, `bindToken`,
 *         `setTokenBound`. One operator key must not be able to do the second without the timelock, so the
 *         guard splits them:
 *
 *         - the timelock (the guard's owner, two-step, no renounce) can forward ANY owner call to the
 *           compliance with `forward`;
 *         - the operator can only call `callModuleFunction(data, module)` with the same signature the
 *           compliance has, where `module` must be this guard's sandbox and the selector one of the three
 *           whitelisted settings. Nothing else is reachable, so the API only has to point at the guard
 *           instead of the compliance.
 *
 *         `setTreasury` and `setClaimIssuer` on the module move money or trust, so they stay timelock-only.
 */
contract ComplianceGuard is Ownable2Step {
    ModularCompliance public immutable compliance;
    address public immutable sandbox;
    address public operator;

    // SandboxModule setters the admin screens use: setMode(uint8), setCaps(uint256,uint256,uint256), setSeriesEnd(uint64).
    bytes4 internal constant SET_MODE = bytes4(keccak256("setMode(uint8)"));
    bytes4 internal constant SET_CAPS = bytes4(keccak256("setCaps(uint256,uint256,uint256)"));
    bytes4 internal constant SET_SERIES_END = bytes4(keccak256("setSeriesEnd(uint64)"));

    event OperatorSet(address indexed operator);
    event Forwarded(bytes4 indexed selector);

    constructor(ModularCompliance compliance_, address sandbox_, address operator_) {
        require(address(compliance_) != address(0) && sandbox_ != address(0), "ComplianceGuard: zero address");
        compliance = compliance_;
        sandbox = sandbox_;
        operator = operator_;
        emit OperatorSet(operator_);
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "ComplianceGuard: not operator");
        _;
    }

    /// @notice The operator's only door: sandbox mode, caps and series end, on this guard's sandbox.
    function callModuleFunction(bytes calldata callData, address module) external onlyOperator {
        require(module == sandbox, "ComplianceGuard: not the sandbox");
        require(callData.length >= 4, "ComplianceGuard: no selector");
        bytes4 sel = bytes4(callData[:4]);
        require(sel == SET_MODE || sel == SET_CAPS || sel == SET_SERIES_END, "ComplianceGuard: selector not allowed");
        compliance.callModuleFunction(callData, module);
    }

    /// @notice The timelock forwards any owner call to the compliance (addModule, removeModule, bindToken,
    ///         transferOwnership, any module setter, ...).
    function forward(bytes calldata data) external onlyOwner returns (bytes memory result) {
        bool ok;
        (ok, result) = address(compliance).call(data);
        if (!ok) {
            assembly {
                revert(add(result, 0x20), mload(result))
            }
        }
        emit Forwarded(data.length >= 4 ? bytes4(data[:4]) : bytes4(0));
    }

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
        emit OperatorSet(newOperator);
    }

    /// @dev Renouncing would freeze the compliance for good, so it is disabled.
    function renounceOwnership() public pure override {
        revert("ComplianceGuard: renounce disabled");
    }
}
