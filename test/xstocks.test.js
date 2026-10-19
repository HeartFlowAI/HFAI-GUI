const { test, beforeEach } = require('node:test'), assert = require('node:assert/strict');
const xstocks = require('../src/wallet/xstocks');
const providers = require('../src/wallet/providers');
const { executeTool } = require('../src/tools');

const AAPL = 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp';
const TSLA = 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB';
const META = 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX';
const SPY = 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W';
const json = body => ({ ok: true, status: 200, json: async () => body });
function raw(symbol, name, underlying, mint, { open = true, halted = false, etf = false } = {}) {
  return { symbol, name, underlyingSymbol: underlying, underlying: { symbol: underlying, name, exchange: { abbreviation: 'NASDAQ', name: 'Nasdaq', mic: 'XNAS' } }, description: name, logo: `https://example.test/${symbol}.png`, isTradingHalted: halted, trading: { openNow: open, currentPeriod: open ? 'extended' : 'closed', isTradingHalted: halted, nextChangeAt: '2026-10-19T13:30:00.000Z' }, deployments: [{ network: 'Solana', address: mint }] };
}
function apiFetch() {
  const assets = [raw('AAPLx', 'Apple xStock', 'AAPL', AAPL), raw('TSLAx', 'Tesla xStock', 'TSLA', TSLA, { open: false }), raw('METAx', 'Meta xStock', 'META', META, { halted: true }), raw('SPYx', 'SP500 xStock', 'SPY', SPY, { etf: true })];
  return async url => {
    const u = String(url);
    if (u.includes('/public/assets?')) { const page = Number(new URL(u).searchParams.get('page') || 0); return json(page === 0 ? { nodes: assets.slice(0, 2), page: { currentPage: 0, hasNextPage: true } } : { nodes: assets.slice(2), page: { currentPage: 1, hasNextPage: false } }); }
    if (u.includes('/price-data')) return json({ quote: 200 });
    if (u.includes('/multiplier')) return json({ currentMultiplier: 1.01 });
    if (u.includes('/public/system/status/')) return json({ isMarketTradingHalted: false });
    if (u.includes('/proof-of-reserves/')) return json({ sharesHeld: 100, circulatingSupply: 99 });
    const match = u.match(/\/public\/assets\/([^/?]+)/);
    if (match) { const found = assets.find(asset => asset.symbol === decodeURIComponent(match[1])); return found ? json(found) : { ok: false, status: 404, json: async () => ({}) }; }
    throw new Error('unexpected xStocks url ' + u);
  };
}
beforeEach(() => xstocks.resetCaches());

test('normalizeAsset keeps Solana deployment, underlying and market state', () => {
  const asset = xstocks.normalizeAsset(raw('AAPLx', 'Apple xStock', 'AAPL', AAPL));
  assert.equal(asset.symbol, 'AAPLx');
  assert.equal(asset.mint, AAPL);
  assert.equal(asset.underlyingSymbol, 'AAPL');
  assert.equal(asset.exchange, 'NASDAQ');
  assert.equal(asset.openNow, true);
  assert.equal(asset.currentPeriod, 'extended');
  assert.equal(asset.isEtf, false);
  assert.equal(xstocks.normalizeAsset(raw('SPYx', 'SP500 xStock', 'SPY', SPY)).isEtf, true);
});

test('catalog paginates and builds mint and symbol indexes', async () => {
  const catalog = await xstocks.loadCatalog({ fetchImpl: apiFetch() });
  assert.equal(catalog.assets.length, 4);
  assert.equal(catalog.byMint.get(AAPL).symbol, 'AAPLx');
  assert.equal(catalog.bySymbol.get('SPYx').isEtf, true);
});

test('selectAssets handles featured order, alphabetical all, ETFs, search and status', async () => {
  const featured = await xstocks.loadFeatured({ fetchImpl: apiFetch() });
  const catalog = await xstocks.loadCatalog({ fetchImpl: apiFetch() });
  assert.deepEqual(featured.map(asset => asset.symbol), ['AAPLx', 'TSLAx', 'METAx', 'SPYx']);
  assert.deepEqual(xstocks.selectAssets(catalog, featured, { tab: 'all', pageSize: 10 }).rows.map(asset => asset.underlyingSymbol), ['AAPL', 'META', 'SPY', 'TSLA']);
  assert.deepEqual(xstocks.selectAssets(catalog, featured, { tab: 'etfs' }).rows.map(asset => asset.symbol), ['SPYx']);
  assert.deepEqual(xstocks.selectAssets(catalog, featured, { tab: 'all', query: 'tesla' }).rows.map(asset => asset.symbol), ['TSLAx']);
  assert.deepEqual(xstocks.selectAssets(catalog, featured, { tab: 'all', status: 'closed' }).rows.map(asset => asset.symbol), ['TSLAx']);
  assert.deepEqual(xstocks.selectAssets(catalog, featured, { tab: 'all', status: 'halted' }).rows.map(asset => asset.symbol), ['METAx']);
});

