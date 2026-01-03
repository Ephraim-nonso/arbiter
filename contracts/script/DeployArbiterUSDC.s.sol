// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {ArbiterUSDC} from "../src/mocks/ArbiterUSDC.sol";

/// @notice Deploy ARBITER_USDC mock token and mint initial supply to owner.
/// @dev Run:
///   forge script script/DeployArbiterUSDC.s.sol:DeployArbiterUSDC --rpc-url mantle_sepolia --broadcast --private-key $PRIVATE_KEY
///
/// Env:
/// - TOKEN_OWNER (optional): owner address for minting admin (defaults to msg.sender)
/// - INITIAL_MINT_USDC (optional): amount in whole USDC units (6 decimals). Default = 1,000,000 USDC.
contract DeployArbiterUSDC is Script {
    function run() external {
        vm.startBroadcast();

        address owner = vm.envOr("TOKEN_OWNER", msg.sender);
        uint256 initialMintUsdc = vm.envOr("INITIAL_MINT_USDC", uint256(1_000_000));
        uint256 amount = initialMintUsdc * 1e6; // 6 decimals

        ArbiterUSDC token = new ArbiterUSDC(owner);
        token.mint(owner, amount);

        vm.stopBroadcast();

        console2.log("Deployed ARBITER_USDC:", address(token));
        console2.log("Owner:", owner);
        console2.log("Initial mint (micros):", amount);
    }
}


