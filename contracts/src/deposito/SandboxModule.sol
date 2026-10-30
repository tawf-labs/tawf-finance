// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { ModuleAdmin } from "../proxy/ModuleAdmin.sol";

/// @dev Minimal view of the bound ModularCompliance: the token it serves.
interface IModularComplianceLike {
    function getTokenBound() external view returns (address);
}

/// @dev Minimal view of the T-REX token: its IdentityRegistry.
interface ITokenLike {
    function identityRegistry() external view returns (address);
}

/// @dev Minimal view of the IdentityRegistry: the ONCHAINID for an address.
interface IIdentityRegistryLike {
    function identity(address userAddress) external view returns (address);
}

/// @dev Minimal view of an ONCHAINID (ERC-735) for reading claims.
interface IIdentityLike {
    function getClaimIdsByTopic(uint256 topic) external view returns (bytes32[] memory claimIds);
    function getClaim(bytes32 claimId)
        external
        view
        returns (uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri);
}

/// @dev Minimal view of the Tawf ClaimIssuer: claim validity.
interface IClaimIssuerLike {
    function isClaimValid(address identity, uint256 claimTopic, bytes calldata sig, bytes calldata data)
        external
        view
        returns (bool);
}

/**
 * @title SandboxModule
 * @notice A T-REX ModularCompliance module that enforces the Tawf deposito
 *         series sandbox policy: who may hold tokens (by mode) and how much
 *         (by cap), for the regulated pre-admission and sandbox phases.
 *
 * @dev Pinned to `pragma solidity 0.8.17` because it extends the T-REX
 *      AbstractModule. It reads the token's IdentityRegistry and the holder's
 *      ONCHAINID claims directly, so holder eligibility is proven on chain,
 *      never told.
 *
 *      Modes (explicit on chain, an event on every change):
 *        PILOT_ONLY       default. Only the Tawf treasury wallet may receive
 *                         tokens, so the only holder is Tawf itself. The safe
 *                         default before any investor is admitted.
 *        SCREENED_GROUP   only wallets whose ONCHAINID holds a valid claim of
 *                         topic TAWF_SCREENED (2) from the Tawf ClaimIssuer,
 *                         issued after in-person verification.
 *        SANDBOX_ADMITTED a screened claim (topic 2) OR an
 *                         OJK_SANDBOX_PARTICIPANT claim (topic 3), same caps.
 *
 *      Caps (every mode, admin-adjustable with events):
 *        maxInvestors           distinct non-treasury holders (default 50)
 *        maxBalancePerInvestor  per non-treasury holder in sen (default
 *                               Rp10,000,000 = 1_000_000_000 sen)
 *        seriesCap              total supply cap in sen (default
 *                               Rp500,000,000 = 50_000_000_000 sen)
 *        seriesEnd              after it, no transfers between holders;
 *                               mint/burn still allowed
 *
 *      moduleCheck is the gate T-REX calls before a move to decide if it is
 *      allowed. The action hooks (mint/burn/transfer) maintain the holder
 *      count so the investor cap is enforced on the count after the move. The
 *      treasury is exempt from the per-investor balance cap and is never
 *      counted as an investor.
 *
 *      Admin model: configuration (mode, caps, treasury, claim issuer) is set
 *      through onlyComplianceCall functions so it goes through the bound
 *      compliance's owner, the T-REX convention for module settings. A plain
 *      owner (the deployer) may set the hook-like config before binding. This
 *      module is not plug-and-play: it must be configured for a compliance
 *      before that compliance can bind it.
 */
