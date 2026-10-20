const { conditionHit } = require('./strategy');

function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function pctChange(price, previous) { return previous > 0 ? ((price - previous) / previous) * 100 : 0; }
function downsample(points, max = 90) {
  if (points.length <= max) return points;
  const step = points.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out[out.length - 1] = points[points.length - 1];
  return out;
}
function priceAgo(points, index, milliseconds) {
  if (!(milliseconds > 0)) return 0;
  const cutoff = points[index].t - milliseconds;
  let low = 0, high = index;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].t < cutoff) low = middle + 1;
    else high = middle;
  }
  const point = points[Math.min(index, low)];
  return point ? point.p : 0;
}
function runBacktest({ points = [], conditions = [], logic = 'and', windowMinutes = 0, sizingUsd = 25, takeProfitPct = 0, stopLossPct = 0, cooldownSec = 3600, startingCash = 1000, feePct = 0.5 } = {}) {
  const series = (Array.isArray(points) ? points : [])
    .filter(point => point && Number(point.t) > 0 && Number(point.p) > 0)
    .map(point => ({ t: Number(point.t), p: Number(point.p), h: Number(point.h ?? point.p), l: Number(point.l ?? point.p) }))
    .sort((a, b) => a.t - b.t);
  const rules = (Array.isArray(conditions) ? conditions : []).filter(condition => condition && condition.metric && condition.op && Number.isFinite(Number(condition.value)));
  if (series.length < 2 || !rules.length) return { ok: false, error: 'Not enough candles or triggers for a test.' };
  const size = Math.max(1, number(sizingUsd) || 25);
  const fee = Math.max(0, Math.min(10, number(feePct))) / 100;
  const cooldownMs = Math.max(0, number(cooldownSec)) * 1000;
  const targetPct = Math.max(0, number(takeProfitPct));
  const stopPct = Math.max(0, number(stopLossPct));
  let cash = Math.max(size, number(startingCash) || 1000);
  let position = null, cooldownUntil = 0, previous = null;
  const trades = [], equity = [];
  const close = (price, time, reason) => {
    if (!position) return;
    const gross = position.qty * price;
    const net = gross * (1 - fee);
    const pnl = net - position.cost;
    cash += net;
    trades.push({
      entryAt: position.entryTime, exitAt: time, entryPrice: position.entryPrice, exitPrice: price,
      qty: position.qty, invested: position.cost, pnl, pnlPct: position.cost > 0 ? (pnl / position.cost) * 100 : 0,
      holdMinutes: Math.max(0, (time - position.entryTime) / 60000), reason
    });
    cooldownUntil = time + cooldownMs;
    position = null;
  };
  for (let i = 0; i < series.length; i++) {
    const point = series[i];
    const signals = {
      price: point.p,
      change24h: pctChange(point.p, priceAgo(series, i, 864e5)),
      change: pctChange(point.p, priceAgo(series, i, Math.max(0, number(windowMinutes)) * 60000))
    };
    if (position) {
      if (stopPct > 0 && point.l <= position.stop) close(position.stop, point.t, 'stop loss');
      else if (targetPct > 0 && point.h >= position.target) close(position.target, point.t, 'take profit');
    }
    const results = rules.map(condition => ({ hit: conditionHit(condition, signals, previous) }));
    const triggered = logic === 'or' ? results.some(result => result.hit) : results.every(result => result.hit);
    if (!position && triggered && point.t >= cooldownUntil && cash > 0) {
      const invest = Math.min(size, cash);
      const entryFee = invest * fee;
      const qty = (invest - entryFee) / point.p;
      if (qty > 0) {
        cash -= invest;
        position = { qty, cost: invest, entryTime: point.t, entryPrice: point.p, target: point.p * (1 + targetPct / 100), stop: point.p * (1 - stopPct / 100) };
      }
    }
    equity.push({ t: point.t, p: cash + (position ? position.qty * point.p : 0) });
    previous = signals;
  }
  close(series[series.length - 1].p, series[series.length - 1].t, 'end of test');
  const wins = trades.filter(trade => trade.pnl > 0);
  const losses = trades.filter(trade => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  let peak = Math.max(size, number(startingCash) || 1000), maxDrawdownPct = 0;
  for (const point of equity) { peak = Math.max(peak, point.p); if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - point.p) / peak) * 100); }
  return {
    ok: true, from: series[0].t, to: series[series.length - 1].t, candles: series.length,
    startingCash: Math.max(size, number(startingCash) || 1000), endingCash: cash,
    metrics: {
      trades: trades.length, wins: wins.length, losses: losses.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      netPnl, returnPct: (netPnl / Math.max(1, Math.max(size, number(startingCash) || 1000))) * 100,
      avgPnl: trades.length ? netPnl / trades.length : 0,
      avgPnlPct: trades.length ? trades.reduce((sum, trade) => sum + trade.pnlPct, 0) / trades.length : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
      maxDrawdownPct,
      avgHoldMinutes: trades.length ? trades.reduce((sum, trade) => sum + trade.holdMinutes, 0) / trades.length : 0,
      bestTrade: trades.length ? Math.max(...trades.map(trade => trade.pnl)) : 0,
      worstTrade: trades.length ? Math.min(...trades.map(trade => trade.pnl)) : 0
    },
    trades: trades.slice(-20).reverse(), equity: downsample(equity)
  };
}
module.exports = { runBacktest, priceAgo, downsample };
