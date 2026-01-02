// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Canonical protocol id assignments used by:
/// - ZK circuit `zk/circuits/policy.circom` (bitmap + allocations index)
/// - Router `targetProtocolId[target] -> protocolId`
/// - Off-chain agent allocation planner
library ProtocolIds {
    // N=5 fixed vector (must stay consistent across codebase)
    uint8 internal constant ONDO = 0;
    uint8 internal constant AGNI = 1;
    uint8 internal constant STARGATE = 2;
    uint8 internal constant MANTLE_REWARDS = 3;
    uint8 internal constant INIT = 4;
}


