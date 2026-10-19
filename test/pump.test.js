const { test } = require('node:test'), assert = require('node:assert/strict');
const providers = require('../src/wallet/providers');
const pump = require('../src/wallet/pump');
const pumpPortal = require('../src/wallet/pump-portal');
const { executeTool } = require('../src/tools');

const NOW = Date.now();
const FRESH = 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump';
const CLIMB = '3jzN6pDQLSCERTW2KBi5Sey9eghUjX1hpwYCFRUrpump';
const BONDED = 'HZLEZULB1bV6rgxm6dWMdPnftPw42KG72bwvPeEipump';
const json = body => ({ ok: true, status: 200, json: async () => body });

function pools() {
  return [
    { id: `solana_${FRESH}`, attributes: { name: 'CREW / SOL', address: FRESH, pool_created_at: new Date(NOW - 60000).toISOString(), pool_created_at: new Date(NOW - 60000).toISOString(), base_token_price_usd: '0.00001', fdv_usd: '10000', price_change_percentage: { m5: '2', h1: '12', h24: '30' }, volume_usd: { m5: '100', h1: '5000', h24: '20000' }, reserve_in_usd: '4000', transactions: { h1: { buys: 20, sells: 5, buyers: 15, sellers: 5 } } }, relationships: { base_token: { data: { id: `solana_${FRESH}` } }, dex: { data: { id: 'pump-fun' } } } },
    { id: `solana_${CLIMB}`, attributes: { name: 'AGI / SOL', address: CLIMB, pool_created_at: new Date(NOW - 7200000).toISOString(), pool_created_at: new Date(NOW - 7200000).toISOString(), base_token_price_usd: '0.001', fdv_usd: '400000', price_change_percentage: { h1: '8', h24: '20' }, volume_usd: { h1: '80000', h24: '300000' }, reserve_in_usd: '60000', transactions: { h1: { buys: 300, sells: 100, buyers: 220, sellers: 80 } } }, relationships: { base_token: { data: { id: `solana_${CLIMB}` } }, dex: { data: { id: 'pump-fun' } } } },
    { id: `solana_${BONDED}`, attributes: { name: 'MC / SOL', address: BONDED, pool_created_at: new Date(NOW - 86400000).toISOString(), pool_created_at: new Date(NOW - 86400000).toISOString(), base_token_price_usd: '0.0003', fdv_usd: '300000', price_change_percentage: { h1: '3', h24: '15' }, volume_usd: { h1: '120000', h24: '900000' }, reserve_in_usd: '50000', transactions: { h1: { buys: 400, sells: 200, buyers: 300, sellers: 150 } } }, relationships: { base_token: { data: { id: `solana_${BONDED}` } }, dex: { data: { id: 'pumpswap' } } } }
  ];
}
function token(address, symbol, graduation, completed) {
  return { address, symbol, name: symbol, image_url: '', price_usd: '0.001', fdv_usd: '100000', volume_usd: { h24: '10000' }, launchpad_details: { graduation_percentage: graduation, completed, completed_at: completed ? new Date(NOW).toISOString() : null, migrated_destination_pool_address: completed ? 'pool' : null } };
}
function geckoFetch() {
  return async (url) => {
    const u = String(url);
    if (u.includes('/new_pools')) return json({ data: pools() });
    if (u.includes('/trending_pools')) return json({ data: pools() });
    if (u.includes('/tokens/multi/')) return json({ data: [token(FRESH, 'CREW', 0.34, false), token(CLIMB, 'AGI', 42.5, false), token(BONDED, 'MC', 100, true)].map(item => ({ id: `solana_${item.address}`, type: 'token', attributes: item })) });
    throw new Error('unexpected gecko url ' + u);
  };
}

test('geckoNewPools and geckoTrendingPools normalize pump pool metrics', async () => {
  const list = await providers.geckoNewPools({ fetchImpl: geckoFetch() });
  assert.equal(list.length, 3);
  assert.equal(list[0].mint, FRESH);
  assert.equal(list[0].dex, 'pump-fun');
  assert.equal(list[0].volume1h, 5000);
  assert.equal(list[0].buys1h, 20);
  const trending = await providers.geckoTrendingPools({ fetchImpl: geckoFetch() });
  assert.equal(trending[2].dex, 'pumpswap');
});

test('geckoTokenMulti batches token metadata and launchpad details', async () => {
  const tokens = await providers.geckoTokenMulti([FRESH, CLIMB, BONDED], { fetchImpl: geckoFetch() });
  assert.equal(tokens.length, 3);
  assert.equal(tokens.find(item => item.address === CLIMB).launchpad.graduationPercentage, 42.5);
  assert.equal(tokens.find(item => item.address === BONDED).launchpad.completed, true);
});

