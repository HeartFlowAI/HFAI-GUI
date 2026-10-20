const { test } = require('node:test'), assert = require('node:assert/strict');
const solana = require('../src/wallet/solana');
const providers = require('../src/wallet/providers');
const { createWalletManager, normalizeConfig, sanitizeHistory, sanitizeHistoryCache } = require('../src/wallet/index');
const { executeTool } = require('../src/tools');
const follow = require('../src/wallet/follow');
const copyWallet = require('../src/wallet/copy');
const mirrorWallet = require('../src/wallet/mirror');
const { createSolanaConnect } = require('../src/wallet/connect');

const SOL = solana.SOL_MINT;
const DATE = Date.now() - 20 * 864e5;
const GECKO_NOW = Math.floor(Date.now() / 1000);
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
      if (method === 'getTokenAccountsByOwner') { const program = JSON.parse(options.body).params?.[1]?.programId; if (program === solana.TOKEN_2022_PROGRAM) return json({ result: { value: [] } }); return json({ result: { value: [tokenAccount('MintA', 1000), tokenAccount('MintB', 0)] } }); }
      if (method === 'getAccountInfo') return json({ result: { value: { data: { parsed: { info: { mintAuthority: null, freezeAuthority: 'Frz', decimals: 6 } } } } } });
      if (method === 'getSignaturesForAddress') return json({ result: [{ signature: 'sig1', slot: 10, blockTime: 1700000000, err: null }] });
      if (method === 'getVersion') return json({ result: { 'solana-core': 'test' } });
    }
    if (u.includes('api.helius.xyz')) return json([{ signature: 'helius1', timestamp: 1700000100, type: 'SWAP', description: 'Swapped 1 SOL for 100 USDC', fee: 5000, tokenTransfers: [{ mint: SOL, tokenAmount: 1, fromUserAccount: ADDRESS, toUserAccount: 'pool' }, { mint: WATCH, tokenAmount: 100, fromUserAccount: 'pool', toUserAccount: ADDRESS }] }]);
    if (u.includes('jup')) return json({ [SOL]: { usdPrice: 150, priceChange24h: 1.5 }, [WATCH]: { usdPrice: 1, priceChange24h: 0.1 }, MintA: { usdPrice: 2, priceChange24h: 3 } });
    if (u.includes('coingecko') && u.includes('market_chart')) return json({ prices: [[DATE, 1], [DATE + 10 * 864e5, 2], [DATE + 20 * 864e5, 3]] });
    if (u.includes('geckoterminal')) {
      if (u.includes('/tokens/') && u.includes('/pools')) { const mint = decodeURIComponent(u.split('/tokens/')[1].split('/pools')[0]); return json({ data: [{ id: 'solana_POOL', attributes: { name: 'PUMP / SOL', reserve_in_usd: '1000', pool_created_at: '2026-01-01T00:00:00Z' }, relationships: { base_token: { data: { id: `solana_${mint}` } } } }] }); }
      if (u.includes('/ohlcv/')) return json({ data: { attributes: { ohlcv_list: [[GECKO_NOW, 3, 3, 3, 3, 300], [GECKO_NOW - 3600, 2, 2, 2, 2, 200], [GECKO_NOW - 7200, 1, 1, 1, 1, 100]] } } });
      if (u.includes('/tokens/')) { const mint = decodeURIComponent(u.split('/tokens/')[1].split('?')[0]); return json({ data: { attributes: { address: mint, symbol: 'PUMP', name: 'Pump', price_usd: '0.001', fdv_usd: '100000', volume_usd: { h24: '5000' }, image_url: '', launchpad_details: { graduation_percentage: 42.5, completed: false } } } }); }
    }
    if (u.includes('dexscreener') && u.includes('/tokens/v1/solana/')) { const mint = decodeURIComponent(u.split('/tokens/v1/solana/')[1].split('?')[0]); if (mint === 'MintA') return json([{ chainId: 'solana', baseToken: { address: mint, symbol: 'AAA', name: 'Aaa' }, priceUsd: '2', liquidity: { usd: '10000' }, volume: { h24: '5000' }, marketCap: '100000' }]); return json([]); }
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

