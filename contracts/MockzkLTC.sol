// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract MockzkLTC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1000 * 1e18;
    mapping(address => uint256) public lastFaucet;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    constructor() ERC20("Mock zkLTC", "zkLTC") Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function faucet() external {
        require(block.timestamp >= lastFaucet[msg.sender] + FAUCET_COOLDOWN, "Cooldown active");
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
