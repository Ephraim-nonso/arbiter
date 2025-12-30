// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IVerifier} from "./interfaces/IVerifier.sol";
import {Router} from "./Router.sol";

/// @notice Minimal "vault smart account" that holds funds and gates execution by ZK proof.
contract Vault {
    // ========= Errors =========
    error NotOwner();
    error AlreadyInitialized();
    error ZeroAddress();
    error AgentNotAuthorized(address agent);
    error ProofInvalid();
    error DeadlineExpired(uint256 deadline, uint256 nowTs);
    error BadNonce(uint256 expected, uint256 provided);

    // ========= Events =========
    event PolicyUpdated(bytes32 indexed oldPolicyHash, bytes32 indexed newPolicyHash);
    event AgentSet(address indexed agent, bool enabled);
    event RouterSet(address indexed oldRouter, address indexed newRouter);
    event VerifierSet(address indexed oldVerifier, address indexed newVerifier);
    event ExecutedWithProof(
        address indexed vault,
        address indexed agent,
        bytes32 indexed policyHash,
        bytes32 proofHash,
        uint256 nonce
    );

    // ========= Storage =========
    address public owner;
    bytes32 public policyHash;
    uint256 public nonce;

    Router public router;
    IVerifier public verifier;

    mapping(address agent => bool enabled) public agentEnabled;
    bool private initialized;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Locks the implementation contract so it can't be initialized directly.
    ///      (Clones do not run the constructor, so clones still start uninitialized.)
    constructor() {
        initialized = true;
    }

    /// @notice One-time initializer for EIP-1167 clones.
    function initialize(address _owner, bytes32 _policyHash, address _router, address _verifier) external {
        if (initialized) revert AlreadyInitialized();
        if (_owner == address(0) || _router == address(0) || _verifier == address(0)) revert ZeroAddress();

        initialized = true;
        owner = _owner;
        policyHash = _policyHash;
        router = Router(_router);
        verifier = IVerifier(_verifier);
    }

    // ========= Admin =========
    function setPolicyHash(bytes32 newPolicyHash) external onlyOwner {
        bytes32 old = policyHash;
        policyHash = newPolicyHash;
        emit PolicyUpdated(old, newPolicyHash);
    }

    function setAgent(address agent, bool enabled) external onlyOwner {
        agentEnabled[agent] = enabled;
        emit AgentSet(agent, enabled);
    }

    function setRouter(address newRouter) external onlyOwner {
        address old = address(router);
        router = Router(newRouter);
        emit RouterSet(old, newRouter);
    }

    function setVerifier(address newVerifier) external onlyOwner {
        address old = address(verifier);
        verifier = IVerifier(newVerifier);
        emit VerifierSet(old, newVerifier);
    }

    // ========= Funds =========
    receive() external payable {}

    // ========= ZK-gated execution =========
    /// @notice Execute actions via Router if a ZK proof validates against this vault + policy.
    /// @dev Public input convention (MVP):
    ///      publicInputs[0] = uint256(policyHash)
    ///      publicInputs[1] = uint256(uint160(address(this)))
    ///      publicInputs[2] = nonce
    ///      publicInputs[3] = deadline (0 means no deadline)
    function executeWithProof(
        Router.Call[] calldata calls,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external payable {
        if (!agentEnabled[msg.sender]) revert AgentNotAuthorized(msg.sender);
        if (publicInputs.length < 4) revert ProofInvalid();

        bytes32 piPolicyHash = bytes32(publicInputs[0]);
        address piVault = address(uint160(publicInputs[1]));
        uint256 piNonce = publicInputs[2];
        uint256 deadline = publicInputs[3];

        if (piPolicyHash != policyHash) revert ProofInvalid();
        if (piVault != address(this)) revert ProofInvalid();

        uint256 expected = nonce;
        if (piNonce != expected) revert BadNonce(expected, piNonce);

        if (deadline != 0 && block.timestamp > deadline) revert DeadlineExpired(deadline, block.timestamp);
        if (!verifier.verify(proof, publicInputs)) revert ProofInvalid();

        // Effects before interactions
        nonce = expected + 1;

        // Interactions
        // If allowBitmap is present as an extra public input, enforce router target allowlisting.
        // This keeps per-vault allowlisting off-chain (policyHash) while still enforcing on-chain routing safety.
        if (publicInputs.length >= 5) {
            uint256 allowBitmap = publicInputs[4];
            router.executeWithAllowBitmap{value: msg.value}(allowBitmap, calls);
        } else {
            router.execute{value: msg.value}(calls);
        }

        emit ExecutedWithProof(address(this), msg.sender, policyHash, keccak256(proof), piNonce);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}


