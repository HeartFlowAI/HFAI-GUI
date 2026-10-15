const { test } = require('node:test'), assert = require('node:assert/strict');
const views = require('../src/views');
const thesis = require('../src/thesis');

test('view specs validate their type, layout and source', () => {
  const v = views.normalizeView({ type: 'line', title: 'SOL', source: { kind: 'series', mint: 'So1', range: 240 }, layout: 'full' });
  assert.equal(v.type, 'line');
  assert.equal(v.layout, 'full');
  assert.equal(v.source.kind, 'series');
  assert.equal(v.source.range, 240);
  const fallback = views.normalizeView({ type: 'nonsense', source: { kind: 'bogus' } });
  assert.equal(fallback.type, 'note');
  assert.equal(fallback.source.kind, 'static');
  assert.equal(fallback.layout, 'half');
  assert.equal(fallback.createdBy, 'gigi');
});

test('normalizeViews keeps only specs with ids and caps the list', () => {
  const list = views.normalizeViews([{ id: 'a', type: 'metrics' }, { type: 'line' }, 'junk', null]);
  assert.deepEqual(list.map(v => v.id), ['a']);
});

test('thesis validates legs and requires one long leg with size', () => {
  assert.throws(() => thesis.normalizeThesis({ name: 'X', legs: [] }), /leg/);
  assert.throws(() => thesis.normalizeThesis({ name: 'X', legs: [{ mint: 'M', side: 'short', sizeUsd: 10 }] }), /long leg/);
  const t = thesis.normalizeThesis({ name: 'Intel view', rationale: '18A', legs: [{ mint: 'M1', symbol: 'INTC', side: 'long', sizeUsd: 30, leverage: 10 }, { mint: 'M2', symbol: 'SPX', side: 'hedge', sizeUsd: 10 }], exits: { stopLossPct: 20, text: 'exit if 50-day breaks' } });
  assert.equal(t.legs.length, 2);
  assert.equal(t.status, 'draft');
  assert.deepEqual(thesis.executableLegs(t).map(l => l.symbol), ['INTC']);
  assert.match(thesis.toShareText(t), /Long INTC/);
  assert.match(thesis.toShareText(t), /Hedge SPX/);
  assert.match(thesis.toShareText(t), /Exit:/);
});
