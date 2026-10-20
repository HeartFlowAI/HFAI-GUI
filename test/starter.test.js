const { test } = require('node:test'), assert = require('node:assert/strict');
const starter = require('../src/wallet/starter');
const solana = require('../src/wallet/solana');

test('starter Radar pack has valid unique wallets across all three sources', () => {
  const people = starter.starterPeople();
  assert.equal(people.length, 90);
  assert.equal(new Set(people.map(person => person.address)).size, 90);
  for (const person of people) {
    assert.ok(solana.validateAddress(person.address), `${person.label} has a valid address`);
    assert.ok(['axiom', 'pumpfun-padre', 'kolscan'].includes(person.source), `${person.label} has a source`);
    assert.equal(person.starter, true);
    assert.equal(person.watchActivity, person.sourceRank <= 10);
  }
  assert.equal(people.filter(person => person.source === 'axiom').length, 30);
  assert.equal(people.filter(person => person.source === 'pumpfun-padre').length, 30);
  assert.equal(people.filter(person => person.source === 'kolscan').length, 30);
});

test('starter Radar import adds only missing wallets and is idempotent', () => {
  const existing = [{ address: starter.PEOPLE[0].address, label: 'Custom label', kind: 'kol' }];
  const first = starter.mergeStarterPeople(existing);
  assert.equal(first.added, 89);
  assert.equal(first.people.length, 90);
  assert.equal(first.people.find(person => person.address === existing[0].address).label, 'Custom label');
  assert.equal(first.people[0].source, 'axiom');
  assert.equal(first.people[0].sourceRank, 1);
  const second = starter.mergeStarterPeople(first.people);
  assert.equal(second.added, 0);
  assert.equal(second.people.length, 90);
  const paused = starter.mergeStarterPeople([{ address: starter.PEOPLE[0].address, starter: true, watchActivity: false }]);
  assert.equal(paused.people.find(person => person.address === starter.PEOPLE[0].address).watchActivity, false);
  const retired = starter.mergeStarterPeople([{ address: '6yVb4pxNwDfr6rovwNnBg3SyKSvDcHGD4WdFPN1JJBqm', starter: true, label: 'old starter' }]);
  assert.equal(retired.people.some(person => person.address === '6yVb4pxNwDfr6rovwNnBg3SyKSvDcHGD4WdFPN1JJBqm'), false);
});