test('premiumDiscount uses the dividend multiplier and rejects missing prices', () => {
  assert.ok(Math.abs(xstocks.premiumDiscount(101, 100, 1) - 1) < 1e-9);
  assert.ok(Math.abs(xstocks.premiumDiscount(101, 100, 1.01)) < 1e-9);
  assert.equal(xstocks.premiumDiscount(0, 100, 1), null);
  assert.equal(xstocks.premiumDiscount(100, 0, 1), null);
});

test('pairBatchFor groups DexScreener pairs by base mint', async () => {
  const fetchImpl = async url => {
    assert.match(String(url), /^https:\/\/api\.dexscreener\.com\/tokens\/v1\/solana\//);
    return json([
      { baseToken: { address: AAPL, symbol: 'AAPLx', name: 'Apple xStock' }, priceUsd: '344', liquidity: { usd: '1000' }, volume: { h24: '5000' }, priceChange: { h24: '1' } },
      { baseToken: { address: TSLA, symbol: 'TSLAx', name: 'Tesla xStock' }, priceUsd: '353', liquidity: { usd: '2000' }, volume: { h24: '7000' }, priceChange: { h24: '-1' } }
    ]);
  };
  const pairs = await providers.pairBatchFor([AAPL, TSLA], { fetchImpl });
  assert.equal(pairs.get(AAPL).symbol, 'AAPLx');
  assert.equal(pairs.get(TSLA).priceUsd, 353);
});

test('xStocks tools route through the tool context', async () => {
  const signal = () => new AbortController().signal;
  assert.equal((await executeTool('xstocks_list', { filter: 'featured' }, { signal: signal(), xstocksList: async filter => ({ filter }) })).filter, 'featured');
  assert.equal((await executeTool('xstocks_asset', { symbol: 'AAPLx' }, { signal: signal(), xstocksAsset: async symbol => ({ symbol }) })).symbol, 'AAPLx');
  assert.equal((await executeTool('xstocks_scan', { symbol: 'AAPLx' }, { signal: signal(), xstocksScan: async symbol => ({ symbol }) })).symbol, 'AAPLx');
  assert.equal((await executeTool('xstocks_history', { symbol: 'AAPL', range: '1D' }, { signal: signal(), xstocksHistory: async (symbol, range) => ({ symbol, range }) })).range, '1D');
  await assert.rejects(executeTool('xstocks_asset', {}, { signal: signal() }), /Missing string argument/);
});


test('stockHistory maps Yahoo chart candles, range and quote metadata', async () => {
  const now = Math.floor(Date.now() / 1000);
  let seen = '';
  const fetchImpl = async url => {
    seen = String(url);
    return json({ chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 101, previousClose: 99, longName: 'Apple Inc.', fullExchangeName: 'NasdaqGS', fiftyTwoWeekHigh: 120, fiftyTwoWeekLow: 80 }, timestamp: [now - 3600, now], indicators: { quote: [{ open: [100, 101], high: [102, 103], low: [99, 100], close: [101, 102], volume: [1000, 2000] }] } }] } });
  };
  const stock = await xstocks.stockHistory('AAPL', '1D', { fetchImpl });
  assert.match(seen, /range=1d&interval=5m/);
  assert.match(seen, /includePrePost=true/);
  assert.equal(stock.symbol, 'AAPL');
  assert.equal(stock.name, 'Apple Inc.');
  assert.equal(stock.price, 101);
  assert.equal(stock.previousClose, 99);
  assert.equal(stock.high52, 120);
  assert.equal(stock.points.length, 2);
  assert.deepEqual(stock.points[0], { t: (now - 3600) * 1000, o: 100, h: 102, l: 99, c: 101, p: 101, v: 1000 });
});

test('stockHistory uses longer ranges for daily and weekly stock charts', async () => {
  const seen = [];
  const fetchImpl = async url => { seen.push(String(url)); return json({ chart: { result: [{ meta: {}, timestamp: [1], indicators: { quote: [{ open: [1], high: [1], low: [1], close: [1], volume: [1] }] } }] } }); };
  await xstocks.stockHistory('TSLA', '30D', { fetchImpl });
  await xstocks.stockHistory('TSLA', 'ALL', { fetchImpl });
  assert.match(seen[0], /range=1mo&interval=1d/);
  assert.match(seen[1], /range=5y&interval=1wk/);
});
