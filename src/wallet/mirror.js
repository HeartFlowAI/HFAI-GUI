const STABLES = new Set(['USDC', 'USDT', 'PYUSD', 'USDS', 'FDUSD', 'USDG']);
const MIN_DELTA_USD = 1;

function symbolOf(item) { return String(item?.symbol || '').toUpperCase(); }
function shortMint(mint) { return typeof mint === 'string' && mint.length > 10 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : String(mint || ''); }

// Compare the previous scan with a fresh one and, when parsed Helius data is
// available for the new signatures, use transfer direction to infer sells too.
// Without parsed data only positive holdings changes are mirrored, because a
// token leaving the top-25 list is not proof that the wallet sold it.
function planMirror({ previous, next, parsed = [], address = '', budget = 25, maxBuys = 3 } = {}) {
  const amount = Number(budget);
  if (!(amount > 0)) throw new Error('Enter a mirror budget.');
  const nextByMint = new Map((next?.holdings || []).filter(item => item && item.mint && Number(item.price) > 0).map(item => [item.mint, item]));
  const prevByMint = new Map((previous?.holdings || []).filter(item => item && item.mint).map(item => [item.mint, item]));
  const deltas = [];
  const source = Array.isArray(parsed) && parsed.length ? 'parsed' : 'holdings';
  if (source === 'parsed') {
    const net = new Map();
    for (const tx of parsed) {
      for (const transfer of tx.transfers || []) {
        const mint = transfer.mint;
        const quantity = Number(transfer.amount);
        if (!mint || !(quantity > 0)) continue;
        if (transfer.to === address) net.set(mint, (net.get(mint) || 0) + quantity);
        if (transfer.from === address) net.set(mint, (net.get(mint) || 0) - quantity);
      }
    }
    for (const [mint, delta] of net) {
      if (!(Math.abs(delta) > 1e-9)) continue;
      const holding = nextByMint.get(mint) || prevByMint.get(mint);
      if (!holding || STABLES.has(symbolOf(holding))) continue;
      const price = Number(holding.price) || 0;
      if (!(price > 0)) continue;
      const value = Math.abs(delta) * price;
      if (value < MIN_DELTA_USD) continue;
      deltas.push({ mint, symbol: holding.symbol || shortMint(mint), price, deltaAmount: delta, value });
    }
  } else {
    for (const holding of nextByMint.values()) {
      if (STABLES.has(symbolOf(holding))) continue;
      const before = prevByMint.get(holding.mint);
      const oldAmount = before ? Number(before.amount) : 0;
      const delta = Number(holding.amount) - oldAmount;
      if (!(delta > 0)) continue;
      const value = delta * Number(holding.price);
      if (value < MIN_DELTA_USD) continue;
      deltas.push({ mint: holding.mint, symbol: holding.symbol || shortMint(holding.mint), price: Number(holding.price), deltaAmount: delta, value, previousAmount: oldAmount });
    }
  }
  const selected = deltas.filter(item => item.deltaAmount > 0).sort((a, b) => b.value - a.value).slice(0, Math.max(1, Math.min(8, Math.round(Number(maxBuys) || 3))));
  const totalValue = selected.reduce((sum, item) => sum + item.value, 0) || 1;
  let remaining = amount;
  const buys = [];
  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const usd = i === selected.length - 1 ? remaining : Math.round(amount * (item.value / totalValue) * 100) / 100;
    remaining = Math.round((remaining - usd) * 100) / 100;
    if (usd > 0) buys.push({ ...item, usd, weight: item.value / totalValue });
  }
  const sells = deltas.filter(item => item.deltaAmount < 0).map(item => {
    const before = prevByMint.get(item.mint);
    const previousAmount = before ? Number(before.amount) : 0;
    const percent = previousAmount > 0 ? Math.min(100, Math.max(1, (Math.abs(item.deltaAmount) / previousAmount) * 100)) : 100;
    return { mint: item.mint, symbol: item.symbol, price: item.price, deltaAmount: item.deltaAmount, percent: Math.round(percent * 10) / 10 };
  });
  return { source, budget: amount, buys, sells };
}

module.exports = { STABLES, MIN_DELTA_USD, planMirror };
