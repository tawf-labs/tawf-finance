// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import "forge-std/Script.sol";

interface ITimelock {
    function schedule(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt, uint256 delay)
        external;
    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external;
    function execute(address target, uint256 value, bytes calldata payload, bytes32 predecessor, bytes32 salt) external payable;
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) external payable;
    function cancel(bytes32 id) external;
    function getMinDelay() external view returns (uint256);
    function hashOperationBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) external pure returns (bytes32);
}

/**
 * @title UpgradeViaTimelock
 * @notice Queue and execute an upgrade through the TawfTimelock. Nothing else can upgrade a Tawf
 *         contract. Run with the proposer key (the Safe's signer flow, or the operator key on testnet)
 *         for `schedule*`, and with any key for `execute*` once the delay has passed (executors are open).
 *
 *  BEFORE you schedule an upgrade, run `./script/storage-layout.sh` from contracts/. It must pass, which
 *  proves the new implementation only appends storage. It must also pass before a rollback, because a
 *  rollback is just another upgrade to an older implementation and a layout that moved forward cannot
 *  always move back.
 *
 *  UUPS contracts (our contracts):
 *      TIMELOCK=0x.. PROXY=0x.. NEW_IMPL=0x.. [INIT_DATA=0x..] [SALT=0x..] \
 *        forge script script/UpgradeViaTimelock.s.sol:UpgradeViaTimelock --sig "scheduleUups()" --broadcast
 *      ... --sig "executeUups()" --broadcast
 *    `upgradeToAndCall(impl, INIT_DATA)` upgrades and initialises in one call, so a V2 initialiser
 *    (`reinitializer(2)`) cannot be front-run.
 *
 *  T-REX contracts (token, registries, compliance) sit behind the TREXImplementationAuthority. Their
 *  proxies have NO upgradeAndCall, so switching the version and then calling a V2 initialiser would
 *  leave a gap in which anyone can call that initialiser first. Always run both as ONE batch:
 *      TIMELOCK=0x.. TARGETS=0xAUTH,0xTOKEN DATAS=0x<useTREXVersion or addAndUseTREXVersion>,0x<initV2> \
 *        forge script ... --sig "scheduleBatch()" --broadcast
 *      ... --sig "executeBatch()" --broadcast
 *    The batch is atomic: if the initialiser reverts, the version switch reverts with it.
 */
contract UpgradeViaTimelock is Script {
    function _salt() internal view returns (bytes32) {
        return vm.envOr("SALT", bytes32(0));
    }

    function scheduleUups() external {
        ITimelock t = ITimelock(vm.envAddress("TIMELOCK"));
        address proxy = vm.envAddress("PROXY");
        bytes memory data = abi.encodeWithSignature(
            "upgradeToAndCall(address,bytes)", vm.envAddress("NEW_IMPL"), vm.envOr("INIT_DATA", bytes(""))
        );
        vm.startBroadcast();
        t.schedule(proxy, 0, data, bytes32(0), _salt(), t.getMinDelay());
        vm.stopBroadcast();
    }

    function executeUups() external {
        address proxy = vm.envAddress("PROXY");
        bytes memory data = abi.encodeWithSignature(
            "upgradeToAndCall(address,bytes)", vm.envAddress("NEW_IMPL"), vm.envOr("INIT_DATA", bytes(""))
        );
        vm.startBroadcast();
        ITimelock(vm.envAddress("TIMELOCK")).execute(proxy, 0, data, bytes32(0), _salt());
        vm.stopBroadcast();
    }

    function _batch() internal view returns (address[] memory targets, uint256[] memory values, bytes[] memory datas) {
        targets = vm.envAddress("TARGETS", ",");
        datas = vm.envBytes("DATAS", ",");
        require(targets.length == datas.length && targets.length != 0, "TARGETS and DATAS must match");
        values = new uint256[](targets.length);
    }

    function scheduleBatch() external {
        ITimelock t = ITimelock(vm.envAddress("TIMELOCK"));
        (address[] memory targets, uint256[] memory values, bytes[] memory datas) = _batch();
        vm.startBroadcast();
        t.scheduleBatch(targets, values, datas, bytes32(0), _salt(), t.getMinDelay());
        vm.stopBroadcast();
    }

    function executeBatch() external {
        (address[] memory targets, uint256[] memory values, bytes[] memory datas) = _batch();
        vm.startBroadcast();
        ITimelock(vm.envAddress("TIMELOCK")).executeBatch(targets, values, datas, bytes32(0), _salt());
        vm.stopBroadcast();
    }
}
