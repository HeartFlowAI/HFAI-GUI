const { test } = require('node:test'), assert = require('node:assert/strict');
const { runBacktest, priceAgo } = require('../src/wallet/backtest');

const HOUR = 3600e3;
const points = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110].map((price, index) => ({ t: index * HOUR, p: price, o: price, h: price + 0.2, l: price - 0.2 }));

test('backtest records a winning take-profit trade and metrics', () => {
  const result = runBacktest({
    points,
    conditions: [{ metric: 'price', op: 'above', value: 100 }],
    logic: 'and', sizingUsd: 100, takeProfitPct: 5, stopLossPct: 10,
    cooldownSec: 86400, startingCash: 1000, feePct: 0.5
  });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.trades, 1);
  assert.equal(result.metrics.wins, 1);
  assert.equal(result.metrics.winRate, 100);
  assert.ok(result.metrics.netPnl > 0);
  assert.equal(result.trades[0].reason, 'take profit');
  assert.ok(result.equity.length >= 2);
});

test('backtest stops out and calculates drawdown', () => {
  const falling = [100, 95, 90, 85, 80, 75, 70].map((price, index) => ({ t: index * HOUR, p: price, o: price, h: price + 0.1, l: price - 0.1 }));
  const result = runBacktest({
    points: falling,
    conditions: [{ metric: 'price', op: 'above', value: 90 }],
    logic: 'and', sizingUsd: 100, takeProfitPct: 10, stopLossPct: 5,
    cooldownSec: 86400, startingCash: 1000, feePct: 0.5
  });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.trades, 1);
  assert.equal(result.metrics.losses, 1);
  assert.equal(result.trades[0].reason, 'stop loss');
  assert.ok(result.metrics.maxDrawdownPct > 0);
  assert.ok(result.metrics.netPnl < 0);
});

test('backtest returns no trades when conditions never fire', () => {
  const result = runBacktest({
    points,
    conditions: [{ metric: 'price', op: 'below', value: 10 }],
    sizingUsd: 100, takeProfitPct: 5, stopLossPct: 5, startingCash: 1000
  });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.trades, 0);
  assert.equal(result.metrics.winRate, 0);
});

test('priceAgo finds the prior candle', () => {
  assert.equal(priceAgo(points, 5, 2 * HOUR), 103);
  assert.equal(priceAgo(points, 5, 0), 0);
});
