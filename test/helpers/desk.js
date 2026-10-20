// Minimal jsdom harness so the desk (src/workspace.js) can be exercised in node
// tests. It provides just the globals workspace.js touches and stubs window.aurora.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'workspace.js'), 'utf8');
const TUTORIAL_SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'tutorials.js'), 'utf8');

const SOL = 'So11111111111111111111111111111111111111112';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

function walletFixture(overrides = {}) {
  const markets = [
    { mint: SOL, symbol: 'SOL', name: 'Solana', price: 100, change24h: 1.5 },
    { mint: BONK, symbol: 'BONK', name: 'Bonk', price: 0.0000030404, change24h: -3.09 }
  ];
  return {
    config: { execution: 'paper', addresses: [], limits: {}, mode: 'simple', currency: 'USD' },
    state: { loading: false, error: '', updated: Date.now(), watching: false, total: 0, change24h: 0, holdings: [], watchlist: [], markets, alerts: [] },
    wc: { connected: false, accounts: [] },
    paper: { cash: 1000, initial: 1000, holdingsValue: 0, equity: 1000, totalPnl: 0, realizedPnl: 0, positions: [], orders: [], pending: [], paused: false },
    research: [], strategies: [], limits: {}, executions: [],
    session: { state: 'RUNNING', note: '', needsConfirmation: false },
    vault: [], views: [], theses: [], view: null, signals: [], followed: overrides.followed || [], people: overrides.people || [],
    ...overrides
  };
}

