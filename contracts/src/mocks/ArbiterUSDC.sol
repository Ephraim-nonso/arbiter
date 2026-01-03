// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simple 6-decimal ERC20 mock for testing vault deposits.
/// @dev Not production-safe. Owner can mint.
contract ArbiterUSDC is ERC20, Ownable {
    constructor(address owner_) ERC20("Arbiter USDC", "ARBITER_USDC") Ownable(owner_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}


