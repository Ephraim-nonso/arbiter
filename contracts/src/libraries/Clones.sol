// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Minimal EIP-1167 clone helpers (inspired by OpenZeppelin Clones).
library Clones {
    error CreateFailed();

    function clone(address implementation) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        if (instance == address(0)) revert CreateFailed();
    }

    function cloneDeterministic(address implementation, bytes32 salt) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, ptr, 0x37, salt)
        }
        if (instance == address(0)) revert CreateFailed();
    }

    function predictDeterministicAddress(
        address implementation,
        bytes32 salt,
        address deployer
    ) internal pure returns (address predicted) {
        bytes32 codeHash = keccak256(abi.encodePacked(_creationCodePrefix(), bytes20(implementation), _creationCodeSuffix()));
        bytes32 digest = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, codeHash));
        predicted = address(uint160(uint256(digest)));
    }

    function _creationCodePrefix() private pure returns (bytes memory) {
        return hex"3d602d80600a3d3981f3363d3d373d3d3d363d73";
    }

    function _creationCodeSuffix() private pure returns (bytes memory) {
        return hex"5af43d82803e903d91602b57fd5bf3";
    }
}


