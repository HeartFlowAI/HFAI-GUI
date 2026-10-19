const { randomUUID } = require('node:crypto');
const solana = require('./solana');
const providers = require('./providers');
const markets = require('./markets');

const MAX_FOLLOWED = 50;
const MAX_HOLDINGS = 25;
const MAX_UNPRICED = 10;
const MAX_RECENT = 12;
const ACTIVITY_CHECK_MS = 5 * 60000;
const METADATA_TTL = 6 * 3600e3;
const metadataCache = new Map();

function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function shortMint(mint) { return typeof mint === 'string' && mint.length > 10 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : String(mint || ''); }
function shortAddress(address) { return typeof address === 'string' && address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : String(address || ''); }

// Cached scan data is persisted next to the followed wallet. Keep the shape
// small and fully numeric so a corrupted store cannot inject odd values.
function normalizeScan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const holdings = Array.isArray(input.holdings) ? input.holdings
    .filter(item => item && typeof item === 'object' && solana.validateAddress(item.mint) && number(item.amount) > 0)
    .slice(0, MAX_HOLDINGS)
    .map(item => ({
      mint: item.mint.trim(), symbol: text(item.symbol, 16) || shortMint(item.mint),
      amount: number(item.amount), price: number(item.price), value: number(item.value),
      change24h: number(item.change24h), share: number(item.share), name: text(item.name, 64)
    })) : [];
  const unpriced = Array.isArray(input.unpriced) ? input.unpriced
    .filter(item => item && typeof item === 'object' && solana.validateAddress(item.mint) && number(item.amount) > 0)
    .slice(0, MAX_UNPRICED)
    .map(item => ({ mint: item.mint.trim(), symbol: text(item.symbol, 16) || shortMint(item.mint), name: text(item.name, 64), amount: number(item.amount) })) : [];
  const recent = Array.isArray(input.recent) ? input.recent
    .filter(item => item && typeof item === 'object' && typeof item.signature === 'string')
    .slice(0, MAX_RECENT)
    .map(item => ({ signature: item.signature.slice(0, 160), blockTime: number(item.blockTime), err: item.err === true })) : [];
  const parsed = Array.isArray(input.parsed) ? input.parsed
    .filter(item => item && typeof item === 'object' && typeof item.signature === 'string')
    .slice(0, 20)
    .map(item => ({
      signature: item.signature.slice(0, 160), timestamp: number(item.timestamp),
      type: text(item.type, 40), description: text(item.description, 300), fee: number(item.fee),
      transfers: Array.isArray(item.transfers) ? item.transfers.slice(0, 8).map(transfer => ({
        mint: text(transfer?.mint, 60), amount: number(transfer?.amount),
        from: text(transfer?.from, 60), to: text(transfer?.to, 60)
      })) : []
    })) : [];
  return {
    address: typeof input.address === 'string' ? input.address.slice(0, 60) : '',
    at: number(input.at), sol: number(input.sol), total: number(input.total), change24h: number(input.change24h),
    tokenCount: number(input.tokenCount), pricedCount: number(input.pricedCount),
    top10Share: number(input.top10Share), lastActive: number(input.lastActive), holdings, unpriced, recent, parsed
  };
}

function normalizeFollowed(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set(), out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const address = typeof item.address === 'string' ? item.address.trim() : '';
    if (!solana.validateAddress(address) || seen.has(address)) continue;
    seen.add(address);
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 60) : randomUUID(),
      address,
      label: text(item.label, 40),
      tags: Array.isArray(item.tags) ? [...new Set(item.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 20)).filter(Boolean))].slice(0, 8) : [],
      note: text(item.note, 500),
      addedAt: number(item.addedAt) || Date.now(),
      scanAt: number(item.scanAt),
      scan: normalizeScan(item.scan),
      lastError: text(item.lastError, 300),
      watchActivity: item.watchActivity !== false,
      autoMirror: item.autoMirror === true,
      mirrorBudgetUsd: Math.min(1000, Math.max(1, number(item.mirrorBudgetUsd) || 25)),
      mirrorMaxBuys: Math.min(8, Math.max(1, Math.round(number(item.mirrorMaxBuys) || 3))),
      mirrorLastAt: number(item.mirrorLastAt),
      mirrorLastResult: text(item.mirrorLastResult, 300),
      mirrorError: text(item.mirrorError, 300),
      lastSignature: text(item.lastSignature, 160),
      activityAt: number(item.activityAt),
      lastActivityAt: number(item.lastActivityAt),
      activityError: text(item.activityError, 300)
    });
    if (out.length >= MAX_FOLLOWED) break;
  }
  return out;
}

