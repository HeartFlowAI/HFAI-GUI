const { test } = require('node:test'), assert = require('node:assert/strict');
const solana = require('../src/wallet/solana');
const providers = require('../src/wallet/providers');
const { createWalletManager, normalizeConfig, sanitizeHistory } = require('../src/wallet/index');
const { executeTool } = require('../src/tools');
const { createSolanaConnect } = require('../src/wallet/connect');

const SOL = solana.SOL_MINT;
const ADDRESS = 'So11111111111111111111111111111111111111112';
const WATCH = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const json = body => ({ ok: true, status: 200, json: async () => body });
const tokenAccount = (mint, amount) => ({ account: { data: { parsed: { info: { mint, tokenAmount: { uiAmount: amount } } } } } });

function fakeFetch() {
  return async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.mainnet-beta') || u.includes('rpc.example')) {
      const { method } = JSON.parse(options.body);
      if (method === 'getBalance') return json({ result: { value: 2_000_000_000 } });
      if (method === 'getTokenAccountsByOwner') return json({ result: { value: [tokenAccount('MintA', 1000), tokenAccount('MintB', 0)] } });
      if (method === 'getAccountInfo') return json({ result: { value: { data: { parsed: { info: { mintAuthority: null, freezeAuthority: 'Frz', decimals: 6 } } } } } });
    }
    if (u.includes('jup')) return json({ [SOL]: { usdPrice: 150, priceChange24h: 1.5 }, [WATCH]: { usdPrice: 1, priceChange24h: 0.1 }, MintA: { usdPrice: 2, priceChange24h: 3 } });
    if (u.includes('dexscreener') && u.includes('search')) return json({ pairs: [
      { chainId: 'solana', dexId: 'raydium', baseToken: { address: 'MintA', symbol: 'AAA', name: 'Aaa' }, priceUsd: '2', priceChange: { h24: '5' }, liquidity: { usd: '10000' }, volume: { h24: '5000' }, marketCap: '100000' },
      { chainId: 'ethereum', baseToken: { address: 'x', symbol: 'ETHX', name: 'Ethx' } }
    ] });
    throw new Error('unexpected url ' + u);
  };
}

test('wallet address validation accepts base58 and rejects junk', () => {
  assert.equal(solana.validateAddress(ADDRESS), true);
  assert.equal(solana.validateAddress('  ' + ADDRESS + ' '), true);
  for (const bad of ['', 'abc', '0OIl', 'x'.repeat(50), null, 42]) assert.equal(solana.validateAddress(bad), false);
  assert.throws(() => solana.normalizeAddress('nope'), /Solana address/);
});

test('fetchPortfolio reads SOL balance and SPL token accounts', async () => {
  const portfolio = await solana.fetchPortfolio(ADDRESS, { fetchImpl: fakeFetch() });
  assert.equal(portfolio.sol, 2);
  assert.equal(portfolio.address, ADDRESS);
  assert.deepEqual(portfolio.tokens, [{ mint: 'MintA', amount: 1000 }]);
});

test('jupiterPrices and searchTokens parse provider responses', async () => {
  const prices = await providers.jupiterPrices([SOL, 'MintA'], { fetchImpl: fakeFetch() });
  assert.equal(prices[SOL].price, 150);
  assert.equal(prices[SOL].change24h, 1.5);
  assert.equal(prices.MintA.price, 2);
  const results = await providers.searchTokens('aaa', { fetchImpl: fakeFetch() });
  assert.equal(results.length, 1);
  assert.deepEqual({ symbol: results[0].symbol, priceUsd: results[0].priceUsd, change24h: results[0].change24h, liquidityUsd: results[0].liquidityUsd }, { symbol: 'AAA', priceUsd: 2, change24h: 5, liquidityUsd: 10000 });
});

test('tokenSafety reads mint/freeze authority from the mint account', async () => {
  const safety = await providers.tokenSafety('MintX', { fetchImpl: fakeFetch() });
  assert.equal(safety.known, true);
  assert.equal(safety.mintRevoked, true);
  assert.equal(safety.freezeRevoked, false);
  assert.equal(safety.level, 'caution');
  assert.ok(safety.flags.includes('freeze authority active'));
});

test('wallet manager values holdings and computes shares', async () => {
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  const state = await manager.refresh();
  assert.equal(state.watching, true);
  assert.equal(state.total, 300 + 2000);
  assert.equal(state.holdings[0].symbol, 'MintA');
  assert.equal(state.holdings.find(h => h.symbol === 'SOL').value, 300);
  assert.ok(Math.abs(state.holdings[0].share - 2000 / 2300) < 1e-9);
  manager.dispose();
});

