// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IVerifier} from "../../src/interfaces/IVerifier.sol";

contract MockVerifier is IVerifier {
    bool public result = true;

    function setResult(bool r) external {
        result = r;
    }

    function verify(bytes calldata, uint256[] calldata) external view returns (bool) {
        return result;
    }
}
