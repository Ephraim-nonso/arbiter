#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"

mkdir -p "$BUILD_DIR"

if ! command -v circom >/dev/null 2>&1; then
  echo "circom not found. Install it first (see zk/README.md)."
  exit 1
fi

echo "[1/6] Compile circuit..."
# Allow includes from node_modules (circomlib).
circom "$ROOT_DIR/circuits/policy.circom" -l "$ROOT_DIR/node_modules" --r1cs --wasm --sym -o "$BUILD_DIR"

echo "[2/6] Generate Powers of Tau (local, small)..."
# 14 powers is plenty for this tiny circuit; increase if circuit grows.
npx snarkjs powersoftau new bn128 14 "$BUILD_DIR/pot14_0000.ptau" -v
npx snarkjs powersoftau contribute "$BUILD_DIR/pot14_0000.ptau" "$BUILD_DIR/pot14_0001.ptau" --name="arbiter" -v -e="arbiter"
npx snarkjs powersoftau prepare phase2 "$BUILD_DIR/pot14_0001.ptau" "$BUILD_DIR/pot14_final.ptau" -v

echo "[3/6] Groth16 setup..."
npx snarkjs groth16 setup "$BUILD_DIR/policy.r1cs" "$BUILD_DIR/pot14_final.ptau" "$BUILD_DIR/policy_0000.zkey"
npx snarkjs zkey contribute "$BUILD_DIR/policy_0000.zkey" "$BUILD_DIR/policy_final.zkey" --name="arbiter" -v -e="arbiter"

echo "[4/6] Export verification key..."
npx snarkjs zkey export verificationkey "$BUILD_DIR/policy_final.zkey" "$BUILD_DIR/verification_key.json"

echo "[5/6] Export Solidity verifier into contracts..."
CONTRACTS_VERIFIER="$ROOT_DIR/../contracts/src/verifiers/PolicyGroth16Verifier.sol"
mkdir -p "$(dirname "$CONTRACTS_VERIFIER")"
npx snarkjs zkey export solidityverifier "$BUILD_DIR/policy_final.zkey" "$CONTRACTS_VERIFIER"

echo "[6/6] Done."
echo "Generated verifier: $CONTRACTS_VERIFIER"
echo "Build artifacts: $BUILD_DIR"


