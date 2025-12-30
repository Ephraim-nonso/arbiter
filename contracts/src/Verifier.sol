// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IVerifier} from "./interfaces/IVerifier.sol";

/// @notice Placeholder verifier.
/// @dev Replace this contract with a generated verifier from Noir/circom once the circuit is ready.
///      We keep this in `src/` so deployments can point at a verifier address, but it should NOT
///      be used in production.
contract Verifier is IVerifier {
    function verify(bytes calldata, uint256[] calldata) external pure returns (bool) {
        // Fail closed by default.
        return false;
    }
}


