const { randomUUID } = require('node:crypto');
const paper = require('./paper');

// Typed strategy rules and a restricted interpreter. Conditions are data, not
// arbitrary code, so a strategy can be evaluated safely (this is the C14
// boundary: inspectable, paper-only until a real sandbox exists).
const OPS = ['above', 'below', 'crossAbove', 'crossBelow'];
const METRICS = ['price', 'change24h', 'change'];

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function normalizeCondition(input) {
  if (!input || typeof input !== 'object') return null;
  const metric = METRICS.includes(input.metric) ? input.metric : null;
  const op = OPS.includes(input.op) ? input.op : null;
  if (!metric || !op || !Number.isFinite(Number(input.value))) return null;
  return { metric, op, value: Number(input.value), windowMinutes: Math.max(0, Math.min(10080, Math.floor(num(input.windowMinutes)))) };
}
function normalizeStrategy(input, existing) {
  if (!input || typeof input !== 'object') throw new Error('Invalid strategy.');
  const name = (typeof input.name === 'string' ? input.name.trim() : '').slice(0, 60) || 'Untitled strategy';
  const conditions = (Array.isArray(input.conditions) ? input.conditions.map(normalizeCondition).filter(Boolean) : []).slice(0, 8);
  if (!conditions.length) throw new Error('Add at least one condition with a metric, an operator and a value.');
  const mint = typeof input.mint === 'string' ? input.mint.trim() : (existing?.mint || '');
  if (!mint) throw new Error('Choose a token.');
  const exits = input.exits && typeof input.exits === 'object' ? input.exits : (existing?.exits || {});
  return {
    id: existing?.id || randomUUID(),
    revision: (existing?.revision || 0) + 1,
    name, mint, symbol: (typeof input.symbol === 'string' ? input.symbol.slice(0, 24) : existing?.symbol || ''),
    logic: input.logic === 'or' ? 'or' : 'and',
    conditions,
    windowMinutes: Math.max(0, Math.min(10080, Math.floor(num(input.windowMinutes || existing?.windowMinutes)))),
    sizingUsd: Math.max(1, num(input.sizingUsd ?? existing?.sizingUsd ?? 25)),
    mode: input.mode === 'each' ? 'each' : 'auto',
    execution: (input.execution ?? existing?.execution) === 'live' ? 'live' : 'paper',
    cooldownSec: Math.max(0, Math.min(86400, Math.floor(num(input.cooldownSec ?? existing?.cooldownSec ?? 3600)))),
    exits: { takeProfit: Math.max(0, num(exits.takeProfit)), stopLoss: Math.max(0, num(exits.stopLoss)) },
    status: ['draft', 'active', 'paused'].includes(input.status) ? input.status : (existing?.status || 'draft'),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    lastRun: existing?.lastRun || 0,
    lastTriggeredAt: existing?.lastTriggeredAt || 0,
    lastDetail: existing?.lastDetail || '',
    lastError: existing?.lastError || '',
    triggers: existing?.triggers || 0
  };
}
function normalizeStrategies(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => item && item.id && item.mint).slice(0, 20).map(item => ({
    id: String(item.id), revision: Math.max(1, Math.floor(num(item.revision)) || 1), name: String(item.name || '').slice(0, 60),
    mint: String(item.mint).slice(0, 60), symbol: String(item.symbol || '').slice(0, 24), logic: item.logic === 'or' ? 'or' : 'and',
    conditions: (Array.isArray(item.conditions) ? item.conditions.map(normalizeCondition).filter(Boolean) : []).slice(0, 8),
    windowMinutes: Math.max(0, Math.floor(num(item.windowMinutes))), sizingUsd: Math.max(1, num(item.sizingUsd)),
    mode: item.mode === 'each' ? 'each' : 'auto', cooldownSec: Math.max(0, Math.floor(num(item.cooldownSec))),
    execution: item.execution === 'live' ? 'live' : 'paper',
    exits: { takeProfit: Math.max(0, num(item.exits?.takeProfit)), stopLoss: Math.max(0, num(item.exits?.stopLoss)) },
    status: ['draft', 'active', 'paused'].includes(item.status) ? item.status : 'draft',
    createdAt: num(item.createdAt), updatedAt: num(item.updatedAt), lastRun: num(item.lastRun), lastTriggeredAt: num(item.lastTriggeredAt),
    lastDetail: String(item.lastDetail || '').slice(0, 200), lastError: String(item.lastError || '').slice(0, 200), triggers: Math.floor(num(item.triggers))
  })).filter(item => item.conditions.length);
}
function conditionHit(condition, signals, previous) {
  const value = num(signals[condition.metric]);
  const prev = previous ? num(previous[condition.metric]) : value;
  switch (condition.op) {
    case 'above': return value > condition.value;
    case 'below': return value < condition.value;
    case 'crossAbove': return prev <= condition.value && value > condition.value;
    case 'crossBelow': return prev >= condition.value && value < condition.value;
    default: return false;
  }
}
function evaluate(strategy, signals, previous) {
  const results = strategy.conditions.map(condition => ({ metric: condition.metric, op: condition.op, threshold: condition.value, value: num(signals[condition.metric]), hit: conditionHit(condition, signals, previous) }));
  const triggered = strategy.logic === 'or' ? results.some(result => result.hit) : results.length > 0 && results.every(result => result.hit);
  return { triggered, results };
}
// The paper executor. Enforces per-position, total and daily caps, a cooldown,
// and records automatic exits. Live execution would reuse this policy gate.
function runStrategies(paperAccount, strategies, signalsFor, { now = Date.now(), limits = {} } = {}) {
  const executed = [];
  const intents = [];
  const priceOf = mint => num(signalsFor(mint, 0).price);
  const totalValue = () => paper.valuation(paperAccount, priceOf).holdingsValue;
  for (const strategy of strategies) {
    if (strategy.status !== 'active' || strategy.mode !== 'auto') continue;
    if (now - (strategy.lastRun || 0) < strategy.cooldownSec * 1000) continue;
    const signals = signalsFor(strategy.mint, strategy.windowMinutes);
    const previous = strategy.prev || null;
    const { triggered, results } = evaluate(strategy, signals, previous);
    strategy.prev = { price: signals.price, change24h: signals.change24h, change: signals.change };
    strategy.lastRun = now;
    if (!(signals.price > 0)) { strategy.lastError = 'No live price.'; continue; }
    if (!triggered) { strategy.lastError = ''; continue; }
    if (strategy.execution === 'live') {
      if (strategy.livePending) continue;
      strategy.livePending = true;
      strategy.lastDetail = results.map(result => `${result.metric} ${result.op} ${result.threshold} (=${result.value.toFixed(4)})`).join(', ');
      intents.push({ id: strategy.id, mint: strategy.mint, symbol: strategy.symbol, usd: strategy.sizingUsd, price: signals.price, mode: strategy.mode, exits: strategy.exits });
      continue;
    }
    try {
      if (limits.maxTotalUsd && totalValue() + strategy.sizingUsd > limits.maxTotalUsd) throw new Error('Total exposure cap reached.');
      const held = paperAccount.positions[strategy.mint];
      const positionValue = held ? held.amount * priceOf(strategy.mint) : 0;
      if (limits.maxPositionUsd && positionValue + strategy.sizingUsd > limits.maxPositionUsd) throw new Error('Position cap reached.');
      const spentToday = paperAccount.orders.filter(order => order.side === 'buy' && order.at > now - 86400000).reduce((sum, order) => sum + order.valueUsd, 0);
      if (limits.dailyCapUsd && spentToday + strategy.sizingUsd > limits.dailyCapUsd) throw new Error('Daily spend cap reached.');
      paper.buy(paperAccount, { mint: strategy.mint, symbol: strategy.symbol, usd: strategy.sizingUsd, price: signals.price, now, id: randomUUID() });
      const filled = paperAccount.orders[paperAccount.orders.length - 1];
      if (filled) filled.strategyId = strategy.id;
      if (strategy.exits.takeProfit > 0) paper.addPending(paperAccount, { mint: strategy.mint, symbol: strategy.symbol, kind: 'takeProfit', side: 'sell', trigger: signals.price * (1 + strategy.exits.takeProfit / 100), percent: 100, now });
      if (strategy.exits.stopLoss > 0) paper.addPending(paperAccount, { mint: strategy.mint, symbol: strategy.symbol, kind: 'stop', side: 'sell', trigger: signals.price * (1 - strategy.exits.stopLoss / 100), percent: 100, now });
      strategy.triggers = (strategy.triggers || 0) + 1;
      strategy.lastTriggeredAt = now;
      strategy.lastDetail = results.map(result => `${result.metric} ${result.op} ${result.threshold} (=${result.value.toFixed(4)})`).join(', ');
      strategy.lastError = '';
      executed.push({ strategy: strategy.id, mint: strategy.mint });
    } catch (error) { strategy.lastError = error.message; }
  }
  return { executed, intents };
}
module.exports = { OPS, METRICS, normalizeCondition, normalizeStrategy, normalizeStrategies, conditionHit, evaluate, runStrategies };
