// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

// Focused tests for the SandboxModule: each mode's eligibility, the three caps, the series-end
// freeze, and the screened-claim path (valid vs missing vs from an untrusted issuer). Uses the
// shared T-REX fixture for identities and a T-REX token whose compliance binds the SandboxModule.
// A standalone minter (the "series" stand-in) is the token agent so mints go through the module.

import { ModuleProxies } from "../../src/proxy/ModuleProxies.sol";
import {TrexFixture} from "../trex/TrexFixture.sol";
import {SandboxModule} from "../../src/deposito/SandboxModule.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";

contract SandboxModuleTest is TrexFixture {
    uint256 internal constant TAWF_SCREENED = 2;
    uint256 internal constant OJK_SANDBOX = 3;

    SandboxModule internal sandbox;
    Token internal token;
    ModularCompliance internal mc;

    address internal treasury = address(0x7EA5);
    address internal investor = makeAddr("investor");
    address internal investor2 = makeAddr("investor2");
    address internal outsider = makeAddr("outsider");

    uint64 internal seriesEnd;

    function setUp() public {
        _setUpTrex();
        // Trust the shared ClaimIssuer for topics 2 and 3 too.
        vm.startPrank(deployer);
        uint256[] memory topics = new uint256[](2);
        topics[0] = TAWF_SCREENED;
        topics[1] = OJK_SANDBOX;
        tir.removeTrustedIssuer(claimIssuer);
        uint256[] memory all = new uint256[](3);
        all[0] = KYC_TOPIC;
        all[1] = TAWF_SCREENED;
        all[2] = OJK_SANDBOX;
        tir.addTrustedIssuer(claimIssuer, all);
        vm.stopPrank();

        (token, mc,) = _deployTrexToken("Tawf Deposito Series 1 (BPRS Demo)", "tDEP-TAWF-S1", 2);

        seriesEnd = uint64(block.timestamp + 90 days);
        vm.startPrank(deployer);
        sandbox = ModuleProxies.sandbox();
        sandbox.initConfig(
            address(mc),
            SandboxModule.Mode.PILOT_ONLY,
            treasury,
            address(claimIssuer),
            0, // default 50
            0, // default Rp10,000,000 = 1_000_000_000 sen
            0, // default Rp500,000,000 = 50_000_000_000 sen
            seriesEnd
        );
        mc.addModule(address(sandbox));
        // deployer is the token agent / minter in these tests.
        token.addAgent(deployer);
        token.unpause();
        vm.stopPrank();

        _registerVerified(investor, 360);
        _registerVerified(investor2, 360);
        _registerVerified(treasury, 360);
    }

    function _setMode(SandboxModule.Mode mode) internal {
        vm.prank(deployer);
        mc.callModuleFunction(abi.encodeWithSelector(SandboxModule.setMode.selector, mode), address(sandbox));
    }

    function _setCaps(uint256 maxInv, uint256 maxBal, uint256 seriesCap) internal {
        vm.prank(deployer);
        mc.callModuleFunction(
            abi.encodeWithSelector(SandboxModule.setCaps.selector, maxInv, maxBal, seriesCap), address(sandbox)
        );
    }

    function _addScreeningClaim(address wallet, uint256 topic) internal {
        address id = address(ir.identity(wallet));
        bytes memory data = abi.encodePacked("SCREENED");
        bytes32 dataHash = keccak256(abi.encode(id, topic, data));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(claimIssuerKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(wallet);
        Identity(id).addClaim(topic, 1, address(claimIssuer), sig, data, "");
    }

    function _mint(address to, uint256 amount) internal {
        vm.prank(deployer);
        token.mint(to, amount);
    }

    // --- modes -----------------------------------------------------------

    function test_pilotOnlyAllowsTreasuryOnly() public {
        assertTrue(sandbox.isEligible(address(mc), treasury));
        assertFalse(sandbox.isEligible(address(mc), investor));
        // Mint to treasury works; mint to investor is blocked by compliance.
        _mint(treasury, 1_000);
        assertEq(token.balanceOf(treasury), 1_000);
        vm.expectRevert(bytes("Compliance not followed"));
        _mint(investor, 1_000);
    }

    function test_screenedGroupRequiresClaim() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        assertFalse(sandbox.isEligible(address(mc), investor));
        _addScreeningClaim(investor, TAWF_SCREENED);
        assertTrue(sandbox.isEligible(address(mc), investor));
        _mint(investor, 1_000);
        assertEq(token.balanceOf(investor), 1_000);
    }

    function test_screenedClaimFromUntrustedIssuerRejected() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        // A claim signed by a different issuer is not the Tawf ClaimIssuer.
        uint256 rogueKey = 0xB0B;
        ClaimIssuer rogue = new ClaimIssuer(vm.addr(rogueKey));
        address id = address(ir.identity(investor));
        bytes memory data = abi.encodePacked("SCREENED");
        bytes32 dataHash = keccak256(abi.encode(id, TAWF_SCREENED, data));
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));
        // Validly signed by the rogue issuer's own key, so the identity accepts it.
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(rogueKey, prefixed);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(investor);
        Identity(id).addClaim(TAWF_SCREENED, 1, address(rogue), sig, data, "");
        // Issuer on the claim is the rogue, so the module ignores it.
        assertFalse(sandbox.isEligible(address(mc), investor));
    }

    function test_sandboxAdmittedAcceptsEitherClaim() public {
        _setMode(SandboxModule.Mode.SANDBOX_ADMITTED);
        assertFalse(sandbox.isEligible(address(mc), investor));
        _addScreeningClaim(investor, OJK_SANDBOX);
        assertTrue(sandbox.isEligible(address(mc), investor));
        _addScreeningClaim(investor2, TAWF_SCREENED);
        assertTrue(sandbox.isEligible(address(mc), investor2));
    }

    // --- caps ------------------------------------------------------------

    function test_maxBalancePerInvestorEnforced() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        _addScreeningClaim(investor, TAWF_SCREENED);
        _setCaps(0, 1_000, 0); // Rp10 cap in sen
        _mint(investor, 1_000);
        vm.expectRevert(bytes("Compliance not followed"));
        _mint(investor, 1);
    }

    function test_maxInvestorsEnforced() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        _addScreeningClaim(investor, TAWF_SCREENED);
        _addScreeningClaim(investor2, TAWF_SCREENED);
        _setCaps(1, 0, 0); // only one investor
        _mint(investor, 100);
        assertEq(sandbox.investorCount(address(mc)), 1);
        vm.expectRevert(bytes("Compliance not followed"));
        _mint(investor2, 100);
    }

    function test_seriesCapEnforced() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        _addScreeningClaim(investor, TAWF_SCREENED);
        _setCaps(0, 0, 500); // seriesCap 500 sen
        _mint(investor, 500);
        vm.expectRevert(bytes("Compliance not followed"));
        _mint(investor, 1);
    }

    function test_treasuryExemptFromPerInvestorCapAndCount() public {
        _setCaps(0, 1_000, 0);
        _mint(treasury, 10_000); // above per-investor cap, allowed for treasury
        assertEq(token.balanceOf(treasury), 10_000);
        assertEq(sandbox.investorCount(address(mc)), 0);
    }

    function test_transfersFrozenAfterSeriesEnd() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        _addScreeningClaim(investor, TAWF_SCREENED);
        _addScreeningClaim(investor2, TAWF_SCREENED);
        _mint(investor, 1_000);

        vm.warp(seriesEnd + 1);
        // Transfer between holders is blocked after series end.
        vm.expectRevert(bytes("Transfer not possible"));
        vm.prank(investor);
        token.transfer(investor2, 100);

        // Mint still allowed after series end.
        _mint(investor2, 100);
        assertEq(token.balanceOf(investor2), 100);
    }

    function test_investorCountDropsToZeroOnFullTransferOut() public {
        _setMode(SandboxModule.Mode.SCREENED_GROUP);
        _addScreeningClaim(investor, TAWF_SCREENED);
        _addScreeningClaim(investor2, TAWF_SCREENED);
        _mint(investor, 1_000);
        assertEq(sandbox.investorCount(address(mc)), 1);
        vm.prank(investor);
        token.transfer(investor2, 1_000);
        // investor emptied, investor2 now holds: still one investor.
        assertEq(sandbox.investorCount(address(mc)), 1);
    }
}
