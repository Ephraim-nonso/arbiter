use anyhow::Context;
use serde::Deserialize;

/// Minimal subset of DefiLlama yields pool schema we care about.
#[derive(Debug, Clone, Deserialize)]
pub struct LlamaPool {
    pub pool: String,
    pub chain: String,
    pub project: String,
    pub symbol: String,
    #[serde(default)]
    pub apy: f64,
    #[serde(rename = "tvlUsd", default)]
    pub tvl_usd: f64,
}

#[derive(Debug, Deserialize)]
struct LlamaPoolsResponse {
    data: Vec<LlamaPool>,
}

pub async fn fetch_defillama_pools() -> anyhow::Result<Vec<LlamaPool>> {
    let url = std::env::var("LLAMA_POOLS_URL")
        .unwrap_or_else(|_| "https://yields.llama.fi/pools".to_string());

    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .context("failed to fetch DefiLlama pools")?
        .error_for_status()
        .context("DefiLlama pools returned non-200")?
        .json::<LlamaPoolsResponse>()
        .await
        .context("failed to parse DefiLlama pools JSON")?;

    Ok(resp.data)
}

pub fn select_top_pools(
    pools: &[LlamaPool],
    chain: &str,
    stable_hint: &str,
    top_k: usize,
) -> Vec<LlamaPool> {
    let chain_lc = chain.to_lowercase();
    let hint_lc = stable_hint.to_lowercase();

    let mut filtered: Vec<LlamaPool> = pools
        .iter()
        .cloned()
        .filter(|p| p.chain.to_lowercase() == chain_lc)
        .filter(|p| p.symbol.to_lowercase().contains(&hint_lc))
        // MVP sanity filters (avoid obvious junk)
        .filter(|p| p.tvl_usd >= 50_000.0)
        .filter(|p| p.apy.is_finite() && p.apy > 0.0 && p.apy < 1_000_000.0)
        .collect();

    filtered.sort_by(|a, b| b.apy.partial_cmp(&a.apy).unwrap_or(std::cmp::Ordering::Equal));
    filtered.truncate(top_k);
    filtered
}


