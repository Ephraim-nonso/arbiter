// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {Router} from "../src/Router.sol";
import {Groth16Verifier} from "../src/verifiers/PolicyGroth16Verifier.sol";
import {Groth16VerifierAdapter} from "../src/verifiers/Groth16VerifierAdapter.sol";
import {ProofGateSafeModule} from "../src/safe/ProofGateSafeModule.sol";

/// @notice Deploy Router + Groth16 verifier + adapter + ProofGateSafeModule.
/// @dev Run (Mantle Sepolia example):
///   forge script script/DeployProofGateStack.s.sol:DeployProofGateStack --rpc-url $MANTLE_SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY
///
/// Optional env vars:
/// - ROUTER_OWNER: if set, transfers Router ownership after deploy (useful if you want a different admin for allowlists).
contract DeployProofGateStack is Script {
    function run() external {
        vm.startBroadcast();

        Router router = new Router();
        Groth16Verifier groth16 = new Groth16Verifier();
        Groth16VerifierAdapter adapter = new Groth16VerifierAdapter(address(groth16));
        ProofGateSafeModule proofGate = new ProofGateSafeModule(address(adapter), address(router));

        // Optional: hand Router admin to a different address for allowlist management
        address routerOwner = vm.envOr("ROUTER_OWNER", address(0));
        if (routerOwner != address(0)) {
            router.setOwner(routerOwner);
        }

        vm.stopBroadcast();

        console2.log("Deployed contracts:");
        console2.log("Router:", address(router));
        console2.log("Groth16Verifier (snarkjs):", address(groth16));
        console2.log("Groth16VerifierAdapter:", address(adapter));
        console2.log("ProofGateSafeModule:", address(proofGate));
        console2.log("Router owner:", router.owner());
    }
}


// forge verify-contract \
//   --verifier-url "https://api.etherscan.io/v2/api?chainid=5003" \
//   --etherscan-api-key  6PJNXSBJ3RC79WYI7HPT68T62F4DRQ8PIM\
//   0xfc31138946c9169FF907502cFBd260A2b963Cd28 \src/Router.sol:Router --watch

//   Deployed contracts:
//   Router: 0xfc31138946c9169FF907502cFBd260A2b963Cd28
//   Groth16Verifier (snarkjs): 0x5Af33372dd96C47B95A87d0881E97dC8caa998Ca
//   Groth16VerifierAdapter: 0xB2f0c4D4F64564789C61e719713604155E2ED313
//   ProofGateSafeModule: 0x4b692CB6324DC5e031C717183552E3D323942984
//   Router owner: 0x00cB231aB0d44BB6eEBCb8d7b4a69B3aeBFFdCd5
//  Deployed ARBITER_USDC: 0x41895F42569Bf533fDd688994B64E0728fD395Ea
//agent - 0x2A5503650D4944Da59c8dD426A92E4E8aF4515c9