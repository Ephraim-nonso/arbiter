// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";

import {Router} from "../src/Router.sol";
import {ProtocolIds} from "../src/libraries/ProtocolIds.sol";

/// @notice One-shot script to configure Router target allowlisting.
/// @dev Run (example):
///   ROUTER=0x... forge script script/ConfigureRouter.s.sol:ConfigureRouter --rpc-url $RPC_URL --broadcast
contract ConfigureRouter is Script {
    // Ondo Finance (Mantle) – provided by user
    address internal constant ONDO_USDY = 0x05Be26527e817998A7206475496FDe1e68957c5a;
    // Mantle USD (replaces OUSG in our product)
    address internal constant ONDO_MANTLE_USD = 0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3;

    function run() external {
        address routerAddr = vm.envAddress("ROUTER");
        Router router = Router(routerAddr);

        vm.startBroadcast();

        // ProtocolId 0 (Ondo): allow Router to call Ondo token/vault contracts.
        // NOTE: Depending on the exact integration, you may also need to register additional Ondo
        // contracts (vault/router) beyond the token addresses. Keep Router targets tight.
        address[] memory ondoTargets = new address[](2);
        ondoTargets[0] = ONDO_USDY;
        ondoTargets[1] = ONDO_MANTLE_USD;
        router.setTargetsProtocolId(ondoTargets, ProtocolIds.ONDO);

        // TODO(arbiter): AGNI
        // - USDe/COOK pool contract address
        // - USDT/axlUSDC pool contract address
        // Then: router.setTargetsProtocolId(agniTargets, ProtocolIds.AGNI);

        // TODO(arbiter): INIT Capital
        // - USDC Lending Pool contract address
        // - USDC Looping Hook contract address
        // Then: router.setTargetsProtocolId(initTargets, ProtocolIds.INIT);

        // TODO(arbiter): Mantle Rewards
        // - Pendle USDe Pool contract address
        // - Bybit Mantle Vault contract address
        // Then: router.setTargetsProtocolId(mantleRewardsTargets, ProtocolIds.MANTLE_REWARDS);

        // TODO(arbiter): Stargate
        // - USDC pool contract address (earning STG rewards)
        // Then: router.setTargetsProtocolId(stargateTargets, ProtocolIds.STARGATE);

        vm.stopBroadcast();
    }
}


