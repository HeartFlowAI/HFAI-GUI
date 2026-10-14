const { test } = require('node:test'), assert = require('node:assert/strict');
const swap = require('../src/wallet/swap');

const json = body => ({ ok: true, status: 200, json: async () => body });
const QUOTE = { inputMint: swap.SOL_MINT, outputMint: 'MintA', inAmount: '1000000000', outAmount: '5000000', otherAmountThreshold: '4900000', slippageBps: 50, priceImpactPct: '0.01', routePlan: [{}, {}] };

test('amounts convert to base units', () => {
  assert.equal(swap.toBaseUnits(1, 9), '1000000000');
  assert.equal(swap.toBaseUnits(0.5, 6), '500000');
  assert.throws(() => swap.toBaseUnits(0, 9), /amount/);
});

test('quote and swap build the expected requests and parse the response', async () => {
  let swapBody;
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes('/quote')) return json(QUOTE);
    if (String(url).includes('/swap')) { swapBody = JSON.parse(options.body); return json({ swapTransaction: 'BASE64TX' }); }
    throw new Error('unexpected ' + url);
  };
  const quote = await swap.quote({ inputMint: swap.SOL_MINT, outputMint: 'MintA', amount: '1000000000', slippageBps: 50 }, { fetchImpl });
  assert.equal(quote.outAmount, '5000000');
  const tx = await swap.swapTransaction({ quoteResponse: quote, userPublicKey: 'User' }, { fetchImpl });
  assert.equal(tx, 'BASE64TX');
  assert.equal(swapBody.userPublicKey, 'User');
  assert.equal(swapBody.wrapAndUnwrapSol, true);
});

test('quote surfaces provider errors and missing routes', async () => {
  await assert.rejects(swap.quote({ inputMint: 'a', outputMint: 'b', amount: '1' }, { fetchImpl: async () => ({ ok: false, status: 400 }) }), /responded 400/);
  await assert.rejects(swap.quote({ inputMint: 'a', outputMint: 'b', amount: '1' }, { fetchImpl: async () => json({}) }), /No route/);
  await assert.rejects(swap.swapTransaction({ quoteResponse: {}, userPublicKey: 'u' }, { fetchImpl: async () => json({}) }), /did not return a transaction/);
});

test('summarize produces a readable, decoded preview', () => {
  const summary = swap.summarize(QUOTE);
  assert.equal(summary.inAmount, '1000000000');
  assert.equal(summary.minimumOut, '4900000');
  assert.equal(summary.priceImpactPct, 1);
  assert.equal(summary.routes, 2);
});

test('simulation reports success and failure', async () => {
  const ok = await swap.simulate('rpc', 'TX', { fetchImpl: async () => json({ result: { value: { err: null, unitsConsumed: 1234, logs: ['a', 'b'] } } }) });
  assert.equal(ok.ok, true);
  assert.equal(ok.units, 1234);
  const bad = await swap.simulate('rpc', 'TX', { fetchImpl: async () => json({ result: { value: { err: { InstructionError: [0, 'Custom'] } } } }) });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /InstructionError/);
});

test('confirmation reconciles status without inventing success', async () => {
  const confirmed = await swap.confirm('rpc', 'sig', { fetchImpl: async () => json({ result: { value: [{ err: null, confirmationStatus: 'confirmed' }] } }), interval: 1 });
  assert.equal(confirmed.status, 'confirmed');
  const failed = await swap.confirm('rpc', 'sig', { fetchImpl: async () => json({ result: { value: [{ err: { InstructionError: [0, 'Custom'] }, confirmationStatus: 'processed' }] } }), interval: 1 });
  assert.equal(failed.status, 'failed');
});