test('fetchPortfolio merges Token-2022 accounts with classic token accounts', async () => {
  const fetchImpl = async (url, options = {}) => {
    const { method, params } = JSON.parse(options.body);
    if (method === 'getBalance') return json({ result: { value: 1_000_000_000 } });
    if (method === 'getTokenAccountsByOwner' && params[1].programId === solana.TOKEN_2022_PROGRAM) return json({ result: { value: [tokenAccount('Mint2022', 5)] } });
    if (method === 'getTokenAccountsByOwner') return json({ result: { value: [tokenAccount('MintClassic', 2)] } });
    throw new Error('unexpected ' + method);
  };
  const portfolio = await solana.fetchPortfolio(ADDRESS, { fetchImpl });
  assert.equal(portfolio.sol, 1);
  assert.deepEqual(portfolio.tokens.sort((a, b) => a.mint.localeCompare(b.mint)), [{ mint: 'Mint2022', amount: 5 }, { mint: 'MintClassic', amount: 2 }]);
});

test('pairListFor enriches long-tail symbols from DexScreener', async () => {
  const pairs = await providers.pairListFor(['MintA'], { fetchImpl: fakeFetch() });
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].symbol, 'AAA');
  assert.equal(pairs[0].name, 'Aaa');
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

test('portfolio history aggregates priced holdings across a range', async () => {
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager.refresh();
  await manager.ready(SOL, 'max');
  await manager.ready('MintA', 'max');
  const series = manager.portfolioHistory('30D');
  assert.equal(series.length, 3);
  assert.equal(series[0].p, 1000 * 1 + 2 * 1);
  assert.equal(series[2].p, 1000 * 3 + 2 * 3);
  manager.dispose();
});

test('portfolioSeries reports coverage and the request range uses its Binance interval', async () => {
  const seen = [];
  const fetchImpl = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('binance.com') && u.includes('/klines')) {
      if (u.includes('interval=1h')) { seen.push(u); return json([[DATE, '1', '2', '0.5', '1'], [DATE + 864e5, '1', '2', '0.5', '2']]); }
      throw new Error('binance ' + u);
    }
    return fakeFetch()(u, options);
  };
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl });
  await manager.refresh();
  await manager.ready(SOL, 'max');
  await manager.ready('MintA', 'max');
  const result = manager.portfolioSeries('30D');
  assert.equal(result.holdings, 2);
  assert.equal(result.covered, 2);
  assert.equal(result.points.length, 3);
  assert.ok(result.total >= 2300);
  seen.length = 0;
  await manager.ready(SOL, '7D');
  assert.match(seen[0], /interval=1h&limit=168/);
  manager.dispose();
});

test('live auto is opt-in and defaults off', () => {
  assert.equal(normalizeConfig({}).liveAutoEnabled, false);
  assert.equal(normalizeConfig({ liveAutoEnabled: true }).liveAutoEnabled, true);
});

