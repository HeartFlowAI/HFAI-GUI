const { test } = require('node:test'), assert = require('node:assert/strict');
const { normalizeStrategy, normalizeStrategies, conditionHit, evaluate, runStrategies } = require('../src/wallet/strategy');
const { normalizePaper, valuation } = require('../src/wallet/paper');

const signals = { price: 2, change24h: -25, change: -10 };

test('strategy validation requires a mint and at least one typed condition', () => {
  assert.throws(() => normalizeStrategy({ name: 'X', mint: 'M', conditions: [] }), /condition/);
  assert.throws(() => normalizeStrategy({ name: 'X', conditions: [{ metric: 'price', op: 'above', value: 1 }] }), /token/);
  const strategy = normalizeStrategy({ name: 'Dip', mint: 'MintA', conditions: [{ metric: 'change24h', op: 'below', value: -20 }] });
  assert.equal(strategy.revision, 1);
  assert.equal(strategy.status, 'draft');
  assert.deepEqual(strategy.conditions, [{ metric: 'change24h', op: 'below', value: -20, windowMinutes: 0 }]);
  const edited = normalizeStrategy({ name: 'Dip', mint: 'MintA', conditions: [{ metric: 'price', op: 'above', value: 5 }] }, strategy);
  assert.equal(edited.revision, 2);
  assert.equal(edited.id, strategy.id);
});

test('normalizeStrategies drops unusable records', () => {
  const list = normalizeStrategies([{ id: 'a', mint: 'MintA', conditions: [{ metric: 'price', op: 'above', value: 1 }] }, { id: 'b', mint: 'MintB', conditions: [] }, 'junk']);
  assert.deepEqual(list.map(item => item.id), ['a']);
});

test('conditions cross in the right direction and combine with AND/OR', () => {
  assert.equal(conditionHit({ metric: 'change24h', op: 'below', value: -20 }, signals), true);
  assert.equal(conditionHit({ metric: 'price', op: 'above', value: 3 }, signals), false);
  assert.equal(conditionHit({ metric: 'price', op: 'crossAbove', value: 1.5 }, signals, { price: 1 }), true);
  const and = evaluate({ logic: 'and', conditions: [{ metric: 'change24h', op: 'below', value: -20 }, { metric: 'price', op: 'above', value: 1 }] }, signals);
  assert.equal(and.triggered, true);
  const notAll = evaluate({ logic: 'and', conditions: [{ metric: 'change24h', op: 'below', value: -20 }, { metric: 'price', op: 'above', value: 5 }] }, signals);
  assert.equal(notAll.triggered, false);
  const or = evaluate({ logic: 'or', conditions: [{ metric: 'price', op: 'above', value: 5 }, { metric: 'change24h', op: 'below', value: -20 }] }, signals);
  assert.equal(or.triggered, true);
});

function autoStrategy(overrides = {}) {
  return Object.assign(normalizeStrategy({ name: 'Buy dips', mint: 'MintA', symbol: 'AAA', status: 'active', mode: 'auto', sizingUsd: 100, cooldownSec: 0, conditions: [{ metric: 'price', op: 'below', value: 999 }], exits: { takeProfit: 20, stopLoss: 10 } }), overrides);
}

test('an active auto strategy buys in paper and sets exits', () => {
  const paper = normalizePaper({ cash: 1000 });
  const strategy = autoStrategy();
  const { executed } = runStrategies(paper, [strategy], () => ({ price: 2, change24h: 0, change: 0 }), { now: 1000, limits: {} });
  assert.equal(executed.length, 1);
  assert.ok(valuation(paper, () => 2).holdingsValue > 0);
  assert.equal(paper.pending.length, 2);
  assert.equal(strategy.triggers, 1);
  assert.equal(paper.orders.at(-1).strategyId, strategy.id);
});

test('limits, cooldown and per-trade mode stop automatic execution', () => {
  const paper = normalizePaper({ cash: 1000 });
  const capped = runStrategies(paper, [autoStrategy()], () => ({ price: 2 }), { now: 1, limits: { maxTotalUsd: 50 } });
  assert.equal(capped.executed.length, 0);
  const cooling = autoStrategy({ lastRun: 500 });
  cooling.cooldownSec = 3600;
  assert.equal(runStrategies(paper, [cooling], () => ({ price: 2 }), { now: 1000, limits: {} }).executed.length, 0);
  const each = autoStrategy({ mode: 'each' });
  assert.equal(runStrategies(paper, [each], () => ({ price: 2 }), { now: 1000, limits: {} }).executed.length, 0);
});

test('a triggered strategy with too little paper cash records an error and stays', () => {
  const paper = normalizePaper({ cash: 10 });
  const strategy = autoStrategy();
  runStrategies(paper, [strategy], () => ({ price: 2 }), { now: 1, limits: {} });
  assert.match(strategy.lastError, /Not enough paper cash/);
  assert.equal(strategy.triggers, 0);
});

test('a live strategy emits an intent instead of buying in paper', () => {
  const paper = normalizePaper({ cash: 1000 });
  const strategy = autoStrategy({ execution: 'live' });
  const { executed, intents } = runStrategies(paper, [strategy], () => ({ price: 2 }), { now: 1, limits: {} });
  assert.equal(executed.length, 0);
  assert.equal(intents.length, 1);
  assert.equal(intents[0].mint, 'MintA');
  assert.equal(intents[0].usd, 100);
  assert.equal(valuation(paper, () => 2).holdingsValue, 0);
  assert.equal(strategy.livePending, true);
  assert.equal(runStrategies(paper, [strategy], () => ({ price: 2 }), { now: 2, limits: {} }).intents.length, 0);
});
