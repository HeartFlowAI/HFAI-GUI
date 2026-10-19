const STAGES = [
  { id: 'new', label: 'New', description: 'Fresh launches on the bonding curve' },
  { id: 'trending', label: 'Trending', description: 'Climbing the bonding curve' },
  { id: 'graduated', label: 'Graduated', description: 'Bonded and trading on PumpSwap' }
];
const STAGE_IDS = new Set(STAGES.map(stage => stage.id));
const NEW_MAX_AGE_MS = 6 * 3600e3;
const PUMP_INITIAL_VSOL = 30;
const PUMP_GRADUATION_VSOL = 115;
const PUMP_INITIAL_VTOKENS = 1073000000;
const PUMP_TOTAL_SUPPLY = 1e9;

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function log10(value) { return Math.log10(Math.max(0, Number(value) || 0) + 1); }

function isPumpPool(pool) { return pool?.dex === 'pump-fun' || pool?.dex === 'pumpswap' || /pump/i.test(pool?.dex || ''); }
function tokenFor(map, mint) { return map.get(mint) || null; }
function symbolFromPool(pool) { return String(pool?.name || '').split('/')[0].trim(); }

function scoreTrending(row) {
  const buyRatio = row.buys1h + row.sells1h > 0 ? row.buys1h / (row.buys1h + row.sells1h) : 0.5;
  const ageHours = row.ageMs > 0 ? row.ageMs / 36e5 : 0;
  const freshness = ageHours > 0 ? clamp(24 / (ageHours + 6), 0.2, 2.4) : 0.4;
  return row.graduationPercentage * 1.8 + log10(row.volume1h) * 12 + buyRatio * 10 + clamp(row.change1h, -100, 400) * 0.35 + freshness;
}
function scoreGraduated(row) {
  const buyRatio = row.buys1h + row.sells1h > 0 ? row.buys1h / (row.buys1h + row.sells1h) : 0.5;
  const ageHours = row.ageMs > 0 ? row.ageMs / 36e5 : 0;
  const freshness = ageHours > 0 ? clamp(72 / (ageHours + 12), 0.2, 1.8) : 0.4;
  return log10(row.volume24h) * 14 + log10(row.liquidityUsd) * 9 + buyRatio * 8 + clamp(row.change24h, -100, 500) * 0.25 + freshness;
}

function normalizeRow(pool, token) {
  const createdAt = num(pool.createdAt);
  const graduationKnown = !!token?.launchpad;
  const graduation = graduationKnown ? num(token.launchpad.graduationPercentage) : 0;
  const completed = token?.launchpad?.completed === true || pool.dex === 'pumpswap';
  const marketCap = num(pool.marketCap) || num(pool.fdv) || num(token?.fdv);
  const symbol = token?.symbol || symbolFromPool(pool) || String(pool.mint || '').slice(0, 6);
  const name = token?.name || pool.name?.replace(/\s*\/\s*[^/]+$/, '').trim() || symbol;
  const row = {
    mint: pool.mint, symbol, name, imageUrl: token?.imageUrl || '',
    poolAddress: pool.poolAddress || pool.poolId, dex: pool.dex,
    createdAt, ageMs: createdAt > 0 ? Math.max(0, Date.now() - createdAt) : 0,
    priceUsd: num(pool.priceUsd) || num(token?.priceUsd), fdv: num(pool.fdv) || num(token?.fdv), marketCap,
    change5m: num(pool.change5m), change15m: num(pool.change15m), change1h: num(pool.change1h), change6h: num(pool.change6h), change24h: num(pool.change24h),
    volume5m: num(pool.volume5m), volume1h: num(pool.volume1h), volume6h: num(pool.volume6h), volume24h: num(pool.volume24h) || num(token?.volume24h),
    liquidityUsd: num(pool.reserveUsd), buys1h: num(pool.buys1h), sells1h: num(pool.sells1h), buyers1h: num(pool.buyers1h), sellers1h: num(pool.sellers1h),
    graduationPercentage: clamp(graduation, 0, 100), graduationKnown, completed,
    completedAt: token?.launchpad?.completedAt || '', migratedPool: token?.launchpad?.migratedPool || '',
    aboutToGraduate: !completed && graduationKnown && graduation >= 80
  };
  row.score = completed ? scoreGraduated(row) : scoreTrending(row);
  return row;
}

