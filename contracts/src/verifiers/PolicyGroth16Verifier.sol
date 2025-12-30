// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Placeholder Groth16 verifier.
/// @dev This file is OVERWRITTEN by `zk/scripts/build_groth16.sh` with a snarkjs-generated verifier.
///      It exists so the repo compiles before you generate the real verifier.
contract PolicyGroth16Verifier {
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[] calldata
    ) external pure returns (bool) {
        return false;
    }
}