test('pump stages separate fresh launches, climbers and graduated tokens', async () => {
  const list = pools().map(pool => providers.geckoPoolSummary(pool));
  const tokens = await providers.geckoTokenMulti([FRESH, CLIMB, BONDED], { fetchImpl: geckoFetch() });
  const fresh = pump.buildPumpFeed('new', { pools: list, tokens });
  const trending = pump.buildPumpFeed('trending', { pools: list, tokens });
  const graduated = pump.buildPumpFeed('graduated', { pools: list, tokens });
  assert.deepEqual(fresh.map(row => row.mint), [FRESH, CLIMB]);
  assert.deepEqual(trending.map(row => row.mint), [CLIMB]);
  assert.equal(trending[0].graduationPercentage, 42.5);
  assert.equal(trending[0].aboutToGraduate, false);
  assert.deepEqual(graduated.map(row => row.mint), [BONDED]);
  assert.equal(graduated[0].completed, true);
});

test('pump feed can show up to 50 tokens per stage', () => {
  const now = Date.now();
  const list = Array.from({ length: 60 }, (_, i) => ({
    mint: `live${String(i).padStart(2, '0')}pump`, symbol: `T${i}`, name: `Token ${i}`,
    dex: 'pump-fun', createdAt: now - i * 1000, priceUsd: 0.001,
    marketCap: 100000 + i, fdv: 100000 + i, liquidityUsd: 5000 + i,
    volume1h: 1000 + i, volume24h: 10000 + i, buys1h: 10, sells1h: 2,
    change5m: 1, change1h: 2, change24h: 3
  }));
  const rows = pump.buildPumpFeed('new', { pools: list, tokens: [], limit: 50 });
  assert.equal(rows.length, 50);
  assert.equal(pump.buildPumpFeed('new', { pools: list, tokens: [], limit: 100 }).length, 50);
});

test('pump bonding curve progress works from reserve or market cap data', () => {
  assert.equal(pump.curveProgress({ vSolInBondingCurve: 30 }).percentage, 0);
  assert.equal(pump.curveProgress({ vSolInBondingCurve: 72.5 }).percentage, 50);
  assert.equal(pump.curveProgress({ vSolInBondingCurve: 115 }).percentage, 100);
  assert.equal(pump.curveProgress({ vSolInBondingCurve: 200 }).percentage, 100);
  assert.equal(pump.curveProgress({ graduationKnown: true, graduationPercentage: 42.5 }).percentage, 42.5);
  assert.equal(pump.curveProgress({ completed: true }).percentage, 100);
  const launch = pump.curveProgress({ marketCapSol: 27.958993476234856 });
  assert.ok(Math.abs(launch.percentage) < 0.01);
  const half = pump.curveProgress({ vSolInBondingCurve: 0, marketCap: 5000, solPrice: 100 });
  assert.equal(half.source, 'market-cap');
  assert.ok(half.percentage > 0 && half.percentage < 100);
});

test('pump classifier marks high graduation as about to bond', () => {
  const pool = providers.geckoPoolSummary(pools()[1]);
  const tokens = [{ address: CLIMB, symbol: 'AGI', launchpad: { graduationPercentage: 87.5, completed: false } }];
  const [row] = pump.buildPumpFeed('trending', { pools: [pool], tokens });
  assert.equal(row.aboutToGraduate, true);
  assert.ok(row.score > 0);
});

test('PumpPortal tradeLocal sends the expected body and returns base64', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url: String(url), body: JSON.parse(options.body) });
    const bytes = Buffer.from([1, 2, 3, 4]);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
  const result = await pumpPortal.tradeLocal({ publicKey: 'So11111111111111111111111111111111111111112', action: 'buy', mint: FRESH, amount: 0.5, slippage: 12, priorityFee: 0.001, pool: 'pump' }, { fetchImpl });
  assert.equal(result.transaction, Buffer.from([1, 2, 3, 4]).toString('base64'));
  assert.equal(seen[0].url, 'https://pumpportal.fun/api/trade-local');
  assert.equal(seen[0].body.action, 'buy');
  assert.equal(seen[0].body.pool, 'pump');
  assert.equal(seen[0].body.denominatedInSol, 'true');
  assert.equal(seen[0].body.slippage, 12);
});

