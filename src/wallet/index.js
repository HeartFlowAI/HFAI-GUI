const { randomUUID } = require('node:crypto');
const solana = require('./solana');
const providers = require('./providers');
const paperModule = require('./paper');
const strategyModule = require('./strategy');
const sessionModule = require('./session');
const viewsModule = require('../views');
const thesisModule = require('../thesis');
const signalsModule = require('../signals');

const MAX_POINTS = 240;
function sanitizeHistory(input) {  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [mint, points] of Object.entries(input)) {
    if (!solana.validateAddress(mint) || !Array.isArray(points)) continue;
    const clean = points
      .filter(point => point && Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.p)))
      .slice(-MAX_POINTS)
      .map(point => ({ t: Number(point.t), p: Number(point.p) }));
    if (clean.length) out[mint] = clean;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}
function sanitizeResearch(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(item => item && item.id && ['queued', 'running', 'ready', 'failed'].includes(item.status)).slice(-30).map(item => ({
    id: String(item.id), mint: typeof item.mint === 'string' ? item.mint.slice(0, 60) : '', symbol: typeof item.symbol === 'string' ? item.symbol.slice(0, 24) : '',
    status: item.status, createdAt: Number(item.createdAt) || 0,
    report: typeof item.report === 'string' ? item.report.slice(0, 20000) : '',
    error: typeof item.error === 'string' ? item.error.slice(0, 300) : ''
  }));
}
function sanitizeExecutions(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(item => item && item.id).slice(-100).map(item => ({
    id: String(item.id), at: Number(item.at) || 0, signature: String(item.signature || '').slice(0, 120),
    side: item.side === 'sell' ? 'sell' : 'buy', mint: String(item.mint || '').slice(0, 60),
    inAmount: String(item.inAmount || '').slice(0, 40), outAmount: String(item.outAmount || '').slice(0, 40),
    status: ['submitted', 'confirmed', 'failed', 'pending'].includes(item.status) ? item.status : 'submitted',
    error: String(item.error || '').slice(0, 200)
  }));
}
function sanitizeVault(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(item => item && item.id && item.publicKey && item.encryptedSecret).slice(0, 10).map(item => ({
    id: String(item.id), label: String(item.label || 'Bot wallet').slice(0, 40), publicKey: String(item.publicKey).slice(0, 64),
    encryptedSecret: String(item.encryptedSecret), createdAt: Number(item.createdAt) || 0
  }));
}
function normalizeLimits(input) {  const source = input && typeof input === 'object' ? input : {};
  return { maxPositionUsd: Math.max(0, Number(source.maxPositionUsd) || 0), maxTotalUsd: Math.max(0, Number(source.maxTotalUsd) || 0), dailyCapUsd: Math.max(0, Number(source.dailyCapUsd) || 0) };
}
function normalizeConfig(input) {
  const source = input && typeof input === 'object' ? input : {};
  const addresses = Array.isArray(source.addresses)
    ? [...new Set(source.addresses.filter(a => solana.validateAddress(a)).map(a => a.trim()))].slice(0, 10)
    : [];
  const watchlist = Array.isArray(source.watchlist)
    ? [...new Set(source.watchlist.filter(a => solana.validateAddress(a)).map(a => a.trim()))].slice(0, 50)
    : [];
  const alerts = Array.isArray(source.alerts)
    ? source.alerts
      .filter(a => a && solana.validateAddress(a.mint) && (a.direction === 'above' || a.direction === 'below') && Number.isFinite(Number(a.price)))
      .slice(0, 50)
      .map(a => ({ id: typeof a.id === 'string' && a.id ? a.id : randomUUID(), mint: a.mint.trim(), direction: a.direction, price: Number(a.price), triggeredAt: Number(a.triggeredAt) || 0 }))
    : [];
  return {
    addresses,
    rpc: typeof source.rpc === 'string' && /^https:\/\//.test(source.rpc.trim()) ? source.rpc.trim() : '',
    mode: source.mode === 'pro' ? 'pro' : 'simple',
    currency: typeof source.currency === 'string' && source.currency.trim() ? source.currency.trim().slice(0, 3).toUpperCase() : 'USD',
    hideBalances: source.hideBalances === true,
    execution: source.execution === 'live' ? 'live' : 'paper',
    watchlist,
    alerts,
    history: sanitizeHistory(source.history),
    wcProjectId: typeof source.wcProjectId === 'string' ? source.wcProjectId.trim().slice(0, 120) : '',
    wcStorage: source.wcStorage && typeof source.wcStorage === 'object' && !Array.isArray(source.wcStorage) ? source.wcStorage : {},
    wcSession: source.wcSession && typeof source.wcSession === 'object' ? { topic: String(source.wcSession.topic || '').slice(0, 200), accounts: Array.isArray(source.wcSession.accounts) ? source.wcSession.accounts.slice(0, 5).map(String) : [] } : { topic: '', accounts: [] },
    paper: paperModule.normalizePaper(source.paper),
    research: sanitizeResearch(source.research),
    strategies: strategyModule.normalizeStrategies(source.strategies),
    limits: normalizeLimits(source.limits),
    executions: sanitizeExecutions(source.executions),
    session: sessionModule.normalizeSession(source.session),
    vault: sanitizeVault(source.vault),
    views: viewsModule.normalizeViews(source.views),
    theses: thesisModule.normalizeTheses(source.theses),
    signals: signalsModule.normalizeSignals(source.signals)
  };
}
function shortMint(mint) { return typeof mint === 'string' && mint.length > 10 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : String(mint || ''); }
function emptyState(now) {
  return { loading: false, error: '', updated: now, watching: false, total: 0, change24h: 0, holdings: [], watchlist: [], alerts: [] };
}
function createWalletManager({ config, fetchImpl = fetch, onUpdate = () => {}, onAlert = () => {}, onSamples = () => {}, onIntent = () => {}, onSignal = () => {}, freshResearch = () => true, intervalMs = 60000, now = () => Date.now() } = {}) {
  let timer = null, disposed = false;
  const fired = new Set();
  const lastPrices = {};
  const lastChange = {};
  const samples = config.history || (config.history = {});
  const state = emptyState(now());
  const alertsView = () => config.alerts.map(alert => ({ id: alert.id, mint: alert.mint, symbol: shortMint(alert.mint), direction: alert.direction, price: alert.price, triggeredAt: alert.triggeredAt || 0 }));
  function record(mint, price) {
    if (!(price > 0)) return false;
    const series = samples[mint] || (samples[mint] = []);
    const last = series[series.length - 1];
    const t = now();
    if (last && last.p === price && t - last.t < 30000) return false;
    series.push({ t, p: price });
    while (series.length > MAX_POINTS) series.shift();
    return true;
  }
  function signals(mint, windowMinutes = 0) {
    const price = Number(lastPrices[mint] || 0);
    const change24h = Number(lastChange[mint] || 0);
    let change = 0;
    if (windowMinutes > 0) { const series = samples[mint] || []; if (series.length) { const cutoff = now() - windowMinutes * 60000; const first = series.find(point => point.t >= cutoff) || series[0]; if (first && first.p > 0) change = (price - first.p) / first.p * 100; } }
    return { price, change24h, change };
  }
  async function refresh() {
    if (disposed) return state;
    const watching = config.addresses.length > 0;
    if (!watching && !config.watchlist.length) { Object.assign(state, emptyState(now()), { alerts: alertsView() }); onUpdate(); return state; }
    state.loading = true; state.error = ''; onUpdate();
    try {
      const rpc = config.rpc || solana.DEFAULT_RPC;
      const portfolios = watching ? await Promise.all(config.addresses.map(address => solana.fetchPortfolio(address, { rpc, fetchImpl }))) : [];
      const mints = new Set([solana.SOL_MINT, ...config.watchlist]);
      for (const portfolio of portfolios) for (const token of portfolio.tokens) mints.add(token.mint);
      for (const order of config.paper.pending) mints.add(order.mint);
      const prices = await providers.jupiterPrices([...mints], { fetchImpl }).catch(() => ({}));
      for (const [mint, quote] of Object.entries(prices)) { lastPrices[mint] = Number(quote.price || 0); lastChange[mint] = Number(quote.change24h || 0); }
      const holdings = [];
      const push = (mint, symbol, amount, address) => {
        if (!(amount > 0)) return;
        const quote = prices[mint] || {};
        const price = Number(quote.price || 0);
        holdings.push({ mint, symbol, amount, price, change24h: Number(quote.change24h || 0), value: amount * price, address });
      };
      for (const portfolio of portfolios) {
        push(solana.SOL_MINT, 'SOL', portfolio.sol, portfolio.address);
        for (const token of portfolio.tokens) push(token.mint, shortMint(token.mint), token.amount, portfolio.address);
      }
      holdings.sort((a, b) => b.value - a.value);
      const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
      const change24h = total > 0 ? holdings.reduce((sum, holding) => sum + holding.value * (holding.change24h || 0), 0) / total : 0;
      for (const holding of holdings) holding.share = total > 0 ? holding.value / total : 0;
      const watchlist = config.watchlist.map(mint => { const quote = prices[mint] || {}; return { mint, symbol: shortMint(mint), price: Number(quote.price || 0), change24h: Number(quote.change24h || 0) }; });
      let recorded = false;
      for (const mint of mints) { const quote = prices[mint]; if (quote && record(mint, Number(quote.price))) recorded = true; }
      const running = (config.session && config.session.state) === 'RUNNING';
      const filled = running ? paperModule.evaluatePending(config.paper, mint => Number(lastPrices[mint] || 0)) : [];
      const result = running ? strategyModule.runStrategies(config.paper, config.strategies, (mint, windowMinutes) => signals(mint, windowMinutes), { now: now(), limits: config.limits }) : { executed: [], intents: [] };
      if (filled.length || result.executed.length || result.intents.length) recorded = true;
      for (const intent of result.intents) { try { onIntent(intent); } catch {} }
      for (const alert of config.alerts) {
        const price = Number(prices[alert.mint]?.price || 0);
        if (!(price > 0)) continue;
        const hit = alert.direction === 'above' ? price >= alert.price : price <= alert.price;
        if (hit && !fired.has(alert.id)) { fired.add(alert.id); alert.triggeredAt = now(); onAlert({ ...alert, symbol: shortMint(alert.mint), current: price }); }
      }
      const firedSignals = running ? signalsModule.runSignals(config.signals, (mint, windowMinutes) => signals(mint, windowMinutes), { now: now(), freshResearch }) : [];
      for (const hit of firedSignals) { try { onSignal(hit.rule, hit.signals); } catch {} }
      if (firedSignals.length) recorded = true;
      Object.assign(state, { loading: false, error: '', updated: now(), watching, total, change24h, holdings, watchlist, alerts: alertsView() });
      if (recorded) { try { onSamples(samples); } catch {} }
    } catch (error) {
      state.loading = false; state.error = error.message; state.updated = now();
    }
    onUpdate(); return state;
  }
  function series(mint) { return (samples[mint] || []).slice(-MAX_POINTS); }
  function start() { if (timer || disposed) return; refresh().catch(() => {}); timer = setInterval(() => refresh().catch(() => {}), intervalMs); timer.unref?.(); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function dispose() { disposed = true; stop(); }
  return { refresh, start, stop, dispose, snapshot: () => state, series, shortMint, priceOf: mint => Number(lastPrices[mint] || 0), signals };
}
module.exports = { createWalletManager, normalizeConfig, shortMint, sanitizeHistory, sanitizeResearch, MAX_POINTS };