// Pump.fun's curve starts at 30 virtual SOL and graduates at 115 virtual SOL
// (85 SOL raised). Stream events include the virtual reserves, so fresh tokens
// can show real progress even before GeckoTerminal indexes their launchpad.
function curveProgress({ vSolInBondingCurve = 0, marketCapSol = 0, marketCap = 0, solPrice = 0, graduationPercentage = 0, graduationKnown = false, completed = false } = {}) {
  if (completed) return { known: true, percentage: 100, source: 'migrated' };
  if (graduationKnown) return { known: true, percentage: clamp(num(graduationPercentage), 0, 100), source: 'launchpad' };
  const vSol = num(vSolInBondingCurve);
  const mcSol = num(marketCapSol) || (num(solPrice) > 0 ? num(marketCap) / num(solPrice) : 0);
  if (vSol > 0) {
    return { known: true, percentage: clamp(((vSol - PUMP_INITIAL_VSOL) / (PUMP_GRADUATION_VSOL - PUMP_INITIAL_VSOL)) * 100, 0, 100), source: 'reserves' };
  }
  if (mcSol > 0) {
    // mcSol = totalSupply * price; price = vSol^2 / (initialVsol * initialVtokens)
    const impliedVsol = Math.sqrt(mcSol * PUMP_INITIAL_VSOL * PUMP_INITIAL_VTOKENS / PUMP_TOTAL_SUPPLY);
    return { known: true, percentage: clamp(((impliedVsol - PUMP_INITIAL_VSOL) / (PUMP_GRADUATION_VSOL - PUMP_INITIAL_VSOL)) * 100, 0, 100), source: 'market-cap' };
  }
  return { known: false, percentage: 0, source: 'unknown' };
}

function parsePumpVerdicts(content, rows) {
  const text = String(content || '');
  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('Gigi did not return a JSON verdict list.');
  const raw = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(raw)) throw new Error('Gigi returned an invalid verdict list.');
  const allowed = new Set((rows || []).map(row => row.mint));
  const verdicts = {};
  for (const item of raw) {
    if (!item || typeof item !== 'object' || !allowed.has(item.mint)) continue;
    const verdict = ['buy', 'watch', 'avoid'].includes(item.verdict) ? item.verdict : 'watch';
    verdicts[item.mint] = { mint: item.mint, verdict, score: Math.min(10, Math.max(0, Number(item.score) || 0)), reason: String(item.reason || '').slice(0, 240) };
  }
  if (!Object.keys(verdicts).length) throw new Error('Gigi returned no usable verdicts.');
  return verdicts;
}
function selectAutoBuys(verdicts, rows, { minScore = 8, maxBuys = 1, cooldownMs = 30 * 60000, lastAuto = {}, now = Date.now() } = {}) {
  const byMint = new Map((rows || []).map(row => [row.mint, row]));
  const picks = [];
  for (const item of Object.values(verdicts || {}).sort((a, b) => b.score - a.score)) {
    if (picks.length >= Math.max(1, Number(maxBuys) || 1)) break;
    if (item.verdict !== 'buy' || item.score < minScore) continue;
    const row = byMint.get(item.mint);
    if (!row || !(Number(row.priceUsd) > 0)) continue;
    if (now - (Number(lastAuto[item.mint]) || 0) < cooldownMs) continue;
    picks.push({ ...item, row });
  }
  return picks;
}
function limitError({ limits = {}, heldUsd = 0, totalUsd = 0, spentTodayUsd = 0, valueUsd = 0 } = {}) {
  if (limits.maxPositionUsd && heldUsd + valueUsd > limits.maxPositionUsd) return `Position cap is $${limits.maxPositionUsd}; this trade would exceed it.`;
  if (limits.maxTotalUsd && totalUsd + valueUsd > limits.maxTotalUsd) return `Total cap is $${limits.maxTotalUsd}; this trade would exceed it.`;
  if (limits.dailyCapUsd && spentTodayUsd + valueUsd > limits.dailyCapUsd) return `Daily cap is $${limits.dailyCapUsd}; this trade would exceed it.`;
  return '';
}

// Build one stage from raw GeckoTerminal pools and batch token metadata. This
// stays pure so stage rules and scoring can be tested without the network.
function buildPumpFeed(stage, { pools = [], tokens = [], limit = 20 } = {}) {
  if (!STAGE_IDS.has(stage)) throw new Error('Unknown pump stage.');
  const tokenMap = new Map((Array.isArray(tokens) ? tokens : []).map(token => [token.address, token]));
  const byMint = new Map();
  for (const pool of pools) {
    if (!isPumpPool(pool) || !pool.mint) continue;
    const token = tokenFor(tokenMap, pool.mint);
    const row = normalizeRow(pool, token);
    if (stage === 'new' && (row.completed || row.dex !== 'pump-fun' || !(row.createdAt > 0) || row.ageMs > NEW_MAX_AGE_MS)) continue;
    if (stage === 'trending' && (row.completed || row.dex !== 'pump-fun' || (row.graduationKnown && (row.graduationPercentage < 1 || row.graduationPercentage >= 100)))) continue;
    if (stage === 'graduated' && !row.completed) continue;
    const current = byMint.get(row.mint);
    if (!current) { byMint.set(row.mint, row); continue; }
    if (row.liquidityUsd > current.liquidityUsd || row.volume1h > current.volume1h) byMint.set(row.mint, row);
  }
  const rows = [...byMint.values()];
  if (stage === 'new') rows.sort((a, b) => b.createdAt - a.createdAt);
  else rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, Math.max(1, Math.min(50, Number(limit) || 20)));
}

module.exports = { STAGES, STAGE_IDS, NEW_MAX_AGE_MS, PUMP_INITIAL_VSOL, PUMP_GRADUATION_VSOL, isPumpPool, curveProgress, parsePumpVerdicts, selectAutoBuys, limitError, normalizeRow, scoreTrending, scoreGraduated, buildPumpFeed };