test('PumpPortal detects bonding and PumpSwap pools and rejects API errors', async () => {
  assert.equal(pumpPortal.detectPool({ completed: false, dex: 'pumpfun' }), 'pump');
  assert.equal(pumpPortal.detectPool({ completed: true, dex: 'pumpswap' }), 'pump-amm');
  const fetchImpl = async () => ({ ok: false, status: 400, text: async () => 'bad mint' });
  await assert.rejects(pumpPortal.tradeLocal({ publicKey: 'So11111111111111111111111111111111111111112', action: 'buy', mint: FRESH, amount: 1 }, { fetchImpl }), /PumpPortal responded 400/);
});


test('pump tools route through the tool context', async () => {
  const signal = () => new AbortController().signal;
  assert.equal((await executeTool('pump_discover', { stage: 'new' }, { signal: signal(), pumpDiscover: async stage => ({ stage }) })).stage, 'new');
  assert.equal((await executeTool('pump_scan', { mint: FRESH }, { signal: signal(), pumpScan: async mint => ({ mint }) })).mint, FRESH);
  assert.equal((await executeTool('pump_watch', { mint: FRESH }, { signal: signal(), pumpWatch: async mint => ({ mint, watching: true }) })).watching, true);
  assert.equal((await executeTool('pump_trade_preview', { mint: FRESH, side: 'buy', usd: '25' }, { signal: signal(), pumpTradePreview: async (mint, side, usd) => ({ mint, side, usd }) })).side, 'buy');
  assert.equal((await executeTool('pump_trade_execute', { mint: FRESH, side: 'sell', amount: '1000' }, { signal: signal(), pumpTradeExecute: async (mint, side, usd, amount) => ({ side, amount }) })).amount, '1000');
  await assert.rejects(executeTool('pump_discover', {}, { signal: signal() }), /Missing string argument/);
});


test('pump limits block over-cap trades before signing', () => {
  assert.match(pump.limitError({ limits: { maxPositionUsd: 100 }, heldUsd: 50, valueUsd: 60 }), /Position cap/);
  assert.match(pump.limitError({ limits: { maxTotalUsd: 200 }, totalUsd: 150, valueUsd: 60 }), /Total cap/);
  assert.match(pump.limitError({ limits: { dailyCapUsd: 100 }, spentTodayUsd: 90, valueUsd: 20 }), /Daily cap/);
  assert.equal(pump.limitError({ limits: { maxPositionUsd: 100, dailyCapUsd: 100 }, heldUsd: 10, valueUsd: 20, spentTodayUsd: 10 }), '');
});


test('parsePumpVerdicts accepts fenced JSON and filters unknown mints', () => {
  const rows = [{ mint: FRESH }, { mint: CLIMB }];
  const verdicts = pump.parsePumpVerdicts('Here you go:\n```json\n[{"mint":"' + FRESH + '","verdict":"buy","score":12,"reason":"strong"},{"mint":"fake","verdict":"buy","score":9},{"mint":"' + CLIMB + '","verdict":"avoid","score":-2}]\n```', rows);
  assert.equal(Object.keys(verdicts).length, 2);
  assert.equal(verdicts[FRESH].score, 10);
  assert.equal(verdicts[CLIMB].score, 0);
  assert.equal(verdicts[CLIMB].verdict, 'avoid');
  assert.throws(() => pump.parsePumpVerdicts('not json', rows), /JSON verdict/);
});

test('selectAutoBuys respects score, cooldown and max buys', () => {
  const rows = [{ mint: FRESH, priceUsd: 1 }, { mint: CLIMB, priceUsd: 1 }, { mint: BONDED, priceUsd: 1 }];
  const verdicts = {
    [FRESH]: { mint: FRESH, verdict: 'buy', score: 9 },
    [CLIMB]: { mint: CLIMB, verdict: 'buy', score: 8 },
    [BONDED]: { mint: BONDED, verdict: 'avoid', score: 10 }
  };
  const now = Date.now();
  const picks = pump.selectAutoBuys(verdicts, rows, { maxBuys: 1, now, lastAuto: {} });
  assert.deepEqual(picks.map(pick => pick.mint), [FRESH]);
  const cooled = pump.selectAutoBuys(verdicts, rows, { maxBuys: 2, now, lastAuto: { [FRESH]: now - 50000 } });
  assert.deepEqual(cooled.map(pick => pick.mint), [CLIMB]);
  const low = pump.selectAutoBuys({ [CLIMB]: { mint: CLIMB, verdict: 'buy', score: 7 } }, rows, { maxBuys: 2, now, lastAuto: {} });
  assert.equal(low.length, 0);
});
