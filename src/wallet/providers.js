const { fetchMintSafety, rpcCall, DEFAULT_RPC } = require('./solana');

// Public, key-free endpoints. Kept as constants so they can be swapped or
// upgraded to Helius/Birdeye later without touching callers.
const JUPITER_PRICE = 'https://lite-api.jup.ag/price/v3';
const JUPITER_PRO_PRICE = 'https://api.jup.ag/price/v3';
const DEXSCREENER = 'https://api.dexscreener.com/latest/dex';
const TOKEN_BOOSTS = 'https://api.dexscreener.com/token-boosts/top/v1';
const TOKEN_BOOSTS_LATEST = 'https://api.dexscreener.com/token-boosts/latest/v1';
const TOKEN_PROFILES = 'https://api.dexscreener.com/token-profiles/latest/v1';
const TAKEOVERS = 'https://api.dexscreener.com/community-takeovers/latest/v1';
const NARRATIVES = 'https://api.dexscreener.com/metas/trending/v1';
const RUGCHECK = 'https://api.rugcheck.xyz/v1/tokens';
const COINGECKO = 'https://api.coingecko.com/api/v3';
const BINANCE = 'https://api.binance.com/api/v3';
const HELIUS = 'https://api.helius.xyz/v0';
const GECKO = 'https://api.geckoterminal.com/api/v2';

