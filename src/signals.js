const { randomUUID } = require('node:crypto');
const { conditionHit, METRICS, OPS } = require('./wallet/strategy');

// Signal rules: watch a price condition and fire only when the chart lines up,
// optionally gated on a fresh research report. The local take on "ping me when
// it lines up".
const ACTIONS = ['notify', 'paper-buy'];

function normalizeCondition(input) {
  if (!input || typeof input !== 'object') return null;
  const metric = METRICS.includes(input.metric) ? input.metric : null;
  const op = OPS.includes(input.op) ? input.op : null;
  if (!metric || !op || !Number.isFinite(Number(input.value))) return null;
  return { metric, op, value: Number(input.value), windowMinutes: Math.max(0, Math.min(10080, Math.floor(Number(input.windowMinutes) || 0))) };
}
function normalizeSignal(input, existing) {
  if (!input || typeof input !== 'object') throw new Error('Invalid signal.');
  const name = (typeof input.name === 'string' ? input.name.trim() : '').slice(0, 60) || (existing?.name || 'Signal');
  const mint = typeof input.mint === 'string' ? input.mint.trim().slice(0, 60) : (existing?.mint || '');
  if (!mint) throw new Error('Choose a token.');
  const condition = normalizeCondition(input.condition || existing?.condition);
  if (!condition) throw new Error('Add a condition with a metric, an operator and a value.');
  return {
    id: existing?.id || randomUUID(),
    name, mint,
    symbol: typeof input.symbol === 'string' ? input.symbol.slice(0, 24) : (existing?.symbol || ''),
    condition,
    requireResearch: input.requireResearch === undefined ? (existing?.requireResearch === true) : input.requireResearch === true,
    researchMaxAgeMin: Math.max(0, Math.min(10080, Math.floor(Number(input.researchMaxAgeMin ?? existing?.researchMaxAgeMin ?? 720) || 0))),
    action: ACTIONS.includes(input.action) ? input.action : (existing?.action || 'notify'),
    usd: Math.max(0, Number(input.usd ?? existing?.usd ?? 25) || 0),
    cooldownSec: Math.max(0, Math.min(86400, Math.floor(Number(input.cooldownSec ?? existing?.cooldownSec ?? 3600) || 0))),
    enabled: input.enabled === undefined ? (existing ? existing.enabled !== false : true) : input.enabled !== false,
    createdAt: existing?.createdAt || Date.now(),
    lastTriggeredAt: existing?.lastTriggeredAt || 0,
    lastDetail: existing?.lastDetail || ''
  };
}
function normalizeSignals(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => item && item.id && item.mint && item.condition).slice(-40).map(item => ({
    id: String(item.id), name: String(item.name || '').slice(0, 60), mint: String(item.mint).slice(0, 60), symbol: String(item.symbol || '').slice(0, 24),
    condition: item.condition, requireResearch: item.requireResearch === true,
    researchMaxAgeMin: Math.max(0, Math.floor(Number(item.researchMaxAgeMin) || 0)), action: ACTIONS.includes(item.action) ? item.action : 'notify',
    usd: Math.max(0, Number(item.usd) || 0), cooldownSec: Math.max(0, Math.floor(Number(item.cooldownSec) || 0)),
    enabled: item.enabled !== false, createdAt: Number(item.createdAt) || 0, lastTriggeredAt: Number(item.lastTriggeredAt) || 0, lastDetail: String(item.lastDetail || '').slice(0, 200)
  })).filter(item => item.condition);
}
function runSignals(rules, signalsFor, { now = Date.now(), freshResearch = () => true } = {}) {
  const fired = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.lastTriggeredAt && now - rule.lastTriggeredAt < rule.cooldownSec * 1000) continue;
    const signals = signalsFor(rule.mint, rule.condition.windowMinutes);
    const previous = rule.prev || null;
    const hit = conditionHit(rule.condition, signals, previous);
    rule.prev = { price: signals.price, change24h: signals.change24h, change: signals.change };
    if (!hit) continue;
    if (rule.requireResearch && !freshResearch(rule.mint, rule)) continue;
    rule.lastTriggeredAt = now;
    rule.lastDetail = `${rule.condition.metric} ${rule.condition.op} ${rule.condition.value} (=${Number(signals[rule.condition.metric] || 0).toFixed(4)})`;
    fired.push({ rule, signals });
  }
  return fired;
}
module.exports = { ACTIONS, normalizeCondition, normalizeSignal, normalizeSignals, runSignals };
