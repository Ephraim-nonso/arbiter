// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IVerifier} from "../interfaces/IVerifier.sol";

/// @notice Adapter that lets the Vault use a snarkjs-exported Groth16 verifier.
/// @dev Proof encoding expected by `verify`:
///      proofBytes = abi.encode(uint256[2] a, uint256[2][2] b, uint256[2] c)
contract Groth16VerifierAdapter is IVerifier {
    error BadProofEncoding();

    IGroth16Verifier public immutable groth16Verifier;

    constructor(address verifier) {
        groth16Verifier = IGroth16Verifier(verifier);
    }

    function verify(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool) {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) =
            abi.decode(proof, (uint256[2], uint256[2][2], uint256[2]));

        // snarkjs verifiers typically accept public signals as uint256[].
        return groth16Verifier.verifyProof(a, b, c, publicInputs);
    }
}

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata input
    ) external view returns (bool);
}


