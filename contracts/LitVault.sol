// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
contract LitVault is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    IERC20 public immutable asset;
    uint256 public totalAssets;
    uint256 public performanceFee = 500;
    uint256 public constant MAX_FEE = 2000;
    uint256 public constant BPS = 10000;
    address public feeRecipient;
    address public strategist;
    struct Strategy {
        address target;
        uint256 allocation;
        uint256 deployed;
        bool active;
        string name;
    }
    Strategy[] public strategies;
    uint256 public constant MAX_STRATEGIES = 5;
    uint256 public lastHarvest;
    uint256 public totalYieldEarned;
    mapping(address => uint256) public depositedAt;
    mapping(address => uint256) public userDeposited;
    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event Harvested(uint256 yield, uint256 fee, uint256 timestamp);
    event StrategyAdded(uint256 indexed id, address target, string name);
    event StrategyRemoved(uint256 indexed id);
    event FeeUpdated(uint256 newFee);
    error ZeroAmount();
    error InsufficientShares();
    error TooManyStrategies();
    error InvalidAllocation();
    error NotStrategist();
    modifier onlyStrategist() {
        if (msg.sender != strategist && msg.sender != owner()) revert NotStrategist();
        _;
    }
    constructor(address _asset, address _feeRecipient, address _strategist)
        ERC20("LitVault Share", "lvzkLTC") Ownable(msg.sender) {
        asset = IERC20(_asset);
        feeRecipient = _feeRecipient;
        strategist = _strategist;
        lastHarvest = block.timestamp;
    }
    function deposit(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        shares = _convertToShares(assets);
        asset.safeTransferFrom(msg.sender, address(this), assets);
        totalAssets += assets;
        userDeposited[msg.sender] += assets;
        depositedAt[msg.sender] = block.timestamp;
        _mint(msg.sender, shares);
        _deployToStrategies(assets);
        emit Deposited(msg.sender, assets, shares);
    }
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (balanceOf(msg.sender) < shares) revert InsufficientShares();
        assets = _convertToAssets(shares);
        _burn(msg.sender, shares);
        totalAssets -= assets;
        userDeposited[msg.sender] = userDeposited[msg.sender] > assets ? userDeposited[msg.sender] - assets : 0;
        uint256 available = asset.balanceOf(address(this));
        if (available < assets) _withdrawFromStrategies(assets - available);
        asset.safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets, shares);
    }
    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0 || totalAssets == 0) return assets;
        return (assets * supply) / totalAssets;
    }
    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets) / supply;
    }
    function pricePerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets * 1e18) / supply;
    }
    function addStrategy(address target, uint256 allocation, string calldata name) external onlyOwner {
        if (strategies.length >= MAX_STRATEGIES) revert TooManyStrategies();
        strategies.push(Strategy({ target: target, allocation: allocation, deployed: 0, active: true, name: name }));
        emit StrategyAdded(strategies.length - 1, target, name);
    }
    function removeStrategy(uint256 id) external onlyOwner {
        if (strategies[id].deployed > 0) _withdrawFromStrategy(id, strategies[id].deployed);
        strategies[id].active = false;
        emit StrategyRemoved(id);
    }
    function setAllocations(uint256[] calldata allocations) external onlyStrategist {
        uint256 total;
        for (uint256 i = 0; i < allocations.length; i++) total += allocations[i];
        if (total != BPS) revert InvalidAllocation();
        for (uint256 i = 0; i < allocations.length && i < strategies.length; i++)
            strategies[i].allocation = allocations[i];
    }
    function _deployToStrategies(uint256 amount) internal {
        for (uint256 i = 0; i < strategies.length; i++) {
            if (!strategies[i].active || strategies[i].allocation == 0) continue;
            uint256 portion = (amount * strategies[i].allocation) / BPS;
            if (portion == 0) continue;
            strategies[i].deployed += portion;
        }
    }
    function _withdrawFromStrategies(uint256 needed) internal {
        for (uint256 i = 0; i < strategies.length; i++) {
            if (!strategies[i].active || strategies[i].deployed == 0) continue;
            uint256 pull = needed > strategies[i].deployed ? strategies[i].deployed : needed;
            _withdrawFromStrategy(i, pull);
            needed -= pull;
            if (needed == 0) break;
        }
    }
    function _withdrawFromStrategy(uint256 id, uint256 amount) internal { strategies[id].deployed -= amount; }
    function harvest(uint256 yieldAmount) external onlyStrategist nonReentrant {
        if (yieldAmount == 0) return;
        uint256 fee = (yieldAmount * performanceFee) / BPS;
        totalAssets += yieldAmount - fee;
        totalYieldEarned += yieldAmount;
        if (fee > 0) asset.safeTransfer(feeRecipient, fee);
        lastHarvest = block.timestamp;
        emit Harvested(yieldAmount, fee, block.timestamp);
    }
    function setFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert InvalidAllocation();
        performanceFee = newFee;
        emit FeeUpdated(newFee);
    }
    function setFeeRecipient(address r) external onlyOwner { feeRecipient = r; }
    function setStrategist(address s) external onlyOwner { strategist = s; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function emergencyWithdrawAll() external nonReentrant {
        uint256 shares = balanceOf(msg.sender);
        if (shares == 0) revert ZeroAmount();
        uint256 assets = _convertToAssets(shares);
        _burn(msg.sender, shares);
        totalAssets -= assets;
        asset.safeTransfer(msg.sender, assets);
    }
    function getStrategyCount() external view returns (uint256) { return strategies.length; }
    function getStrategy(uint256 id) external view returns (Strategy memory) { return strategies[id]; }
    function getUserInfo(address user) external view returns (uint256 shares, uint256 assets, uint256 deposited, uint256 depositTime) {
        shares = balanceOf(user);
        assets = _convertToAssets(shares);
        deposited = userDeposited[user];
        depositTime = depositedAt[user];
    }
    function getVaultStats() external view returns (uint256 _totalAssets, uint256 _totalShares, uint256 _pricePerShare, uint256 _totalYield, uint256 _lastHarvest, uint256 _fee) {
        _totalAssets = totalAssets;
        _totalShares = totalSupply();
        _pricePerShare = totalSupply() == 0 ? 1e18 : (totalAssets * 1e18) / totalSupply();
        _totalYield = totalYieldEarned;
        _lastHarvest = lastHarvest;
        _fee = performanceFee;
    }
}
