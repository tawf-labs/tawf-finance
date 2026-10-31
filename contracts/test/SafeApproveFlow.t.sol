// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

// The on-chain approval flow the admin UI uses, against the REAL canonical Safe v1.4.1 contracts on a fork
// of Arbitrum Sepolia (there is no hosted Safe service there): propose = compute getTransactionHash, owners
// approve with approveHash, anyone executes with execTransaction and approved-hash signatures
// (r = owner, s = 0, v = 1, sorted by owner). Needs the network; set SKIP_FORK_TESTS=true to skip.

import "forge-std/Test.sol";

interface ISafe {
    function setup(
        address[] calldata owners, uint256 threshold, address to, bytes calldata data,
        address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver
    ) external;
    function nonce() external view returns (uint256);
    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
    function domainSeparator() external view returns (bytes32);
    function approvedHashes(address owner, bytes32 hash) external view returns (uint256);
    function approveHash(bytes32 hashToApprove) external;
    function getTransactionHash(
        address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas,
        uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce
    ) external view returns (bytes32);
    function execTransaction(
        address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas,
        uint256 gasPrice, address gasToken, address payable refundReceiver, bytes memory signatures
    ) external payable returns (bool success);
}

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce) external returns (address);
}

/// @dev Something the Safe can call, owned by the Safe like a beacon would be.
contract SafeTarget {
    address public owner;
    uint256 public value;

    constructor(address owner_) {
        owner = owner_;
    }

    function set(uint256 v) external {
        require(msg.sender == owner, "not owner");
        value = v;
    }
}

