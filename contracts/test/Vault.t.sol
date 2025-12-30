// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {Vault} from "../src/Vault.sol";
import {Router} from "../src/Router.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract VaultTest is Test {
    Vault internal vaultImpl;
    Router internal router;
    MockVerifier internal verifier;
    VaultFactory internal factory;
    Vault internal vault;

    address internal owner = address(0xA11CE);
    address internal agent = address(0xB0B);
    bytes32 internal policy = keccak256("policy-v0");

    function setUp() public {
        router = new Router();
        verifier = new MockVerifier();
        vaultImpl = new Vault();
        factory = new VaultFactory(address(vaultImpl));
        vault = Vault(payable(factory.createVault(owner, policy, address(router), address(verifier))));

        vm.prank(owner);
        vault.setAgent(agent, true);
    }

    function test_executeWithProof_incrementsNonce() public {
        Router.Call[] memory calls = new Router.Call[](0);
        bytes memory proof = hex"1234";

        uint256[] memory publicInputs = new uint256[](4);
        publicInputs[0] = uint256(policy);
        publicInputs[1] = uint256(uint160(address(vault)));
        publicInputs[2] = 0;
        publicInputs[3] = 0;

        vm.prank(agent);
        vault.executeWithProof(calls, proof, publicInputs);

        assertEq(vault.nonce(), 1);
    }

    function test_factorySetsOwnerAndPolicy() public {
        assertEq(vault.owner(), owner);
        assertEq(vault.policyHash(), policy);
        assertEq(address(vault.router()), address(router));
        assertEq(address(vault.verifier()), address(verifier));
    }
}


