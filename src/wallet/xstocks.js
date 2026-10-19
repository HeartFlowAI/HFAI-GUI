const API = 'https://api.xstocks.fi/api/v2';
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CATALOG_TTL = 15 * 60000;
const QUOTE_TTL = 60000;
const DETAIL_TTL = 15 * 60000;
const FEATURED = ['AAPLx', 'TSLAx', 'NVDAx', 'MSFTx', 'AMZNx', 'GOOGLx', 'METAx', 'SPYx', 'QQQx', 'VOOx', 'VTIx', 'COINx', 'MSTRx', 'PLTRx', 'AMDx', 'NFLXx', 'JPMx', 'XOMx'];
const ETF_TICKERS = new Set(['SPY', 'QQQ', 'VOO', 'VTI', 'IWM', 'DIA', 'GLD', 'SLV', 'TLT', 'XLF', 'XLK', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC', 'ARKK', 'QYLD', 'UVXY', 'EWZ', 'EWJ', 'EEM', 'VGK', 'VWO', 'BND', 'AGG', 'HYG', 'LQD']);

const STOCK_TTL = { '1D': 60000, '7D': 5 * 60000, '30D': 5 * 60000, '3M': 30 * 60000, '6M': 30 * 60000, '1Y': 30 * 60000, ALL: 30 * 60000 };
const STOCK_RANGES = { '1D': ['1d', '5m', true], '7D': ['1mo', '60m', true], '30D': ['1mo', '1d', false], '3M': ['3mo', '1d', false], '6M': ['6mo', '1d', false], '1Y': ['1y', '1d', false], ALL: ['5y', '1wk', false] };
const cache = { catalog: null, catalogPromise: null, featured: null, featuredPromise: null, assets: new Map(), quotes: new Map(), statuses: new Map(), multipliers: new Map(), reserves: new Map(), stocks: new Map() };
let stockChain = Promise.resolve(), stockLast = 0;

function timeoutSignal(signal, ms = 15000) { try { return signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms); } catch { return signal; } }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function isEtf(asset) {
  const text = `${asset?.name || ''} ${asset?.description || ''}`.toLowerCase();
  return /\b(etf|fund|trust)\b/.test(text) || ETF_TICKERS.has(String(asset?.underlyingSymbol || '').toUpperCase());
}
function normalizeAsset(asset) {
  if (!asset || typeof asset !== 'object' || !asset.symbol) return null;
  const trading = asset.trading || {};
  const underlying = asset.underlying || {};
  const exchange = underlying.exchange || trading.exchange || {};
  const deployment = (Array.isArray(asset.deployments) ? asset.deployments : []).find(item => String(item?.network || '').toLowerCase() === 'solana');
  return {
    symbol: String(asset.symbol).slice(0, 20), name: String(asset.name || asset.description || asset.symbol).slice(0, 120),
    underlyingSymbol: String(asset.underlyingSymbol || underlying.symbol || '').slice(0, 20),
    underlyingName: String(underlying.name || '').slice(0, 80),
    exchange: String(exchange.abbreviation || '').slice(0, 24), exchangeName: String(exchange.name || '').slice(0, 80), mic: String(exchange.mic || '').slice(0, 12),
    logo: String(asset.logo || '').slice(0, 500), mint: deployment?.address || '', isin: String(asset.isin || '').slice(0, 24),
    description: String(asset.description || '').slice(0, 300),
    isTradingHalted: asset.isTradingHalted === true || trading.isTradingHalted === true,
    openNow: trading.openNow === true, currentPeriod: String(trading.currentPeriod || '').slice(0, 20),
    nextChangeAt: String(trading.nextChangeAt || '').slice(0, 40), tradingHoursMode: String(trading.tradingHoursMode || '').slice(0, 30),
    isEtf: isEtf(asset)
  };
}
async function request(path, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`${API}${path}`, { headers: { accept: 'application/json' }, signal: timeoutSignal(signal) });
  if (!response.ok) throw new Error(`xStocks responded ${response.status}.`);
  return response.json();
}
async function assetsPage(page, options = {}) {
  const body = await request(`/public/assets?page=${Math.max(0, Math.floor(Number(page) || 0))}`, options);
  return {
    assets: (body?.nodes || []).map(normalizeAsset).filter(asset => asset && asset.mint),
    hasNextPage: body?.page?.hasNextPage === true,
    currentPage: Number(body?.page?.currentPage) || 0
  };
}
async function loadCatalog({ fetchImpl = fetch, signal, force = false } = {}) {
  if (!force && cache.catalog && Date.now() - cache.catalog.at < CATALOG_TTL) return cache.catalog;
  if (cache.catalogPromise) return cache.catalogPromise;
  cache.catalogPromise = (async () => {
    const assets = [];
    let page = 0, hasNextPage = true;
    while (hasNextPage && page < 30) {
      const result = await assetsPage(page, { fetchImpl, signal });
      assets.push(...result.assets);
      hasNextPage = result.hasNextPage;
      page += 1;
      if (hasNextPage) await new Promise(resolve => setTimeout(resolve, 100));
    }
    const unique = [...new Map(assets.map(asset => [asset.mint, asset])).values()];
    const byMint = new Map(unique.map(asset => [asset.mint, asset]));
    const bySymbol = new Map(unique.map(asset => [asset.symbol, asset]));
    cache.catalog = { at: Date.now(), assets: unique, byMint, bySymbol };
    return cache.catalog;
  })().finally(() => { cache.catalogPromise = null; });
  return cache.catalogPromise;
}
async function loadFeatured({ fetchImpl = fetch, signal, force = false } = {}) {
  if (!force && cache.featured && Date.now() - cache.featured.at < CATALOG_TTL) return cache.featured.assets;
  if (cache.featuredPromise) return cache.featuredPromise;
  cache.featuredPromise = (async () => {
    const assets = [];
    for (let i = 0; i < FEATURED.length; i += 10) {
      const chunk = FEATURED.slice(i, i + 10);
      const found = await Promise.all(chunk.map(symbol => asset(symbol, { fetchImpl, signal }).catch(() => null)));
      assets.push(...found.filter(Boolean));
    }
    cache.featured = { at: Date.now(), assets };
    return assets;
  })().finally(() => { cache.featuredPromise = null; });
  return cache.featuredPromise;
}
async function asset(symbol, { fetchImpl = fetch, signal, force = false } = {}) {
  const key = String(symbol || '').trim();
  if (!key) return null;
  const cached = cache.assets.get(key);
  if (!force && cached && Date.now() - cached.at < CATALOG_TTL) return cached.value;
  if (key.length > 30 && cache.catalog?.byMint.has(key)) return cache.catalog.byMint.get(key);
  const body = await request(`/public/assets/${encodeURIComponent(key)}`, { fetchImpl, signal });
  const value = normalizeAsset(body);
  if (value) cache.assets.set(key, { at: Date.now(), value });
  return value;
}
async function price(symbol, { fetchImpl = fetch, signal, force = false } = {}) {
  const key = String(symbol || '').trim(); if (!key) return null;
  const cached = cache.quotes.get(key);
  if (!force && cached && Date.now() - cached.at < QUOTE_TTL) return cached.value;
  const body = await request(`/public/assets/${encodeURIComponent(key)}/price-data`, { fetchImpl, signal });
  const value = Number.isFinite(Number(body?.quote)) ? Number(body.quote) : null;
  cache.quotes.set(key, { at: Date.now(), value });
  return value;
}
async function status(symbol, { fetchImpl = fetch, signal, force = false } = {}) {
  const key = String(symbol || '').trim(); if (!key) return null;
  const cached = cache.statuses.get(key);
  if (!force && cached && Date.now() - cached.at < QUOTE_TTL) return cached.value;
  const value = await request(`/public/system/status/${encodeURIComponent(key)}`, { fetchImpl, signal });
  cache.statuses.set(key, { at: Date.now(), value });
  return value;
}
async function multiplier(symbol, network = 'Solana', { fetchImpl = fetch, signal, force = false } = {}) {
  const key = `${symbol}|${network}`;
  const cached = cache.multipliers.get(key);
  if (!force && cached && Date.now() - cached.at < DETAIL_TTL) return cached.value;
  const value = await request(`/public/assets/${encodeURIComponent(symbol)}/multiplier?network=${encodeURIComponent(network)}`, { fetchImpl, signal });
  cache.multipliers.set(key, { at: Date.now(), value });
  return value;
}
async function reserves(symbol, { fetchImpl = fetch, signal, force = false } = {}) {
  const key = String(symbol || '').trim(); if (!key) return null;
  const cached = cache.reserves.get(key);
  if (!force && cached && Date.now() - cached.at < DETAIL_TTL) return cached.value;
  const value = await request(`/public/proof-of-reserves/${encodeURIComponent(key)}`, { fetchImpl, signal });
  cache.reserves.set(key, { at: Date.now(), value });
  return value;
}
function stockSchedule(fn, retries = 2) {
  stockChain = stockChain.then(async () => {
    const gap = 500 - (Date.now() - stockLast);
    if (gap > 0) await new Promise(resolve => setTimeout(resolve, gap));
    stockLast = Date.now();
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { return await fn(); }
      catch (error) { if (!/429/.test(error.message) || attempt >= retries) throw error; await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1))); }
    }
    return null;
  });
  const current = stockChain;
  stockChain = stockChain.catch(() => null);
  return current;
}
async function stockHistory(symbol, range = '1D', { fetchImpl = fetch, signal, force = false } = {}) {
  const ticker = String(symbol || '').trim().toUpperCase();
  if (!ticker) throw new Error('Enter a stock ticker.');
  const spec = STOCK_RANGES[range] || STOCK_RANGES['1D'];
  const key = `${ticker}|${range}`;
  const cached = cache.stocks.get(key);
  if (!force && cached && Date.now() - cached.at < (STOCK_TTL[range] || STOCK_TTL['1D'])) return cached.value;
  const [span, interval, prepost] = spec;
  const body = await stockSchedule(async () => {
    const url = `${YAHOO}/${encodeURIComponent(ticker)}?range=${span}&interval=${interval}${prepost ? '&includePrePost=true' : ''}&events=div,splits`;
    const response = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' }, signal: timeoutSignal(signal) });
    if (!response.ok) throw new Error(`Yahoo Finance responded ${response.status}.`);
    return response.json();
  });
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(body?.chart?.error?.description || 'No stock history found.');
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const cutoff = range === '7D' ? Date.now() - 7 * 864e5 : 0;
  const points = timestamps.map((timestamp, index) => ({
    t: Number(timestamp) * 1000, o: Number(quote.open?.[index]), h: Number(quote.high?.[index]),
    l: Number(quote.low?.[index]), c: Number(quote.close?.[index]), p: Number(quote.close?.[index]), v: Number(quote.volume?.[index]) || 0
  })).filter(point => point.t > 0 && Number.isFinite(point.c) && point.c > 0 && (!cutoff || point.t >= cutoff)).sort((a, b) => a.t - b.t);
  const meta = result.meta || {};
  const value = {
    symbol: ticker, currency: meta.currency || 'USD', exchange: meta.fullExchangeName || meta.exchangeName || '',
    name: meta.longName || meta.shortName || ticker, timezone: meta.exchangeTimezoneName || '',
    price: num(meta.regularMarketPrice), previousClose: num(meta.previousClose || meta.chartPreviousClose),
    dayHigh: num(meta.regularMarketDayHigh), dayLow: num(meta.regularMarketDayLow),
    high52: num(meta.fiftyTwoWeekHigh), low52: num(meta.fiftyTwoWeekLow), points
  };
  cache.stocks.set(key, { at: Date.now(), value });
  return value;
}
function premiumDiscount(onChainPrice, underlyingQuote, multiplierValue = 1) {
  const priceValue = Number(onChainPrice), quote = Number(underlyingQuote), factor = Number(multiplierValue) || 1;
  if (!(priceValue > 0) || !(quote > 0)) return null;
  return (priceValue / (quote * factor) - 1) * 100;
}
function matchesStatus(assetRow, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return true;
  if (statusFilter === 'halted') return assetRow.isTradingHalted === true;
  if (statusFilter === 'open') return assetRow.openNow === true && !assetRow.isTradingHalted;
  if (statusFilter === 'closed') return assetRow.openNow !== true && assetRow.isTradingHalted !== true;
  return assetRow.currentPeriod === statusFilter;
}
function selectAssets(catalog, featured, { tab = 'featured', query = '', status = 'all', page = 1, pageSize = 20 } = {}) {
  const source = tab === 'featured' ? featured : (catalog?.assets || []);
  const q = String(query || '').trim().toLowerCase();
  let rows = source.filter(assetRow => (tab !== 'etfs' || assetRow.isEtf) && matchesStatus(assetRow, status) && (!q || `${assetRow.symbol} ${assetRow.name} ${assetRow.underlyingSymbol} ${assetRow.underlyingName}`.toLowerCase().includes(q)));
  if (tab === 'featured') { const order = new Map(FEATURED.map((symbol, index) => [symbol, index])); rows.sort((a, b) => (order.get(a.symbol) ?? 99) - (order.get(b.symbol) ?? 99)); }
  else rows.sort((a, b) => `${a.underlyingSymbol}${a.symbol}`.localeCompare(`${b.underlyingSymbol}${b.symbol}`));
  const total = rows.length;
  const size = Math.max(1, Math.min(50, Number(pageSize) || 20));
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.min(pages, Math.floor(Number(page) || 1)));
  return { rows: rows.slice((current - 1) * size, current * size), total, page: current, pages, pageSize: size };
}
function cachedByMint(mint) { return cache.catalog?.byMint.get(mint) || null; }
function cachedBySymbol(symbol) { return cache.catalog?.bySymbol.get(symbol) || cache.featured?.assets.find(assetRow => assetRow.symbol === symbol) || null; }
function resetCaches() { cache.catalog = null; cache.catalogPromise = null; cache.featured = null; cache.featuredPromise = null; cache.assets.clear(); cache.quotes.clear(); cache.statuses.clear(); cache.multipliers.clear(); cache.reserves.clear(); cache.stocks.clear(); }
module.exports = { API, YAHOO, FEATURED, ETF_TICKERS, STOCK_RANGES, normalizeAsset, isEtf, assetsPage, loadCatalog, loadFeatured, asset, price, status, multiplier, reserves, stockHistory, premiumDiscount, matchesStatus, selectAssets, cachedByMint, cachedBySymbol, resetCaches };
