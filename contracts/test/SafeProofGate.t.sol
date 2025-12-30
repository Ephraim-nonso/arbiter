// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";

import {Router} from "../src/Router.sol";
import {ProofGateSafeModule} from "../src/safe/ProofGateSafeModule.sol";

import {PolicyGroth16Verifier} from "../src/verifiers/PolicyGroth16Verifier.sol";
import {Groth16VerifierAdapter} from "../src/verifiers/Groth16VerifierAdapter.sol";

import {Safe} from "safe-contracts/Safe.sol";
import {SafeProxyFactory} from "safe-contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "safe-contracts/proxies/SafeProxy.sol";
import {Enum} from "safe-contracts/common/Enum.sol";

import {Safe4337Module} from "safe4337/Safe4337Module.sol";
import {SafeModuleSetup} from "safe4337/SafeModuleSetup.sol";

import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";

contract SafeProofGateTest is Test {
    using stdJson for string;

    uint256 internal ownerPk;
    address internal owner;
    address internal agent;

    Router internal router;
    PolicyGroth16Verifier internal groth16;
    Groth16VerifierAdapter internal verifier;
    ProofGateSafeModule internal proofGate;

    EntryPoint internal entryPoint;
    Safe4337Module internal safe4337;
    SafeModuleSetup internal moduleSetup;

    Safe internal singleton;
    SafeProxyFactory internal factory;

    struct ProofData {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] publicInputs;
        bytes proofBytes;
    }

    function setUp() public {
        ownerPk = 0xA11CE;
        owner = vm.addr(ownerPk);
        agent = address(0xB0B);

        router = new Router();
        groth16 = new PolicyGroth16Verifier();
        verifier = new Groth16VerifierAdapter(address(groth16));
        proofGate = new ProofGateSafeModule(address(verifier), address(router));

        entryPoint = new EntryPoint();
        safe4337 = new Safe4337Module(address(entryPoint));
        moduleSetup = new SafeModuleSetup();

        singleton = new Safe();
        factory = new SafeProxyFactory();
    }

    function test_safe_proof_gated_router_exec() public {
        bool run = vm.envOr("RUN_ZK_E2E", false);
        if (!run) return;
        Safe safe = _createSafe();
        vm.deal(address(safe), 10 ether);

        ProofData memory p = _proveForSafe(address(safe));

        _safeExec(ownerPk, safe, address(proofGate), 0, abi.encodeWithSelector(ProofGateSafeModule.setPolicyHash.selector, bytes32(p.publicInputs[0])));
        _safeExec(ownerPk, safe, address(proofGate), 0, abi.encodeWithSelector(ProofGateSafeModule.setAgent.selector, agent, true));

        Router.Call[] memory calls = new Router.Call[](0);
        vm.prank(agent);
        proofGate.executeWithProof(address(safe), calls, p.proofBytes, p.publicInputs);

        assertEq(proofGate.nonceOf(address(safe)), 1);
    }

    function _createSafe() internal returns (Safe safe) {
        address[] memory owners = new address[](1);
        owners[0] = owner;

        address[] memory modules = new address[](2);
        modules[0] = address(safe4337);
        modules[1] = address(proofGate);

        bytes memory setupData = abi.encodeWithSelector(SafeModuleSetup.enableModules.selector, modules);

        bytes memory initializer = abi.encodeWithSelector(
            Safe.setup.selector,
            owners,
            uint256(1),
            address(moduleSetup),
            setupData,
            address(safe4337),
            address(0),
            uint256(0),
            payable(address(0))
        );

        SafeProxy proxy = factory.createProxyWithNonce(address(singleton), initializer, 1);
        safe = Safe(payable(address(proxy)));
    }

    function _proveForSafe(address safeAddr) internal returns (ProofData memory p) {
        string[] memory cmd = new string[](3);
        cmd[0] = "bash";
        cmd[1] = "-lc";
        cmd[2] = string.concat(
            "cd ../zk && node scripts/prove.mjs",
            " --vault ",
            vm.toString(safeAddr),
            " --nonce 0",
            " --deadline 0",
            " --allowBitmap 1",
            " --capsBps 10000,0,0,0,0",
            " --allocations 10000,0,0,0,0"
        );

        bytes memory out = vm.ffi(cmd);
        string memory json = string(out);

        p.a = abi.decode(json.parseRaw(".a"), (uint256[2]));
        p.b = abi.decode(json.parseRaw(".b"), (uint256[2][2]));
        p.c = abi.decode(json.parseRaw(".c"), (uint256[2]));
        p.publicInputs = abi.decode(json.parseRaw(".publicInputs"), (uint256[]));
        p.proofBytes = abi.encode(p.a, p.b, p.c);
    }

    function _safeExec(
        uint256 pk,
        Safe safe,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        // Build Safe tx and sign it (threshold=1). Use zeroed gas fields for tests.
        bytes32 txHash = safe.getTransactionHash(
            to,
            value,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            address(0),
            safe.nonce()
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, txHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        bool ok = safe.execTransaction(
            to,
            value,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            sig
        );
        require(ok, "SAFE_TX_FAILED");
    }
}


