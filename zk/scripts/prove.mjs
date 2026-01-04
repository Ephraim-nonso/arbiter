import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function requireArg(flag) {
  const v = getArg(flag);
  if (v == null) {
    console.error(`Missing required arg: ${flag}`);
    process.exit(1);
  }
  return v;
}

function parseCsvNums(csv) {
  return csv.split(",").map((s) => s.trim()).filter(Boolean).map((s) => Number(s));
}

function toUint160(addr) {
  const a = addr.toLowerCase();
  if (!a.startsWith("0x") || a.length !== 42) throw new Error(`bad address: ${addr}`);
  return BigInt(a);
}

const vault = requireArg("--vault");
const nonce = Number(requireArg("--nonce"));
const deadline = Number(requireArg("--deadline"));
const allowBitmap = Number(requireArg("--allowBitmap"));
const capsCsv = requireArg("--capsBps");
const allocationsCsv = requireArg("--allocations");

const capsBps = parseCsvNums(capsCsv);
const allocations = parseCsvNums(allocationsCsv);
if (capsBps.length !== 5) throw new Error("capsBps must have 5 entries (for N=5 protocol vector)");
if (allocations.length !== 5) throw new Error("allocations must have 5 entries (for N=5 protocol vector)");

// Compute policyHash = Poseidon([allowBitmap, capsBps[0..4]]) to match the circuit.
const poseidon = await buildPoseidon();
const F = poseidon.F;
const policyHash = F.toObject(poseidon([allowBitmap, ...capsBps])).toString();

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const buildDir = path.join(rootDir, "build");
const wasmPath = path.join(buildDir, "policy_js", "policy.wasm");
const zkeyPath = path.join(buildDir, "policy_final.zkey");

if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
  throw new Error("Missing build artifacts. Run: ./scripts/build_groth16.sh");
}

const input = {
  vault: toUint160(vault).toString(),
  nonce,
  deadline,
  policyHash,
  allowBitmap,
  capsBps,
  allocations
};

const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
const callData = await groth16.exportSolidityCallData(proof, publicSignals);

// callData is a string like:
// ["a0","a1"],[["b00","b01"],["b10","b11"]],["c0","c1"],["pub0","pub1","pub2","pub3"]
// We parse it into structured JSON for Foundry.
const cleaned = callData.replace(/["\[\]\s]/g, "");
const parts = cleaned.split("],[[");
// Instead of brittle parsing, use JSON conversion trick:
const jsonish = "[" + callData + "]";
const parsed = JSON.parse(jsonish);
const [a, b, c, pubs] = parsed;

process.stdout.write(
  JSON.stringify(
    {
      policyHash: publicSignals[0],
      a,
      b,
      c,
      publicInputs: pubs
    },
    null,
    2
  )
);