contract SandboxModule is ModuleAdmin {
    enum Mode {
        PILOT_ONLY,
        SCREENED_GROUP,
        SANDBOX_ADMITTED
    }

    /// @dev Claim topic for a Tawf in-person screening claim.
    uint256 public constant TAWF_SCREENED = 2;
    /// @dev Claim topic for an OJK regulatory-sandbox participant claim.
    uint256 public constant OJK_SANDBOX_PARTICIPANT = 3;

    uint256 public constant DEFAULT_MAX_INVESTORS = 50;
    /// @dev Rp10,000,000 in sen (two decimals).
    uint256 public constant DEFAULT_MAX_BALANCE_PER_INVESTOR = 1_000_000_000;
    /// @dev Rp500,000,000 in sen (two decimals).
    uint256 public constant DEFAULT_SERIES_CAP = 50_000_000_000;

    struct Config {
        Mode mode;
        address treasury;
        address claimIssuer;
        uint256 maxInvestors;
        uint256 maxBalancePerInvestor;
        uint256 seriesCap;
        uint64 seriesEnd;
        bool configured;
    }

    /// @notice Per-bound-compliance policy.
    mapping(address => Config) public configOf;
    /// @notice Distinct non-treasury holder count per compliance.
    mapping(address => uint256) public investorCount;
    /// @notice Whether an address is currently a counted investor, per compliance.
    mapping(address => mapping(address => bool)) private _isInvestor;

    error NotConfigured();
    error ZeroTreasury();

    event ConfigInitialized(
        address indexed compliance,
        Mode mode,
        address treasury,
        address claimIssuer,
        uint256 maxInvestors,
        uint256 maxBalancePerInvestor,
        uint256 seriesCap,
        uint64 seriesEnd
    );
    event ModeChanged(address indexed compliance, Mode mode);
    event TreasuryChanged(address indexed compliance, address treasury);
    event ClaimIssuerChanged(address indexed compliance, address claimIssuer);
    event CapsChanged(
        address indexed compliance, uint256 maxInvestors, uint256 maxBalancePerInvestor, uint256 seriesCap
    );
    event SeriesEndChanged(address indexed compliance, uint64 seriesEnd);

    /// @dev Implementation only: the logic contract is never initialised
    ///      directly. State lives in the ModuleProxy; upgrades go through the
    ///      proxy owner (the timelock) via `upgradeTo`. New state variables
    ///      must be appended below the existing ones.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialise the proxy. The caller becomes the owner, allowed to
    ///         configure a compliance before binding.
    function initialize() external initializer {
        __ModuleAdmin_init();
    }

    // ---------------------------------------------------------------
    // Configuration (deployer before binding, compliance owner after)
    // ---------------------------------------------------------------

    /// @notice Initialize the policy for `compliance`. Must be called by the
    ///         deployer before the module is bound. Applies defaults for any
    ///         cap passed as zero.
    function initConfig(
        address compliance,
        Mode mode,
        address treasury,
        address claimIssuer,
        uint256 maxInvestors,
        uint256 maxBalancePerInvestor,
        uint256 seriesCap,
        uint64 seriesEnd
    ) external {
        if (msg.sender != configurer) revert NotConfigurer();
        if (treasury == address(0)) revert ZeroTreasury();
        Config storage c = configOf[compliance];
        c.mode = mode;
        c.treasury = treasury;
        c.claimIssuer = claimIssuer;
        c.maxInvestors = maxInvestors == 0 ? DEFAULT_MAX_INVESTORS : maxInvestors;
        c.maxBalancePerInvestor =
            maxBalancePerInvestor == 0 ? DEFAULT_MAX_BALANCE_PER_INVESTOR : maxBalancePerInvestor;
        c.seriesCap = seriesCap == 0 ? DEFAULT_SERIES_CAP : seriesCap;
        c.seriesEnd = seriesEnd;
        c.configured = true;
        emit ConfigInitialized(
            compliance, mode, treasury, claimIssuer, c.maxInvestors, c.maxBalancePerInvestor, c.seriesCap, seriesEnd
        );
    }

    /// @notice Set the admission mode for the calling compliance.
    function setMode(Mode mode) external onlyComplianceCall {
        Config storage c = _require(msg.sender);
        c.mode = mode;
        emit ModeChanged(msg.sender, mode);
    }

    /// @notice Set the treasury wallet for the calling compliance.
    function setTreasury(address treasury) external onlyComplianceCall {
        if (treasury == address(0)) revert ZeroTreasury();
        Config storage c = _require(msg.sender);
        c.treasury = treasury;
        emit TreasuryChanged(msg.sender, treasury);
    }

    /// @notice Set the Tawf ClaimIssuer whose topic 2/3 claims are accepted.
    function setClaimIssuer(address claimIssuer) external onlyComplianceCall {
        Config storage c = _require(msg.sender);
        c.claimIssuer = claimIssuer;
        emit ClaimIssuerChanged(msg.sender, claimIssuer);
    }

    /// @notice Set the three caps for the calling compliance. Zero keeps the
    ///         current value, so a single cap can be changed in isolation.
    function setCaps(uint256 maxInvestors, uint256 maxBalancePerInvestor, uint256 seriesCap)
        external
        onlyComplianceCall
    {
        Config storage c = _require(msg.sender);
        if (maxInvestors != 0) c.maxInvestors = maxInvestors;
        if (maxBalancePerInvestor != 0) c.maxBalancePerInvestor = maxBalancePerInvestor;
        if (seriesCap != 0) c.seriesCap = seriesCap;
        emit CapsChanged(msg.sender, c.maxInvestors, c.maxBalancePerInvestor, c.seriesCap);
    }

    /// @notice Set the series end timestamp for the calling compliance.
    function setSeriesEnd(uint64 seriesEnd) external onlyComplianceCall {
        Config storage c = _require(msg.sender);
        c.seriesEnd = seriesEnd;
        emit SeriesEndChanged(msg.sender, seriesEnd);
    }

    // ---------------------------------------------------------------
    // Eligibility (public view for the series contract and the app)
    // ---------------------------------------------------------------

    /// @notice Whether `who` may receive tokens under `compliance`'s current
    ///         mode. The series contract calls this to fail fast before cash
    ///         moves; the result matches the moduleCheck gate for a mint.
    function isEligible(address compliance, address who) public view returns (bool) {
        Config storage c = configOf[compliance];
        if (!c.configured) return false;
        address token = IModularComplianceLike(compliance).getTokenBound();
        return _modeAllows(c, c.mode, token, who);
    }

    // ---------------------------------------------------------------
    // T-REX IModule hooks
    // ---------------------------------------------------------------

    /// @notice The gate T-REX calls before a transfer, mint or burn to decide
    ///         if it is allowed.
    /// @dev `_from == 0` is a mint, `_to == 0` is a burn. The series contract
    ///      is denominated in sen, so `_value` and balances are in sen.
    function moduleCheck(address _from, address _to, uint256 _value, address _compliance)
        external
        view
        override
        returns (bool)
    {
        Config storage c = configOf[_compliance];
        if (!c.configured) return false;

        // Burn: always allowed (redemption shrinks supply and holders).
        if (_to == address(0)) return true;

        address token = IModularComplianceLike(_compliance).getTokenBound();

        if (_from == address(0)) {
            // Mint. Receiver must satisfy the mode; series cap on supply after.
            if (!_modeAllows(c, c.mode, token, _to)) return false;
            if (_totalSupply(token) + _value > c.seriesCap) return false;
            if (!_capsOk(c, _compliance, token, _to, _value)) return false;
            return true;
        }

        // Transfer between holders. Supply is unchanged, so no series-cap check.
        if (block.timestamp >= c.seriesEnd) return false; // frozen after series end
        if (!_modeAllows(c, c.mode, token, _to)) return false;
        if (!_capsOk(c, _compliance, token, _to, _value)) return false;
        return true;
    }

    /// @dev Maintain the investor count on transfer: `_to` may become a new
    ///      holder, `_from` may cease to be one.
    function moduleTransferAction(address _from, address _to, uint256 _value) external override onlyComplianceCall {
        address token = IModularComplianceLike(msg.sender).getTokenBound();
        _onReceive(msg.sender, _to, token);
        _onSend(msg.sender, _from, token, _value);
    }

    /// @dev Maintain the investor count on mint: `_to` may become a new holder.
    function moduleMintAction(address _to, uint256 _value) external override onlyComplianceCall {
        address token = IModularComplianceLike(msg.sender).getTokenBound();
        _onReceive(msg.sender, _to, token);
        _value; // silence unused
    }

    /// @dev Maintain the investor count on burn: `_from` may cease to hold.
    function moduleBurnAction(address _from, uint256 _value) external override onlyComplianceCall {
        address token = IModularComplianceLike(msg.sender).getTokenBound();
        _onSend(msg.sender, _from, token, _value);
    }

    /// @dev Not plug-and-play: a compliance must be configured before binding.
    function canComplianceBind(address _compliance) external view override returns (bool) {
        return configOf[_compliance].configured;
    }

    function isPlugAndPlay() external pure override returns (bool) {
        return false;
    }

    function name() external pure override returns (string memory) {
        return "SandboxModule";
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    function _require(address compliance) private view returns (Config storage c) {
        c = configOf[compliance];
        if (!c.configured) revert NotConfigured();
    }

    /// @dev Whether `who` is allowed to hold under `mode`. The treasury is
    ///      always allowed (it is Tawf itself). `token` resolves the holder's
    ///      ONCHAINID through the token's IdentityRegistry.
    function _modeAllows(Config storage c, Mode mode, address token, address who) private view returns (bool) {
        if (who == c.treasury) return true;
        if (mode == Mode.PILOT_ONLY) return false; // only treasury
        if (token == address(0)) return false;
        if (mode == Mode.SCREENED_GROUP) {
            return _hasValidClaim(c, token, who, TAWF_SCREENED);
        }
        // SANDBOX_ADMITTED: screened OR OJK sandbox participant.
        return _hasValidClaim(c, token, who, TAWF_SCREENED) || _hasValidClaim(c, token, who, OJK_SANDBOX_PARTICIPANT);
    }

    function _hasValidClaim(Config storage c, address token, address who, uint256 topic)
        private
        view
        returns (bool)
    {
        if (c.claimIssuer == address(0)) return false;
        address ir = ITokenLike(token).identityRegistry();
        address id = IIdentityRegistryLike(ir).identity(who);
        if (id == address(0)) return false;
        bytes32[] memory claimIds = IIdentityLike(id).getClaimIdsByTopic(topic);
        for (uint256 i = 0; i < claimIds.length; i++) {
            (, , address issuer, bytes memory sig, bytes memory data, ) = IIdentityLike(id).getClaim(claimIds[i]);
            if (issuer != c.claimIssuer) continue;
            if (IClaimIssuerLike(c.claimIssuer).isClaimValid(id, topic, sig, data)) return true;
        }
        return false;
    }

    /// @dev Per-investor balance cap and investor-count cap, applied to the
    ///      receiver after the move. The treasury is exempt and never counted.
    function _capsOk(Config storage c, address compliance, address token, address to, uint256 value)
        private
        view
        returns (bool)
    {
        if (to == c.treasury) return true;
        if (_balanceOf(token, to) + value > c.maxBalancePerInvestor) return false;
        uint256 countAfter = investorCount[compliance];
        if (!_isInvestor[compliance][to]) countAfter += 1;
        if (countAfter > c.maxInvestors) return false;
        return true;
    }

    /// @dev Count `to` as an investor if it now holds a balance and is not the
    ///      treasury. Called after the balance has moved.
    function _onReceive(address compliance, address to, address token) private {
        Config storage c = configOf[compliance];
        if (to == address(0) || to == c.treasury) return;
        if (!_isInvestor[compliance][to] && _balanceOf(token, to) > 0) {
            _isInvestor[compliance][to] = true;
            investorCount[compliance] += 1;
        }
    }

    /// @dev Drop `from` from the investor count if its balance reached zero.
    function _onSend(address compliance, address from, address token, uint256) private {
        Config storage c = configOf[compliance];
        if (from == address(0) || from == c.treasury) return;
        if (_isInvestor[compliance][from] && _balanceOf(token, from) == 0) {
            _isInvestor[compliance][from] = false;
            if (investorCount[compliance] > 0) investorCount[compliance] -= 1;
        }
    }

    function _totalSupply(address token) private view returns (uint256) {
        return IERC20Like(token).totalSupply();
    }

    function _balanceOf(address token, address who) private view returns (uint256) {
        return IERC20Like(token).balanceOf(who);
    }
}

/// @dev Minimal ERC20 view of the T-REX token for supply and balances (sen).
interface IERC20Like {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}
