// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Governance: the TawfTimelock is the only upgrader. Covers its roles and delay, a UUPS upgrade through
// it, cancelling, the operator losing upgrade rights, and the T-REX batch rule: switching the
// implementation version and running a V2 initialiser must be ONE timelock batch, because the T-REX
// proxies have no upgradeAndCall and a separate initialiser call could be front-run.

import { TrexFixture } from "../trex/TrexFixture.sol";
import { ITimelock } from "../../script/UpgradeViaTimelock.s.sol";
import { TrexProxies } from "../../src/proxy/TrexProxies.sol";
import { ITREXImplementationAuthority } from
    "@erc3643org/erc-3643/contracts/proxy/authority/ITREXImplementationAuthority.sol";
import { Token } from "@erc3643org/erc-3643/contracts/token/Token.sol";
import { ModularCompliance } from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";

interface IAccess {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function PROPOSER_ROLE() external view returns (bytes32);
    function CANCELLER_ROLE() external view returns (bytes32);
    function EXECUTOR_ROLE() external view returns (bytes32);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function UPGRADER_ROLE() external view returns (bytes32);
    function isOperationPending(bytes32 id) external view returns (bool);
    function isOperationReady(bytes32 id) external view returns (bool);
    function isOperationDone(bytes32 id) external view returns (bool);
    function hashOperation(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt)
        external
        pure
        returns (bytes32);
}

interface IV2Anchor {
    function version() external view returns (uint256);
    function epochs() external view returns (uint256);
}

/// @dev A token release that needs a one-off initialiser. Anyone can call it, so it must run in the
///      same transaction as the version switch.
contract TokenWithInitV2 is Token {
    uint256 public marker;

    function initV2(uint256 m) external reinitializer(2) {
        marker = m;
    }
}