async function scanWallet(address, { rpc = solana.DEFAULT_RPC, fetchImpl = fetch, signal, heliusKey = '', jupiterKey = '' } = {}) {
  const account = solana.normalizeAddress(address);
  const portfolio = await solana.fetchPortfolio(account, { rpc, fetchImpl, signal });
  const recent = await solana.fetchHistory(account, { rpc, fetchImpl, signal, limit: 20 }).catch(() => []);
  let parsed = [];
  if (heliusKey) { try { parsed = await providers.heliusTransactions(account, { key: heliusKey, fetchImpl, signal, limit: 20 }) || []; } catch {} }
  const mints = [...new Set([solana.SOL_MINT, ...portfolio.tokens.map(token => token.mint).filter(Boolean)])].slice(0, 50);
  let prices = {};
  try { prices = await providers.jupiterPrices(mints, { fetchImpl, signal, key: jupiterKey }); } catch {}
  const all = [];
  const push = (mint, symbol, amount, name = '') => {
    if (!(number(amount) > 0)) return;
    const quote = prices[mint] || {};
    const price = number(quote.price);
    all.push({
      mint, symbol, name, amount: number(amount), price,
      value: price > 0 ? number(amount) * price : 0,
      change24h: number(quote.change24h)
    });
  };
  push(solana.SOL_MINT, markets.marketFor(solana.SOL_MINT)?.symbol || 'SOL', portfolio.sol, markets.marketFor(solana.SOL_MINT)?.name || 'Solana');
  for (const token of portfolio.tokens) {
    const market = markets.marketFor(token.mint);
    push(token.mint, market?.symbol || shortMint(token.mint), token.amount, market?.name || '');
  }
  const priced = all.filter(item => item.price > 0).sort((a, b) => b.value - a.value);
  const unpriced = all.filter(item => !(item.price > 0)).sort((a, b) => b.amount - a.amount);
  const unknown = [...new Set([...priced.filter(item => !markets.marketFor(item.mint)).slice(0, 6), ...unpriced.filter(item => !markets.marketFor(item.mint)).slice(0, 6)].map(item => item.mint))];
  if (unknown.length) {
    const meta = new Map(), missing = [];
    for (const mint of unknown) {
      const cached = metadataCache.get(mint);
      if (cached && Date.now() - cached.at < METADATA_TTL) meta.set(mint, cached.value);
      else missing.push(mint);
    }
    if (missing.length) {
      try {
        const pairs = await providers.pairListFor(missing, { fetchImpl, signal, limit: 12 });
        for (const pair of pairs) { metadataCache.set(pair.address, { value: pair, at: Date.now() }); meta.set(pair.address, pair); }
      } catch {}
    }
    for (const item of [...priced, ...unpriced]) {
      const found = meta.get(item.mint);
      if (!found) continue;
      item.symbol = found.symbol || item.symbol;
      item.name = found.name || item.name;
    }
  }
  const total = priced.reduce((sum, item) => sum + item.value, 0);
  for (const item of priced) item.share = total > 0 ? item.value / total : 0;
  const change24h = total > 0 ? priced.reduce((sum, item) => sum + item.value * item.change24h, 0) / total : 0;
  const top10 = priced.slice(0, 10).reduce((sum, item) => sum + item.value, 0);
  return {
    address: account,
    at: Date.now(),
    sol: portfolio.sol,
    total,
    change24h,
    tokenCount: all.length,
    pricedCount: priced.length,
    top10Share: total > 0 ? top10 / total : 0,
    lastActive: Math.max(recent.reduce((latest, item) => Math.max(latest, number(item.blockTime) * 1000), 0), parsed.reduce((latest, item) => Math.max(latest, number(item.timestamp)), 0)),
    holdings: priced.slice(0, MAX_HOLDINGS),
    unpriced: unpriced.slice(0, MAX_UNPRICED),
    recent: recent.slice(0, MAX_RECENT).map(item => ({ signature: item.signature, blockTime: item.blockTime, err: item.err })),
    parsed: parsed.slice(0, 20)
  };
}

module.exports = { MAX_FOLLOWED, ACTIVITY_CHECK_MS, normalizeFollowed, normalizeScan, scanWallet, shortAddress };
