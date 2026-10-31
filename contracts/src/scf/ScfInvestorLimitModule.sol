// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { ModuleAdmin } from "../proxy/ModuleAdmin.sol";

/// @dev Minimal view of the bound ModularCompliance: the token it serves.
interface IScfComplianceLike {
    function getTokenBound() external view returns (address);
}

/// @dev Minimal view of the IdentityRegistry: the ONCHAINID for an address.
interface IScfIdentityRegistryLike {
    function identity(address userAddress) external view returns (address);
}

/// @dev Minimal ERC20 view of the T-REX token for supply.
interface IScfTokenLike {
    function totalSupply() external view returns (uint256);
}

/**
 * @title ScfInvestorLimitModule
 * @notice A T-REX ModularCompliance module for securities crowdfunding (SCF,
 *         Indonesian "Layanan Urun Dana") offerings. It enforces the POJK
 *         57/2020 investor limit (a yearly amount derived from the investor's
 *         income) across every offering of one SCF platform, and a cap on each
 *         offering's total issue.
 *
 * @dev Pinned to `pragma solidity 0.8.17` because it extends the T-REX
 *      AbstractModule.
 *
 *      One module instance serves every offering of a platform: each offering
 *      token's compliance binds the same instance, so an investor's usage is
 *      counted across all of them. Usage is keyed by the investor's ONCHAINID,
 *      so two wallets of one investor share one limit.
 *
 *      Profiles: the platform's suitability check sets each investor's yearly
 *      limit (in settlement-token base units, 6 decimals) and an optional
 *      exemption (legal entity, or a capital-market account held for two years
 *      or more). Only the limit and a bracket code go on chain, never the
 *      income figure. An investor without a profile has a limit of zero and is
 *      blocked until the suitability step is done.
 *
 *      Usage counts money invested per period: mints and transfers add the
 *      amount to the receiver's usage, burns never reduce it. Periods are
 *      fixed 365-day buckets from `periodStart`. An agent can reset a period's
 *      usage, for example after a failed raise was refunded.
 *
 *      Every token bound to the module must use the same unit as the limits
 *      (6 decimals, one unit per settlement-token unit).
 */
