// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Interface for a ZK verifier contract.
interface IVerifier {
    function verify(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}