function followedFixture() {
  return {
    id: 'f1', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Whale', tags: ['smart'], note: 'watch rotations', addedAt: Date.now() - 86400000, scanAt: Date.now() - 120000, lastError: '',
    scan: { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', at: Date.now() - 120000, sol: 12.5, total: 4200, change24h: 3.4, tokenCount: 6, pricedCount: 5, top10Share: 0.82, lastActive: Date.now() - 3600000, holdings: [{ mint: SOL, symbol: 'SOL', amount: 12.5, price: 100, value: 1250, change24h: 1.5, share: 0.2976 }, { mint: BONK, symbol: 'BONK', amount: 900000000, price: 0.0000030404, value: 2736, change24h: -3.09, share: 0.6514 }], unpriced: [], recent: [{ signature: '5sig'.repeat(10), blockTime: Math.floor(Date.now() / 1000) - 3600, err: false }] }
  };
}

const html = `<!doctype html><html><head></head><body><button id="trading-open"></button><button id="crypto-open" hidden></button><button id="wallet-open"></button><textarea id="prompt"></textarea><div id="toast" hidden></div><main></main><div class="main-content"><div class="conversation"></div><div class="companion"></div></div></body></html>`;

function createDesk({ wallet, agent = 'gigi' } = {}) {
  const dom = new JSDOM(html, { url: 'https://aurora.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const toasts = []; const renderCalls = []; const calls = {};
  let eventHandler = () => {};
  const snapshot = () => ({ currentId: 'c1', agent: 'gigi', messages: [], wallet: window.view.wallet, busy: false });

  window.__auroraTest = true;
  window.view = { agent, wallet: wallet || walletFixture() };
  window.toast = message => toasts.push(String(message));
  window.render = data => renderCalls.push(data);
  window.AuroraIcons = { icon: () => { const span = window.document.createElement('span'); span.className = 'hf-ico'; span.append(window.document.createElementNS('http://www.w3.org/2000/svg', 'svg')); return span; } };
  window.AuroraMarkdown = { render: (el, md) => { el.textContent = md; } };
  window.CSS = window.CSS || {}; if (!window.CSS.escape) window.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`);
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.URL.createObjectURL = () => 'blob:mock'; window.URL.revokeObjectURL = () => {};
  try { Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); } catch {}

  const ok = value => Promise.resolve({ ok: true, value });
  const track = name => { calls[name] = (calls[name] || 0) + 1; };
  const method = (name, valueFn) => (...args) => { track(name); return ok(valueFn ? valueFn(...args) : snapshot()); };

  const aurora = {
    load: method('load'), walletRefresh: method('walletRefresh'),
    walletTokenInfo: method('walletTokenInfo', () => ({ mint: SOL, pair: { address: SOL, symbol: 'SOL', name: 'Solana', dex: 'pumpswap', priceUsd: 100, change24h: 1.5, liquidityUsd: 5e6, volume24h: 2e6, marketCap: 1e9 }, safety: { level: 'ok', flags: [] } })),
    walletSeries: method('walletSeries', () => Array.from({ length: 40 }, (_, i) => ({ t: Date.now() - (40 - i) * 36e5, o: 99 + i * 0.1, h: 100 + i * 0.1, l: 98 + i * 0.1, c: 99.5 + i * 0.1, p: 99.5 + i * 0.1, v: 1000 + i }))),
    walletPortfolioSeries: method('walletPortfolioSeries', () => ({ points: [], covered: 0, considered: 0, holdings: 0, total: 0, range: '30D' })),
    walletHolders: method('walletHolders', () => ({ mint: SOL, holders: 12345, top1: 8.8, top10: 38.3, risks: ['Low liquidity'], accounts: [{ address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', amount: 1000, pct: 8.83 }, { address: '51yZyDSnec4xnUv7XLRVYcDyV4x3wUtzrDcRaYbmQU5j', amount: 500, pct: 6.79 }] })),
    walletSearch: method('walletSearch', () => []), walletTrending: method('walletTrending', () => []),
    walletPeopleSave: method('walletPeopleSave', value => ({ ...snapshot(), wallet: { ...window.view.wallet, people: [...(window.view.wallet.people || []), { id: 'p1', address: value.address, label: value.label || 'Person', kind: value.kind || 'kol', tags: [], note: '', addedAt: Date.now(), scanAt: Date.now(), scan: { total: 500, holdings: [{ mint: SOL, symbol: 'SOL', amount: 5, value: 500, change24h: 1 }], unpriced: [], at: Date.now() }, launches: [], stats: { launches: 0, completed: 0, lastLaunchAt: 0 } }] } })),
    walletPeopleRemove: method('walletPeopleRemove'), walletPeopleScan: method('walletPeopleScan'), walletPeopleWatch: method('walletPeopleWatch'), walletRadarStarter: method('walletRadarStarter', () => ({ ...snapshot(), radarStarter: { added: 0, total: 15 } })), walletPeopleScanAll: method('walletPeopleScanAll', () => ({ ...snapshot(), peopleScanJob: { id: 'j1', total: 1, done: 0, running: true, errors: 0, current: '', startedAt: Date.now(), finishedAt: 0, error: '' } })), walletPeopleScanStatus: method('walletPeopleScanStatus', () => ({ job: null })),
    walletTokenIntel: method('walletTokenIntel', value => ({ at: Date.now(), mint: value.mint, symbol: 'CREW', name: 'CREW', metrics: { priceUsd: 0.00001, marketCap: 10000, liquidityUsd: 4000, change24h: 30, estimated: true }, pair: { priceUsd: 0.00001, marketCap: 10000, fdv: 10000, liquidityUsd: 4000, change24h: 30, imageUrl: 'https://example.test/crew.png', links: [{ type: 'twitter', url: 'https://x.com/example' }], url: 'https://dexscreener.com/solana/x' }, safety: { level: 'ok', flags: [] }, curve: { known: true, percentage: 12, source: 'reserves' }, ageMs: 60000, links: [{ type: 'twitter', url: 'https://x.com/example' }], dev: { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Dev', tracked: false, balance: 1000, value: 0, pct: 0.0001, supply: 1e9, launches: [{ mint: value.mint, symbol: 'CREW', createdAt: Date.now() - 60000, completed: false, marketCap: 10000 }], stats: { launches: 1, completed: 0, lastLaunchAt: Date.now() - 60000 }, lastError: '' }, people: [{ id: 'p1', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Alpha KOL', kind: 'kol', tags: ['kol'], value: 500, amount: 5000, scanAt: Date.now(), source: 'people' }], followed: [], convergence: { kol: 1, traders: 0, total: 1, value: 500 }, holders: { top1: 8.8, top10: 38.3, holders: 12345, flags: [], accounts: [{ address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', pct: 8.83, label: 'Alpha KOL', kind: 'kol', isDev: false }] } })),
    walletPumpDiscover: method('walletPumpDiscover', value => ({ stage: value.stage, at: Date.now(), stale: false, counts: { new: 2, trending: 1, graduated: 1 }, rows: value.stage === 'graduated' ? [{ mint: 'HZLEZULB1bV6rgxm6dWMdPnftPw42KG72bwvPeEipump', symbol: 'MC', name: 'Marketcat', poolAddress: 'pool', dex: 'pumpswap', createdAt: Date.now() - 86400000, ageMs: 86400000, priceUsd: 0.0003, marketCap: 300000, fdv: 300000, change5m: 1, change1h: 3, change24h: 15, volume5m: 1000, volume1h: 120000, volume24h: 900000, liquidityUsd: 50000, buys1h: 400, sells1h: 200, buyers1h: 300, sellers1h: 150, graduationPercentage: 100, graduationKnown: true, completed: true, aboutToGraduate: false, score: 80 }] : value.stage === 'trending' ? [{ mint: '3jzN6pDQLSCERTW2KBi5Sey9eghUjX1hpwYCFRUrpump', symbol: 'AGI', name: 'AGI', poolAddress: 'pool2', dex: 'pump-fun', createdAt: Date.now() - 7200000, ageMs: 7200000, priceUsd: 0.001, marketCap: 400000, fdv: 400000, change5m: 1, change1h: 8, change24h: 20, volume5m: 2000, volume1h: 80000, volume24h: 300000, liquidityUsd: 60000, buys1h: 300, sells1h: 100, buyers1h: 220, sellers1h: 80, graduationPercentage: 42.5, graduationKnown: true, completed: false, aboutToGraduate: false, score: 60 }] : [{ mint: 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump', symbol: 'CREW', name: 'CREW', imageUrl: 'https://example.test/crew.png', links: [{ type: 'twitter', url: 'https://x.com/example' }, { type: 'telegram', url: 'https://t.me/example' }], poolAddress: 'pool3', dex: 'pump-fun', createdAt: Date.now() - 60000, ageMs: 60000, priceUsd: 0.00001, marketCap: 10000, fdv: 10000, change5m: 2, change1h: 12, change24h: 30, volume5m: 100, volume1h: 5000, volume24h: 20000, liquidityUsd: 4000, buys1h: 20, sells1h: 5, buyers1h: 15, sellers1h: 5, graduationPercentage: 0.34, graduationKnown: true, completed: false, aboutToGraduate: false, score: 30 }] })),
    walletPumpPreview: method('walletPumpPreview', value => ({ user: 'So11111111111111111111111111111111111111112', completed: false, pool: 'pump', summary: { venue: 'PumpPortal', pool: 'pump', action: value.side, feePct: 0.5, slippagePct: 10, priorityFeeSol: 0.0005, estimate: 1000 }, simulation: { ok: true } })),
    walletPumpExecute: method('walletPumpExecute', () => ({ signature: 'pumpsig', status: 'confirmed', summary: {} })),
    walletPumpAutoStatus: method('walletPumpAutoStatus', () => ({ enabled: false, running: false, stage: 'new', autoPaper: false, budgetUsd: 10, maxBuys: 1, intervalSec: 90, lastAt: 0, lastBought: 0, error: '', verdicts: { 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump': { mint: 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump', verdict: 'buy', score: 9, reason: 'Liquidity and buy pressure are strong.' } }, autoMints: [] })),
    walletPumpAuto: method('walletPumpAuto', value => ({ enabled: value.enabled !== false, running: false, stage: value.stage || 'new', autoPaper: value.autoPaper === true, budgetUsd: value.budgetUsd || 10, maxBuys: value.maxBuys || 1, intervalSec: value.intervalSec || 90, lastAt: Date.now(), lastBought: 0, error: '', verdicts: { 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump': { mint: 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump', verdict: 'buy', score: 9, reason: 'Liquidity and buy pressure are strong.' } }, autoMints: [] })),
    walletXStocksDiscover: method('walletXStocksDiscover', value => ({ tab: value.tab, page: 1, pages: 1, pageSize: 20, total: 2, counts: { total: 2, open: 1, halted: 0 }, at: Date.now(), rows: [
      { symbol: 'AAPLx', name: 'Apple xStock', underlyingSymbol: 'AAPL', underlyingName: 'Apple Inc', exchange: 'NASDAQ', logo: 'https://example.test/aapl.png', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', isTradingHalted: false, openNow: true, currentPeriod: 'extended', isEtf: false, pair: { priceUsd: 344.36, change24h: 1.2, volume24h: 5000000, liquidityUsd: 255306 }, quote: 342.72, multiplier: 1.003269, premium: 0.48 },
      { symbol: 'TSLAx', name: 'Tesla xStock', underlyingSymbol: 'TSLA', underlyingName: 'Tesla Inc', exchange: 'NASDAQ', logo: 'https://example.test/tsla.png', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', isTradingHalted: false, openNow: false, currentPeriod: 'closed', isEtf: false, pair: { priceUsd: 353.13, change24h: -0.8, volume24h: 7000000, liquidityUsd: 2356000 }, quote: 355.2, multiplier: 1, premium: -0.58 }
    ] })),
    walletStockHistory: method('walletStockHistory', value => ({ symbol: value.symbol, currency: 'USD', exchange: 'NasdaqGS', name: 'Apple Inc.', price: 342.72, previousClose: 340, high52: 350, low52: 240, points: Array.from({ length: 12 }, (_, i) => ({ t: Date.now() - (12 - i) * 36e5, o: 340 + i, h: 341 + i, l: 339 + i, c: 340.5 + i, p: 340.5 + i, v: 1000 + i })) })),
    walletXStocksAsset: method('walletXStocksAsset', value => ({ asset: { symbol: 'AAPLx', name: 'Apple xStock', underlyingSymbol: 'AAPL', underlyingName: 'Apple Inc', exchange: 'NASDAQ', logo: 'https://example.test/aapl.png', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', isTradingHalted: false, openNow: true, currentPeriod: 'extended', isEtf: false, nextChangeAt: '2026-10-19T13:30:00.000Z' }, pair: { priceUsd: 344.36, change24h: 1.2, volume24h: 5000000, liquidityUsd: 255306 }, quote: 342.72, multiplier: 1.003269, multiplierDetail: { currentMultiplier: 1.003269 }, reserves: { sharesHeld: 36614, circulatingSupply: 36507.94 }, tradingStatus: { isMarketTradingHalted: false }, premium: 0.48 })),
    walletDiscover: method('walletDiscover', kind => kind === 'narratives' ? [{ name: 'AI', slug: 'ai', description: 'agents', tokenCount: 12, marketCap: 1e9, volume: 2e7, change24h: 5 }] : [{ address: BONK, symbol: 'BONK', name: 'Bonk', priceUsd: 0.0000030404, change5m: 1.2, change1h: -0.5, change24h: -3.09, liquidityUsd: 500000, volume24h: 120000, marketCap: 2e8, createdAt: Date.now() - 86400000, dex: 'raydium' }, { address: 'HZLEZULB1bV6rgxm6dWMdPnftPw42KG72bwvPeEipump', symbol: 'PUMP', name: 'Pump', priceUsd: 0.001, change5m: 2, change1h: 3, change24h: 4, liquidityUsd: 50000, volume24h: 60000, marketCap: 1e6, createdAt: Date.now() - 3600000, dex: 'pumpfun' }]),
    walletWatchlistAdd: method('walletWatchlistAdd'), walletWatchlistRemove: method('walletWatchlistRemove'),
    walletAlertAdd: method('walletAlertAdd'), walletAlertRemove: method('walletAlertRemove'),
    walletPaperBuy: method('walletPaperBuy'), walletPaperSell: method('walletPaperSell'), walletPaperReset: method('walletPaperReset'), walletPaperCondition: method('walletPaperCondition'), walletPaperCancel: method('walletPaperCancel'),
    walletResearchStart: method('walletResearchStart'), walletResearchCancel: method('walletResearchCancel'), walletResearchRemove: method('walletResearchRemove'), walletResearchReport: method('walletResearchReport', () => ({ report: '# Report\n\n- fact' })),
    walletStrategySave: method('walletStrategySave'), walletStrategyRemove: method('walletStrategyRemove'), walletStrategyStatus: method('walletStrategyStatus'), walletStrategyRun: method('walletStrategyRun', () => ({ executed: false })), walletStrategyBacktest: method('walletStrategyBacktest', value => ({ ok: true, range: value.range || '7D', candles: 120, startingCash: 1000, endingCash: 1042, equity: Array.from({ length: 20 }, (_, i) => ({ t: i * 3600000, p: 1000 + i * 2 })), trades: [{ entryAt: Date.now() - 7200000, exitAt: Date.now() - 3600000, entryPrice: 1, exitPrice: 1.05, qty: 100, invested: 100, pnl: 4.5, pnlPct: 4.5, holdMinutes: 60, reason: 'take profit' }], metrics: { trades: 4, wins: 3, losses: 1, winRate: 75, netPnl: 42, returnPct: 4.2, avgPnl: 10.5, avgPnlPct: 4.2, profitFactor: 2.1, maxDrawdownPct: 6.1, avgHoldMinutes: 45, bestTrade: 25, worstTrade: -8 } })),
    walletSwapPreview: method('walletSwapPreview'), walletSwapExecute: method('walletSwapExecute'),
    walletSessionPause: method('walletSessionPause'), walletSessionResume: method('walletSessionResume'), walletSessionReconcile: method('walletSessionReconcile'),
    walletVaultGenerate: method('walletVaultGenerate'), walletVaultImport: method('walletVaultImport'), walletVaultRemove: method('walletVaultRemove'),
    walletViewShow: method('walletViewShow', () => ({ view: { id: 'v1', type: 'line', title: 'X' } })), walletViewPin: method('walletViewPin'), walletViewRemove: method('walletViewRemove'),
    walletThesisSave: method('walletThesisSave'), walletThesisRemove: method('walletThesisRemove'), walletThesisActivate: method('walletThesisActivate'), walletThesisShare: method('walletThesisShare', () => ({ text: 'call' })),
    walletSignalSave: method('walletSignalSave'), walletSignalRemove: method('walletSignalRemove'), walletSignalToggle: method('walletSignalToggle'),
    walletConfig: method('walletConfig'), walletLimits: method('walletLimits'),
    walletAddressAdd: method('walletAddressAdd'), walletAddressRemove: method('walletAddressRemove'),
    walletFollowAdd: method('walletFollowAdd'), walletFollowRemove: method('walletFollowRemove'), walletFollowUpdate: method('walletFollowUpdate'), walletFollowScan: method('walletFollowScan'), walletFollowScanAll: method('walletFollowScanAll'), walletFollowBrief: method('walletFollowBrief'), walletFollowCopy: method('walletFollowCopy', () => ({ ...snapshot(), copy: { copied: 2, totalCost: 100, tokens: [] } })), walletRpcTest: method('walletRpcTest', () => ({ ok: true, version: 'test' })), searchSettings: method('searchSettings'), searchTest: method('searchTest', () => ({ ok: true, results: 2 })),
    walletWcConnect: method('walletWcConnect', () => ({ uri: 'wc:test' })), walletWcDisconnect: method('walletWcDisconnect'),
    openLink: method('openLink'),
    onEvent: handler => { eventHandler = handler; }
  };
  window.aurora = aurora;

  window.eval(TUTORIAL_SOURCE);
  window.eval(SOURCE);

  const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  const tab = name => window.document.querySelector(`#ws-tabs .hf-tab[data-ws=${name}]`);
  return { window, document: window.document, toasts, renderCalls, calls, eventHandler: () => eventHandler, flush, tab };
}

module.exports = { createDesk, walletFixture, followedFixture, SOL, BONK };
