use clap::Parser;

mod yields;
mod prover;

#[derive(Parser, Debug)]
#[command(name = "arbiter-agent", about = "Arbiter Rust agent (MVP scaffold)")]
struct Args {
    /// Pick up to K highest-yielding pools after filtering.
    #[arg(long, default_value_t = 7)]
    top_k: usize,

    /// Only keep pools on this chain (DefiLlama uses chain names like "Mantle").
    #[arg(long, default_value = "Mantle")]
    chain: String,

    /// Only keep pools that match this stable symbol hint (MVP filter).
    #[arg(long, default_value = "USDC")]
    stable_hint: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    let pools = yields::fetch_defillama_pools().await?;
    let selected = yields::select_top_pools(&pools, &args.chain, &args.stable_hint, args.top_k);

    println!("Selected {} pool(s):", selected.len());
    for p in &selected {
        println!(
            "- {} | {} | apy={:.2}% | tvl=${:.0} | pool={}",
            p.project, p.symbol, p.apy, p.tvl_usd, p.pool
        );
    }

    // TODO(arbiter): map selected pools -> per-protocol allocation vector (N=5),
    // produce Groth16 proof via zk/scripts/prove.mjs, and submit executeWithProof.
    //
    // Once you provide contract addresses for AGNI/INIT/MantleRewards/Stargate pools and you deploy:
    // - Router (configured with ProtocolIds target mapping)
    // - ProofGateSafeModule
    // the agent will:
    // 1) read nonce/policyHash from ProofGateSafeModule
    // 2) pick allocations <= caps, sum=10000
    // 3) call prover::prove_with_node(...)
    // 4) build Router.Call[] for deposits/swaps
    // 5) submit ProofGateSafeModule.executeWithProof(...)
    Ok(())
}