test('a paper-buy signal fires onSignal with the rule and live quote', async () => {
  const config = normalizeConfig({ watchlist: [WATCH], signals: [{ id: 'sig1', name: 'Dip', mint: WATCH, condition: { metric: 'price', op: 'above', value: 0.5 }, action: 'paper-buy', usd: 50, cooldownSec: 0 }] });
  const fired = [];
  const manager = createWalletManager({ config, fetchImpl: fakeFetch(), onSignal: (rule, quote) => fired.push({ rule, quote }) });
  await manager.refresh();
  assert.equal(fired.length, 1);
  assert.equal(fired[0].rule.action, 'paper-buy');
  assert.equal(fired[0].rule.usd, 50);
  assert.equal(fired[0].quote.price, 1);
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

test('sanitizeHistoryCache keeps valid ranged entries with OHLC and prunes bad keys', () => {
  const cache = sanitizeHistoryCache({
    [`${WATCH}|7D`]: { at: 123, points: [{ t: 1, p: 2, o: 1, h: 3, l: 0.5, c: 2 }, { t: 2, p: 3 }, { t: 'bad' }] },
    'nope|7D': { at: 1, points: [{ t: 1, p: 1 }, { t: 2, p: 2 }] },
    [`${WATCH}|weird`]: { at: 1, points: [{ t: 1, p: 1 }, { t: 2, p: 2 }] },
    [`${WATCH}|max`]: { at: 1, points: [{ t: 1, p: 1 }] }
  });
  assert.equal(Object.keys(cache).length, 1);
  assert.equal(cache[`${WATCH}|7D`].at, 123);
  assert.deepEqual(cache[`${WATCH}|7D`].points[0], { t: 1, o: 1, h: 3, l: 0.5, c: 2, p: 2, v: 0 });
});

test('ranged history persists to config and reloads without a refetch', async () => {
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager.refresh();
  await manager.ready('MintA', 'max');
  assert.ok(config.historyCache['MintA|max']);
  manager.dispose();
  const manager2 = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager2.refresh();
  const result = manager2.portfolioSeries('30D');
  assert.ok(result.covered >= 1);
  manager2.dispose();
});

test('a market token without a Binance mapping probes SYMBOLUSDT once', async () => {
  const seen = [];
  const fetchImpl = async (url, options = {}) => { const u = String(url); if (u.includes('binance.com') && u.includes('/klines')) { seen.push(u); if (u.includes('symbol=MSOLUSDT')) return json([[DATE, '1', '2', '0.5', '1'], [DATE + 864e5, '1', '2', '0.5', '2']]); throw new Error('no binance'); } if (u.includes('coingecko')) return json({ prices: [] }); return fakeFetch()(u, options); };
  const config = normalizeConfig({});
  const manager = createWalletManager({ config, fetchImpl });
  await manager.ready('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', '7D');
  assert.ok(seen.some(u => u.includes('symbol=MSOLUSDT')));
  manager.dispose();
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


test('followed wallets normalize, dedupe and keep a bounded scan', () => {
  const list = follow.normalizeFollowed([
    { address: ' ' + ADDRESS + ' ', label: '  Whale  ', tags: ['smart', 'smart', 2], note: ' note ' },
    { address: ADDRESS, label: 'duplicate' },
    { address: 'bad' },
    { address: WATCH, scan: { address: WATCH, at: 1, total: 5, holdings: [{ mint: SOL, symbol: 'SOL', amount: 1, price: 2, value: 2 }], recent: [{ signature: 'x', blockTime: 2, err: null }] } }
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].address, ADDRESS);
  assert.equal(list[0].label, 'Whale');
  assert.deepEqual(list[0].tags, ['smart']);
  assert.equal(list[1].scan.total, 5);
  assert.equal(list[1].scan.holdings[0].symbol, 'SOL');
  assert.equal(list[1].scan.recent[0].err, false);
  assert.deepEqual(normalizeConfig({ followed: list }).followed.map(item => item.address), [ADDRESS, WATCH]);
});

test('scanWallet values holdings, concentration and recent activity', async () => {
  const scan = await follow.scanWallet(ADDRESS, { fetchImpl: fakeFetch() });
  assert.equal(scan.address, ADDRESS);
  assert.equal(scan.sol, 2);
  assert.equal(scan.tokenCount, 2);
  assert.equal(scan.total, 2300);
  assert.equal(scan.holdings[0].symbol, 'AAA');
  assert.equal(scan.holdings[0].name, 'Aaa');
  assert.equal(scan.holdings[0].value, 2000);
  assert.ok(scan.top10Share > 0.99);
  assert.equal(scan.recent[0].signature, 'sig1');
  assert.ok(scan.lastActive > 0);
});

test('followed wallet tools route through the tool context', async () => {
  const signal = () => new AbortController().signal;
  assert.equal((await executeTool('wallet_follow', { address: ADDRESS, label: 'Whale' }, { signal: signal(), walletFollow: async (address, label) => ({ address, label }) })).label, 'Whale');
  assert.equal((await executeTool('wallet_scan', { address: ADDRESS }, { signal: signal(), walletScan: async address => ({ address }) })).address, ADDRESS);
  assert.equal((await executeTool('wallet_copy', { address: ADDRESS, usd: '100' }, { signal: signal(), walletCopy: async (address, usd) => ({ address, usd }) })).usd, '100');
  assert.equal((await executeTool('wallet_auto_mirror', { address: ADDRESS, enabled: 'true' }, { signal: signal(), walletAutoMirror: async (address, enabled) => ({ address, enabled }) })).enabled, 'true');
  assert.deepEqual(await executeTool('wallet_follow_list', {}, { signal: signal(), walletFollowList: async () => [] }), []);
  await assert.rejects(executeTool('wallet_scan', {}, { signal: signal() }), /Missing string argument/);
});


test('followed wallet activity alerts only when a new signature appears', async () => {
  let signature = 'sig1';
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes('api.mainnet-beta') || String(url).includes('rpc.example')) {
      const { method } = JSON.parse(options.body);
      if (method === 'getSignaturesForAddress') return json({ result: [{ signature, slot: 10, blockTime: 1700000000, err: null }] });
    }
    return fakeFetch()(url, options);
  };
  const config = normalizeConfig({ followed: [{ address: ADDRESS, label: 'Whale', lastSignature: 'sig0', activityAt: 0 }] });
  const alerts = [];
  const manager = createWalletManager({ config, fetchImpl, onFollowedActivity: (item, items) => alerts.push({ label: item.label, signatures: items.map(tx => tx.signature) }) });
  await manager.refresh();
  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0], { label: 'Whale', signatures: ['sig1'] });
  config.followed[0].activityAt = 0;
  await manager.refresh();
  assert.equal(alerts.length, 1, 'same signature does not re-alert');
  signature = 'sig2';
  config.followed[0].activityAt = 0;
  await manager.refresh();
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts[1].signatures, ['sig2']);
  config.followed[0].watchActivity = false;
  signature = 'sig3';
  config.followed[0].activityAt = 0;
  await manager.refresh();
  assert.equal(alerts.length, 2, 'alerts can be turned off per wallet');
  manager.dispose();
});


