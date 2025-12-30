// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice MVP execution router.
/// @dev In the hackathon build this will wrap a small allowlisted set of integrations.
contract Router {
    error NotOwner();
    error RouterCallFailed(uint256 index, address target, bytes data, bytes reason);
    error TargetNotAllowlisted(uint256 index, address target);

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    /// @notice Admin address for setting protocol target registry.
    /// @dev MVP-only. In production this should be a multisig or removed in favor of immutables.
    address public owner;

    /// @notice Maps a contract address to a protocolId (0..254). 255 means "unset".
    mapping(address target => uint8 protocolId) public targetProtocolId;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @notice Batch set targets to a protocol id.
    /// @dev Use protocolId=255 to "unset" a target.
    function setTargetsProtocolId(address[] calldata targets, uint8 protocolId) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            targetProtocolId[targets[i]] = protocolId;
        }
    }

    function execute(Call[] calldata calls) external payable returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory ret) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert RouterCallFailed(i, calls[i].target, calls[i].data, ret);
            results[i] = ret;
        }
    }

    /// @notice Execute calls, but require every call target to belong to a protocol whose bit is set.
    /// @dev Bit `p` in allowBitmap corresponds to protocolId `p`.
    function executeWithAllowBitmap(uint256 allowBitmap, Call[] calldata calls)
        external
        payable
        returns (bytes[] memory results)
    {
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            uint8 p = targetProtocolId[calls[i].target];
            if (p == 255) revert TargetNotAllowlisted(i, calls[i].target);

            // Check bit is set in allowBitmap
            if (((allowBitmap >> uint256(p)) & 1) == 0) revert TargetNotAllowlisted(i, calls[i].target);

            (bool ok, bytes memory ret) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert RouterCallFailed(i, calls[i].target, calls[i].data, ret);
            results[i] = ret;
        }
    }
}


