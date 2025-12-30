// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";

import {Router} from "../src/Router.sol";
import {Vault} from "../src/Vault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {PolicyGroth16Verifier} from "../src/verifiers/PolicyGroth16Verifier.sol";
import {Groth16VerifierAdapter} from "../src/verifiers/Groth16VerifierAdapter.sol";

/// @notice End-to-end proof verification test (Groth16).
/// @dev Requires:
///      - `ffi = true` in foundry.toml
///      - zk artifacts built: `cd zk && npm i && ./scripts/build_groth16.sh`
/// Run with: `RUN_ZK_E2E=1 forge test`
contract ZkE2ETest is Test {
    using stdJson for string;

    function test_e2e_executeWithRealGroth16Proof() public {
        bool run = vm.envOr("RUN_ZK_E2E", false);
        if (!run) return;

        Router router = new Router();

        // Deploy Groth16 verifier + adapter into our generic IVerifier shape.
        PolicyGroth16Verifier verifier = new PolicyGroth16Verifier();
        Groth16VerifierAdapter adapter = new Groth16VerifierAdapter(address(verifier));

        // Create vault via factory (clone)
        Vault impl = new Vault();
        VaultFactory factory = new VaultFactory(address(impl));
        Vault vault = Vault(payable(factory.createVault(address(this), bytes32(0), address(router), address(adapter))));

        // Generate proof via zk script (binds to this vault address)
        string[] memory cmd = new string[](3);
        cmd[0] = "bash";
        cmd[1] = "-lc";
        cmd[2] = string.concat(
            "cd ../zk && node scripts/prove.mjs",
            " --vault ",
            vm.toString(address(vault)),
            " --nonce 0",
            " --deadline 0",
            " --allowBitmap 1",
            " --capsBps 10000,0,0,0,0",
            " --allocations 10000,0,0,0,0"
        );

        bytes memory out = vm.ffi(cmd);
        string memory json = string(out);

        // Extract proof + public inputs
        uint256[2] memory a = abi.decode(json.parseRaw(".a"), (uint256[2]));
        uint256[2][2] memory b = abi.decode(json.parseRaw(".b"), (uint256[2][2]));
        uint256[2] memory c = abi.decode(json.parseRaw(".c"), (uint256[2]));
        uint256[] memory publicInputs = abi.decode(json.parseRaw(".publicInputs"), (uint256[]));

        // publicInputs[0] is policyHash (for now, 0 in circuit/script)
        vault.setPolicyHash(bytes32(publicInputs[0]));
        vault.setAgent(address(this), true);

        Router.Call[] memory calls = new Router.Call[](0);
        bytes memory proofBytes = abi.encode(a, b, c);

        vault.executeWithProof(calls, proofBytes, publicInputs);
        assertEq(vault.nonce(), 1);
    }
}