test('heliusTransactions maps enhanced transactions to compact parsed activity', async () => {
  const txs = await providers.heliusTransactions(ADDRESS, { key: 'test', fetchImpl: fakeFetch() });
  assert.equal(txs.length, 1);
  assert.equal(txs[0].type, 'SWAP');
  assert.equal(txs[0].description, 'Swapped 1 SOL for 100 USDC');
  assert.equal(txs[0].timestamp, 1700000100000);
  assert.equal(txs[0].transfers.length, 2);
  assert.equal(txs[0].transfers[1].mint, WATCH);
});

test('scanWallet includes parsed activity when a Helius key is available', async () => {
  const scan = await follow.scanWallet(ADDRESS, { fetchImpl: fakeFetch(), heliusKey: 'test' });
  assert.equal(scan.parsed.length, 1);
  assert.equal(scan.parsed[0].description, 'Swapped 1 SOL for 100 USDC');
  assert.ok(scan.lastActive >= 1700000100000);
  const stored = follow.normalizeFollowed([{ address: ADDRESS, scan }])[0];
  assert.equal(stored.scan.parsed[0].type, 'SWAP');
  assert.equal(stored.scan.parsed[0].transfers[1].amount, 100);
});


test('jupiterPrices uses the pro endpoint and header when a key is supplied', async () => {
  const seen = [];
  const fetchImpl = async (url, options = {}) => {
    seen.push({ url: String(url), headers: options.headers || {} });
    return json({ [SOL]: { usdPrice: 42, priceChange24h: 1 } });
  };
  const quotes = await providers.jupiterPrices([SOL], { key: 'secret', fetchImpl });
  assert.equal(quotes[SOL].price, 42);
  assert.match(seen[0].url, /api\.jup\.ag\/price\/v3/);
  assert.equal(seen[0].headers['x-api-key'], 'secret');
  const free = await providers.jupiterPrices([SOL], { fetchImpl });
  assert.match(seen[1].url, /lite-api\.jup\.ag/);
  assert.equal(seen[1].headers['x-api-key'], undefined);
  assert.equal(free[SOL].price, 42);
});


