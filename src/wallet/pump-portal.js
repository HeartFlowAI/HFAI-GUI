const solana = require('./solana');

const TRADE_URL = 'https://pumpportal.fun/api/trade-local';
const LOCAL_FEE_PCT = 0.5;
const POOLS = ['pump', 'pump-amm', 'auto'];

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function detectPool({ completed = false, dex = '' } = {}) {
  if (completed || dex === 'pumpswap' || dex === 'pump-amm') return 'pump-amm';
  return 'pump';
}
function normalizeAmount(value, denominatedInSol) {
  if (denominatedInSol) {
    const amount = Number(value);
    if (!(amount > 0)) throw new Error('Enter a SOL amount.');
    return String(amount);
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?%$/.test(value.trim())) return value.trim();
  const amount = Number(value);
  if (!(amount > 0)) throw new Error('Enter a token amount.');
  return String(amount);
}
async function tradeLocal({ publicKey, action, mint, amount, denominatedInSol = true, slippage = 10, priorityFee = 0.0005, pool = 'pump' } = {}, { fetchImpl = fetch, signal } = {}) {
  if (!solana.validateAddress(publicKey)) throw new Error('Connect a valid Solana wallet first.');
  if (!solana.validateAddress(mint)) throw new Error('That does not look like a token mint.');
  if (!['buy', 'sell'].includes(action)) throw new Error('Action must be buy or sell.');
  if (!POOLS.includes(pool)) throw new Error('Unknown PumpPortal pool.');
  const body = {
    publicKey,
    action,
    mint,
    amount: normalizeAmount(amount, denominatedInSol),
    denominatedInSol: denominatedInSol ? 'true' : 'false',
    slippage: clamp(Number(slippage) || 10, 0.1, 50),
    priorityFee: clamp(Number(priorityFee) || 0.0005, 0, 0.05),
    pool
  };
  const response = await fetchImpl(TRADE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/octet-stream' },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`PumpPortal responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('PumpPortal returned an empty transaction.');
  const prefix = buffer.subarray(0, Math.min(200, buffer.length)).toString('utf8');
  if (/^\s*[{[]/.test(prefix)) {
    let message = prefix;
    try { const parsed = JSON.parse(buffer.toString('utf8')); message = parsed.error || parsed.message || JSON.stringify(parsed); } catch {}
    throw new Error(`PumpPortal: ${String(message).slice(0, 240)}`);
  }
  return { transaction: buffer.toString('base64'), request: body };
}
function summary(request) {
  return {
    venue: 'PumpPortal', pool: request.pool, action: request.action,
    amount: request.amount, denominatedInSol: request.denominatedInSol === 'true',
    slippagePct: Number(request.slippage), priorityFeeSol: Number(request.priorityFee),
    feePct: LOCAL_FEE_PCT
  };
}
module.exports = { TRADE_URL, LOCAL_FEE_PCT, POOLS, detectPool, tradeLocal, summary };
