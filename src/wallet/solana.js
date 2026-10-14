const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function validateAddress(address) {
  return typeof address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}
function normalizeAddress(address) {
  const value = typeof address === 'string' ? address.trim() : '';
  if (!validateAddress(value)) throw new Error('That does not look like a Solana address.');
  return value;
}
async function rpcCall(url, method, params, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
    signal
  });
  if (!response.ok) throw new Error(`Solana RPC responded ${response.status}.`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'Solana RPC error.');
  return body.result;
}
async function fetchPortfolio(address, { rpc = DEFAULT_RPC, fetchImpl = fetch, signal } = {}) {
  const account = normalizeAddress(address);
  const [balance, accounts] = await Promise.all([
    rpcCall(rpc, 'getBalance', [account], { fetchImpl, signal }),
    rpcCall(rpc, 'getTokenAccountsByOwner', [account, { programId: TOKEN_PROGRAM }, { encoding: 'jsonParsed' }], { fetchImpl, signal })
  ]);
  const tokens = [];
  for (const entry of accounts?.value || []) {
    const info = entry?.account?.data?.parsed?.info;
    const amount = Number(info?.tokenAmount?.uiAmount || 0);
    if (!info?.mint || !(amount > 0)) continue;
    tokens.push({ mint: info.mint, amount });
  }
  return { address: account, lamports: Number(balance?.value || 0), sol: Number(balance?.value || 0) / 1e9, tokens };
}
async function fetchMintSafety(mint, { rpc = DEFAULT_RPC, fetchImpl = fetch, signal } = {}) {
  const result = await rpcCall(rpc, 'getAccountInfo', [mint, { encoding: 'jsonParsed' }], { fetchImpl, signal });
  const info = result?.value?.data?.parsed?.info;
  if (!info) return null;
  const mintAuthority = info.mintAuthority || '';
  const freezeAuthority = info.freezeAuthority || '';
  return { mintAuthority, freezeAuthority, mintRevoked: !mintAuthority, freezeRevoked: !freezeAuthority, decimals: Number(info.decimals || 0) };
}
async function fetchHistory(address, { rpc = DEFAULT_RPC, fetchImpl = fetch, signal, limit = 10 } = {}) {
  const account = normalizeAddress(address);
  const result = await rpcCall(rpc, 'getSignaturesForAddress', [account, { limit: Math.min(50, Math.max(1, Number(limit) || 10)) }], { fetchImpl, signal });
  return (result || []).map(item => ({ signature: item.signature, slot: item.slot, err: !!item.err, blockTime: item.blockTime || 0, memo: item.memo || '' }));
}
module.exports = { DEFAULT_RPC, SOL_MINT, TOKEN_PROGRAM, validateAddress, normalizeAddress, rpcCall, fetchPortfolio, fetchMintSafety, fetchHistory };
