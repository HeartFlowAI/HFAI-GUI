const { test } = require('node:test'), assert = require('node:assert/strict');
const session = require('../src/wallet/session');
const paper = require('../src/wallet/paper');

function held() {
  const account = paper.normalizePaper({ cash: 1000 });
  paper.buy(account, { mint: 'MintA', symbol: 'AAA', usd: 200, price: 2 });
  paper.addPending(account, { mint: 'MintA', kind: 'takeProfit', side: 'sell', trigger: 4, percent: 100 });
  return account;
}
const strategy = () => ({ id: 's1', status: 'active' });
const priceOf = mint => (mint === 'MintA' ? 2 : 0);

test('session state defaults to RUNNING', () => {
  assert.equal(session.normalizeSession({}).state, 'RUNNING');
  assert.equal(session.normalizeSession({ state: 'nonsense' }).state, 'RUNNING');
});

test('exit and pause cancels orders, pauses strategies and settles paper positions', () => {
  const account = held();
  const strategies = [strategy()];
  const state = session.pause(session.normalizeSession({}), { paper: account, strategies, priceOf, exit: true, now: 10 });
  assert.equal(state.state, 'PAUSED_FLAT');
  assert.equal(account.pending.length, 0);
  assert.equal(Object.keys(account.positions).length, 0);
  assert.equal(strategies[0].status, 'paused');
});

test('pause without exit keeps exposure visible', () => {
  const account = held();
  const state = session.pause(session.normalizeSession({}), { paper: account, priceOf, exit: false, now: 10 });
  assert.equal(state.state, 'PAUSED_WITH_EXPOSURE');
  assert.equal(Object.keys(account.positions).length, 1);
  assert.match(state.note, /still open/);
});

test('resume returns to RUNNING and clears the note', () => {
  const state = session.pause(session.normalizeSession({}), { paper: held(), priceOf, exit: false, now: 10 });
  session.resume(state, { now: 20 });
  assert.equal(state.state, 'RUNNING');
  assert.equal(state.note, '');
});

test('resuming after an interrupted exit reconciles and asks for confirmation', () => {
  const account = held();
  const state = session.normalizeSession({ state: 'EXITING' });
  const changed = session.afterStartup(state, { paper: account, now: 30 });
  assert.equal(changed, true);
  assert.equal(state.state, 'PAUSED_WITH_EXPOSURE');
  assert.equal(state.needsConfirmation, true);
  assert.match(state.note, /attention/);
});
