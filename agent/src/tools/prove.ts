import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const ProveOutputSchema = z.object({
  policyHash: z.string(),
  a: z.tuple([z.string(), z.string()]),
  b: z.tuple([
    z.tuple([z.string(), z.string()]),
    z.tuple([z.string(), z.string()]),
  ]),
  c: z.tuple([z.string(), z.string()]),
  publicInputs: z.array(z.string()),
});

export type ProveOutput = z.infer<typeof ProveOutputSchema>;

export async function proveWithNode({
  safe,
  nonce,
  deadline,
  allowBitmap,
  capsBpsCsv,
  allocationsCsv,
}: {
  safe: string;
  nonce: number;
  deadline: number;
  allowBitmap: number;
  capsBpsCsv: string;
  allocationsCsv: string;
}): Promise<ProveOutput> {
  const base =
    process.env.ZK_PROVER_CMD?.trim() || "node ../zk/scripts/prove.mjs";

  // We run via bash -lc so base can include spaces/flags.
  const cmd = `${base} --vault ${safe} --nonce ${nonce} --deadline ${deadline} --allowBitmap ${allowBitmap} --capsBps ${capsBpsCsv} --allocations ${allocationsCsv}`;

  const timeoutMs = Number(process.env.PROVE_TIMEOUT_MS ?? "300000"); // 5 minutes default
  const { stdout } = await execFileAsync("bash", ["-lc", cmd], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
  });

  const parsed = ProveOutputSchema.parse(JSON.parse(stdout));
  return parsed;
}

export const proveWithNodeMetadata = {
  name: "proveWithNode",
  description:
    "Generate a Groth16 proof by calling the repo's Node prover (zk/scripts/prove.mjs). Returns proof elements and public inputs.",
  schema: z.object({
    safe: z.string(),
    nonce: z.number().int().min(0),
    deadline: z.number().int().min(0),
    allowBitmap: z.number().int().min(0),
    capsBpsCsv: z
      .string()
      .describe("Comma-separated caps in bps, e.g. 10000,0,0,0,0"),
    allocationsCsv: z
      .string()
      .describe(
        "Comma-separated allocations in bps, sum=10000, e.g. 10000,0,0,0,0"
      ),
  }),
};
