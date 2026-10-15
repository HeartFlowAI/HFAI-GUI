const { test } = require('node:test'), assert = require('node:assert/strict');
const s = require('../src/signals');

test('signals validate their mint and condition', () => {
  assert.throws(() => s.normalizeSignal({ name: 'X', condition: { metric: 'price', op: 'above', value: 1 } }), /token/);
  assert.throws(() => s.normalizeSignal({ name: 'X', mint: 'M' }), /condition/);
  const sig = s.normalizeSignal({ name: 'Dip', mint: 'M', condition: { metric: 'change24h', op: 'below', value: -20 } });
  assert.equal(sig.action, 'notify');
  assert.equal(sig.enabled, true);
  assert.equal(sig.condition.op, 'below');
});

test('a signal fires when the chart lines up, respects cooldown and the research gate', () => {
  const rules = [s.normalizeSignal({ name: 'Dip', mint: 'M', condition: { metric: 'change24h', op: 'below', value: -20 }, cooldownSec: 3600 })];
  const signalsFor = () => ({ price: 2, change24h: -25, change: -10 });
  assert.equal(s.runSignals(rules, signalsFor, { now: 1000 }).length, 1);
  assert.equal(s.runSignals(rules, signalsFor, { now: 1001 }).length, 0); // cooldown
  const gated = [s.normalizeSignal({ name: 'News', mint: 'M', condition: { metric: 'price', op: 'above', value: 1 }, requireResearch: true })];
  assert.equal(s.runSignals(gated, signalsFor, { now: 1000, freshResearch: () => false }).length, 0);
  assert.equal(s.runSignals(gated, signalsFor, { now: 1000, freshResearch: () => true }).length, 1);
});

test('runSignals ignores disabled rules and records the trigger detail', () => {
  const rule = s.normalizeSignal({ name: 'Off', mint: 'M', condition: { metric: 'price', op: 'above', value: 1 }, enabled: false });
  assert.equal(s.runSignals([rule], () => ({ price: 2 }), { now: 1 }).length, 0);
  rule.enabled = true;
  const fired = s.runSignals([rule], () => ({ price: 2 }), { now: 1 });
  assert.equal(fired.length, 1);
  assert.match(rule.lastDetail, /price above 1/);
});
