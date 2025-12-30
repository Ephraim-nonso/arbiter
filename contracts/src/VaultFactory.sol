// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Clones} from "./libraries/Clones.sol";
import {Vault} from "./Vault.sol";

/// @notice Minimal factory for creating Vault instances via EIP-1167 clones.
contract VaultFactory {
    using Clones for address;

    error ZeroAddress();

    event VaultCreated(address indexed vault, address indexed owner, bytes32 indexed policyHash, address router, address verifier);
    event ImplementationSet(address indexed oldImplementation, address indexed newImplementation);

    address public implementation;

    constructor(address _implementation) {
        if (_implementation == address(0)) revert ZeroAddress();
        implementation = _implementation;
    }

    function setImplementation(address newImplementation) external {
        // MVP: no access control yet; wire to Ownable/multisig later.
        if (newImplementation == address(0)) revert ZeroAddress();
        address old = implementation;
        implementation = newImplementation;
        emit ImplementationSet(old, newImplementation);
    }

    /// @notice Create a new Vault clone and initialize it.
    function createVault(address owner, bytes32 policyHash, address router, address verifier) external returns (address vault) {
        vault = implementation.clone();
        Vault(payable(vault)).initialize(owner, policyHash, router, verifier);
        emit VaultCreated(vault, owner, policyHash, router, verifier);
    }

    /// @notice Create a deterministic (CREATE2) Vault clone and initialize it.
    function createVaultDeterministic(
        address owner,
        bytes32 policyHash,
        address router,
        address verifier,
        bytes32 salt
    ) external returns (address vault) {
        vault = implementation.cloneDeterministic(salt);
        Vault(payable(vault)).initialize(owner, policyHash, router, verifier);
        emit VaultCreated(vault, owner, policyHash, router, verifier);
    }

    function predictVaultAddress(bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, salt, address(this));
    }
}


