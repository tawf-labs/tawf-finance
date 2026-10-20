// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title SandboxPolicyHarness
 * @notice A solc8.24 re-expression of SandboxModule's PURE policy decisions —
 *         mode admission, the three caps, series-end freeze, and investor-count
 *         maintenance — isolated from the T-REX AbstractModule.
 *
 * @dev Why a re-expression and not `is SandboxModule`: the real SandboxModule is
 *      pinned to `pragma solidity 0.8.17` because it extends the T-REX
 *      `AbstractModule`, and the deposito confs compile the scene with solc8.24
 *      and deliberately keep the 0.8.17 T-REX compiler and contracts OUT of
 *      scene (LESSONS item 4 / deposito.system.md section 3). Pulling
 *      AbstractModule in would drag the whole T-REX modular-compliance stack and
 *      a second compiler into the scene.
 *
 *      This harness carries the identical policy constants and the exact branch
 *      structure of `moduleCheck`, `_modeAllows`, `_capsOk`, `_onReceive` and
 *      `_onSend`, over harness-fed inputs:
 *        - token balances / supply come from `setBalance` / `setSupply`,
 *        - claim-topic possession comes from `setClaim(who, topic, ok)`,
 *      which stand in for the ONCHAINID/ClaimIssuer walk (summarized as a ghost
 *      in deposito_summaries.spec). The Sandbox CVL spec verifies the policy
 *      rules against THIS contract. No `src/` edit is required; see
 *      properties/deposito.needs_src_changes.md.
 */
contract SandboxPolicyHarness {
    enum Mode {
        PILOT_ONLY,
        SCREENED_GROUP,
        SANDBOX_ADMITTED
    }

    uint256 public constant TAWF_SCREENED = 2;
    uint256 public constant OJK_SANDBOX_PARTICIPANT = 3;

    uint256 public constant DEFAULT_MAX_INVESTORS = 50;
    uint256 public constant DEFAULT_MAX_BALANCE_PER_INVESTOR = 1_000_000_000; // Rp10,000,000 sen
    uint256 public constant DEFAULT_SERIES_CAP = 50_000_000_000; // Rp500,000,000 sen

    Mode public mode;
    address public treasury;
    address public claimIssuer;
    uint256 public maxInvestors = DEFAULT_MAX_INVESTORS;
    uint256 public maxBalancePerInvestor = DEFAULT_MAX_BALANCE_PER_INVESTOR;
    uint256 public seriesCap = DEFAULT_SERIES_CAP;
    uint64 public seriesEnd = type(uint64).max;

    // Investor accounting (one compliance modelled).
    uint256 public investorCount;
    mapping(address => bool) public isInvestor;

    // Harness-fed token ledger + claim possession.
    uint256 public supply;
    mapping(address => uint256) public bal;
    mapping(address => mapping(uint256 => bool)) public hasClaim;

    function setMode(Mode m) external { mode = m; }
    function setTreasury(address t) external { treasury = t; }
    function setClaimIssuer(address c) external { claimIssuer = c; }
    function setCaps(uint256 mi, uint256 mb, uint256 sc) external {
        if (mi != 0) maxInvestors = mi;
        if (mb != 0) maxBalancePerInvestor = mb;
        if (sc != 0) seriesCap = sc;
    }
    function setSeriesEnd(uint64 e) external { seriesEnd = e; }
    function setBalance(address a, uint256 v) external { bal[a] = v; }
    function setSupply(uint256 v) external { supply = v; }
    function setClaim(address who, uint256 topic, bool ok) external { hasClaim[who][topic] = ok; }

    // ---- policy, mirroring SandboxModule exactly ----

    function _hasValidClaim(address who, uint256 topic) internal view returns (bool) {
        if (claimIssuer == address(0)) return false;
        return hasClaim[who][topic];
    }

    function modeAllows(address who) public view returns (bool) {
        if (who == treasury) return true;
        if (mode == Mode.PILOT_ONLY) return false;
        if (mode == Mode.SCREENED_GROUP) return _hasValidClaim(who, TAWF_SCREENED);
        return _hasValidClaim(who, TAWF_SCREENED) || _hasValidClaim(who, OJK_SANDBOX_PARTICIPANT);
    }

    function capsOk(address to, uint256 value) public view returns (bool) {
        if (to == treasury) return true;
        if (bal[to] + value > maxBalancePerInvestor) return false;
        uint256 countAfter = investorCount;
        if (!isInvestor[to]) countAfter += 1;
        if (countAfter > maxInvestors) return false;
        return true;
    }

    /// @dev Mirrors moduleCheck: _from==0 mint, _to==0 burn, else transfer.
    function moduleCheck(address _from, address _to, uint256 _value, uint64 nowTs)
        public
        view
        returns (bool)
    {
        if (_to == address(0)) return true; // burn always allowed
        if (_from == address(0)) {
            if (!modeAllows(_to)) return false;
            if (supply + _value > seriesCap) return false;
            if (!capsOk(_to, _value)) return false;
            return true;
        }
        if (nowTs >= seriesEnd) return false; // frozen after series end
        if (!modeAllows(_to)) return false;
        if (!capsOk(_to, _value)) return false;
        return true;
    }

    /// @dev Mirrors _onReceive: count `to` once it holds a positive balance.
    function onReceive(address to) external {
        if (to == address(0) || to == treasury) return;
        if (!isInvestor[to] && bal[to] > 0) {
            isInvestor[to] = true;
            investorCount += 1;
        }
    }

    /// @dev Mirrors _onSend: drop `from` when its balance reaches zero.
    function onSend(address from) external {
        if (from == address(0) || from == treasury) return;
        if (isInvestor[from] && bal[from] == 0) {
            isInvestor[from] = false;
            if (investorCount > 0) investorCount -= 1;
        }
    }
}
