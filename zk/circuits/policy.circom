pragma circom 2.1.8;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// MVP circuit (protocol vector version, fixed N):
// - public binds: policyHash, vault, nonce, deadline
// - policyHash is computed in-circuit as Poseidon([allowBitmap, capsBps[0..N-1]])
// - constraints:
//    * sum allocations = 10000 bps
//    * each allocation <= capsBps[i] (per-protocol caps)
//    * if protocol i is not allowlisted, allocation[i] must be 0
//    * if protocol i is not allowlisted, capsBps[i] must be 0 (so caps are policy-bound and sane)
//
// Protocol IDs (N=5):
//  0: Ondo Finance
//  1: AGNI Finance
//  2: Stargate
//  3: Pendle
//  4: INIT Capital

template PolicyCircuit(N) {
    // Public bindings
    signal input vault;      // public (uint160 address)
    signal input nonce;      // public
    signal input deadline;   // public (0 = none)
    signal input policyHash; // public (must match Poseidon(allowBitmap, capsBps))

    // Private policy + proposal (kept private; the hash binds it on-chain)
    signal input allowBitmap;     // public bitset of allowlisted protocols (lowest N bits)
    signal input capsBps[N];      // private per-protocol caps (bps)
    signal input allocations[N];  // private

    // constrain allocations
    signal sum;

    // Feasibility: sum of per-protocol caps must allow a full allocation (>= 10000 bps).
    signal sumCaps;

    // Accumulators (Circom signals can only be assigned once).
    signal sumAcc[N + 1];
    signal sumCapsAcc[N + 1];
    sumAcc[0] <== 0;
    sumCapsAcc[0] <== 0;

    // Decompose allowBitmap into bits for the lowest N protocols.
    component allowBits = Num2Bits(N);
    allowBits.in <== allowBitmap;

    // Range checks / helpers per protocol (declare arrays outside loops).
    component capBits[N];
    component dBits[N];
    signal diff[N];

    // Compute policyHash = Poseidon(allowBitmap, capsBps[0..N-1])
    // For N=5 we use Poseidon(6).
    component h = Poseidon(1 + N);
    h.inputs[0] <== allowBitmap;
    for (var i = 0; i < N; i++) {
        h.inputs[1 + i] <== capsBps[i];
    }
    // Bind the provided public policyHash to the private caps + allowBitmap.
    h.out === policyHash;

    for (var i = 0; i < N; i++) {
        // Enforce caps are within a sane range (<= 16383; 10000 fits).
        capBits[i] = Num2Bits(14);
        capBits[i].in <== capsBps[i];

        // If protocol i is NOT allowlisted, capsBps[i] must be 0 (so a user can't "hide" caps off-chain)
        capsBps[i] * (1 - allowBits.out[i]) === 0;

        sumCapsAcc[i + 1] <== sumCapsAcc[i] + capsBps[i];

        // allocations[i] <= capsBps[i]
        // (capsBps[i] - allocations[i]) must be >= 0.
        // We enforce by requiring capsBps[i] - allocations[i] = diff and diff >= 0 by bit-range.
        diff[i] <== capsBps[i] - allocations[i];

        // range check diff in 14 bits (enough for <= 16383)
        dBits[i] = Num2Bits(14);
        dBits[i].in <== diff[i];

        // If protocol i is NOT allowlisted, allocations[i] must be 0:
        // allocations[i] * (1 - allowBits.out[i]) == 0
        allocations[i] * (1 - allowBits.out[i]) === 0;

        sumAcc[i + 1] <== sumAcc[i] + allocations[i];
    }

    // Finalize sums.
    sum <== sumAcc[N];
    sumCaps <== sumCapsAcc[N];

    // Enforce sumCaps >= 10000 via range check on (sumCaps - 10000).
    // With N=5, sumCaps max is 5*10000=50000, so diffCaps fits in 16 bits.
    signal diffCaps;
    diffCaps <== sumCaps - 10000;
    component diffCapsBits = Num2Bits(16);
    diffCapsBits.in <== diffCaps;

    // sum == 10000
    sum === 10000;
}

// Make allowBitmap public so on-chain can enforce router call target allowlisting
// without storing the entire policy (still bound by policyHash).
component main {public [policyHash, vault, nonce, deadline, allowBitmap]} = PolicyCircuit(5);