test('planCopy weights holdings, skips stablecoins and respects the budget', () => {
  const scan = { holdings: [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', value: 50, price: 1 },
    { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', value: 100, price: 1 },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', value: 30, price: 1 },
    { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', value: 20, price: 1 }
  ] };
  const proportional = copyWallet.planCopy(scan, { budget: 100, mode: 'proportional', count: 3 });
  assert.deepEqual(proportional.allocations.map(item => item.symbol), ['SOL', 'BONK', 'JUP']);
  assert.deepEqual(proportional.allocations.map(item => item.usd), [50, 30, 20]);
  assert.equal(proportional.allocations.reduce((sum, item) => sum + item.usd, 0), 100);
  const equal = copyWallet.planCopy(scan, { budget: 100, mode: 'equal', count: 3 });
  assert.ok(equal.allocations.every(item => Math.abs(item.usd - 100 / 3) < 0.02));
  const tiny = copyWallet.planCopy(scan, { budget: 0.5, mode: 'proportional', count: 8 });
  assert.equal(tiny.allocations.length, 1);
  assert.equal(tiny.allocations[0].usd, 0.5);
  const stableOnly = copyWallet.planCopy({ holdings: [scan.holdings[1]] }, { budget: 10 });
  assert.equal(stableOnly.allocations[0].symbol, 'USDC');
  assert.throws(() => copyWallet.planCopy({ holdings: [] }, { budget: 10 }), /No priced holdings/);
});


test('planMirror mirrors parsed buys and proportional sells', () => {
  const previous = { holdings: [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 10, price: 2, value: 20 },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', amount: 5, price: 1, value: 5 }
  ] };
  const next = { holdings: [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 15, price: 2, value: 30 },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', amount: 3, price: 1, value: 3 }
  ] };
  const parsed = [{ signature: 'new', transfers: [
    { mint: 'So11111111111111111111111111111111111111112', from: 'pool', to: ADDRESS, amount: 5 },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', from: ADDRESS, to: 'pool', amount: 2 }
  ] }];
  const plan = mirrorWallet.planMirror({ previous, next, parsed, address: ADDRESS, budget: 20, maxBuys: 2 });
  assert.equal(plan.source, 'parsed');
  assert.equal(plan.buys.length, 1);
  assert.equal(plan.buys[0].symbol, 'SOL');
  assert.equal(plan.buys[0].usd, 20);
  assert.equal(plan.sells.length, 1);
  assert.equal(plan.sells[0].symbol, 'BONK');
  assert.equal(plan.sells[0].percent, 40);
});

test('planMirror falls back to holdings increases and never invents sells', () => {
  const previous = { holdings: [{ mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 10, price: 2, value: 20 }] };
  const next = { holdings: [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 15, price: 2, value: 30 },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', amount: 100, price: 0.5, value: 50 }
  ] };
  const plan = mirrorWallet.planMirror({ previous, next, budget: 30, maxBuys: 5 });
  assert.equal(plan.source, 'holdings');
  assert.deepEqual(plan.buys.map(item => item.symbol), ['BONK', 'SOL']);
  assert.equal(plan.sells.length, 0);
  assert.equal(plan.buys.reduce((sum, item) => sum + item.usd, 0), 30);
});

test('auto-mirror settings survive followed-wallet normalization', () => {
  const [item] = follow.normalizeFollowed([{ address: ADDRESS, autoMirror: true, mirrorBudgetUsd: 40, mirrorMaxBuys: 2, mirrorLastResult: 'Mirrored 1 buy.' }]);
  assert.equal(item.autoMirror, true);
  assert.equal(item.mirrorBudgetUsd, 40);
  assert.equal(item.mirrorMaxBuys, 2);
  assert.equal(item.mirrorLastResult, 'Mirrored 1 buy.');
});


test('geckoOhlcv maps pump pools into ascending candles', async () => {
  const mint = 'HZLEZULB1bV6rgxm6dWMdPnftPw42KG72bwvPeEipump';
  const points = await providers.geckoOhlcv(mint, '7D', { fetchImpl: fakeFetch() });
  assert.equal(points.length, 3);
  assert.deepEqual(points.map(point => point.t), [(GECKO_NOW - 7200) * 1000, (GECKO_NOW - 3600) * 1000, GECKO_NOW * 1000]);
  assert.deepEqual({ o: points[0].o, h: points[0].h, l: points[0].l, c: points[0].c, p: points[0].p, v: points[0].v }, { o: 1, h: 1, l: 1, c: 1, p: 1, v: 100 });
  assert.equal(points[2].c, 3);
});

test('geckoToken returns launchpad graduation metadata', async () => {
  const token = await providers.geckoToken('HZLEZULB1bV6rgxm6dWMdPnftPw42KG72bwvPeEipump', { fetchImpl: fakeFetch() });
  assert.equal(token.symbol, 'PUMP');
  assert.equal(token.launchpad.graduationPercentage, 42.5);
  assert.equal(token.launchpad.completed, false);
});

test('a pump token falls back to GeckoTerminal when Binance has no series', async () => {
  const mint = 'HZLEZULB1bV6rgxm6dWMdPnftPw42KG72bwvPeEipump';
  const config = normalizeConfig({});
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  const points = await manager.ready(mint, '7D');
  assert.ok(points.length >= 2);
  assert.equal(points[0].o, 1);
  assert.equal(points[1].c, 2);
  manager.dispose();
});
