// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17 <0.9.0;

import "forge-std/Script.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce) external returns (address proxy);
}

/// @notice Deploys the five duty Safes through the canonical Safe v1.4.1 SafeProxyFactory on Arbitrum Sepolia, with
///         owners and thresholds from env. It never generates or holds signer keys: the owner addresses are the
///         people's own wallets. A Safe that already exists can be used instead (skip this script and pass its
///         address to DeployAll).
///
///   PRIVATE_KEY=<any funded deployer key, not a signer> \
///   GOV_SAFE_OWNERS=0x..,0x..,0x..,0x..,0x..   GOV_SAFE_THRESHOLD=3 \
///   TREASURY_SAFE_OWNERS=0x..,0x..,0x..        TREASURY_SAFE_THRESHOLD=2 \
///   MINTING_SAFE_OWNERS=0x..,0x..,0x..         MINTING_SAFE_THRESHOLD=2 \
///   COMPLIANCE_SAFE_OWNERS=0x..,0x..,0x..      COMPLIANCE_SAFE_THRESHOLD=2 \
///   GUARDIAN_SAFE_OWNERS=0x..,0x..,0x..        GUARDIAN_SAFE_THRESHOLD=1 \
///   [SAFE_SALT_NONCE=..] \
///     forge script script/DeploySafes.s.sol:DeploySafes --sig "run()" --rpc-url arbitrum_sepolia   (add --broadcast to deploy)
///
/// The five owner sets must be distinct enough that no address is an owner of both the Treasury and the Minting Safe
/// (a person who could approve both would defeat the MINTER and FUNDER separation), and the Governance threshold must
/// be at least 2, which DeployAll also requires. The printed addresses go into DeployAll as GOV_SAFE, TREASURY_SAFE,
/// MINTING_SAFE, COMPLIANCE_SAFE and GUARDIAN_SAFE.
contract DeploySafes is Script {
    // Canonical Safe v1.4.1 deployments on Arbitrum Sepolia (chain 421614), from the official safe-deployments.
    address internal constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address internal constant SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a;
    address internal constant FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;

    function run() external {
        require(block.chainid == 421614 || vm.envOr("ALLOW_OTHER_CHAIN", false), "Arbitrum Sepolia only (421614)");
        require(SAFE_PROXY_FACTORY.code.length > 0 || vm.envOr("ALLOW_OTHER_CHAIN", false), "canonical SafeProxyFactory not found on this chain");
        require(vm.envOr("ALLOW_OTHER_CHAIN", false) || (SAFE_SINGLETON.code.length > 0 && FALLBACK_HANDLER.code.length > 0), "Safe singleton or fallback handler not found: verify the addresses against safe-deployments");
        string[5] memory names = ["GOV", "TREASURY", "MINTING", "COMPLIANCE", "GUARDIAN"];
        address[][5] memory owners;
        for (uint256 i; i < 5; i++) {
            owners[i] = vm.envAddress(string.concat(names[i], "_SAFE_OWNERS"), ",");
            uint256 th = vm.envUint(string.concat(names[i], "_SAFE_THRESHOLD"));
            require(owners[i].length >= 1 && th >= 1 && th <= owners[i].length, "bad owners or threshold");
            if (i == 0) require(owners[i].length >= 2 && th >= 2, "the Governance Safe needs >= 2 owners and threshold >= 2");
            for (uint256 a; a < owners[i].length; a++) {
                require(owners[i][a] != address(0), "zero owner");
                for (uint256 b = a + 1; b < owners[i].length; b++) require(owners[i][a] != owners[i][b], "duplicate owner");
            }
        }
        // MINTER and FUNDER separation also means no person approves for both money out and minting.
        for (uint256 a; a < owners[1].length; a++) {
            for (uint256 b; b < owners[2].length; b++) {
                require(owners[1][a] != owners[2][b], "an address owns both the Treasury and the Minting Safe");
            }
        }

        uint256 salt = vm.envOr("SAFE_SALT_NONCE", uint256(block.timestamp));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        for (uint256 i; i < 5; i++) {
            bytes memory init = abi.encodeWithSignature(
                "setup(address[],uint256,address,bytes,address,address,uint256,address)",
                owners[i],
                vm.envUint(string.concat(names[i], "_SAFE_THRESHOLD")),
                address(0),
                bytes(""),
                FALLBACK_HANDLER,
                address(0),
                uint256(0),
                address(0)
            );
            address safe = ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(SAFE_SINGLETON, init, salt + i);
            console.log(string.concat(names[i], "_SAFE="), safe);
        }
        vm.stopBroadcast();
    }
}