contract ScfInvestorLimitModule is ModuleAdmin {
    enum Exemption {
        NONE,
        LEGAL_ENTITY,
        CAPITAL_MARKET_2Y
    }

    struct Profile {
        uint128 annualLimit;
        uint8 bracket;
        Exemption exemption;
        uint64 updatedAt;
    }

    struct Offering {
        address treasury;
        uint256 offeringCap;
        bool configured;
    }

    uint256 public constant PERIOD = 365 days;

    /// @notice The shared IdentityRegistry the investors are registered in.
    address public identityRegistry;
    /// @notice Start of period 0.
    uint64 public periodStart;

    /// @notice Platform agents allowed to set investor profiles.
    mapping(address => bool) public isAgent;
    /// @notice Investor profile per ONCHAINID.
    mapping(address => Profile) public profileOf;
    /// @notice Amount invested per ONCHAINID per period.
    mapping(address => mapping(uint256 => uint256)) public usedOf;
    /// @notice Offering settings per bound compliance.
    mapping(address => Offering) public offeringOf;

    error OnlyAgent();
    error NotConfigured();
    error ZeroCap();
    error AlreadyBound();

    event AgentSet(address indexed agent, bool enabled);
    event OfferingInitialized(address indexed compliance, address treasury, uint256 offeringCap);
    event OfferingCapChanged(address indexed compliance, uint256 offeringCap);
    event ProfileSet(address indexed onchainId, uint128 annualLimit, uint8 bracket, Exemption exemption);
    event UsageReset(address indexed onchainId, uint256 indexed period);
    event Invested(address indexed onchainId, uint256 indexed period, address indexed compliance, uint256 amount);

    /// @dev Implementation only: the logic contract is never initialised
    ///      directly. State lives in the BeaconProxy; upgrades go through the
    ///      module's UpgradeableBeacon (owned by the Governance Safe). New state
    ///      variables must be appended below the existing ones.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialise the proxy. The caller becomes the owner.
    function initialize(address identityRegistry_) external initializer {
        if (identityRegistry_ == address(0)) revert ZeroAddress();
        __ModuleAdmin_init();
        identityRegistry = identityRegistry_;
        periodStart = uint64(block.timestamp);
    }

    modifier onlyAgent() {
        if (!isAgent[msg.sender] && msg.sender != configurer) revert OnlyAgent();
        _;
    }

    // ---------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------

    /// @notice Appoint or remove a platform agent.
    function setAgent(address agent, bool enabled) external {
        if (msg.sender != configurer) revert NotConfigurer();
        if (agent == address(0)) revert ZeroAddress();
        isAgent[agent] = enabled;
        emit AgentSet(agent, enabled);
    }

    /// @notice Configure an offering. Only the deployer, and only before the
    ///         offering's compliance binds the module: once an offering is
    ///         live its treasury (exempt from the limit) and cap cannot be
    ///         rewritten here. A live cap changes through setOfferingCap.
    function initOffering(address compliance, address treasury, uint256 offeringCap) external {
        if (msg.sender != configurer) revert NotConfigurer();
        if (compliance == address(0) || treasury == address(0)) revert ZeroAddress();
        if (this.isComplianceBound(compliance)) revert AlreadyBound();
        if (offeringCap == 0) revert ZeroCap();
        offeringOf[compliance] = Offering({ treasury: treasury, offeringCap: offeringCap, configured: true });
        emit OfferingInitialized(compliance, treasury, offeringCap);
    }

    /// @notice Change the calling compliance's offering cap.
    function setOfferingCap(uint256 offeringCap) external onlyComplianceCall {
        Offering storage o = offeringOf[msg.sender];
        if (!o.configured) revert NotConfigured();
        if (offeringCap == 0) revert ZeroCap();
        o.offeringCap = offeringCap;
        emit OfferingCapChanged(msg.sender, offeringCap);
    }

    /// @notice Record the outcome of an investor's suitability check.
    /// @param onchainId The investor's ONCHAINID.
    /// @param annualLimit Yearly limit in settlement-token base units.
    /// @param bracket Income bracket code, for disclosure only.
    /// @param exemption Exemption from the limit, if any.
    function setProfile(address onchainId, uint128 annualLimit, uint8 bracket, Exemption exemption)
        external
        onlyAgent
    {
        if (onchainId == address(0)) revert ZeroAddress();
        profileOf[onchainId] = Profile({
            annualLimit: annualLimit,
            bracket: bracket,
            exemption: exemption,
            updatedAt: uint64(block.timestamp)
        });
        emit ProfileSet(onchainId, annualLimit, bracket, exemption);
    }

    /// @notice Clear an investor's usage for a period (for example after a
    ///         cancelled raise was refunded).
    function resetUsage(address onchainId, uint256 period) external onlyAgent {
        usedOf[onchainId][period] = 0;
        emit UsageReset(onchainId, period);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /// @notice The current period index.
    function currentPeriod() public view returns (uint256) {
        return (block.timestamp - periodStart) / PERIOD;
    }

    /// @notice An investor's limit, usage and remaining room this period.
    /// @dev `remaining` is type(uint256).max for an exempt investor and zero
    ///      for a wallet without an ONCHAINID.
    function remainingOf(address wallet)
        external
        view
        returns (uint256 limit, uint256 used, uint256 remaining, Exemption exemption)
    {
        address id = IScfIdentityRegistryLike(identityRegistry).identity(wallet);
        if (id == address(0)) return (0, 0, 0, Exemption.NONE);
        Profile storage p = profileOf[id];
        limit = p.annualLimit;
        used = usedOf[id][currentPeriod()];
        exemption = p.exemption;
        if (exemption != Exemption.NONE) remaining = type(uint256).max;
        else remaining = used >= limit ? 0 : limit - used;
    }

    // ---------------------------------------------------------------
    // T-REX IModule hooks
    // ---------------------------------------------------------------

    /// @notice The gate T-REX calls before a transfer, mint or burn.
    function moduleCheck(address _from, address _to, uint256 _value, address _compliance)
        external
        view
        override
        returns (bool)
    {
        Offering storage o = offeringOf[_compliance];
        if (!o.configured) return false;
        if (_to == address(0)) return true; // burn

        if (_from == address(0)) {
            address token = IScfComplianceLike(_compliance).getTokenBound();
            if (IScfTokenLike(token).totalSupply() + _value > o.offeringCap) return false;
        }
        return _investorOk(o, _to, _value);
    }

    function moduleTransferAction(address, address _to, uint256 _value) external override onlyComplianceCall {
        _record(msg.sender, _to, _value);
    }

    function moduleMintAction(address _to, uint256 _value) external override onlyComplianceCall {
        _record(msg.sender, _to, _value);
    }

    /// @dev Burns never reduce usage: the limit counts money invested.
    function moduleBurnAction(address, uint256) external override onlyComplianceCall { }

    /// @dev Not plug-and-play: an offering must be configured before binding.
    function canComplianceBind(address _compliance) external view override returns (bool) {
        return offeringOf[_compliance].configured;
    }

    function isPlugAndPlay() external pure override returns (bool) {
        return false;
    }

    function name() external pure override returns (string memory) {
        return "ScfInvestorLimitModule";
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    function _investorOk(Offering storage o, address to, uint256 value) private view returns (bool) {
        if (to == o.treasury) return true;
        address id = IScfIdentityRegistryLike(identityRegistry).identity(to);
        if (id == address(0)) return false;
        Profile storage p = profileOf[id];
        if (p.exemption != Exemption.NONE) return true;
        return usedOf[id][currentPeriod()] + value <= p.annualLimit;
    }

    function _record(address compliance, address to, uint256 value) private {
        Offering storage o = offeringOf[compliance];
        if (to == address(0) || to == o.treasury) return;
        address id = IScfIdentityRegistryLike(identityRegistry).identity(to);
        if (id == address(0)) return;
        uint256 period = currentPeriod();
        usedOf[id][period] += value;
        emit Invested(id, period, compliance, value);
    }
}