contract TimelockGovernanceTest is TrexFixture {
    uint256 internal constant DELAY = 1 hours;
    address internal safe = address(0x5AFE);
    address internal operator = address(0x0BE7A);
    address internal stranger = address(0xBAD);
    address internal attacker = address(0xBADBAD);

    address internal tl; // the TawfTimelock
    address internal anchor; // a UUPS contract behind the timelock
    Token internal token;
    ModularCompliance internal mc;

    function setUp() public {
        _setUpTrex();
        address[] memory proposers = new address[](1);
        proposers[0] = safe;
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution once the delay has passed
        tl = vm.deployCode("TawfTimelock.sol:TawfTimelock", abi.encode(DELAY, proposers, executors));

        anchor = _deployProxy(
            "LedgerAnchor.sol:LedgerAnchor", abi.encodeWithSignature("initialize(uint256,address,address)", 42, operator, tl)
        );

        (token, mc,) = _deployTrexToken("Governed Token", "tGOV", 6);
        vm.prank(deployer);
        trexIA.transferOwnership(tl); // hand-over of the T-REX authority, as the deploy script does
    }

    // ------------------------------------------------------------------
    // Roles and delay
    // ------------------------------------------------------------------

    function test_rolesAndDelay() public view {
        IAccess a = IAccess(tl);
        assertEq(ITimelock(tl).getMinDelay(), DELAY);
        assertTrue(a.hasRole(a.PROPOSER_ROLE(), safe));
        assertTrue(a.hasRole(a.CANCELLER_ROLE(), safe));
        assertTrue(a.hasRole(a.EXECUTOR_ROLE(), address(0))); // open executors
        assertFalse(a.hasRole(a.PROPOSER_ROLE(), operator));
        // No bootstrap admin: only the timelock administers itself.
        assertTrue(a.hasRole(a.DEFAULT_ADMIN_ROLE(), tl));
        assertFalse(a.hasRole(a.DEFAULT_ADMIN_ROLE(), safe));
        assertFalse(a.hasRole(a.DEFAULT_ADMIN_ROLE(), deployer));
        assertFalse(a.hasRole(a.DEFAULT_ADMIN_ROLE(), address(this)));
    }

    function test_timelockHoldsUpgradeRightsAndTheOperatorDoesNot() public view {
        IAccess c = IAccess(anchor);
        assertTrue(c.hasRole(c.UPGRADER_ROLE(), tl));
        assertFalse(c.hasRole(c.UPGRADER_ROLE(), operator));
        assertEq(trexIA.owner(), tl);
    }

    // ------------------------------------------------------------------
    // A UUPS upgrade through the timelock
    // ------------------------------------------------------------------

    function _upgradeData(address impl) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("upgradeToAndCall(address,bytes)", impl, bytes(""));
    }

    function test_uupsUpgrade_scheduleWaitExecute() public {
        address v2 = vm.deployCode("UpgradeV2Mocks.sol:LedgerAnchorV2");
        bytes memory data = _upgradeData(v2);

        // Only the proposer can schedule.
        vm.prank(operator);
        vm.expectRevert();
        ITimelock(tl).schedule(anchor, 0, data, bytes32(0), bytes32(0), DELAY);
        vm.prank(safe);
        vm.expectRevert(); // below the minimum delay
        ITimelock(tl).schedule(anchor, 0, data, bytes32(0), bytes32(0), DELAY - 1);

        vm.prank(safe);
        ITimelock(tl).schedule(anchor, 0, data, bytes32(0), bytes32(0), DELAY);

        // Not ready before the delay.
        vm.expectRevert();
        ITimelock(tl).execute(anchor, 0, data, bytes32(0), bytes32(0));

        vm.warp(block.timestamp + DELAY);
        vm.prank(stranger); // executors are open
        ITimelock(tl).execute(anchor, 0, data, bytes32(0), bytes32(0));
        assertEq(IV2Anchor(anchor).version(), 2);
    }

    function test_uupsUpgrade_proposerCanCancel() public {
        address v2 = vm.deployCode("UpgradeV2Mocks.sol:LedgerAnchorV2");
        bytes memory data = _upgradeData(v2);
        bytes32 id = IAccess(tl).hashOperation(anchor, 0, data, bytes32(0), bytes32(0));
        vm.prank(safe);
        ITimelock(tl).schedule(anchor, 0, data, bytes32(0), bytes32(0), DELAY);
        vm.prank(operator);
        vm.expectRevert();
        ITimelock(tl).cancel(id);
        vm.prank(safe);
        ITimelock(tl).cancel(id);
        vm.warp(block.timestamp + DELAY);
        vm.expectRevert();
        ITimelock(tl).execute(anchor, 0, data, bytes32(0), bytes32(0));
    }

    function test_operatorCannotUpgradeDirectly() public {
        address v2 = vm.deployCode("UpgradeV2Mocks.sol:LedgerAnchorV2");
        vm.prank(operator);
        vm.expectRevert();
        (bool ok,) = anchor.call(_upgradeData(v2));
        ok;
    }

    // ------------------------------------------------------------------
    // T-REX: the version switch and the V2 initialiser are one batch
    // ------------------------------------------------------------------

    function _v(uint8 minor) internal pure returns (ITREXImplementationAuthority.Version memory) {
        return ITREXImplementationAuthority.Version({ major: 1, minor: minor, patch: 0 });
    }

    function _v2Contracts() internal returns (ITREXImplementationAuthority.TREXContracts memory c) {
        c = TrexProxies.implementations();
        c.tokenImplementation = address(new TokenWithInitV2());
    }

    function _switchData() internal returns (bytes memory) {
        return abi.encodeWithSelector(trexIA.addAndUseTREXVersion.selector, _v(1), _v2Contracts());
    }

    /// @dev Why a batch: run as two separate steps, anyone can call the initialiser in between.
    function test_separateSteps_initialiserCanBeFrontRun() public {
        bytes memory data = _switchData(); // build first: it deploys implementations, which would eat the prank
        vm.prank(tl);
        (bool ok,) = address(trexIA).call(data);
        assertTrue(ok);
        // The gap: the new logic is live and the initialiser is still open to everyone.
        vm.prank(attacker);
        TokenWithInitV2(address(token)).initV2(666);
        assertEq(TokenWithInitV2(address(token)).marker(), 666);
        // The governance call that was meant to set it now fails for good.
        vm.prank(tl);
        vm.expectRevert();
        TokenWithInitV2(address(token)).initV2(7);
    }

    function test_batch_switchAndInitialiseAtomically() public {
        address[] memory targets = new address[](2);
        targets[0] = address(trexIA);
        targets[1] = address(token);
        uint256[] memory values = new uint256[](2);
        bytes[] memory datas = new bytes[](2);
        datas[0] = _switchData();
        datas[1] = abi.encodeCall(TokenWithInitV2.initV2, (7));

        vm.prank(safe);
        ITimelock(tl).scheduleBatch(targets, values, datas, bytes32(0), bytes32("v1.1"), DELAY);
        vm.warp(block.timestamp + DELAY);
        ITimelock(tl).executeBatch(targets, values, datas, bytes32(0), bytes32("v1.1"));

        assertEq(TokenWithInitV2(address(token)).marker(), 7);
        // Nothing was left open: nobody can run the initialiser again.
        vm.prank(attacker);
        vm.expectRevert();
        TokenWithInitV2(address(token)).initV2(666);
    }

    function test_batch_isAtomic_failedInitialiserRevertsTheSwitch() public {
        address[] memory targets = new address[](2);
        targets[0] = address(trexIA);
        targets[1] = address(token);
        uint256[] memory values = new uint256[](2);
        bytes[] memory datas = new bytes[](2);
        datas[0] = _switchData();
        datas[1] = abi.encodeWithSignature("doesNotExist()"); // reverts, so the whole batch must revert

        vm.prank(safe);
        ITimelock(tl).scheduleBatch(targets, values, datas, bytes32(0), bytes32("bad"), DELAY);
        vm.warp(block.timestamp + DELAY);
        vm.expectRevert();
        ITimelock(tl).executeBatch(targets, values, datas, bytes32(0), bytes32("bad"));

        // Still on version 1.0.0: the token has no V2 function.
        (bool ok,) = address(token).call(abi.encodeWithSignature("marker()"));
        assertFalse(ok);
    }
}
