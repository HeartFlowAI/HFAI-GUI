const { fetchMintSafety } = require('./solana');

// Public, key-free endpoints. Kept as constants so they can be swapped or
// upgraded to Helius/Birdeye later without touching callers.
const JUPITER_PRICE = 'https://lite-api.jup.ag/price/v3';
const DEXSCREENER = 'https://api.dexscreener.com/latest/dex';

function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function pairSummary(pair) {
  return {
    dex: pair.dexId || '', chain: pair.chainId || '', url: pair.url || '',
    address: pair.baseToken?.address || '', symbol: pair.baseToken?.symbol || '', name: pair.baseToken?.name || '',
    priceUsd: number(pair.priceUsd), change24h: number(pair.priceChange?.h24),
    liquidityUsd: number(pair.liquidity?.usd), volume24h: number(pair.volume?.h24),
    marketCap: number(pair.marketCap || pair.fdv), fdv: number(pair.fdv)
  };
}
async function jupiterPrices(mints, { fetchImpl = fetch, signal } = {}) {
  const ids = [...new Set((Array.isArray(mints) ? mints : []).filter(Boolean))];
  if (!ids.length) return {};
  const response = await fetchImpl(`${JUPITER_PRICE}?ids=${ids.join(',')}`, { signal });
  if (!response.ok) throw new Error(`Jupiter price responded ${response.status}.`);
  const body = await response.json();
  const quotes = {};
  for (const id of ids) {
    const entry = body?.data?.[id] || body?.[id];
    if (!entry) continue;
    const price = Number(entry.usdPrice ?? entry.price);
    if (!Number.isFinite(price)) continue;
    quotes[id] = { price, change24h: number(entry.priceChange24h ?? entry.change24h) };
  }
  return quotes;
}
async function searchTokens(query, { fetchImpl = fetch, signal } = {}) {
  if (typeof query !== 'string' || !query.trim()) return [];
  const response = await fetchImpl(`${DEXSCREENER}/search?q=${encodeURIComponent(query.trim())}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  const solana = (body?.pairs || []).filter(pair => pair.chainId === 'solana');
  return solana.slice(0, 25).map(pairSummary);
}
async function pairForToken(mint, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`${DEXSCREENER}/tokens/v1/solana/${encodeURIComponent(mint)}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const pairs = await response.json();
  const best = (Array.isArray(pairs) ? pairs : []).sort((a, b) => number(b?.liquidity?.usd) - number(a?.liquidity?.usd))[0];
  return best ? pairSummary(best) : null;
}
async function tokenSafety(mint, options = {}) {
  const safety = await fetchMintSafety(mint, options);
  if (!safety) return { known: false, level: 'unknown', flags: [] };
  const flags = [];
  if (!safety.mintRevoked) flags.push('mint authority active');
  if (!safety.freezeRevoked) flags.push('freeze authority active');
  const level = flags.length === 0 ? 'ok' : flags.length === 1 ? 'caution' : 'risk';
  return { known: true, level, flags, mintRevoked: safety.mintRevoked, freezeRevoked: safety.freezeRevoked };
}
module.exports = { JUPITER_PRICE, DEXSCREENER, jupiterPrices, searchTokens, pairForToken, tokenSafety };
