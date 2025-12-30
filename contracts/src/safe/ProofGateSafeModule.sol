// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IVerifier} from "../interfaces/IVerifier.sol";
import {Router} from "../Router.sol";

import {Safe} from "safe-contracts/Safe.sol";
import {Enum} from "safe-contracts/common/Enum.sol";

/// @notice Safe module that proof-gates execution.
/// @dev Flow:
///      - Safe owners install this module (Safe ModuleManager).
///      - Owners configure `policyHash` and allowlisted agent(s) via Safe tx calling this module.
///      - Agent calls `executeWithProof(...)` directly (EOA tx or via Safe4337Module UserOp),
///        module verifies proof and triggers Safe.execTransactionFromModule(...) to execute Router.
contract ProofGateSafeModule {
    error NotSafe();
    error NotAuthorizedAgent(address agent);
    error ProofInvalid();
    error DeadlineExpired(uint256 deadline, uint256 nowTs);
    error BadNonce(uint256 expected, uint256 provided);
    error PolicyNotSet();

    event PolicySet(address indexed safe, bytes32 indexed policyHash);
    event AgentSet(address indexed safe, address indexed agent, bool enabled);
    event ExecutedWithProof(address indexed safe, address indexed agent, bytes32 indexed policyHash, bytes32 proofHash, uint256 nonce);

    IVerifier public immutable verifier;
    Router public immutable router;

    mapping(address safe => bytes32 policyHash) public policyHashOf;
    mapping(address safe => uint256 nonce) public nonceOf;
    mapping(address safe => mapping(address agent => bool enabled)) public agentEnabled;

    constructor(address _verifier, address _router) {
        verifier = IVerifier(_verifier);
        router = Router(_router);
    }

    /// @notice Configure the policy hash for a given Safe.
    /// @dev Must be called FROM the Safe itself (via Safe tx), so only owners can change policy.
    function setPolicyHash(bytes32 newPolicyHash) external {
        address safe = msg.sender;
        // When invoked via Safe, msg.sender is the Safe.
        // If a user calls directly, it won't be a Safe (cannot be fully proven here, but enough for MVP).
        if (!_isSafe(safe)) revert NotSafe();
        policyHashOf[safe] = newPolicyHash;
        emit PolicySet(safe, newPolicyHash);
    }

    /// @notice Enable/disable an agent for the calling Safe.
    /// @dev Must be called FROM the Safe itself (via Safe tx).
    function setAgent(address agent, bool enabled) external {
        address safe = msg.sender;
        if (!_isSafe(safe)) revert NotSafe();
        agentEnabled[safe][agent] = enabled;
        emit AgentSet(safe, agent, enabled);
    }

    /// @notice Execute a Router batch if a Groth16 proof validates policy constraints.
    /// @dev publicInputs convention (updated):
    ///      publicInputs[0] = uint256(policyHash)
    ///      publicInputs[1] = uint256(uint160(safe))
    ///      publicInputs[2] = nonce
    ///      publicInputs[3] = deadline
    ///      publicInputs[4] = allowBitmap
    function executeWithProof(
        address safe,
        Router.Call[] calldata calls,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external {
        if (!agentEnabled[safe][msg.sender]) revert NotAuthorizedAgent(msg.sender);
        bytes32 safePolicyHash = policyHashOf[safe];
        if (safePolicyHash == bytes32(0)) revert PolicyNotSet();

        if (publicInputs.length < 5) revert ProofInvalid();

        if (bytes32(publicInputs[0]) != safePolicyHash) revert ProofInvalid();
        if (address(uint160(publicInputs[1])) != safe) revert ProofInvalid();

        uint256 expected = nonceOf[safe];
        if (publicInputs[2] != expected) revert BadNonce(expected, publicInputs[2]);

        uint256 deadline = publicInputs[3];
        if (deadline != 0 && block.timestamp > deadline) revert DeadlineExpired(deadline, block.timestamp);

        if (!verifier.verify(proof, publicInputs)) revert ProofInvalid();

        nonceOf[safe] = expected + 1;

        uint256 allowBitmap = publicInputs[4];
        bytes memory data = abi.encodeWithSelector(Router.executeWithAllowBitmap.selector, allowBitmap, calls);
        bool ok = Safe(payable(safe)).execTransactionFromModule(address(router), 0, data, Enum.Operation.Call);
        require(ok, "SAFE_EXEC_FAILED");

        emit ExecutedWithProof(safe, msg.sender, safePolicyHash, keccak256(proof), expected);
    }

    function _isSafe(address a) internal view returns (bool) {
        // Minimal heuristic: Safe has `getOwners()` selector and non-empty code.
        if (a.code.length == 0) return false;
        (bool ok, bytes memory ret) = a.staticcall(abi.encodeWithSignature("getOwners()"));
        return ok && ret.length > 0;
    }
}