function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function pairSummary(pair) {
  const txns = pair.txns || {};
  const links = [
    ...(Array.isArray(pair.info?.socials) ? pair.info.socials.map(item => ({ type: item?.type || 'social', url: item?.url || '' })) : []),
    ...(Array.isArray(pair.info?.websites) ? pair.info.websites.map(item => ({ type: 'website', url: item?.url || '' })) : [])
  ].filter(item => /^https:\/\//.test(item.url) && item.url.length <= 300).slice(0, 5);
  return {
    dex: pair.dexId || '', chain: pair.chainId || '', url: pair.url || '',
    address: pair.baseToken?.address || '', symbol: pair.baseToken?.symbol || '', name: pair.baseToken?.name || '', imageUrl: pair.info?.imageUrl || '', links,
    priceUsd: number(pair.priceUsd), change24h: number(pair.priceChange?.h24),
    change5m: number(pair.priceChange?.m5), change1h: number(pair.priceChange?.h1), change6h: number(pair.priceChange?.h6),
    liquidityUsd: number(pair.liquidity?.usd), volume24h: number(pair.volume?.h24),
    marketCap: number(pair.marketCap || pair.fdv), fdv: number(pair.fdv),
    buys1h: number(txns.h1?.buys), sells1h: number(txns.h1?.sells), buys24h: number(txns.h24?.buys), sells24h: number(txns.h24?.sells), createdAt: number(pair.pairCreatedAt)
  };
}
async function jupiterPrices(mints, { fetchImpl = fetch, signal, key = '' } = {}) {
  const ids = [...new Set((Array.isArray(mints) ? mints : []).filter(Boolean))];
  if (!ids.length) return {};
  const base = key ? JUPITER_PRO_PRICE : JUPITER_PRICE;
  const response = await fetchImpl(`${base}?ids=${ids.join(',')}`, { signal, ...(key ? { headers: { 'x-api-key': key } } : {}) });
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
  const response = await fetchImpl(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const pairs = await response.json();
  const all = Array.isArray(pairs) ? pairs : [];
  const own = all.filter(pair => pair && pair.baseToken && pair.baseToken.address === mint);
  const best = (own.length ? own : all).sort((a, b) => number(b?.liquidity?.usd) - number(a?.liquidity?.usd))[0];
  return best ? pairSummary(best) : null;
}
// Free price history (hourly points) for majors, used to seed charts so they are
// not empty on first open. CoinGecko ids only cover well-known tokens.
async function marketChart(url, days, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`${url}?vs_currency=usd&days=${days}`, { signal });
  if (!response.ok) throw new Error(`CoinGecko responded ${response.status}.`);
  const body = await response.json();
  return (body?.prices || []).map(([ms, usd]) => ({ t: Number(ms), p: Number(usd) })).filter(point => point.t > 0 && point.p > 0);
}
function coinHistory(coingeckoId, { fetchImpl = fetch, signal, days = 1 } = {}) {
  return marketChart(`${COINGECKO}/coins/${encodeURIComponent(coingeckoId)}/market_chart`, days, { fetchImpl, signal });
}
// History for any Solana token by mint, via CoinGecko's contract endpoint. Works
// for anything CoinGecko lists; unlisted tokens simply return an empty series.
function tokenHistory(mint, days = 30, { fetchImpl = fetch, signal } = {}) {
  return marketChart(`${COINGECKO}/coins/solana/contract/${encodeURIComponent(mint)}/market_chart`, days, { fetchImpl, signal });
}
const priceHistory = coinHistory;
// Binance public klines: generous limits, no key. Covers tokens with a USDT
// pair and is the primary chart source for those. Returns OHLC plus close as
// `p` so the desk can draw candles without a second request.
async function binanceHistory(symbol, { fetchImpl = fetch, signal, interval = '1d', limit = 1000 } = {}) {
  const response = await fetchImpl(`${BINANCE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`, { signal });
  if (!response.ok) throw new Error(`Binance responded ${response.status}.`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({ t: Number(row[0]), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]), p: Number(row[4]), v: Number(row[5]) || 0 }))
    .filter(point => point.t > 0 && point.p > 0);
}
// The highest-liquidity pair whose base token is exactly `mint`, so symbol and
// USD price belong to the token we asked about (not the SOL quote side).
async function basePair(mint, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const pairs = await response.json();
  const own = (Array.isArray(pairs) ? pairs : []).filter(pair => pair && pair.baseToken && pair.baseToken.address === mint);
  const best = own.sort((a, b) => number(b?.liquidity?.usd) - number(a?.liquidity?.usd))[0];
  return best ? pairSummary(best) : null;
}
async function pairBatchFor(mints, { fetchImpl = fetch, signal } = {}) {
  const list = [...new Set((Array.isArray(mints) ? mints : []).filter(Boolean))].slice(0, 30);
  if (!list.length) return new Map();
  const response = await fetchImpl(`https://api.dexscreener.com/tokens/v1/solana/${list.map(encodeURIComponent).join(',')}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  const map = new Map();
  for (const pair of Array.isArray(body) ? body : []) {
    const address = pair?.baseToken?.address;
    if (!address || !list.includes(address)) continue;
    const summary = pairSummary(pair);
    const current = map.get(address);
    if (!current || summary.liquidityUsd > current.liquidityUsd) map.set(address, summary);
  }
  return map;
}
async function pairListFor(addresses, { fetchImpl = fetch, signal, limit = 14 } = {}) {
  const pairs = await Promise.all((addresses || []).slice(0, limit * 2).map(address => basePair(address, { fetchImpl, signal }).catch(() => null)));
  const seen = new Set();
  return pairs.filter(pair => pair && pair.symbol && !seen.has(pair.address) && seen.add(pair.address)).slice(0, limit);
}
// Real trending: DexScreener token boosts (free, no key), Solana only, kept to the
// pairs where the boosted token is the base so each row is a distinct token.
async function trending({ fetchImpl = fetch, signal, limit = 14 } = {}) {
  const response = await fetchImpl(TOKEN_BOOSTS, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  const solana = (Array.isArray(body) ? body : []).filter(item => item && item.chainId === 'solana' && item.tokenAddress).map(item => item.tokenAddress);
  return pairListFor(solana, { fetchImpl, signal, limit });
}
function solanaAddresses(body) { return (Array.isArray(body) ? body : []).filter(item => item && item.chainId === 'solana' && item.tokenAddress).map(item => item.tokenAddress); }
async function tokenProfiles({ fetchImpl = fetch, signal, limit = 14 } = {}) {
  const response = await fetchImpl(TOKEN_PROFILES, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  return pairListFor(solanaAddresses(await response.json()), { fetchImpl, signal, limit });
}
async function takeovers({ fetchImpl = fetch, signal, limit = 14 } = {}) {
  const response = await fetchImpl(TAKEOVERS, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  return pairListFor(solanaAddresses(await response.json()), { fetchImpl, signal, limit });
}
async function narratives({ fetchImpl = fetch, signal, limit = 24 } = {}) {
  const response = await fetchImpl(NARRATIVES, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  return (Array.isArray(body) ? body : []).slice(0, limit).map(meta => ({
    name: String(meta.name || ''), slug: String(meta.slug || ''), description: String(meta.description || '').slice(0, 200),
    marketCap: number(meta.marketCap), liquidity: number(meta.liquidity), volume: number(meta.volume), tokenCount: number(meta.tokenCount),
    change24h: number(meta.marketCapChange?.h24), change1h: number(meta.marketCapChange?.h1)
  }));
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
// Top holders via RugCheck (free, no key). Falls back to the RPC largest-account
// list when RugCheck has no data. Both are largest-account lists, not unique
// holders; pools and market makers are not excluded, so label it honestly.
async function holders(mint, { fetchImpl = fetch, rpc = DEFAULT_RPC, signal } = {}) {
  try {
    const response = await fetchImpl(`${RUGCHECK}/${encodeURIComponent(mint)}/report`, { signal });
    if (response.ok) {
      const body = await response.json();
      const top = Array.isArray(body?.topHolders) ? body.topHolders : [];
      if (top.length) {
        const accounts = top.slice(0, 20).map(entry => ({
          address: entry.owner || entry.address || '',
          amount: number(entry.uiAmount ?? entry.amount),
          pct: number(entry.pct)
        }));
        return {
          mint, accounts, source: 'rugcheck',
          top1: accounts[0]?.pct || 0,
          top10: accounts.slice(0, 10).reduce((sum, entry) => sum + entry.pct, 0),
          holders: number(body.totalHolders), risks: Array.isArray(body.risks) ? body.risks.map(r => r.name || r.description || String(r)).slice(0, 6) : [], score: number(body.score)
        };
      }
    }
  } catch {}
  const [supply, largest] = await Promise.all([
    rpcCall(rpc, 'getTokenSupply', [mint], { fetchImpl, signal }).catch(() => null),
    rpcCall(rpc, 'getTokenLargestAccounts', [mint], { fetchImpl, signal }).catch(() => null)
  ]);
  const total = Number(supply?.value?.uiAmount || 0) || 0;
  const accounts = (largest?.value || []).slice(0, 20).map(entry => {
    const amount = Number(entry.uiAmount || 0) || 0;
    return { address: entry.address || '', amount, pct: total > 0 ? (amount / total) * 100 : 0 };
  });
  return { mint, accounts, source: 'rpc', total, top1: accounts[0]?.pct || 0, top10: accounts.slice(0, 10).reduce((sum, entry) => sum + entry.pct, 0), holders: 0, risks: [] };
}
const GECKO_RANGES = {
  '1D': ['minute', 5, 288], '7D': ['hour', 1, 168], '30D': ['hour', 4, 180],
  '3M': ['hour', 12, 180], '6M': ['day', 1, 180], '1Y': ['day', 1, 365],
  ALL: ['day', 1, 1000], max: ['day', 1, 1000]
};
const geckoPools = new Map(), geckoTokens = new Map();
let geckoChain = Promise.resolve(), geckoLast = 0;
function timeoutSignal(signal, ms = 15000) {
  try { return signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms); } catch { return signal; }
}
function geckoSchedule(fn, retries = 2) {
  geckoChain = geckoChain.then(async () => {
    const gap = 500 - (Date.now() - geckoLast);
    if (gap > 0) await new Promise(resolve => setTimeout(resolve, gap));
    geckoLast = Date.now();
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { return await fn(); }
      catch (error) { if (/429/.test(error.message) || attempt >= retries) throw error; await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1))); }
    }
    return null;
  });
  const current = geckoChain;
  geckoChain = geckoChain.catch(() => null);
  return current;
}
async function geckoPool(mint, { fetchImpl = fetch, signal } = {}) {
  const cached = geckoPools.get(mint);
  if (cached && Date.now() - cached.at < 10 * 60000) return cached.value;
  const body = await geckoSchedule(async () => {
    const response = await fetchImpl(`${GECKO}/networks/solana/tokens/${encodeURIComponent(mint)}/pools`, { signal: timeoutSignal(signal) });
    if (!response.ok) throw new Error(`GeckoTerminal responded ${response.status}.`);
    return response.json();
  });
  const list = body?.data || [];
  const own = list.filter(pool => pool?.relationships?.base_token?.data?.id === `solana_${mint}`);
  const best = (own.length ? own : list).sort((a, b) => number(b?.attributes?.reserve_in_usd) - number(a?.attributes?.reserve_in_usd))[0];
  const value = best ? { id: String(best.id || '').replace(/^solana_/, ''), name: best.attributes?.name || '', reserveUsd: number(best.attributes?.reserve_in_usd), createdAt: best.attributes?.pool_created_at || '' } : null;
  geckoPools.set(mint, { at: Date.now(), value });
  return value;
}
async function geckoOhlcv(mint, range, { fetchImpl = fetch, signal } = {}) {
  const spec = GECKO_RANGES[range] || GECKO_RANGES.max;
  const pool = await geckoPool(mint, { fetchImpl, signal });
  if (!pool?.id) return [];
  const [timeframe, aggregate, limit] = spec;
  const body = await geckoSchedule(async () => {
    const response = await fetchImpl(`${GECKO}/networks/solana/pools/${encodeURIComponent(pool.id)}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=base`, { signal: timeoutSignal(signal) });
    if (!response.ok) throw new Error(`GeckoTerminal responded ${response.status}.`);
    return response.json();
  });
  return (body?.data?.attributes?.ohlcv_list || [])
    .map(row => ({ t: number(row[0]) * 1000, o: number(row[1]), h: number(row[2]), l: number(row[3]), c: number(row[4]), p: number(row[4]), v: number(row[5]) }))
    .filter(point => point.t > 0 && point.p > 0)
    .sort((a, b) => a.t - b.t);
}
async function geckoToken(mint, { fetchImpl = fetch, signal } = {}) {
  const cached = geckoTokens.get(mint);
  if (cached && Date.now() - cached.at < 5 * 60000) return cached.value;
  const body = await geckoSchedule(async () => {
    const response = await fetchImpl(`${GECKO}/networks/solana/tokens/${encodeURIComponent(mint)}`, { signal: timeoutSignal(signal) });
    if (!response.ok) throw new Error(`GeckoTerminal responded ${response.status}.`);
    return response.json();
  });
  const attributes = body?.data?.attributes;
  if (!attributes) return null;
  const value = {
    address: attributes.address || mint, symbol: attributes.symbol || '', name: attributes.name || '',
    imageUrl: attributes.image_url || '', priceUsd: number(attributes.price_usd), fdv: number(attributes.fdv_usd),
    volume24h: number(attributes.volume_usd?.h24),
    launchpad: attributes.launchpad_details ? {
      graduationPercentage: number(attributes.launchpad_details.graduation_percentage),
      completed: attributes.launchpad_details.completed === true,
      completedAt: attributes.launchpad_details.completed_at || '',
      migratedPool: attributes.launchpad_details.migrated_destination_pool_address || ''
    } : null
  };
  geckoTokens.set(mint, { at: Date.now(), value });
  return value;
}
function geckoPoolSummary(pool) {
  const a = pool?.attributes || {}, r = pool?.relationships || {};
  const txns = a.transactions || {};
  const changes = a.price_change_percentage || {}, volume = a.volume_usd || {};
  return {
    poolId: String(pool?.id || '').replace(/^solana_/, ''),
    poolAddress: a.address || String(pool?.id || '').replace(/^solana_/, ''),
    name: a.name || '',
    mint: String(r.base_token?.data?.id || '').replace(/^solana_/, ''),
    dex: r.dex?.data?.id || '',
    createdAt: Date.parse(a.pool_created_at || '') || 0,
    priceUsd: number(a.base_token_price_usd),
    fdv: number(a.fdv_usd),
    marketCap: number(a.market_cap_usd),
    change5m: number(changes.m5), change15m: number(changes.m15), change30m: number(changes.m30),
    change1h: number(changes.h1), change6h: number(changes.h6), change24h: number(changes.h24),
    volume5m: number(volume.m5), volume15m: number(volume.m15), volume30m: number(volume.m30),
    volume1h: number(volume.h1), volume6h: number(volume.h6), volume24h: number(volume.h24),
    reserveUsd: number(a.reserve_in_usd),
    buys5m: number(txns.m5?.buys), sells5m: number(txns.m5?.sells),
    buys1h: number(txns.h1?.buys), sells1h: number(txns.h1?.sells),
    buyers1h: number(txns.h1?.buyers), sellers1h: number(txns.h1?.sellers)
  };
}
function geckoTokenSummary(attributes = {}) {
  return {
    address: attributes.address || '', symbol: attributes.symbol || '', name: attributes.name || '',
    imageUrl: attributes.image_url || '', priceUsd: number(attributes.price_usd), fdv: number(attributes.fdv_usd),
    volume24h: number(attributes.volume_usd?.h24),
    launchpad: attributes.launchpad_details ? {
      graduationPercentage: number(attributes.launchpad_details.graduation_percentage),
      completed: attributes.launchpad_details.completed === true,
      completedAt: attributes.launchpad_details.completed_at || '',
      migratedPool: attributes.launchpad_details.migrated_destination_pool_address || ''
    } : null
  };
}
async function geckoPoolFeed(path, page = 1, { fetchImpl = fetch, signal } = {}) {
  const body = await geckoSchedule(async () => {
    const response = await fetchImpl(`${GECKO}/networks/solana/${path}?page=${Math.max(1, Math.floor(Number(page) || 1))}`, { signal: timeoutSignal(signal) });
    if (!response.ok) throw new Error(`GeckoTerminal responded ${response.status}.`);
    return response.json();
  }, 0);
  return (body?.data || []).map(geckoPoolSummary).filter(pool => pool.mint);
}
async function geckoNewPools(options = {}) { return geckoPoolFeed('new_pools', options.page || 1, options); }
async function geckoTrendingPools(options = {}) { return geckoPoolFeed('trending_pools', options.page || 1, options); }
async function geckoTokenMulti(mints, { fetchImpl = fetch, signal } = {}) {
  const list = [...new Set((Array.isArray(mints) ? mints : []).filter(Boolean))].slice(0, 30);
  const out = [];
  for (let i = 0; i < list.length; i += 20) {
    const chunk = list.slice(i, i + 20);
    const body = await geckoSchedule(async () => {
      const response = await fetchImpl(`${GECKO}/networks/solana/tokens/multi/${chunk.map(encodeURIComponent).join(',')}`, { signal: timeoutSignal(signal) });
      if (!response.ok) throw new Error(`GeckoTerminal responded ${response.status}.`);
      return response.json();
    }, 0);
    for (const item of body?.data || []) {
      const value = geckoTokenSummary(item.attributes);
      if (!value.address) continue;
      geckoTokens.set(value.address, { at: Date.now(), value });
      out.push(value);
    }
  }
  return out;
}
async function heliusTransactions(address, { key, fetchImpl = fetch, signal, limit = 20 } = {}) {
  if (!key) return null;
  const count = Math.min(50, Math.max(1, Number(limit) || 20));
  const url = `${HELIUS}/addresses/${encodeURIComponent(address)}/transactions?api-key=${encodeURIComponent(key)}&limit=${count}`;
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`Helius responded ${response.status}.`);
  const body = await response.json();
  return (Array.isArray(body) ? body : []).slice(0, count).map(tx => ({
    signature: typeof tx.signature === 'string' ? tx.signature.slice(0, 160) : '',
    timestamp: number(tx.timestamp) * 1000,
    type: typeof tx.type === 'string' ? tx.type.slice(0, 40) : '',
    description: typeof tx.description === 'string' ? tx.description.slice(0, 300) : '',
    fee: number(tx.fee),
    transfers: (Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : []).slice(0, 8).map(item => ({
      mint: String(item.mint || '').slice(0, 60),
      amount: number(item.tokenAmount),
      from: String(item.fromUserAccount || '').slice(0, 60),
      to: String(item.toUserAccount || '').slice(0, 60)
    }))
  }));
}
module.exports = { JUPITER_PRICE, JUPITER_PRO_PRICE, DEXSCREENER, RUGCHECK, BINANCE, HELIUS, GECKO, jupiterPrices, searchTokens, pairForToken, pairListFor, pairBatchFor, priceHistory, coinHistory, tokenHistory, binanceHistory, tokenSafety, holders, trending, tokenProfiles, takeovers, narratives, heliusTransactions, geckoPool, geckoOhlcv, geckoToken, geckoPoolSummary, geckoTokenSummary, geckoNewPools, geckoTrendingPools, geckoTokenMulti };
