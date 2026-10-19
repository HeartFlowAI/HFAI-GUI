const { test } = require('node:test'), assert = require('node:assert/strict');
const people = require('../src/wallet/people');
const { executeTool } = require('../src/tools');

const A = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const B = '51yZyDSnec4xnUv7XLRVYcDyV4x3wUtzrDcRaYbmQU5j';

test('people normalize roles, tags, scans and duplicates', () => {
  const list = people.normalizePeople([
    { address: A, label: 'Alpha', kind: 'KOL', tags: 'kol, ai, kol', scan: { at: 1, total: 50, holdings: [] } },
    { address: A, label: 'Duplicate' },
    { address: 'not-a-wallet', label: 'Bad' },
    { address: B, kind: 'smart money' }
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].label, 'Alpha');
  assert.equal(list[0].kind, 'kol');
  assert.deepEqual(list[0].tags, ['kol', 'ai']);
  assert.equal(list[1].kind, 'other');
});

test('upsertPerson keeps identity, scan and launch history', () => {
  const first = people.upsertPerson([], { address: A, label: 'Dev', kind: 'dev' });
  const id = first[0].id;
  first[0].scan = { at: 1, total: 10, holdings: [] };
  first[0].launches = [{ mint: B, symbol: 'OLD', createdAt: 10 }];
  const next = people.upsertPerson(first, { address: A, label: 'Launch dev', kind: 'kol', note: 'updated' });
  assert.equal(next.length, 1);
  assert.equal(next[0].id, id);
  assert.equal(next[0].label, 'Launch dev');
  assert.equal(next[0].kind, 'kol');
  assert.equal(next[0].note, 'updated');
  assert.equal(next[0].scan.total, 10);
  assert.equal(next[0].launches[0].symbol, 'OLD');
});

test('mergeLaunch updates completion and caps launches', () => {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const mintAt = index => Array.from({ length: 44 }, (_, position) => alphabet[((index + 1) * 17 + position * 11) % alphabet.length]).join('');
  const person = { launches: [] };
  for (let i = 0; i < 60; i++) people.mergeLaunch(person, { mint: mintAt(i), symbol: `T${i}`, createdAt: i });
  assert.equal(person.launches.length, 50);
  const newest = person.launches[0].mint;
  people.mergeLaunch(person, { mint: newest, symbol: 'T59', createdAt: 59, completed: true });
  const launch = person.launches.find(item => item.mint === newest);
  assert.equal(launch.completed, true);
  assert.equal(person.launches[0].mint, newest);
});

test('launchFromPumpEvent and personStats summarize observed dev launches', () => {
  const launch = people.launchFromPumpEvent({ mint: A, symbol: 'CREW', name: 'CREW', receivedAt: 123, completed: true });
  assert.equal(launch.symbol, 'CREW');
  assert.equal(launch.completed, true);
  const stats = people.personStats({ launches: [launch, { mint: B, symbol: 'NEW', createdAt: 200 }] });
  assert.equal(stats.launches, 2);
  assert.equal(stats.completed, 1);
  assert.equal(stats.lastLaunchAt, 200);
});


test('people and token intel tools route through the tool context', async () => {
  const signal = new AbortController().signal;
  const intel = await executeTool('wallet_token_intel', { mint: A }, { signal, walletTokenIntel: async mint => ({ mint, symbol: 'TEST' }) });
  assert.equal(intel.symbol, 'TEST');
  const added = await executeTool('wallet_people_add', { address: A, label: 'KOL', role: 'kol' }, { signal, walletPeopleAdd: async (address, label, role) => ({ address, label, role }) });
  assert.equal(added.role, 'kol');
  const listed = await executeTool('wallet_people', {}, { signal, walletPeople: async () => [{ address: A }] });
  assert.equal(listed.length, 1);
});