contract SafeApproveFlowTest is Test {
    address internal constant FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address internal constant SAFE_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    bytes32 internal constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;

    ISafe internal safe;
    SafeTarget internal target;
    address[3] internal owners;
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        if (vm.envOr("SKIP_FORK_TESTS", false)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork("arbitrum_sepolia");
        owners = [makeAddr("ownerA"), makeAddr("ownerB"), makeAddr("ownerC")];
        address[] memory list = new address[](3);
        for (uint256 i; i < 3; i++) list[i] = owners[i];
        bytes memory init = abi.encodeCall(
            ISafe.setup, (list, 2, address(0), "", address(0), address(0), 0, payable(address(0)))
        );
        safe = ISafe(ISafeProxyFactory(FACTORY).createProxyWithNonce(SAFE_L2, init, uint256(keccak256("tawf-test"))));
        target = new SafeTarget(address(safe));
    }

    function _data(uint256 v) internal pure returns (bytes memory) {
        return abi.encodeCall(SafeTarget.set, (v));
    }

    function _hash(bytes memory data, uint256 n) internal view returns (bytes32) {
        return safe.getTransactionHash(address(target), 0, data, 0, 0, 0, 0, address(0), address(0), n);
    }

    /// @dev Signatures from owners that approved the hash: r = owner, s = 0, v = 1, sorted ascending.
    function _sigs(address[] memory approvers) internal pure returns (bytes memory out) {
        for (uint256 i; i < approvers.length; i++) {
            for (uint256 j = i + 1; j < approvers.length; j++) {
                if (uint160(approvers[j]) < uint160(approvers[i])) (approvers[i], approvers[j]) = (approvers[j], approvers[i]);
            }
        }
        for (uint256 i; i < approvers.length; i++) {
            out = bytes.concat(out, bytes32(uint256(uint160(approvers[i]))), bytes32(0), bytes1(0x01));
        }
    }

    function _exec(bytes memory data, bytes memory sigs) internal returns (bool) {
        return safe.execTransaction(address(target), 0, data, 0, 0, 0, 0, address(0), payable(address(0)), sigs);
    }

    function _two(address a, address b) internal pure returns (address[] memory l) {
        l = new address[](2);
        l[0] = a;
        l[1] = b;
    }

    function test_hashMatchesTheEip712Formula() public view {
        bytes memory data = _data(5);
        bytes32 structHash = keccak256(
            abi.encode(SAFE_TX_TYPEHASH, address(target), 0, keccak256(data), uint8(0), 0, 0, 0, address(0), address(0), safe.nonce())
        );
        assertEq(_hash(data, safe.nonce()), keccak256(abi.encodePacked(bytes1(0x19), bytes1(0x01), safe.domainSeparator(), structHash)));
    }

    function test_proposeApproveTwiceExecute() public {
        bytes memory data = _data(42);
        bytes32 h = _hash(data, safe.nonce()); // the proposal targets the current nonce
        vm.prank(owners[0]);
        safe.approveHash(h);
        vm.prank(owners[2]);
        safe.approveHash(h);
        assertEq(safe.approvedHashes(owners[0], h), 1);
        assertEq(safe.approvedHashes(owners[1], h), 0);

        uint256 before = safe.nonce();
        vm.prank(stranger); // anyone executes once the threshold is met
        assertTrue(_exec(data, _sigs(_two(owners[0], owners[2]))));
        assertEq(target.value(), 42);
        assertEq(safe.nonce(), before + 1);
    }

    function test_thresholdNotMetFails() public {
        bytes memory data = _data(1);
        bytes32 h = _hash(data, safe.nonce());
        vm.prank(owners[0]);
        safe.approveHash(h);
        address[] memory one = new address[](1);
        one[0] = owners[0];
        vm.expectRevert(bytes("GS020")); // signatures data too short for the threshold
        _exec(data, _sigs(one));
        assertEq(target.value(), 0);
    }

    function test_nonOwnerApprovalDoesNotCount() public {
        bytes memory data = _data(1);
        bytes32 h = _hash(data, safe.nonce());
        vm.prank(owners[0]);
        safe.approveHash(h);
        vm.prank(stranger); // the Safe refuses approvals from non-owners outright
        vm.expectRevert(bytes("GS030"));
        safe.approveHash(h);
        vm.expectRevert(bytes("GS025")); // so a stranger's entry in the signatures has no approved hash
        _exec(data, _sigs(_two(owners[0], stranger)));
        assertEq(target.value(), 0);
    }

    function test_ownerWhoDidNotApproveFails() public {
        bytes memory data = _data(1);
        bytes32 h = _hash(data, safe.nonce());
        vm.prank(owners[0]);
        safe.approveHash(h);
        vm.expectRevert(bytes("GS025")); // hash not approved by ownerB
        _exec(data, _sigs(_two(owners[0], owners[1])));
    }

    function test_unsortedSignaturesFail() public {
        bytes memory data = _data(1);
        bytes32 h = _hash(data, safe.nonce());
        vm.prank(owners[0]);
        safe.approveHash(h);
        vm.prank(owners[1]);
        safe.approveHash(h);
        bytes memory sorted = _sigs(_two(owners[0], owners[1]));
        // swap the two 65-byte entries
        bytes memory swapped = bytes.concat(_slice(sorted, 65, 65), _slice(sorted, 0, 65));
        vm.expectRevert(bytes("GS026"));
        _exec(data, swapped);
    }

    function test_staleNonceCannotExecute() public {
        bytes memory dataA = _data(1);
        bytes memory dataB = _data(2);
        uint256 n = safe.nonce();
        bytes32 hA = _hash(dataA, n);
        bytes32 hB = _hash(dataB, n); // a second proposal on the SAME nonce
        for (uint256 i; i < 2; i++) {
            vm.startPrank(owners[i]);
            safe.approveHash(hA);
            safe.approveHash(hB);
            vm.stopPrank();
        }
        _exec(dataA, _sigs(_two(owners[0], owners[1])));
        assertEq(safe.nonce(), n + 1);
        // B targeted nonce n, which is now below the Safe nonce: the approvals no longer match any hash.
        vm.expectRevert(bytes("GS025"));
        _exec(dataB, _sigs(_two(owners[0], owners[1])));
        assertEq(target.value(), 1);
    }

    function test_laterNonceWaitsForTheEarlierOne() public {
        uint256 n = safe.nonce();
        bytes memory data = _data(9);
        bytes32 hLater = _hash(data, n + 1); // queued behind
        for (uint256 i; i < 2; i++) {
            vm.prank(owners[i]);
            safe.approveHash(hLater);
        }
        // executing now computes the hash with nonce n, which nobody approved
        vm.expectRevert(bytes("GS025"));
        _exec(data, _sigs(_two(owners[0], owners[1])));
        // run the nonce-n transaction, then the queued one works
        bytes memory first = _data(3);
        bytes32 hFirst = _hash(first, n);
        for (uint256 i; i < 2; i++) {
            vm.prank(owners[i]);
            safe.approveHash(hFirst);
        }
        _exec(first, _sigs(_two(owners[0], owners[1])));
        _exec(data, _sigs(_two(owners[0], owners[1])));
        assertEq(target.value(), 9);
    }

    function _slice(bytes memory b, uint256 start, uint256 len) internal pure returns (bytes memory out) {
        out = new bytes(len);
        for (uint256 i; i < len; i++) out[i] = b[start + i];
    }
}
