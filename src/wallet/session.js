const paper = require('./paper');

// Pause/exit/reconciliation state machine (trading-workspace chunk C20). Pause
// cancels controllable orders and, when asked, settles paper positions. A live
// bot cannot be liquidated without signing, so it is flagged as holding
// exposure instead of pretending to be flat.
const STATES = ['RUNNING', 'EXITING', 'PAUSED_WITH_EXPOSURE', 'PAUSED_FLAT', 'RECONCILING'];
const EXIT_MINTS = { SOL: 'So11111111111111111111111111111111111111112', USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' };

function normalizeSession(input) {
  const source = input && typeof input === 'object' ? input : {};
  const state = STATES.includes(source.state) ? source.state : 'RUNNING';
  return {
    state,
    exitMint: ['SOL', 'USDC'].includes(source.exitMint) ? source.exitMint : 'SOL',
    updatedAt: Number(source.updatedAt) || 0,
    note: typeof source.note === 'string' ? source.note.slice(0, 200) : '',
    needsConfirmation: source.needsConfirmation === true
  };
}
function settle(paperAccount, priceOf, now) {
  for (const mint of Object.keys(paperAccount.positions)) {
    try { paper.sell(paperAccount, { mint, percent: 100, price: priceOf(mint), now }); }
    catch { /* leave the position; it stays as visible exposure */ }
  }
}
function pause(session, { paper: paperAccount, strategies = [], priceOf = () => 0, exit = false, now = Date.now() } = {}) {
  session.state = 'EXITING';
  paper.clearPending(paperAccount);
  for (const strategy of strategies) if (strategy.status === 'active') strategy.status = 'paused';
  if (exit) settle(paperAccount, priceOf, now);
  const remaining = Object.keys(paperAccount.positions).length;
  session.state = remaining ? 'PAUSED_WITH_EXPOSURE' : 'PAUSED_FLAT';
  session.updatedAt = now;
  session.needsConfirmation = false;
  session.note = remaining ? `${remaining} position(s) still open and visible; they were not liquidated.` : 'All controllable orders cancelled; nothing open.';
  return session;
}
function resume(session, { now = Date.now() } = {}) {
  session.state = 'RUNNING';
  session.updatedAt = now; session.note = ''; session.needsConfirmation = false;
  return session;
}
function reconcile(session, { paper: paperAccount, now = Date.now() } = {}) {
  session.state = 'RECONCILING';
  const remaining = Object.keys(paperAccount.positions).length;
  session.state = remaining ? 'PAUSED_WITH_EXPOSURE' : 'PAUSED_FLAT';
  session.updatedAt = now;
  session.needsConfirmation = remaining > 0;
  session.note = remaining ? `${remaining} position(s) need attention after an interruption. Confirm to resume or exit.` : 'Reconciled after interruption; nothing open.';
  return session;
}
function afterStartup(session, { paper: paperAccount, now = Date.now() } = {}) {
  if (session.state === 'EXITING') { reconcile(session, { paper: paperAccount, now }); return true; }
  return false;
}
module.exports = { STATES, EXIT_MINTS, normalizeSession, pause, resume, reconcile, afterStartup };
