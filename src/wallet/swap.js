const { rpcCall } = require('./solana');

// Jupiter swap + simulation + reconciliation. Live execution signs through
// WalletConnect or a selected local bot wallet. Nothing here is called unless
// the user is in live mode and has approved the specific transaction.
const JUPITER_SWAP = 'https://lite-api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_DECIMALS = 9;

function toBaseUnits(uiAmount, decimals) {
  const value = Number(uiAmount);
  if (!(value > 0)) throw new Error('Enter an amount.');
  return Math.round(value * Math.pow(10, decimals)).toString();
}
async function quote({ inputMint, outputMint, amount, slippageBps = 50 }, { fetchImpl = fetch, signal } = {}) {
  if (!inputMint || !outputMint) throw new Error('Choose input and output tokens.');
  const bps = Math.min(5000, Math.max(1, Math.floor(Number(slippageBps) || 50)));
  const url = `${JUPITER_SWAP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${bps}&restrictIntermediateTokens=true`;
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`Jupiter quote responded ${response.status}.`);
  const body = await response.json();
  if (!body || !body.outAmount) throw new Error('No route found for this swap.');
  return body;
}
async function swapTransaction({ quoteResponse, userPublicKey, wrapAndUnwrapSol = true }, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`${JUPITER_SWAP}/swap`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal,
    body: JSON.stringify({ quoteResponse, userPublicKey, wrapAndUnwrapSol, dynamicComputeUnitLimit: true })
  });
  if (!response.ok) throw new Error(`Jupiter swap responded ${response.status}.`);
  const body = await response.json();
  if (!body.swapTransaction) throw new Error('Jupiter did not return a transaction.');
  return body.swapTransaction;
}
function summarize(quoteResponse) {
  return {
    inputMint: quoteResponse.inputMint, outputMint: quoteResponse.outputMint,
    inAmount: String(quoteResponse.inAmount), outAmount: String(quoteResponse.outAmount),
    minimumOut: String(quoteResponse.otherAmountThreshold || quoteResponse.outAmount),
    slippageBps: Number(quoteResponse.slippageBps || 0),
    priceImpactPct: Number(quoteResponse.priceImpactPct || 0) * 100,
    routes: (quoteResponse.routePlan || []).length
  };
}
async function simulate(rpc, transactionBase64, { fetchImpl = fetch, signal } = {}) {
  const result = await rpcCall(rpc, 'simulateTransaction', [transactionBase64, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed' }], { fetchImpl, signal });
  const value = result?.value || {};
  return { ok: !value.err, error: value.err ? JSON.stringify(value.err) : '', units: Number(value.unitsConsumed || 0), logs: (value.logs || []).slice(-8) };
}
async function confirm(rpc, signature, { fetchImpl = fetch, signal, timeoutMs = 60000, interval = 1500 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await rpcCall(rpc, 'getSignatureStatuses', [[signature], { searchTransactionHistory: false }], { fetchImpl, signal });
    const status = result?.value?.[0];
    if (status) { if (status.err) return { status: 'failed', error: JSON.stringify(status.err) }; if (['confirmed', 'finalized'].includes(status.confirmationStatus)) return { status: 'confirmed' }; }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return { status: 'pending' };
}
module.exports = { JUPITER_SWAP, SOL_MINT, SOL_DECIMALS, toBaseUnits, quote, swapTransaction, summarize, simulate, confirm };
