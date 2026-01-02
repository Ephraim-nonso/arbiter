use anyhow::Context;
use tokio::process::Command;

/// Output shape from `zk/scripts/prove.mjs`.
#[derive(Debug, serde::Deserialize)]
pub struct ProveOutput {
    pub policyHash: String,
    pub a: [String; 2],
    pub b: [[String; 2]; 2],
    pub c: [String; 2],
    pub publicInputs: Vec<String>,
}

/// Calls the existing Node prover (snarkjs) to produce Groth16 proof data.
///
/// TODO(arbiter): consider moving proving to Rust later. For MVP, Rust agent shells out to Node.
pub async fn prove_with_node(
    safe: &str,
    nonce: u64,
    deadline: u64,
    allow_bitmap: u64,
    caps_bps_csv: &str,
    allocations_csv: &str,
) -> anyhow::Result<ProveOutput> {
    // Default command mirrors repo layout.
    // You can override the base invocation via ZK_PROVER_CMD if needed.
    let base = std::env::var("ZK_PROVER_CMD").unwrap_or_else(|_| "node ../zk/scripts/prove.mjs".to_string());

    let cmd = format!(
        "{base} --vault {safe} --nonce {nonce} --deadline {deadline} --allowBitmap {allow_bitmap} --capsBps {caps_bps_csv} --allocations {allocations_csv}"
    );

    let out = Command::new("bash")
        .arg("-lc")
        .arg(cmd)
        .output()
        .await
        .context("failed to run node prover")?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("prover failed: {stderr}");
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let parsed: ProveOutput =
        serde_json::from_str(&stdout).context("failed to parse prover JSON output")?;
    Ok(parsed)
}


