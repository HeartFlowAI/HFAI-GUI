const STABLES = new Set(['USDC', 'USDT', 'PYUSD', 'USDS', 'FDUSD', 'USDG']);
const MAX_TOKENS = 8;
const MIN_ALLOC_USD = 1;

function shortMint(mint) { return typeof mint === 'string' && mint.length > 10 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : String(mint || ''); }

// Turn a followed-wallet scan into paper-buy allocations. Stablecoins are
// skipped because copying cash into a token position is not a mirror. If the
// wallet holds only stablecoins, they are used as a fallback.
function planCopy(scan, { budget = 100, mode = 'proportional', count = 5 } = {}) {
  const amount = Number(budget);
  if (!(amount > 0)) throw new Error('Enter a paper budget.');
  const priced = (scan?.holdings || []).filter(item => item && item.mint && Number(item.value) > 0 && Number(item.price) > 0);
  const nonStable = priced.filter(item => !STABLES.has(String(item.symbol || '').toUpperCase()));
  const pool = nonStable.length ? nonStable : priced;
  if (!pool.length) throw new Error('No priced holdings to copy. Scan the wallet again.');
  const requested = Math.min(Math.max(1, Math.floor(Number(count) || 5)), MAX_TOKENS, pool.length);
  const affordable = Math.max(1, Math.floor(amount / MIN_ALLOC_USD));
  const selected = pool.slice(0, Math.min(requested, affordable));
  const totalValue = selected.reduce((sum, item) => sum + Number(item.value), 0) || 1;
  const weights = mode === 'equal' ? selected.map(() => 1 / selected.length) : selected.map(item => Number(item.value) / totalValue);
  let remaining = amount;
  const allocations = [];
  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const usd = i === selected.length - 1 ? remaining : Math.round(amount * weights[i] * 100) / 100;
    remaining = Math.round((remaining - usd) * 100) / 100;
    if (!(usd > 0)) continue;
    allocations.push({ mint: item.mint, symbol: item.symbol || shortMint(item.mint), usd, price: Number(item.price), weight: weights[i] });
  }
  if (!allocations.length) throw new Error('The paper budget is too small to split across holdings.');
  return { budget: amount, mode: mode === 'equal' ? 'equal' : 'proportional', count: allocations.length, allocations };
}

module.exports = { STABLES, MAX_TOKENS, MIN_ALLOC_USD, planCopy };