test('wallet manager reports an empty state with no addresses', async () => {
  const config = normalizeConfig({});
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  const state = await manager.refresh();
  assert.equal(state.watching, false);
  assert.equal(state.holdings.length, 0);
  manager.dispose();
});

test('normalizeConfig sanitizes addresses, rpc, mode and currency', () => {
  const config = normalizeConfig({ addresses: [ADDRESS, ADDRESS, 'bad'], rpc: 'http://insecure', mode: 'pro', currency: 'eur', hideBalances: true });
  assert.deepEqual(config.addresses, [ADDRESS]);
  assert.equal(config.rpc, '');
  assert.equal(config.mode, 'pro');
  assert.equal(config.currency, 'EUR');
  assert.equal(config.hideBalances, true);
});

test('fetchHistory returns recent transaction summaries', async () => {
  const fetchImpl = async (url, options = {}) => {
    const { method } = JSON.parse(options.body);
    if (method === 'getSignaturesForAddress') return json({ result: [{ signature: 'sig', slot: 1, blockTime: 2, err: null }] });
    throw new Error('unexpected ' + method);
  };
  const history = await solana.fetchHistory(ADDRESS, { fetchImpl });
  assert.deepEqual(history, [{ signature: 'sig', slot: 1, blockTime: 2, err: false, memo: '' }]);
});

test('wallet manager prices the watchlist and fires price alerts once', async () => {
  const config = normalizeConfig({ watchlist: [WATCH], alerts: [{ mint: WATCH, direction: 'above', price: 0.5 }] });
  const alerts = [];
  const manager = createWalletManager({ config, fetchImpl: fakeFetch(), onAlert: alert => alerts.push(alert) });
  const state = await manager.refresh();
  assert.equal(state.watchlist.length, 1);
  assert.equal(state.watchlist[0].price, 1);
  assert.equal(state.alerts[0].direction, 'above');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].current, 1);
  await manager.refresh();
  assert.equal(alerts.length, 1);
  assert.ok(state.alerts[0].triggeredAt > 0);
  manager.dispose();
});

test('wallet tools route through the tool context and validate their input', async () => {
  const signal = () => new AbortController().signal;  assert.equal((await executeTool('wallet_summary', {}, { signal: signal(), walletSummary: async () => ({ watching: true, total: 5 }) })).total, 5);
  assert.equal((await executeTool('token_safety', { mint: 'MintX' }, { signal: signal(), tokenSafety: async mint => ({ mint, level: 'ok' }) })).mint, 'MintX');
  assert.equal((await executeTool('market_discover', { query: 'bonk' }, { signal: signal(), marketDiscover: async query => ({ query }) })).query, 'bonk');
  await assert.rejects(executeTool('wallet_token', {}, { signal: signal() }), /Missing string argument/);
  await assert.rejects(executeTool('wallet_token', { query: 'x', extra: 'y' }, { signal: signal() }), /Unexpected/);
});

test('wallet manager records chartable price history', async () => {
  const config = normalizeConfig({ watchlist: [WATCH] });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager.refresh();
  const series = manager.series(WATCH);
  assert.equal(series.length, 1);
  assert.equal(series[0].p, 1);
  manager.dispose();
});

test('sanitizeHistory keeps bounded, valid points only', () => {
  const history = sanitizeHistory({ [WATCH]: [{ t: '1', p: '2' }, { t: 'bad' }], nope: [{ t: 1, p: 1 }] });
  assert.deepEqual(history[WATCH], [{ t: 1, p: 2 }]);
  assert.equal(history.nope, undefined);
});

test('WalletConnect refuses without a project id and normalizes wc config', async () => {  const connect = createSolanaConnect({ getProjectId: () => '' });
  await assert.rejects(connect.pair(), /WalletConnect project ID/);
  const cfg = normalizeConfig({ wcProjectId: '  abc  ', wcSession: { topic: 't', accounts: ['solana:abc'] } });
  assert.equal(cfg.wcProjectId, 'abc');
  assert.equal(cfg.wcSession.topic, 't');
  assert.deepEqual(cfg.wcSession.accounts, ['solana:abc']);
  assert.deepEqual(normalizeConfig({}).wcSession, { topic: '', accounts: [] });
});

test('research records normalize with only known statuses', () => {
  const cfg = normalizeConfig({ research: [{ id: 'r1', mint: 'MintA', symbol: 'AAA', status: 'ready', report: 'Report body' }, { id: 'r2', mint: 'MintB', status: 'weird' }, { mint: 'x' }] });
  assert.equal(cfg.research.length, 1);
  assert.equal(cfg.research[0].report, 'Report body');
  assert.equal(cfg.research[0].status, 'ready');
  assert.deepEqual(normalizeConfig({}).research, []);
});
