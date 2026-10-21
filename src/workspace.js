// Gigi's Solana desk: wallets to follow plus portfolio, trade, discover,
// research, strategies and journal. Mounts inside <main> so the app sidebar
// stays. Built on ui.css components and the AuroraIcons set. Gigi only.
(() => {
  const el = id => document.getElementById(id);
  const wallet = () => (typeof view !== 'undefined' && view.wallet) ? view.wallet : null;
  const cfg = () => wallet()?.config || {};
  const state = () => wallet()?.state || {};
  const paper = () => wallet()?.paper || null;
  const money = v => { const n = Number(v || 0), abs = Math.abs(n); if (abs === 0) return '$0'; const max = abs >= 1 ? 2 : Math.max(2, Math.min(8, Math.ceil(-Math.log10(abs)) + 3)); return `$${n.toLocaleString(undefined, { minimumFractionDigits: abs >= 1 ? 2 : 0, maximumFractionDigits: max })}`; };
  const amount = v => Number(v || 0) >= 1 ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }) : Number(v || 0).toPrecision(4);
  const num = v => { if (v === null || v === undefined || v === '') return ''; const n = Number(v); if (!Number.isFinite(n)) return String(v); return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1 ? 2 : 8 }); }; 
  const short = m => typeof m === 'string' && m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : String(m || '');
  const sym = (m, st) => xstockNames.get(m)?.symbol || (st?.holdings || []).find(h => h.mint === m)?.symbol || (st?.markets || []).find(x => x.mint === m)?.symbol || (st?.watchlist || []).find(w => w.mint === m)?.symbol || short(m);
  const call2 = promise => promise.then(result => result.ok ? result.value : Promise.reject(Error(result.error)));
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const svgEl = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);
  const ic = (name, size = 16) => window.AuroraIcons.icon(name, size);

  const persisted = (() => { try { return JSON.parse(localStorage.getItem('aurora-desk-v2') || '{}') || {}; } catch { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('aurora-desk-v2', JSON.stringify({ section, chatW, chatOpen, tradeCandles, tradeSide, tradeType, tradeTab, discoverTab, discoverDex, platform, pumpStage, pumpSort, pumpSlippage, pumpPriority, pumpView: pumpViewMode, pumpAutoEnabled: pumpAutoState.enabled, pumpAutoPaper: pumpAutoState.autoPaper, pumpAutoBudget: pumpAutoState.budgetUsd, pumpAutoMaxBuys: pumpAutoState.maxBuys, pumpAutoInterval: pumpAutoState.intervalSec, xStatus, xchart: xChartSource })); } catch {} };
  const SECTIONS = [['wallets', 'Wallets', 'wallet'], ['people', 'People', 'holders'], ['portfolio', 'Portfolio', 'portfolio'], ['trade', 'Trade', 'trade'], ['discover', 'Discover', 'discover'], ['alerts', 'Alerts', 'alert'], ['research', 'Research', 'research'], ['strategies', 'Strategies', 'strategies'], ['journal', 'Journal', 'journal']];
  const persistedSection = persisted.section === 'watch' ? 'alerts' : persisted.section;
  let section = SECTIONS.some(x => x[0] === persistedSection) ? persistedSection : 'wallets';
  let chatW = persisted.chatW || 400, chatOpen = persisted.chatOpen === true;
  let open = false, chartMint = '', pfChartMint = '', reportOpen = '', reportText = '';
  let pfRange = '30D', tradeRange = '7D', tradeCandles = persisted.tradeCandles !== false, journalKind = 'all', journalFilter = '';
  let tradeSide = persisted.tradeSide === 'sell' ? 'sell' : 'buy', tradeType = ['limit', 'stop', 'stopLimit', 'trailing', 'oco'].includes(persisted.tradeType) ? persisted.tradeType : 'market';
  let tradeTab = ['fills', 'holders'].includes(persisted.tradeTab) ? persisted.tradeTab : 'orders';
  let pfSort = { key: 'value', dir: -1 }, pfFilter = '';
  const tokenCache = new Map();
  const holdersCache = new Map();
  const discover = { items: {}, loading: {}, error: {} };
  let discoverTab = ['new', 'takeovers', 'narratives'].includes(persisted.discoverTab) ? persisted.discoverTab : 'trending';
  let discoverQuery = '', discoverMinLiq = 0, discoverSort = { key: 'volume24h', dir: -1 }, watchMint = '', alertFilter = 'all';
  let discoverDex = ['all', 'pumpfun', 'pumpswap'].includes(persisted.discoverDex) ? persisted.discoverDex : 'all';
  let platform = ['pumpfun', 'xstocks'].includes(persisted.platform) ? persisted.platform : 'solana';
  let pumpStage = ['new', 'trending', 'graduated'].includes(persisted.pumpStage) ? persisted.pumpStage : 'new';
  let pumpSort = ['score', 'marketCap', 'volume1h', 'volume24h', 'change1h', 'age'].includes(persisted.pumpSort) ? persisted.pumpSort : 'score';
  let pumpQuery = '', pumpMinVol = 0;
  let pumpSlippage = Math.min(50, Math.max(0.1, Number(persisted.pumpSlippage) || 10));
  let pumpPriority = Math.min(0.05, Math.max(0, Number(persisted.pumpPriority) || 0.0005));
  const pumpFeed = { items: {}, loading: {}, error: {}, at: {}, stale: {}, counts: {} };
  let pumpViewMode = persisted.pumpView === 'table' ? 'table' : 'cards';
  const pulseSparks = new Map();
  const pulseSparkLoading = new Set();
  const pumpAutoState = { enabled: persisted.pumpAutoEnabled === true, running: false, stage: 'new', autoPaper: persisted.pumpAutoPaper === true, budgetUsd: Math.min(100, Math.max(1, Number(persisted.pumpAutoBudget) || 10)), maxBuys: Math.min(5, Math.max(1, Number(persisted.pumpAutoMaxBuys) || 1)), intervalSec: Math.min(600, Math.max(60, Number(persisted.pumpAutoInterval) || 90)), lastAt: 0, lastBought: 0, error: '', verdicts: {}, autoMints: [] };
  let pumpAutoLoaded = false;
  const pumpHints = new Map();
  let xTab = 'featured';
  let xStatus = ['all', 'open', 'closed', 'extended', 'overnight', 'halted'].includes(persisted.xStatus) ? persisted.xStatus : 'all';
  let xQuery = '', xPage = 1, xGeneration = 0, xSearchTimer;
  let xChartSource = persisted.xchart === 'onchain' ? 'onchain' : 'underlying';
  const xFeed = { data: null, loading: false, error: '' };
  const xstockHints = new Map();
  const xstockNames = new Map();
  let pumpRefreshTimer = null;
  let peopleFilter = 'all', peopleAddKind = 'kol', peopleScanState = null;
  let peopleQuery = '', peopleSource = 'all', peopleStatus = 'all', peopleSort = 'order', peopleAddOpen = false;
  let intelMint = '', intelData = null, intelLoading = false, intelError = '';
  const intelTried = new Set();
  let followSelected = '', compareWallets = false, copyOpen = '';
  let walletTab = 'overview', walletAddOpen = false, walletQuery = '';
  let strategyBuilderOpen = false, strategyStep = 0, strategyTemplate = 'dip', strategyDraft = null, strategyEditingId = '';
  let strategyBacktest = null, strategyBacktestLoading = false, strategyBacktestError = '', strategyBacktestRange = '7D', strategyProfile = 'custom';
  let signalComposerOpen = false, signalPreset = 'custom', signalDraft = null, signalEditingId = '';
  const TUTORIALS = window.AuroraTutorials || { languages: [], ui: {}, names: {}, sections: {} };
  const tutorialIds = new Set((TUTORIALS.languages || []).map(item => item.id));
  let tutorialLang = (() => { try { const saved = localStorage.getItem('aurora-tutorial-lang'); if (saved && tutorialIds.has(saved)) return saved; } catch {} const nav = String(navigator.language || 'en').slice(0, 2); return tutorialIds.has(nav) ? nav : 'en'; })();
  let tutorialKey = 'wallets';

  const ws = mk('div'); ws.id = 'trading-workspace'; ws.hidden = true;
  ws.innerHTML = `<header class="ws-top"><div class="ws-brand"><img src="assets/agents/gigi.webp" alt=""><div><strong><span class="dot"></span>Gigi</strong><small id="ws-conn">Solana desk</small></div></div><label class="ws-search"><span class="ws-search-ico"></span><input id="ws-search" type="search" placeholder="Search tokens by name or mint" maxlength="60" aria-label="Search tokens"><kbd>⌘K</kbd></label><div class="ws-search-results" id="ws-search-results" hidden></div><span class="ws-top-spacer"></span><div class="ws-seg ws-platform" id="ws-platform" role="group" aria-label="Platform"><button data-platform="solana">Solana</button><button data-platform="pumpfun">Pump.fun</button><button data-platform="xstocks">xStocks</button></div><div class="ws-seg" id="ws-seg"><button data-exec="paper">Paper</button><button data-exec="live">Live</button></div><button id="ws-chat-visible" class="hf-btn ghost" type="button">Chat</button><button id="ws-settings" class="hf-btn ghost" type="button">Settings</button><button id="ws-close" class="hf-btn" type="button">Back to chat</button></header><nav class="ws-tabs hf-tabs" id="ws-tabs" role="tablist" aria-label="Trading sections"></nav><div class="ws-split" id="ws-split"><div class="ws-content" id="ws-content"></div><aside class="ws-chat" id="ws-chat" role="complementary"><div class="ws-resizer" id="ws-resizer" role="separator" aria-label="Resize chat"></div><div class="ws-chat-head"><img src="assets/agents/gigi.webp" alt=""><div><strong>Gigi</strong> <small>markets sister</small></div><span class="ws-chat-spacer"></span><button class="hf-btn icon sm" id="ws-chat-collapse" type="button" title="Collapse chat"></button></div><div class="ws-chat-slot" id="ws-chat-slot"></div></aside></div><div class="ws-palette" id="ws-palette" hidden><div class="ws-palette-box"><input id="ws-palette-input" class="hf-input" placeholder="Search tokens or type a command…" aria-label="Command palette" autocomplete="off"><div class="ws-list" id="ws-palette-list"></div></div></div><div class="ws-viewer" id="ws-viewer" hidden><div class="ws-viewer-box" role="dialog" aria-modal="true" aria-label="Gigi view"><header class="ws-viewer-head"><div><small>GIGI'S READ</small><strong id="ws-viewer-title">View</strong></div><button class="hf-btn icon sm" id="ws-viewer-close" type="button" aria-label="Close view">×</button></header><div class="ws-viewer-body" id="ws-viewer-body"></div></div></div>`;
  const tutorial = mk('div', 'ws-tutorial'); tutorial.id = 'ws-tutorial'; tutorial.hidden = true;
  tutorial.innerHTML = `<div class="ws-tutorial-box" role="dialog" aria-modal="true" aria-labelledby="ws-tutorial-title"><header class="ws-tutorial-head"><div><small>TUTORIAL</small><strong id="ws-tutorial-title"></strong></div><button id="ws-tutorial-close" class="hf-btn icon sm" type="button" aria-label="Close tutorial">×</button></header><div class="ws-tutorial-langs" id="ws-tutorial-langs"></div><div class="ws-tutorial-body" id="ws-tutorial-body"></div></div>`;
  ws.append(tutorial);
  (document.querySelector('main') || document.body).append(ws);
  const content = ws.querySelector('#ws-content'); const tabs = ws.querySelector('#ws-tabs'); const results = ws.querySelector('#ws-search-results'); const split = ws.querySelector('#ws-split'); const chat = ws.querySelector('#ws-chat');
  const palette = ws.querySelector('#ws-palette'); const paletteInput = ws.querySelector('#ws-palette-input'); const paletteList = ws.querySelector('#ws-palette-list');
  const viewer = ws.querySelector('#ws-viewer'); const viewerBody = ws.querySelector('#ws-viewer-body'); const viewerTitle = ws.querySelector('#ws-viewer-title');
  ws.querySelector('.ws-search-ico').append(ic('discover', 14));
  ws.querySelector('#ws-chat-collapse').append(ic('chevron', 14));

  for (const [id, label, iconName] of SECTIONS) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.ws = id; b.setAttribute('role', 'tab'); if (id === section) b.setAttribute('aria-selected', 'true'); b.append(ic(iconName, 15), mk('span', '', label)); if (id === 'portfolio') b.append(mk('span', 'hf-badge', '0')); if (id === 'alerts') b.append(Object.assign(mk('span', 'hf-badge', '0'), { hidden: true })); if (id === 'research') b.append(Object.assign(mk('span', 'hf-badge', '0'), { hidden: true })); b.onclick = () => { section = id; results.hidden = true; savePrefs(); draw(); }; b.onkeydown = e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); const list = [...tabs.querySelectorAll('.hf-tab')]; const i = list.indexOf(e.currentTarget); const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]; next.click(); next.focus(); }; tabs.append(b); }

  const btn = (label, opts = {}, fn) => { const b = mk('button', `hf-btn${opts.variant ? ' ' + opts.variant : ''}${opts.sm ? ' sm' : ''}`); b.type = 'button'; if (opts.icon) b.append(ic(opts.icon, opts.sm ? 14 : 15)); if (label) b.append(mk('span', '', label)); b.onclick = fn; b.disabled = opts.disabled === true; if (opts.title) b.title = opts.title; return b; };
  const ibtn = (iconName, tip, fn) => { const b = mk('button', 'hf-btn icon sm hf-tooltip'); b.type = 'button'; b.append(ic(iconName, 15)); b.setAttribute('aria-label', tip); b.dataset.tip = tip; b.onclick = fn; return b; };
  function panel(title, opts = {}, ...body) { const p = mk('div', `hf-panel${opts.flush ? ' flush' : ''}`); if (title) { const h = mk('header'); h.append(mk('h3', '', title)); if (opts.actions) h.append(...(Array.isArray(opts.actions) ? opts.actions : [opts.actions])); p.append(h); } const b = mk('div', 'hf-body'); b.append(...body); p.append(b); return p; }
  const emptyState = (mark, title, hint) => { const e = mk('div', 'hf-empty'); const m = mk('div', 'hf-empty-mark'); m.append(ic(mark, 22)); e.append(m, mk('strong', '', title), mk('small', '', hint || '')); return e; };
  const skeleton = (rows = 4) => { const box = mk('div', 'ws-list'); for (let i = 0; i < rows; i++) { const s = mk('div', 'hf-skeleton'); s.style.width = `${70 + (i % 3) * 10}%`; box.append(s); } return box; };
  const safeCls = level => `hf-safety-${level || 'unknown'}`;
  const isSnapshot = data => !!data && typeof data === 'object' && typeof data.currentId === 'string';
  const run = fn => async () => { try { const data = await fn(); if (isSnapshot(data)) window.render(data); } catch (error) { window.toast(error.message); } };
  const askGigi = text => { const p = el('prompt'); if (p) { p.value = text; p.focus(); } };

  function selectToken(mint) { chartMint = mint; if (!tokenCache.has(mint)) { tokenCache.set(mint, { loading: true }); call2(window.aurora.walletTokenInfo(mint)).then(info => { tokenCache.set(mint, info); if (open) { if (info.pair?.createdAt && Date.now() - info.pair.createdAt < 2 * 864e5) tradeRange = '1D'; draw(); } }).catch(error => { tokenCache.set(mint, { error: error.message }); if (open) draw(); }); } if (open) draw(); }
  function enterAnimation() { ws.classList.remove('ws-entering'); void ws.offsetWidth; ws.classList.add('ws-entering'); setTimeout(() => ws.classList.remove('ws-entering'), 520); }
  function openWorkspace(animate) { if (open) { if (animate) enterAnimation(); return; } if (typeof view !== 'undefined' && view.agent !== 'gigi') { window.toast('The trading desk is Gigi’s. Switch to Gigi first.'); return; } open = true; ws.hidden = false; const cryptoButton = el('crypto-open'); if (cryptoButton) cryptoButton.hidden = true; const conversation = document.querySelector('.conversation'); if (conversation) el('ws-chat-slot').append(conversation); el('trading-open')?.setAttribute('aria-current', 'page'); if (animate) enterAnimation(); draw(); call2(window.aurora.load()).then(snapshot => { if (open && snapshot && snapshot.wallet && typeof view !== 'undefined') { view.wallet = snapshot.wallet; draw(); } }).catch(() => {}); call2(window.aurora.walletRefresh()).catch(() => {}); }
  function close() { if (!open) return; open = false; ws.hidden = true; palette.hidden = true; viewer.hidden = true; el('trading-open')?.removeAttribute('aria-current'); const cryptoButton = el('crypto-open'); if (cryptoButton) cryptoButton.hidden = (typeof view === 'undefined' || view.agent !== 'gigi'); const conversation = document.querySelector('.conversation'); const mainContent = document.querySelector('.main-content'); if (conversation && mainContent) mainContent.insertBefore(conversation, mainContent.querySelector('.companion')); }

  const seriesOf = (mint, range) => call2(window.aurora.walletSeries(mint, range)).catch(() => []);
  const RANGES = ['1D', '7D', '30D', '3M', '6M', '1Y', 'ALL'];
  function rangeBar(current, onPick) { const bar = mk('div', 'ws-seg ws-ranges'); for (const r of RANGES) { const b = mk('button', r === current ? 'active' : '', r); b.type = 'button'; b.setAttribute('aria-pressed', String(r === current)); b.onclick = () => onPick(r); bar.append(b); } return bar; }
  function trend(points) { if (!points || points.length < 2) return null; const a = points[0].p, b = points[points.length - 1].p; if (!(a > 0)) return null; return { change: (b - a) / a * 100, from: a, to: b }; }
  function sparkline(points, width = 64, height = 18) { const svg = svgEl('svg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', width); svg.setAttribute('height', height); if (!points || points.length < 2) return svg; const vs = points.map(p => p.p); const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1; const poly = svgEl('polyline'); poly.setAttribute('points', points.map((p, i) => `${((i / (points.length - 1)) * width).toFixed(1)},${(height - 1 - ((p.p - min) / span) * (height - 2)).toFixed(1)}`).join(' ')); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1.2'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly); return svg; }
  const compact = v => { const n = Number(v) || 0, a = Math.abs(n); if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`; if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`; if (a >= 1e3) return `${(n / 1e3).toFixed(2)}k`; return a >= 1 ? n.toFixed(2) : n.toPrecision(3); };
  const axisPrice = v => compact(v);
  const fmtTime = (t, span) => { const d = new Date(t); return span <= 2 * 864e5 ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : span <= 120 * 864e5 ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleDateString([], { month: 'short', year: '2-digit' }); };
  const fmtFull = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function drawChart(box, points, height = 260) { box.replaceChildren(); if (!points || points.length < 2) { box.append(mk('div', 'ws-sub', 'No price history yet. Try another range, or a token listed on Binance or CoinGecko.')); return; } const svg = svgEl('svg'); const H = 40; svg.setAttribute('viewBox', `0 0 100 ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img'); svg.style.height = `${height}px`; const vs = points.map(p => p.p); const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1; const line = points.map((p, i) => `${((i / (points.length - 1)) * 100).toFixed(2)},${(H - 4 - ((p.p - min) / span) * (H - 8)).toFixed(2)}`).join(' '); const area = svgEl('polygon'); area.setAttribute('points', `0,${H} ${line} 100,${H}`); area.setAttribute('fill', 'currentColor'); area.setAttribute('opacity', '.09'); svg.append(area); const poly = svgEl('polyline'); poly.setAttribute('points', line); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1.2'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly); const t = trend(points); const last = vs[vs.length - 1]; svg.setAttribute('aria-label', `Price low ${money(min)}, high ${money(max)}, last ${money(last)}${t ? `, ${t.change >= 0 ? 'up' : 'down'} ${Math.abs(t.change).toFixed(2)} percent` : ''}`); box.append(svg); const meta = mk('div', 'ws-chart-meta'); meta.append(mk('span', '', `Low ${money(min)}`), mk('span', '', `High ${money(max)}`), mk('span', '', `Last ${money(last)}`)); if (t) meta.append(mk('span', t.change >= 0 ? 'hf-up' : 'hf-down', `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%`)); box.append(meta); }

  // TradingView-inspired candlesticks: price axis, time axis, volume histogram,
  // a last-price tag and a hover crosshair with an OHLC readout.
  function drawCandles(box, points, height = 340) {
    box.replaceChildren();
    if (!points || points.length < 2) { box.append(mk('div', 'ws-sub', 'No candles yet. Try another range, or a token listed on Binance.')); return; }
    const width = Math.max(360, Math.round(box.getBoundingClientRect().width || box.clientWidth || 720));
    const padL = 6, padR = 62, padT = 12, padB = 22;
    const plotW = Math.max(60, width - padL - padR);
    const hasVol = points.some(p => Number(p.v) > 0);
    const volH = hasVol ? Math.max(26, Math.round((height - padT - padB) * 0.18)) : 0;
    const priceH = (height - padT - padB) - (hasVol ? volH + 8 : 0);
    const lows = points.map(p => p.l ?? p.p), highs = points.map(p => p.h ?? p.p);
    let lo = Math.min(...lows), hi = Math.max(...highs);
    if (!(hi > lo)) hi = lo + (Math.abs(lo) * 0.01 || 1);
    const padding = (hi - lo) * 0.06; lo -= padding; hi += padding;
    const yOf = v => padT + priceH - ((v - lo) / (hi - lo)) * priceH;
    const step = plotW / points.length;
    const bodyW = Math.max(1, Math.min(step * 0.66, 16));
    const span = points[points.length - 1].t - points[0].t;
    const svg = svgEl('svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Candlestick chart, ${points.length} candles, low ${money(lo)}, high ${money(hi)}, last ${money(points[points.length - 1].p)}`);
    for (let i = 0; i <= 4; i++) {
      const price = lo + (hi - lo) * (i / 4), y = yOf(price);
      const line = svgEl('line'); line.setAttribute('x1', padL); line.setAttribute('x2', padL + plotW); line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('stroke', 'var(--line)'); line.setAttribute('stroke-width', '1'); line.setAttribute('vector-effect', 'non-scaling-stroke'); line.setAttribute('opacity', i === 0 || i === 4 ? '.7' : '.4'); svg.append(line);
      const label = svgEl('text'); label.setAttribute('x', width - padR + 8); label.setAttribute('y', y + 3); label.setAttribute('fill', 'var(--faint)'); label.setAttribute('font-size', '10'); label.setAttribute('font-family', 'ui-monospace, Consolas, monospace'); label.textContent = axisPrice(price); svg.append(label);
    }
    const ticks = Math.max(2, Math.min(6, Math.floor(plotW / 120)));
    for (let i = 0; i <= ticks; i++) {
      const x = padL + (plotW * i) / ticks;
      const line = svgEl('line'); line.setAttribute('x1', x); line.setAttribute('x2', x); line.setAttribute('y1', padT); line.setAttribute('y2', height - padB); line.setAttribute('stroke', 'var(--line)'); line.setAttribute('stroke-width', '1'); line.setAttribute('vector-effect', 'non-scaling-stroke'); line.setAttribute('opacity', '.28'); svg.append(line);
      const idx = Math.min(points.length - 1, Math.round((i / ticks) * (points.length - 1)));
      const label = svgEl('text'); label.setAttribute('x', x); label.setAttribute('y', height - padB + 14); label.setAttribute('fill', 'var(--faint)'); label.setAttribute('font-size', '10'); label.setAttribute('text-anchor', i === 0 ? 'start' : i === ticks ? 'end' : 'middle'); label.textContent = fmtTime(points[idx].t, span); svg.append(label);
    }
    if (hasVol) {
      const maxV = Math.max(...points.map(p => Number(p.v) || 0)) || 1, baseY = height - padB;
      for (let i = 0; i < points.length; i++) { const p = points[i], v = Number(p.v) || 0; if (!(v > 0)) continue; const h = (v / maxV) * volH; const rect = svgEl('rect'); rect.setAttribute('x', padL + i * step + (step - bodyW) / 2); rect.setAttribute('width', bodyW); rect.setAttribute('y', baseY - h); rect.setAttribute('height', h); rect.setAttribute('fill', (p.c ?? p.p) >= (p.o ?? p.p) ? 'var(--live)' : 'var(--loss)'); rect.setAttribute('opacity', '.26'); svg.append(rect); }
    }
    for (let i = 0; i < points.length; i++) {
      const p = points[i], o = p.o ?? p.p, c = p.c ?? p.p, h = p.h ?? p.p, l = p.l ?? p.p;
      const color = c >= o ? 'var(--live)' : 'var(--loss)';
      const cx = padL + i * step + step / 2;
      const wick = svgEl('line'); wick.setAttribute('x1', cx); wick.setAttribute('x2', cx); wick.setAttribute('y1', yOf(h)); wick.setAttribute('y2', yOf(l)); wick.setAttribute('stroke', color); wick.setAttribute('stroke-width', '1'); wick.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(wick);
      const yo = yOf(o), yc = yOf(c); const body = svgEl('rect'); body.setAttribute('x', cx - bodyW / 2); body.setAttribute('y', Math.min(yo, yc)); body.setAttribute('width', bodyW); body.setAttribute('height', Math.max(Math.abs(yc - yo), 1)); body.setAttribute('fill', color); body.setAttribute('rx', '1'); svg.append(body);
    }
    const lastClose = points[points.length - 1].p, ly = yOf(lastClose);
    const lastLine = svgEl('line'); lastLine.setAttribute('x1', padL); lastLine.setAttribute('x2', padL + plotW); lastLine.setAttribute('y1', ly); lastLine.setAttribute('y2', ly); lastLine.setAttribute('stroke', 'var(--accent)'); lastLine.setAttribute('stroke-width', '1'); lastLine.setAttribute('stroke-dasharray', '3 3'); lastLine.setAttribute('vector-effect', 'non-scaling-stroke'); lastLine.setAttribute('opacity', '.75'); svg.append(lastLine);
    const tag = svgEl('rect'); tag.setAttribute('x', width - padR + 2); tag.setAttribute('y', ly - 8); tag.setAttribute('width', padR - 6); tag.setAttribute('height', 16); tag.setAttribute('rx', '3'); tag.setAttribute('fill', 'var(--accent)'); svg.append(tag);
    const tagText = svgEl('text'); tagText.setAttribute('x', width - padR + 8); tagText.setAttribute('y', ly + 3); tagText.setAttribute('fill', 'var(--accent-ink)'); tagText.setAttribute('font-size', '10'); tagText.setAttribute('font-family', 'ui-monospace, Consolas, monospace'); tagText.textContent = axisPrice(lastClose); svg.append(tagText);
    const cross = svgEl('g'); cross.setAttribute('opacity', '0'); const cxLine = svgEl('line'), cyLine = svgEl('line'); for (const line of [cxLine, cyLine]) { line.setAttribute('stroke', 'var(--muted)'); line.setAttribute('stroke-width', '1'); line.setAttribute('stroke-dasharray', '3 3'); line.setAttribute('vector-effect', 'non-scaling-stroke'); } cross.append(cxLine, cyLine); svg.append(cross);
    box.append(svg);
    const tip = mk('div', 'ws-candle-tip'); tip.hidden = true; box.append(tip);
    const hide = () => { cross.setAttribute('opacity', '0'); tip.hidden = true; };
    svg.addEventListener('pointermove', event => {
      const rect = svg.getBoundingClientRect(); if (!rect.width) return;
      const xIn = (event.clientX - rect.left) / rect.width * width;
      const idx = Math.max(0, Math.min(points.length - 1, Math.floor((xIn - padL) / step)));
      const p = points[idx], o = p.o ?? p.p, c = p.c ?? p.p, h = p.h ?? p.p, l = p.l ?? p.p;
      const px = padL + idx * step + step / 2, py = yOf(c);
      cxLine.setAttribute('x1', px); cxLine.setAttribute('x2', px); cxLine.setAttribute('y1', padT); cxLine.setAttribute('y2', height - padB);
      cyLine.setAttribute('x1', padL); cyLine.setAttribute('x2', padL + plotW); cyLine.setAttribute('y1', py); cyLine.setAttribute('y2', py);
      cross.setAttribute('opacity', '1');
      tip.replaceChildren(mk('b', '', fmtFull(p.t)));
      const grid = mk('div', 'ws-tip-grid'); for (const [k, v] of [['O', o], ['H', h], ['L', l], ['C', c]]) grid.append(mk('span', '', k), mk('strong', '', money(v)));
      if (Number(p.v) > 0) grid.append(mk('span', '', 'Vol'), mk('strong', '', compact(p.v)));
      const ch = o > 0 ? (c - o) / o * 100 : 0;
      tip.append(grid, mk('span', ch >= 0 ? 'hf-up' : 'hf-down', `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`));
      tip.hidden = false;
      const brect = box.getBoundingClientRect(), tw = tip.offsetWidth || 150;
      tip.style.left = `${Math.max(4, Math.min(event.clientX - brect.left + 14, brect.width - tw - 4))}px`;
      tip.style.top = `${Math.max(4, event.clientY - brect.top - 12)}px`;
    });
    svg.addEventListener('pointerleave', hide);
    const prevW = box._lastW; box._lastW = width; box._redraw = () => { if (box.isConnected) drawCandles(box, points, height); };
    if (!box._ro && typeof ResizeObserver !== 'undefined') { box._ro = new ResizeObserver(() => { const w = Math.round(box.getBoundingClientRect().width || 0); if (box._lastW && Math.abs(w - box._lastW) > 8 && box._redraw) box._redraw(); }); box._ro.observe(box); }
    void prevW;
  }

  function draw() {
    if (!open) return;
    for (const b of tabs.querySelectorAll('.hf-tab')) b.setAttribute('aria-selected', String(b.dataset.ws === section));
    const isLive = cfg().execution === 'live';
    for (const b of ws.querySelectorAll('#ws-platform button')) b.setAttribute('aria-pressed', String(b.dataset.platform === platform));
    for (const b of ws.querySelectorAll('#ws-seg button')) b.setAttribute('aria-pressed', String((b.dataset.exec === 'live') === isLive));
    ws.querySelector('#ws-seg button[data-exec=live]').classList.toggle('live', isLive);
    const w = wallet(); const signerBot = (w?.vault || []).find(bot => bot.id === cfg().vaultWalletId); el('ws-conn').textContent = !w ? 'Loading…' : signerBot ? `Bot · ${signerBot.label}` : (w.wc?.connected ? `Connected · ${((w.wc.accounts[0] || '').split(':').pop() || '').slice(0, 6)}…` : (cfg().addresses?.length ? `${cfg().addresses.length} watched` : 'Not connected'));
    chat.style.width = `${chatW}px`; split.classList.toggle('collapsed', !chatOpen);
    content.replaceChildren();
    const col = mk('div', 'ws-col');
    const bPortfolio = tabs.querySelector('.hf-tab[data-ws=portfolio] .hf-badge'); const bResearch = tabs.querySelector('.hf-tab[data-ws=research] .hf-badge'); const bWatch = tabs.querySelector('.hf-tab[data-ws=alerts] .hf-badge');
    if (bPortfolio) bPortfolio.textContent = (w?.state?.holdings || []).length;
    if (bWatch) { const unread = ((typeof view !== 'undefined' && view.notifications) || []).filter(item => !item.read).length; bWatch.textContent = unread; bWatch.hidden = !unread; }
    if (bResearch) { const n = (w?.research || []).filter(r => r.status === 'running').length; bResearch.textContent = n; bResearch.hidden = !n; }
    if (!w) { col.append(skeleton(5)); content.append(col); return; }
    const session = w.session;
    if (session && session.state !== 'RUNNING') { const banner = mk('div', 'ws-banner'); banner.append(mk('span', '', `${session.state.replaceAll('_', ' ')}${session.note ? ` · ${session.note}` : ''}`)); const acts = mk('div', 'ws-ctrls'); if (session.needsConfirmation) acts.append(btn('Reconcile', { sm: true }, run(async () => call2(window.aurora.walletSessionReconcile())))); acts.append(btn('Resume', { sm: true }, run(async () => call2(window.aurora.walletSessionResume())))); banner.append(acts); col.append(banner); }
    const discoverLabel = tabs.querySelector('.hf-tab[data-ws=discover] > span:not(.hf-ico)'); if (discoverLabel) discoverLabel.textContent = platform === 'pumpfun' ? 'Pump.fun' : platform === 'xstocks' ? 'xStocks' : 'Discover';
    ({ wallets: drawWallets, people: drawPeople, portfolio: drawPortfolio, trade: drawTrade, discover: drawDiscover, alerts: drawAlerts, research: drawResearch, strategies: drawStrategies, journal: drawJournal })[section](col, w.state);
    content.append(col);
  }

  const tutorialTitle = ws.querySelector('#ws-tutorial-title');
  const tutorialLangs = ws.querySelector('#ws-tutorial-langs');
  const tutorialBody = ws.querySelector('#ws-tutorial-body');
  ws.querySelector('#ws-tutorial-close').onclick = () => closeTutorial();
  tutorial.onclick = event => { if (event.target === tutorial) closeTutorial(); };
  function tutorialLabel() { return (TUTORIALS.ui[tutorialLang] || TUTORIALS.ui.en || {}).button || 'Tutorial'; }
  function tutorialSectionKey() {
    if (section === 'discover') return platform === 'pumpfun' ? 'pumpfun' : platform === 'xstocks' ? 'xstocks' : 'discover';
    return TUTORIALS.sections[section] ? section : 'wallets';
  }
  function syncTutorialButtons() {
    for (const button of ws.querySelectorAll('.ws-tutorial-btn')) {
      const label = tutorialLabel();
      const text = button.querySelector('span:not(.hf-ico)');
      if (text) text.textContent = label;
      button.setAttribute('aria-label', label);
      button.dataset.tip = label;
    }
  }
  function tutorialButton() {
    const button = ibtn('help', tutorialLabel(), () => openTutorial());
    button.classList.add('ws-tutorial-btn');
    return button;
  }
  function renderTutorial() {
    const key = TUTORIALS.sections[tutorialKey] ? tutorialKey : 'wallets';
    const lang = TUTORIALS.sections[key]?.[tutorialLang] ? tutorialLang : 'en';
    const data = TUTORIALS.sections[key]?.[lang] || TUTORIALS.sections[key]?.en;
    const ui = TUTORIALS.ui[lang] || TUTORIALS.ui.en || {};
    const names = TUTORIALS.names[lang] || TUTORIALS.names.en || {};
    tutorialTitle.textContent = names[key] || key;
    tutorialLangs.replaceChildren();
    for (const language of TUTORIALS.languages || []) {
      const button = mk('button', language.id === lang ? 'active' : '', language.short);
      button.type = 'button'; button.title = language.label;
      button.onclick = () => {
        tutorialLang = language.id;
        try { localStorage.setItem('aurora-tutorial-lang', tutorialLang); } catch {}
        syncTutorialButtons();
        renderTutorial();
      };
      tutorialLangs.append(button);
    }
    tutorialBody.replaceChildren();
    if (!data) { tutorialBody.append(emptyState('research', 'Tutorial unavailable', 'This language is not ready yet.')); return; }
    tutorialBody.append(mk('p', 'ws-tutorial-summary', data.summary));
    tutorialBody.append(mk('h4', '', ui.how || 'How it works'));
    const flow = mk('ol', 'ws-tutorial-flow');
    for (const step of data.flow || []) flow.append(mk('li', '', step));
    tutorialBody.append(flow);
    tutorialBody.append(mk('h4', '', ui.controls || 'What the controls do'));
    const actions = mk('ul', 'ws-tutorial-actions');
    for (const action of data.actions || []) actions.append(mk('li', '', action));
    tutorialBody.append(actions);
    const tip = mk('div', 'ws-tutorial-tip');
    tip.append(mk('strong', '', ui.tip || 'Good to know'), mk('p', '', data.tip || ''));
    tutorialBody.append(tip);
  }
  function openTutorial(key = tutorialSectionKey()) {
    tutorialKey = TUTORIALS.sections[key] ? key : 'wallets';
    tutorial.hidden = false;
    renderTutorial();
    ws.querySelector('#ws-tutorial-close').focus();
  }
  function closeTutorial() { tutorial.hidden = true; }
  function head(root, title, sub, actions) { const h = mk('div', 'ws-head'); const left = mk('div'); left.append(mk('h1', 'ws-h1', title), mk('p', 'ws-sub', sub)); h.append(left); const a = mk('div', 'ws-head-actions'); a.append(tutorialButton()); if (actions) a.append(...actions); h.append(a); root.append(h); }
  const metric = (label, value, cls) => { const c = mk('div', 'ws-stat'); c.append(mk('small', '', label)); const b = mk('b', '', value); if (cls) b.className = cls; c.append(b); return c; };
  function listItem(name, sub, value, change, controls, badge) { const item = mk('div', 'ws-item'); const left = mk('div'); left.append(mk('strong', '', name)); if (sub) left.append(mk('small', '', sub)); const right = mk('div', 'ws-ctrls'); if (change !== undefined && change !== null) right.append(mk('small', change >= 0 ? 'hf-up' : 'hf-down', `${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}%`)); if (value !== undefined) right.append(mk('strong', '', value)); if (badge) right.append(badge); if (controls) right.append(controls); item.append(left, right); return item; }
  function field(label, type, options) { const d = mk('div', 'hf-field'); d.append(mk('label', '', label)); if (type === 'select') { const s = mk('select', 'hf-input'); for (const o of options) s.append(mk('option', '', o)); d.append(s); } else { const i = mk('input', 'hf-input'); i.type = type; i.step = 'any'; if (/buy/i.test(label)) i.value = '25'; d.append(i); } return d; }
  const inputOf = d => d.querySelector('input')?.value; const selectOf = d => d.querySelector('select')?.value;
  function checkField(label) { const d = mk('div', 'hf-field ws-check'); const i = mk('input'); i.type = 'checkbox'; d.append(mk('label', '', label), i); return d; }
  const checkedOf = d => !!d.querySelector('input')?.checked;
  function switchField(label, checked, onChange) {
    const wrap = mk('label', 'ws-switch');
    const input = mk('input'); input.type = 'checkbox'; input.checked = checked === true;
    if (onChange) input.onchange = onChange;
    wrap.append(input, mk('span', 'ws-switch-track'), mk('span', 'ws-switch-label', label));
    return wrap;
  }
  function autoCard(iconName, title, description) {
    const card = mk('div', 'ws-auto-card');
    const header = mk('div', 'ws-auto-card-head');
    const ico = mk('span', 'ws-auto-icon'); ico.append(ic(iconName, 15));
    const text = mk('div'); text.append(mk('strong', '', title), mk('small', '', description));
    header.append(ico, text);
    card.append(header);
    return card;
  }

  // ---- alerts ----
  function alertRow(a, s) { const ct = mk('div', 'ws-ctrls'); ct.append(ibtn('delete', 'Remove alert', run(async () => call2(window.aurora.walletAlertRemove(a.id))))); return listItem(`${sym(a.mint, s)} ${a.direction} ${money(a.price)}`, a.triggeredAt ? `fired ${new Date(a.triggeredAt).toLocaleString()}` : 'watching', undefined, undefined, ct, mk('span', `hf-badge${a.triggeredAt ? ' ok' : ' muted'}`, a.triggeredAt ? 'fired' : 'armed')); }
  function alertsBody(s) { const alerts = s?.alerts || []; if (!alerts.length) return emptyState('alert', 'No alerts yet', 'Open a token in Trade and set a price alert, or ask Gigi.'); const list = mk('div', 'ws-list'); for (const a of alerts) list.append(alertRow(a, s)); return list; }
  function alertForm(mint, symbol, s) {
    if (!mint) return emptyState('alert', 'Pick a token', 'Open a token in Trade to set an alert.');
    const dir = field('Direction', 'select', ['above', 'below']);
    const price = field('Trigger price (USD)', 'number');
    const add = btn('Add alert', { sm: true, variant: 'primary' }, run(async () => {
      const value = Number(inputOf(price));
      if (!(value > 0)) { window.toast('Enter a trigger price.'); return null; }
      const data = await call2(window.aurora.walletAlertAdd({ mint, direction: selectOf(dir), price: value }));
      window.toast(`Alert set: ${(symbol || short(mint)).trim()} ${selectOf(dir)} ${money(value)}.`);
      return data;
    }));
    const form = mk('div', 'ws-form'); form.append(dir, price, add);
    const list = mk('div', 'ws-list'); for (const a of (s?.alerts || []).filter(item => item.mint === mint)) list.append(alertRow(a, s));
    if (list.childElementCount) form.append(list);
    return form;
  }
  const SIGNAL_PRESETS = [
    { id: 'price', kicker: 'PRICE', title: 'Price alert', desc: 'Tell me when the price crosses a level.', condition: { metric: 'price', op: 'above', value: 0, windowMinutes: 0 } },
    { id: 'dip', kicker: 'DRAWDOWN', title: '24h dip', desc: 'Tell me when the token is down hard on the day.', condition: { metric: 'change24h', op: 'below', value: -20, windowMinutes: 0 } },
    { id: 'spike', kicker: 'MOMENTUM', title: '1h spike', desc: 'Tell me when the last hour accelerates.', condition: { metric: 'change', op: 'above', value: 10, windowMinutes: 60 } },
    { id: 'research', kicker: 'RESEARCH GATE', title: 'Only with research', desc: 'Only fire when a fresh research report exists.', condition: { metric: 'change24h', op: 'below', value: -15, windowMinutes: 0 }, requireResearch: true },
    { id: 'custom', kicker: 'YOUR RULE', title: 'Start from scratch', desc: 'Build a custom condition.', condition: { metric: 'change24h', op: 'below', value: -10, windowMinutes: 0 } }
  ];
  function startSignalComposer(presetId = 'custom', existing = null) {
    const preset = SIGNAL_PRESETS.find(item => item.id === presetId) || SIGNAL_PRESETS[SIGNAL_PRESETS.length - 1];
    const fallback = chartMint || (state().holdings || [])[0]?.mint || (state().markets || [])[0]?.mint || '';
    signalEditingId = existing?.id || '';
    signalPreset = existing ? 'custom' : presetId;
    signalDraft = existing ? {
      name: existing.name || 'Signal', mint: existing.mint || '', symbol: existing.symbol || '',
      condition: { ...existing.condition }, action: existing.action === 'paper-buy' ? 'paper-buy' : 'notify',
      usd: Number(existing.usd) || 25, cooldownSec: Number(existing.cooldownSec) || 3600, requireResearch: existing.requireResearch === true
    } : {
      name: preset.title, mint: fallback, symbol: sym(fallback, state()),
      condition: { ...preset.condition }, action: 'notify', usd: 25, cooldownSec: 3600,
      requireResearch: preset.requireResearch === true
    };
    signalComposerOpen = true; draw();
  }
  function closeSignalComposer() { signalComposerOpen = false; signalDraft = null; signalEditingId = ''; draw(); }
  function signalForm(s) {
    if (!signalComposerOpen || !signalDraft) {
      const presets = mk('div', 'ws-signal-presets');
      for (const preset of SIGNAL_PRESETS) {
        const card = mk('button', 'ws-strategy-template ws-signal-preset' + (signalPreset === preset.id ? ' active' : ''));
        card.type = 'button';
        card.append(mk('span', 'ws-strategy-kicker', preset.kicker), mk('strong', '', preset.title), mk('p', '', preset.desc), mk('small', '', `${strategyConditionText(preset.condition, preset.condition.windowMinutes)}${preset.requireResearch ? ' · needs fresh research' : ''}`));
        card.onclick = () => startSignalComposer(preset.id);
        presets.append(card);
      }
      return presets;
    }
    const draft = signalDraft;
    const name = field('Name', 'text'); name.querySelector('input').value = draft.name;
    const token = field('Token mint', 'text'); token.querySelector('input').value = draft.mint; token.querySelector('input').spellcheck = false;
    const metric = field('Metric', 'select', ['price', 'change24h', 'change']);
    metric.querySelector('select').value = draft.condition.metric;
    const op = field('Operator', 'select', ['above', 'below', 'crossAbove', 'crossBelow']);
    op.querySelector('select').value = draft.condition.op;
    const value = field('Value', 'number'); value.querySelector('input').value = String(draft.condition.value ?? '');
    const windowField = field('Window for change', 'select', ['15m', '1h', '4h', '24h']); const windowValues = [15, 60, 240, 1440]; [...windowField.querySelectorAll('option')].forEach((option, index) => { option.value = String(windowValues[index]); }); windowField.querySelector('select').value = String(draft.condition.windowMinutes || 60); windowField.hidden = draft.condition.metric !== 'change';
    const action = field('Action', 'select', ['notify', 'paper-buy']); action.querySelector('select').value = draft.action;
    const usd = field('Paper buy USD', 'number'); usd.querySelector('input').value = String(draft.usd || 25); usd.hidden = draft.action !== 'paper-buy';
    const cooldown = field('Cooldown (min)', 'number'); cooldown.querySelector('input').value = String(Math.round((draft.cooldownSec || 3600) / 60));
    const gate = checkField('Require fresh research'); gate.querySelector('input').checked = draft.requireResearch === true;
    const preview = mk('p', 'ws-strategy-preview');
    const refresh = () => {
      draft.name = inputOf(name) || 'Signal'; draft.mint = inputOf(token).trim(); draft.symbol = sym(draft.mint, s);
      draft.condition = { metric: selectOf(metric), op: selectOf(op), value: Number(inputOf(value)), windowMinutes: selectOf(metric) === 'change' ? Number(selectOf(windowField)) || 60 : 0 };
      draft.action = selectOf(action); draft.usd = Number(inputOf(usd)) || 25; draft.cooldownSec = Math.round((Number(inputOf(cooldown)) || 60) * 60); draft.requireResearch = checkedOf(gate);
      windowField.hidden = draft.condition.metric !== 'change'; usd.hidden = draft.action !== 'paper-buy';
      preview.textContent = `${draft.action === 'paper-buy' ? `Paper buy ${money(draft.usd)} when` : 'Notify me when'} ${strategyConditionText(draft.condition, draft.condition.windowMinutes)}${draft.requireResearch ? ', only with fresh research' : ''}.`;
    };
    for (const input of [name, token, value, usd, cooldown]) input.querySelector('input').oninput = refresh;
    for (const select of [metric, op, windowField, action]) select.querySelector('select').onchange = refresh;
    gate.querySelector('input').onchange = refresh;
    refresh();
    const save = btn(signalEditingId ? 'Save signal' : 'Create signal', { sm: true, variant: 'primary', icon: 'alert' }, run(async () => {
      refresh();
      if (!draft.mint) throw Error('Enter a token mint.');
      const data = await call2(window.aurora.walletSignalSave({ ...(signalEditingId ? { id: signalEditingId } : {}), name: draft.name, mint: draft.mint, symbol: draft.symbol, condition: draft.condition, action: draft.action, usd: draft.usd, cooldownSec: draft.cooldownSec, requireResearch: draft.requireResearch }));
      window.toast(signalEditingId ? 'Signal updated.' : 'Signal created.');
      signalComposerOpen = false; signalDraft = null; signalEditingId = '';
      return data;
    }));
    const cancel = btn('Cancel', { sm: true, variant: 'ghost' }, closeSignalComposer);
    const form = mk('div', 'ws-form ws-signal-form'); form.append(name, token, metric, op, value, windowField, action, usd, cooldown, gate);
    const actions = mk('div', 'ws-form-actions'); actions.append(cancel, save); form.append(actions);
    return panel(signalEditingId ? 'Edit signal' : 'Build a signal', {}, form, preview);
  }
  function signalCard(sg) {
    const card = mk('div', `ws-strategy-card ws-signal-card${sg.enabled ? ' active' : ''}`);
    const head = mk('div', 'ws-strategy-card-head');
    const title = mk('div', 'ws-strategy-card-title');
    title.append(mk('strong', '', sg.name), mk('small', '', `${sg.symbol || short(sg.mint)} · ${sg.enabled ? 'watching' : 'paused'}`));
    head.append(title, mk('span', `hf-badge${sg.enabled ? ' ok' : ' muted'}`, sg.action === 'paper-buy' ? 'paper buy' : 'notify'));
    const rule = mk('p', 'ws-strategy-rule', `${sg.action === 'paper-buy' ? `Buy ${money(sg.usd)} when` : 'Notify when'} ${strategyConditionText(sg.condition, sg.condition.windowMinutes)}.`);
    const chips = mk('div', 'ws-strategy-chips');
    chips.append(mk('span', 'ws-strategy-chip', `Cooldown ${strategyCooldown(sg.cooldownSec)}`));
    if (sg.requireResearch) chips.append(mk('span', 'ws-strategy-chip', 'Fresh research required'));
    if (sg.lastTriggeredAt) chips.append(mk('span', 'ws-strategy-chip', `Last ${ageLabel(sg.lastTriggeredAt)} ago`));
    const actions = mk('div', 'ws-strategy-card-actions');
    actions.append(btn('Edit', { sm: true, variant: 'ghost', icon: 'alert' }, () => startSignalComposer('custom', sg)));
    actions.append(btn(sg.enabled ? 'Pause' : 'Enable', { sm: true, variant: sg.enabled ? 'ghost' : 'primary', icon: sg.enabled ? 'pause' : 'play' }, run(async () => call2(window.aurora.walletSignalToggle(sg.id, !sg.enabled)))));
    actions.append(ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletSignalRemove(sg.id)))));
    card.append(head, rule, chips, actions);
    if (sg.lastDetail) card.append(mk('p', 'ws-strategy-last', `Last: ${sg.lastDetail}`));
    return card;
  }
  function signalListBody() {
    const sigs = wallet()?.signals || [];
    if (!sigs.length) return emptyState('alert', 'No signals yet', 'Pick a preset above, or ask Gigi: “ping me when SOL drops 20%.”');
    const grid = mk('div', 'ws-strategy-grid ws-signal-grid');
    for (const sg of sigs) grid.append(signalCard(sg));
    return grid;
  }
  // Live swap with an explicit confirmation showing decoded amounts before signing.
  async function executeLive({ mint, side, amountUi, usd, symbol }) {
    const value = Number(amountUi);
    if (!(value > 0)) throw Error('Enter an amount.');
    const preview = await call2(window.aurora.walletSwapPreview({ mint, amountUi: value, side, slippageBps: 50 }));
    const sim = preview.simulation?.ok ? 'simulation ok' : `simulation failed${preview.simulation?.error ? `: ${preview.simulation.error}` : ''}`;
    const readiness = preview.readiness;
    const walletLine = readiness ? `${readiness.signerType === 'vault' ? 'Bot wallet' : 'Connected wallet'} ${amount(readiness.balanceSol)} SOL · RPC ${readiness.rpcOk ? 'ok' : 'unreachable'}` : 'Wallet not checked';
    const detail = side === 'buy' ? `Buy ≈${amount(value)} ${(symbol || short(mint)).trim()} for ${money(usd)}` : `Sell ${amount(value)} ${(symbol || short(mint)).trim()}`;
    if (!window.confirm(`${detail}\n${walletLine}\nMin out ${preview.summary.minimumOut} · impact ${Number(preview.summary.priceImpactPct || 0).toFixed(2)}% · ${sim}\n\nSign this live transaction?`)) return null;
    const result = await call2(window.aurora.walletSwapExecute({ mint, amountUi: value, side, slippageBps: 50 }));
    window.toast(`Live ${side} ${result.status}${result.signature ? ` · ${result.signature.slice(0, 8)}…` : ''}`);
    return call2(window.aurora.load());
  }

  // ---- wallets ----
  function followForm() {
    const address = field('Wallet address', 'text'); address.querySelector('input').placeholder = 'Paste a Solana address'; address.querySelector('input').spellcheck = false;
    const label = field('Label (optional)', 'text'); label.querySelector('input').placeholder = 'smart money, whale, friend';
    const add = btn('Follow wallet', { variant: 'primary', sm: true, icon: 'plus' }, run(async () => {
      const value = inputOf(address).trim();
      if (!value) throw Error('Paste a Solana address first.');
      const data = await call2(window.aurora.walletFollowAdd({ address: value, label: inputOf(label) }));
      window.toast('Wallet followed. Scan it when you want Gigi to read it.');
      return data;
    }));
    const form = mk('div', 'ws-form ws-followform'); form.append(address, label, add);
    return panel('Follow a wallet', {}, mk('p', 'ws-sub', 'Read-only. Following a wallet never gives Aurora access to its keys or funds.'), form);
  }
  function followSummary(item) {
    const scan = item.scan;
    if (!scan) return 'No scan yet.';
    return `${walletInsightText(scan)}${scan.lastActive ? ` Last active ${new Date(scan.lastActive).toLocaleString()}.` : ''}`;
  }
  function askAboutWallet(item, question) {
    const text = (question || '').trim();
    if (!text) { window.toast('Type a question first.'); return; }
    const prompt = `Followed wallet ${item.label || short(item.address)} (${item.address}). Latest scan: ${followSummary(item)}. Read-only data, no parsed swap history. My question: ${text}`;
    chatOpen = true; savePrefs(); draw();
    call2(window.aurora.send(prompt, [])).then(() => window.toast('Asked Gigi.')).catch(error => window.toast(error.message));
  }
  function copyForm(item) {
    const budget = field('Paper budget (USD)', 'number'); budget.querySelector('input').value = '100';
    const mode = field('Weighting', 'select', ['proportional', 'equal']);
    const count = field('Top tokens', 'select', ['3', '5', '8']);
    const copy = btn('Copy to paper', { variant: 'primary', sm: true, icon: 'paper' }, run(async () => {
      const data = await call2(window.aurora.walletFollowCopy({ id: item.id, budget: Number(inputOf(budget)), mode: selectOf(mode), count: Number(selectOf(count)) }));
      const summary = data.copy || {};
      copyOpen = '';
      if (summary.copied) window.toast(`Copied ${summary.copied} token${summary.copied === 1 ? '' : 's'} · ${money(summary.totalCost)} total.`);
      else window.toast('Nothing copied. Check the scan and paper cash.');
      return data;
    }));
    const cancel = btn('Cancel', { sm: true, variant: 'ghost' }, () => { copyOpen = ''; draw(); });
    const form = mk('div', 'ws-form ws-copyform'); form.append(budget, mode, count);
    const actions = mk('div', 'ws-form-actions'); actions.append(cancel, copy); form.append(actions);
    const wrap = mk('div', 'ws-copyform-wrap');
    wrap.append(mk('p', 'ws-auto-note', `Paper only. Buys the top scanned holdings with up to ${money(paper()?.cash)} paper cash, including the simulated fee. Stablecoins are skipped.`), form);
    return wrap;
  }
  function walletStatus(item) {
    const scan = item.scan || {};
    if (item.lastError) return { label: 'scan failed', cls: ' live', badge: 'error' };
    if (!scan.at) return { label: 'not scanned', cls: ' muted', badge: 'new' };
    return { label: `scanned ${ageLabel(scan.at)} ago`, cls: ' ok', badge: 'scanned' };
  }
  function walletCoverageLabel(value) {
    if (value >= 95) return 'all priced value is in 10 or fewer positions';
    if (value >= 75) return 'concentrated in a few positions';
    if (value >= 40) return 'moderately spread across positions';
    return 'fairly diversified';
  }
  function walletInsightText(scan) {
    const positions = Number(scan.pricedCount) || (scan.holdings || []).length;
    const accounts = Number(scan.tokenCount) || positions;
    const largest = (scan.holdings || [])[0];
    const parts = [`This wallet has ${positions} priced position${positions === 1 ? '' : 's'} worth ${money(scan.total)}.`];
    if (largest) parts.push(`Largest is ${largest.symbol} at ${Math.round((largest.share || 0) * 100)}% of priced value.`);
    const coverage = Number(scan.top10Share || 0) * 100;
    if (coverage > 0) parts.push(`Top-10 coverage is ${coverage.toFixed(1)}% — ${walletCoverageLabel(coverage)}.`);
    if (accounts > positions + 5) parts.push(`${accounts.toLocaleString()} token accounts exist in total, but only ${positions} have a live price; most are likely spam or dust.`);
    return parts.join(' ');
  }
  function walletFact(label, value, detail, detailCls) {
    const fact = mk('div', 'ws-wallet-fact');
    fact.append(mk('small', '', label), mk('strong', '', value));
    if (detail) fact.append(mk('span', detailCls || '', detail));
    return fact;
  }
  function walletHero(scan) {
    const positions = Number(scan.pricedCount) || (scan.holdings || []).length;
    const accounts = Number(scan.tokenCount) || positions;
    const coverage = Number(scan.top10Share || 0) * 100;
    const change = Number(scan.change24h || 0);
    const hero = mk('div', 'ws-wallet-hero');
    hero.append(
      walletFact('Priced value', scan.total >= 1e6 ? `$${compact(scan.total)}` : money(scan.total), `24h ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, change >= 0 ? 'hf-up' : 'hf-down'),
      walletFact('Priced positions', String(positions), `${accounts.toLocaleString()} token account${accounts === 1 ? '' : 's'} in total`),
      walletFact('Top-10 coverage', `${coverage.toFixed(1)}%`, walletCoverageLabel(coverage))
    );
    return hero;
  }
  function walletBrief(scan) {
    const box = mk('div', 'ws-wallet-brief');
    box.append(mk('p', '', walletInsightText(scan)));
    if (scan.lastActive) box.append(mk('small', '', `Last on-chain activity ${new Date(scan.lastActive).toLocaleString()}.`));
    return box;
  }
  function walletPositionList(scan, limit = 12) {
    const holdings = (scan.holdings || []).slice(0, limit);
    if (!holdings.length) return emptyState('portfolio', 'No priced holdings', 'The wallet holds tokens with no price yet, or the RPC returned nothing.');
    const list = mk('div', 'ws-position-list');
    for (const h of holdings) {
      const share = Math.max(0, Math.min(100, (Number(h.share) || 0) * 100));
      const change = Number(h.change24h || 0);
      const row = mk('div', 'ws-position');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `Trade ${h.symbol}`);
      const openTrade = () => { section = 'trade'; selectToken(h.mint); savePrefs(); draw(); };
      row.onclick = openTrade;
      row.onkeydown = event => { if (event.target !== row) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTrade(); } };
      const main = mk('div', 'ws-position-main');
      main.append(mk('strong', '', h.symbol), mk('small', '', `${h.name || short(h.mint)} · ${amount(h.amount)} ${h.symbol || ''}`.trim()));
      const value = mk('div', 'ws-position-value');
      value.append(mk('b', '', money(h.value)), mk('small', change >= 0 ? 'hf-up' : 'hf-down', `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`));
      const allocation = mk('div', 'ws-position-alloc');
      const track = mk('span'); const fill = mk('i'); fill.style.width = `${Math.max(share, share > 0 ? 2 : 0)}%`; track.append(fill);
      allocation.append(track, mk('small', '', `${Math.round(share)}%`));
      const actions = mk('div', 'ws-position-actions');
      const act = (iconName, tip, fn) => { const button = ibtn(iconName, tip, event => { event.stopPropagation(); fn(); }); actions.append(button); };
      act('trade', 'Trade', openTrade);
      act('research', 'Research token', () => call2(window.aurora.walletResearchStart({ mint: h.mint, symbol: h.symbol })).catch(error => window.toast(error.message)));
      act('watch', 'Watch token', () => call2(window.aurora.walletWatchlistAdd(h.mint)).then(() => window.toast(`${h.symbol} watched.`)).catch(error => window.toast(error.message)));
      row.append(pumpLogo(h), main, value, allocation, actions);
      list.append(row);
    }
    return list;
  }
  function walletActivityList(scan) {
    const box = mk('div');
    const recent = (scan.recent || []).slice(0, 8);
    if (recent.length) {
      const list = mk('div', 'ws-list ws-followactivity');
      for (const tx of recent) list.append(listItem(short(tx.signature), `${tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'unknown time'}${tx.err ? ' · failed' : ''}`));
      box.append(mk('small', 'ws-section-label', 'Recent signatures'), list);
    }
    const parsed = (scan.parsed || []).slice(0, 10);
    if (parsed.length) {
      const list = mk('div', 'ws-list ws-followactivity');
      for (const tx of parsed) list.append(listItem(tx.description || tx.type || 'Transaction', `${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'unknown time'}${tx.type ? ` · ${tx.type.replaceAll('_', ' ').toLowerCase()}` : ''}`));
      box.append(mk('small', 'ws-section-label', 'Parsed activity'), list);
    }
    if (!recent.length && !parsed.length) box.append(emptyState('wallet', 'No activity yet', 'Scan the wallet to load recent signatures and parsed transactions.'));
    if (!(typeof view !== 'undefined' && view.heliusHasKey)) box.append(mk('p', 'ws-sub ws-note', 'Add a Helius key in Settings, Connections to unlock parsed swap descriptions.'));
    return box;
  }
  function walletAutomationBody(item) {
    const box = mk('div');
    const grid = mk('div', 'ws-auto-grid');

    const alertCard = autoCard('alert', 'Activity alerts', 'Get a ping when this wallet moves.');
    const alertSwitch = switchField(item.watchActivity !== false ? 'On' : 'Off', item.watchActivity !== false, run(async () => {
      const data = await call2(window.aurora.walletFollowUpdate({ id: item.id, watchActivity: alertSwitch.querySelector('input').checked }));
      window.toast(alertSwitch.querySelector('input').checked ? 'Activity alerts on.' : 'Activity alerts off.');
      return data;
    }));
    alertCard.append(alertSwitch, mk('p', 'ws-auto-note', 'Uses the activity watcher. No parsed history is needed for a ping.'));

    const copyCard = autoCard('paper', 'Copy to paper', 'One-off paper basket from the top scanned holdings.');
    if (copyOpen === item.id) copyCard.append(copyForm(item));
    else {
      const copyRow = mk('div', 'ws-wallet-automation-row ws-auto-action');
      const copyCopy = mk('div');
      copyCopy.append(mk('strong', '', 'Copy holdings'), mk('small', '', `Use up to ${money(paper()?.cash)} of paper cash.`));
      copyRow.append(copyCopy, btn('Copy to paper', { sm: true, variant: 'ghost', icon: 'paper' }, () => { walletTab = 'automation'; copyOpen = item.id; draw(); }));
      copyCard.append(copyRow, mk('p', 'ws-auto-note', 'No live orders. Uses the last scan and the current paper cash.'));
    }

    const mirrorCard = autoCard('switch', 'Auto-mirror', 'Mirror new activity into paper automatically.');
    const mirrorOn = switchField('Enabled', item.autoMirror === true);
    const mirrorBudget = field('Budget per event (USD)', 'number'); mirrorBudget.querySelector('input').value = String(item.mirrorBudgetUsd || 25);
    const mirrorMax = field('Max buys per event', 'select', ['1', '2', '3', '5']);
    mirrorMax.querySelector('select').value = String(item.mirrorMaxBuys || 3);
    const saveMirror = btn('Save mirror', { sm: true, variant: 'primary' }, run(async () => {
      const data = await call2(window.aurora.walletFollowUpdate({ id: item.id, autoMirror: checkedOf(mirrorOn), mirrorBudgetUsd: Number(inputOf(mirrorBudget)), mirrorMaxBuys: Number(selectOf(mirrorMax)) }));
      window.toast(checkedOf(mirrorOn) ? 'Auto-mirror on. First check records a baseline.' : 'Auto-mirror off.');
      return data;
    }));
    const mirrorForm = mk('div', 'ws-form ws-mirrorform'); mirrorForm.append(mirrorBudget, mirrorMax);
    const mirrorActions = mk('div', 'ws-form-actions'); mirrorActions.append(saveMirror); mirrorForm.append(mirrorActions);
    mirrorCard.append(mirrorOn, mirrorForm, mk('p', 'ws-auto-note', 'Paper only. Budget is per event and respects paper cash and position caps. Sells need parsed activity.'));

    grid.append(alertCard, copyCard, mirrorCard);
    box.append(grid);

    const status = mk('div', 'ws-auto-status');
    if (item.mirrorError) status.append(mk('p', 'ws-sub ws-note', item.mirrorError));
    else if (item.mirrorLastResult) status.append(mk('p', 'ws-sub ws-note', item.mirrorLastResult));
    else status.append(mk('p', 'ws-sub ws-note', 'No mirror run yet. The first activity check records a baseline.'));
    if (item.activityError) status.append(mk('p', 'ws-sub ws-note', `Activity check: ${item.activityError}`));
    else if (item.lastActivityAt) status.append(mk('p', 'ws-sub ws-note', `Last on-chain activity ${new Date(item.lastActivityAt).toLocaleString()}.`));
    box.append(status);
    return box;
  }
  function walletNotesBody(item) {
    const grid = mk('div', 'ws-notes-grid');
    const noteCard = autoCard('journal', 'Wallet thesis', 'Your own read. Private to this device.');
    noteCard.classList.add('ws-note-card');
    const note = mk('textarea', 'hf-input'); note.rows = 5; note.value = item.note || ''; note.placeholder = 'Why are you watching this wallet? What would make you stop?';
    const saveNote = btn('Save note', { sm: true, variant: 'primary' }, run(async () => { const data = await call2(window.aurora.walletFollowUpdate({ id: item.id, label: item.label, tags: item.tags, note: note.value })); window.toast('Note saved.'); return data; }));
    const noteRow = mk('div', 'ws-follownote'); noteRow.append(note, saveNote); noteCard.append(noteRow);

    const askCard = autoCard('chat', 'Ask Gigi', 'Answers use the latest scan and your note.');
    askCard.classList.add('ws-ask-card');
    const ask = mk('input', 'hf-input'); ask.type = 'text'; ask.placeholder = 'Ask about this wallet';
    const askBtn = btn('Ask', { sm: true, variant: 'primary', icon: 'chat' }, () => askAboutWallet(item, ask.value));
    ask.addEventListener('keydown', event => { if (event.key === 'Enter') askBtn.click(); });
    const askRow = mk('div', 'ws-followask ws-wallet-ask'); askRow.append(ask, askBtn);
    askCard.append(askRow, mk('p', 'ws-auto-note', 'Read-only. Gigi will not move funds or sign for this wallet.'));

    grid.append(noteCard, askCard);
    const box = mk('div'); box.append(grid); return box;
  }
  function followDetail(item, s) {
    const scan = item.scan || {};
    const status = walletStatus(item);
    const card = mk('div', 'hf-panel ws-wallet-detail');
    const heading = mk('div', 'ws-wallet-detail-head');
    const identity = mk('div', 'ws-wallet-identity');
    const avatar = mk('span', 'ws-wallet-avatar', (item.label || item.address || '?').slice(0, 2).toUpperCase());
    avatar.style.background = pulseGradient(item.address || item.label);
    const title = mk('div', 'ws-wallet-detail-title');
    const nameRow = mk('div', 'ws-wallet-name');
    nameRow.append(mk('strong', '', item.label || short(item.address)), mk('span', `hf-badge${status.cls}`, status.badge));
    const meta = mk('div', 'ws-wallet-meta');
    meta.append(mk('small', 'mono', short(item.address)));
    for (const tag of (item.tags || []).slice(0, 3)) meta.append(mk('span', 'ws-wallet-tag', tag));
    title.append(nameRow, meta);
    identity.append(avatar, title);
    const controls = mk('div', 'ws-ctrls');
    controls.append(btn('Scan', { sm: true, variant: 'primary', icon: 'refresh' }, run(async () => { window.toast('Scanning wallet…'); return call2(window.aurora.walletFollowScan(item.id)); })));
    const menu = mk('details', 'ws-wallet-menu');
    const summary = mk('summary', ''); summary.textContent = '⋯'; summary.title = 'Wallet actions'; summary.setAttribute('aria-label', 'Wallet actions'); menu.append(summary);
    const menuPanel = mk('div', 'ws-wallet-menu-panel');
    const menuButton = (label, action, danger = false) => { const b = mk('button', danger ? 'danger' : '', label); b.type = 'button'; b.onclick = action; return b; };
    menuPanel.append(
      menuButton('Brief', run(async () => { window.toast('Gigi is writing the brief…'); return call2(window.aurora.walletFollowBrief(item.id)); })),
      menuButton('Copy to paper', () => { menu.open = false; walletTab = 'automation'; copyOpen = item.id; draw(); }),
      menuButton('Ask Gigi', () => { menu.open = false; walletTab = 'notes'; draw(); setTimeout(() => card.querySelector('.ws-wallet-ask input')?.focus(), 0); }),
      menuButton('Solscan', () => call2(window.aurora.openLink(`https://solscan.io/account/${item.address}`)).catch(error => window.toast(error.message))),
      menuButton('Stop following', run(async () => { followSelected = ''; copyOpen = ''; return call2(window.aurora.walletFollowRemove(item.id)); }), true)
    );
    menu.append(menuPanel);
    controls.append(menu);
    heading.append(identity, mk('span', 'ws-top-spacer'), controls);
    const tabs = mk('div', 'ws-wallet-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Wallet details');
    for (const [id, label] of [['overview', 'Overview'], ['holdings', 'Holdings'], ['activity', 'Activity'], ['automation', 'Automation'], ['notes', 'Notes']]) {
      const b = mk('button', walletTab === id ? 'active' : '', label); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(walletTab === id));
      b.onclick = () => { walletTab = id; draw(); }; tabs.append(b);
    }
    const body = mk('div', 'ws-wallet-tabbody');
    if (walletTab === 'overview') {
      if (scan.at) {
        body.append(walletHero(scan));
        body.append(walletBrief(scan));
        if ((scan.holdings || []).length) body.append(panel('Top positions', { actions: btn('All holdings', { sm: true, variant: 'ghost', icon: 'portfolio' }, () => { walletTab = 'holdings'; draw(); }) }, walletPositionList(scan, 6)));
        const recent = (scan.recent || []).slice(0, 3);
        if (recent.length) { const list = mk('div', 'ws-list ws-followactivity'); for (const tx of recent) list.append(listItem(short(tx.signature), tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'unknown time')); body.append(panel('Latest activity', {}, list)); }
        if ((scan.unpriced || []).length) body.append(mk('p', 'ws-sub ws-note', `${scan.unpriced.length} unpriced token${scan.unpriced.length === 1 ? '' : 's'} not shown: ${scan.unpriced.slice(0, 6).map(t => t.name || t.symbol).join(', ')}.`));
      } else body.append(emptyState('wallet', 'No scan yet', 'Choose Scan to read holdings and recent activity, or ask Gigi to brief this wallet.'));
    } else if (walletTab === 'holdings') {
      if (scan.at) {
        body.append(walletPositionList(scan, 12));
        if ((scan.unpriced || []).length) body.append(mk('p', 'ws-sub ws-note', `${scan.unpriced.length} unpriced token${scan.unpriced.length === 1 ? '' : 's'} not shown: ${scan.unpriced.slice(0, 6).map(t => t.name || t.symbol).join(', ')}.`));
      } else body.append(emptyState('wallet', 'No holdings yet', 'Scan the wallet first.'));
    } else if (walletTab === 'activity') {
      body.append(walletActivityList(scan));
    } else if (walletTab === 'automation') {
      body.append(walletAutomationBody(item));
    } else {
      body.append(walletNotesBody(item));
    }
    card.append(heading, tabs, body);
    return card;
  }
  const currentScanJob = () => (typeof view !== 'undefined' && view.scanJob) || null;
  async function scanAllFollowed() {
    if (currentScanJob()?.running) return;
    try {
      const data = await call2(window.aurora.walletFollowScanAll());
      if (isSnapshot(data)) window.render(data);
    } catch (error) { window.toast(error.message); }
  }
  function scanJobPanel(job) {
    const wrap = mk('div', 'ws-scanjob');
    const top = mk('div', 'ws-scanjob-top');
    top.append(mk('strong', '', `Scanning ${job.done} of ${job.total}`), mk('small', '', job.current ? `Reading ${job.current}` : 'Finishing…'));
    const track = mk('div', 'ws-progress'); const fill = mk('i'); fill.style.width = `${job.total ? Math.round(job.done / job.total * 100) : 0}%`; track.append(fill);
    wrap.append(top, track); return wrap;
  }
  function comparePanel(followed) {
    const scans = followed.filter(item => item.scan);
    if (scans.length < 2) return panel('Compare', {}, emptyState('wallet', 'Scan at least two wallets', 'Compare shows which tokens appear across the wallets you follow.'));
    const tokens = new Map();
    for (const item of scans) {
      for (const holding of item.scan.holdings || []) {
        const entry = tokens.get(holding.mint) || { mint: holding.mint, symbol: holding.symbol, wallets: [], value: 0 };
        entry.wallets.push(item.label || short(item.address));
        entry.value += holding.value || 0;
        tokens.set(holding.mint, entry);
      }
    }
    const shared = [...tokens.values()].filter(entry => entry.wallets.length >= 2).sort((a, b) => b.wallets.length - a.wallets.length || b.value - a.value).slice(0, 20);
    const sets = scans.map(item => new Set((item.scan.holdings || []).slice(0, 10).map(holding => holding.mint)));
    const union = new Set(sets.flatMap(set => [...set]));
    const common = sets.length ? [...sets[0]].filter(mint => sets.every(set => set.has(mint))) : [];
    const stats = mk('div', 'ws-statbar');
    stats.append(metric('Compared', String(scans.length)), metric('Shared tokens', String(shared.length)), metric('Overlap', `${union.size ? (common.length / union.size * 100).toFixed(0) : 0}%`));
    const body = mk('div'); body.append(stats);
    if (shared.length) {
      const table = mk('table', 'hf-table ws-compare-table');
      const thead = mk('thead'); const htr = mk('tr'); for (const [label, n] of [['Token', false], ['Wallets', true], ['Combined value', true], ['Held by', false]]) htr.append(mk('th', n ? 'num' : '', label)); thead.append(htr); table.append(thead);
      const tb = mk('tbody');
      for (const entry of shared) { const tr = mk('tr'); tr.append(mk('td', 'ws-sym', entry.symbol || short(entry.mint)), mk('td', 'num', String(entry.wallets.length)), mk('td', 'num', money(entry.value)), mk('td', 'ws-compare-owners', entry.wallets.join(', '))); tb.append(tr); }
      table.append(tb); const wrap = mk('div', 'ws-table-scroll'); wrap.append(table); body.append(wrap);
    } else body.append(mk('p', 'ws-sub', 'No token appears in more than one scanned wallet yet.'));
    const per = mk('div', 'ws-list');
    for (const item of scans) { const top = (item.scan.holdings || []).slice(0, 5).map(h => h.symbol).join(', '); per.append(listItem(item.label || short(item.address), top || 'no priced holdings', money(item.scan.total))); }
    body.append(mk('small', 'ws-section-label', 'Top holdings per wallet'), per);
    return panel('Compare', {}, body);
  }
  function drawWallets(root, s) {
    const followed = wallet()?.followed || [];
    const actions = [];
    const scanJob = currentScanJob();
    const scanning = scanJob?.running === true;
    if (followed.length) actions.push(btn(scanning ? `Scanning ${scanJob.done}/${scanJob.total}…` : 'Scan all', { sm: true, variant: 'ghost', icon: 'refresh', disabled: scanning }, scanAllFollowed));
    if (!followed.length) actions.push(btn(walletAddOpen ? 'Close add' : 'Add wallet', { sm: true, variant: 'primary', icon: 'plus' }, () => { walletAddOpen = !walletAddOpen; draw(); }));
    head(root, 'Wallets', 'Follow wallets you want to learn from. Gigi scans them read-only, briefs you on behavior, and answers questions about their tokens.', actions);
    if (scanning) root.append(scanJobPanel(scanJob));
    if (walletAddOpen || !followed.length) root.append(followForm());
    if (!followed.length) { root.append(panel('Following', {}, emptyState('wallet', 'No followed wallets yet', 'Paste an address above. Good candidates are wallets whose trades you already respect.'))); return; }
    const selected = followed.find(item => item.id === followSelected) || followed[0];
    const layout = mk('div', 'ws-wallets-layout');
    const sidebar = mk('div', 'ws-wallet-sidebar');
    const sideHead = mk('div', 'ws-wallet-sidebar-head');
    sideHead.append(mk('strong', '', `Wallets · ${followed.length}`), mk('span', 'ws-top-spacer'));
    const sideActions = mk('div', 'ws-ctrls');
    if (followed.length >= 2) sideActions.append(btn(compareWallets ? 'Close compare' : 'Compare', { sm: true, variant: 'ghost', icon: 'chart' }, () => { compareWallets = !compareWallets; draw(); }));
    const addWallet = ibtn('plus', walletAddOpen ? 'Close add wallet' : 'Add wallet', () => { walletAddOpen = !walletAddOpen; draw(); });
    addWallet.classList.toggle('active', walletAddOpen);
    sideActions.append(addWallet);
    sideHead.append(sideActions);
    const search = mk('input', 'hf-input ws-wallet-search'); search.type = 'search'; search.placeholder = 'Filter wallets'; search.value = walletQuery;
    const list = mk('div', 'ws-wallet-list');
    function renderWalletRows() {
      const q = walletQuery.trim().toLowerCase();
      const visible = followed.filter(item => !q || `${item.label || ''} ${item.address}`.toLowerCase().includes(q));
      list.replaceChildren();
      if (!visible.length) { list.append(mk('p', 'ws-sub', 'No wallets match.')); return; }
      for (const item of visible) {
        const scan = item.scan || {};
        const status = walletStatus(item);
        const row = mk('button', 'ws-wallet-row' + (item.id === selected.id && !compareWallets ? ' selected' : '')); row.type = 'button';
        row.onclick = () => { followSelected = item.id; walletTab = 'overview'; compareWallets = false; draw(); };
        const dot = mk('span', `ws-wallet-dot ${status.cls.trim()}`);
        const main = mk('span', 'ws-wallet-rowmain');
        main.append(mk('strong', '', item.label || short(item.address)), mk('small', '', `${short(item.address)} · ${status.label}`));
        const value = mk('span', 'ws-wallet-value');
        if (scan.at) value.append(mk('b', '', scan.total >= 1e6 ? `$${compact(scan.total)}` : money(scan.total)), mk('small', (scan.change24h || 0) >= 0 ? 'hf-up' : 'hf-down', `${(scan.change24h || 0) >= 0 ? '+' : ''}${Number(scan.change24h || 0).toFixed(2)}%`));
        else value.append(mk('small', 'ws-sub', '—'));
        row.append(dot, main, value); list.append(row);
      }
    }
    search.oninput = () => { walletQuery = search.value; renderWalletRows(); };
    sidebar.append(sideHead, search, list);
    renderWalletRows();
    layout.append(sidebar);
    if (compareWallets) layout.append(comparePanel(followed));
    else layout.append(followDetail(selected, s));
    root.append(layout);
  }
  // Simple bar chart for `bar` view specs (line/area use drawChart).
  function drawBars(box, points, height = 260) {
    box.replaceChildren();
    if (!points || points.length < 2) { box.append(mk('div', 'ws-sub', 'No data yet. Try another range or token.')); return; }
    const width = Math.max(200, Math.round(box.getBoundingClientRect().width || 600)), H = height, padB = 6, padT = 6;
    const svg = svgEl('svg'); svg.setAttribute('viewBox', `0 0 ${width} ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img'); svg.style.height = `${height}px`;
    const vs = points.map(p => p.p); const max = Math.max(...vs) || 1, min = Math.min(0, Math.min(...vs));
    const step = width / points.length, w = Math.max(1, step * 0.68);
    for (let i = 0; i < points.length; i++) { const h = ((points[i].p - min) / (max - min || 1)) * (H - padT - padB); const r = svgEl('rect'); r.setAttribute('x', i * step + (step - w) / 2); r.setAttribute('width', w); r.setAttribute('y', H - padB - h); r.setAttribute('height', Math.max(h, 0.5)); r.setAttribute('fill', 'var(--accent)'); r.setAttribute('rx', '1'); svg.append(r); }
    box.append(svg);
    const t = trend(points); const meta = mk('div', 'ws-chart-meta'); meta.append(mk('span', '', `Low ${money(Math.min(...vs))}`), mk('span', '', `High ${money(max)}`), mk('span', '', `Last ${money(vs[vs.length - 1])}`)); if (t) meta.append(mk('span', t.change >= 0 ? 'hf-up' : 'hf-down', `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%`)); box.append(meta);
  }
  function renderView(v, drawer = false) {
    const layout = v.layout === 'full' ? 'full' : 'half';
    const card = mk('div', `ws-view ${layout}`);
    const headr = mk('div', 'ws-view-head'); const ico = mk('div', 'ws-view-ico'); ico.append(ic(v.type === 'holders' ? 'holders' : v.type === 'thesis' ? 'strategies' : v.type === 'table' ? 'journal' : 'chart', 16)); const t = mk('div', 'ws-view-title'); t.append(mk('strong', '', v.title || 'View'), mk('small', '', v.subtitle || '')); const actions = mk('div', 'ws-ctrls');
    if (!drawer) {
      if (!v._active) actions.append(ibtn('pin', 'Pin view', run(async () => call2(window.aurora.walletViewPin(v)))));
      else actions.append(ibtn('watch', 'Pin view', run(async () => call2(window.aurora.walletViewPin(v)))));
      actions.append(ibtn('delete', 'Remove', run(async () => { await call2(window.aurora.walletViewRemove(v.id)); draw(); })));
    }
    headr.append(ico, t, mk('span', 'ws-top-spacer'), actions);
    const body = mk('div', 'ws-view-body');
    if (drawer) card.append(body); else card.append(headr, body);
    if (v.type === 'line' || v.type === 'area' || v.type === 'bar') {
      if (v.source.kind === 'portfolio') {
        const c = mk('div', 'ws-chart'); body.append(c);
        const range = v.source.range || pfRange;
        const load = () => call2(window.aurora.walletPortfolioSeries(range)).then(result => { const res = Array.isArray(result) ? { points: result } : (result || {}); if (v.type === 'bar') drawBars(c, res.points || [], 260); else drawChart(c, res.points || [], 260); if (res.holdings && res.covered < res.holdings) body.append(mk('p', 'ws-sub', `Chart covers ${res.covered} of ${res.holdings} priced holdings.`)); }).catch(() => drawChart(c, [], 260));
        load();
      } else if (v.source.mint) { const c = mk('div', 'ws-chart'); body.append(c); const render = points => { if (v.type === 'bar') drawBars(c, points, 260); else drawChart(c, points, 260); }; seriesOf(v.source.mint).then(points => { render(points); if (!points || points.length < 2) body.append(btn('Retry', { sm: true, variant: 'ghost', icon: 'refresh' }, run(async () => { c.replaceChildren(); render(await seriesOf(v.source.mint)); }))); }); }
      else body.append(emptyState('chart', 'No data', 'Give this view a token mint.'));
    }
    else if (v.type === 'holders') { body.append(holdersBody(v.source.mint)); }
    else if (v.type === 'metrics') { body.append(metricsBody(v)); }
    else if (v.type === 'table' || v.type === 'list') { body.append(rowsBody(v.source.rows, v.type)); }
    else if (v.type === 'thesis') { const t2 = (wallet()?.theses || []).find(x => x.id === (v.source.data?.id)) || (wallet()?.theses || [])[(wallet()?.theses || []).length - 1]; body.append(t2 ? thesisCard(t2) : emptyState('strategies', 'No thesis yet', 'Ask Gigi to build one.')); }
    else { body.append(mk('p', 'ws-sub', v.subtitle || v.title || '')); }
    return card;
  }

  function openViewer(v) {
    if (!v) return;
    viewerTitle.textContent = v.title || 'View';
    viewerBody.replaceChildren(renderView({ ...v, _active: true }, true));
    viewer.hidden = false;
    ws.querySelector('#ws-viewer-close').focus();
  }
  function closeViewer() { viewer.hidden = true; viewerBody.replaceChildren(); }
  function rowsBody(rows, type) { if (!Array.isArray(rows) || !rows.length) return emptyState('journal', 'Nothing to show', 'No rows were provided.'); const list = mk('div', 'ws-list'); const cell = value => (typeof value === 'number' ? num(value) : String(value == null ? '' : value)); for (const row of rows) { if (Array.isArray(row)) list.append(listItem(cell(row[0]), row.slice(1).map(cell).join(' · '))); else if (row && typeof row === 'object') list.append(listItem(String(row.name || row.symbol || row.label || ''), cell(row.value ?? row.sub ?? ''))); } return list; }
  function metricsBody(v) { const data = v.source.data && typeof v.source.data === 'object' ? v.source.data : {}; const wrap = mk('div', 'ws-stats'); for (const [k, val] of Object.entries(data)) wrap.append(metric(keyLabel(k), typeof val === 'number' ? money(val) : String(val))); return Object.keys(data).length ? wrap : emptyState('chart', 'No metrics', 'No metrics were provided.'); }
  const keyLabel = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  function holdersBody(mint) {
    if (!mint) return emptyState('holders', 'No token', 'Give this view a token mint.');
    if (!holdersCache.has(mint)) { holdersCache.set(mint, { loading: true }); call2(window.aurora.walletHolders(mint)).then(info => { holdersCache.set(mint, info); if (open) draw(); }).catch(error => { holdersCache.set(mint, { error: error.message }); if (open) draw(); }); }
    const info = holdersCache.get(mint);
    if (info.loading) return skeleton(4);
    if (info.error) return emptyState('holders', 'Unavailable', info.error);
    const box = mk('div', 'ws-holders');
    if (!info.accounts.length) { box.append(emptyState('holders', 'Holder data unavailable', 'The holder index has no entry for this token yet. It refreshes automatically.')); return box; }
    const stats = mk('div', 'ws-stats ws-holderstats');
    stats.append(metric('Holders', info.holders ? Number(info.holders).toLocaleString() : '—'), metric('Top 10', `${Number(info.top10 || 0).toFixed(1)}%`), metric('Largest', `${Number(info.top1 || 0).toFixed(1)}%`));
    box.append(stats);
    const wrap = mk('div', 'ws-list ws-holderlist');
    for (const a of info.accounts.slice(0, 12)) { const item = mk('div', 'ws-holder'); const left = mk('div', 'ws-holder-id'); left.append(mk('strong', '', `${a.pct.toFixed(2)}%`), mk('small', 'mono', `${a.address.slice(0, 6)}…${a.address.slice(-6)}`)); const bar = mk('span', 'ws-bar'); const fill = mk('i'); fill.style.width = `${Math.min(100, a.pct)}%`; bar.append(fill); item.append(left, bar); wrap.append(item); }
    box.append(wrap);
    box.append(mk('p', 'ws-sub ws-note', 'Largest token accounts, not unique wallets. Pools and market makers are included.'));
    if (Array.isArray(info.risks) && info.risks.length) { const risks = mk('div', 'ws-chips'); for (const risk of info.risks) risks.append(mk('span', 'ws-chip', risk)); box.append(risks); }
    return box;
  }

  function donut(holdings) { const wrap = mk('div', 'ws-donut'); const total = holdings.reduce((a, h) => a + h.value, 0) || 1; const segs = holdings.slice(0, 6); const R = 40, C = 2 * Math.PI * R; const svg = svgEl('svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('role', 'img'); const track = svgEl('circle'); track.setAttribute('cx', '50'); track.setAttribute('cy', '50'); track.setAttribute('r', String(R)); track.setAttribute('fill', 'none'); track.setAttribute('stroke', 'var(--line)'); track.setAttribute('stroke-width', '10'); svg.append(track); let offset = 0; segs.forEach((h, i) => { const len = (h.value / total) * C; const c = svgEl('circle'); c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(R)); c.setAttribute('fill', 'none'); c.setAttribute('stroke', i % 2 ? 'var(--accent-2)' : 'var(--accent)'); c.setAttribute('stroke-opacity', String(Math.max(.28, 1 - i * .14))); c.setAttribute('stroke-width', '10'); c.setAttribute('stroke-dasharray', `${len} ${C - len}`); c.setAttribute('stroke-dashoffset', String(-offset)); c.setAttribute('transform', 'rotate(-90 50 50)'); svg.append(c); offset += len; }); wrap.append(svg); const legend = mk('div', 'ws-legend'); for (const h of segs.slice(0, 5)) { const row = mk('div'); const dot = mk('span', 'ws-legend-dot'); const b = mk('b', '', `${Math.round((h.value / total) * 100)}%`); row.append(dot, mk('span', '', h.symbol), b); legend.append(row); } wrap.append(legend); return wrap; }

  function drawPortfolio(root, s) {
    const holdings = [...(s.holdings || [])]; const markets = s.markets || []; const p = paper();
    const change = Number(s.change24h || 0) * 100;
    head(root, 'Portfolio', 'Live wallet positions, paper trading and the markets you follow.', [btn('Chart', { sm: true, variant: 'ghost', icon: 'chart' }, () => { if (!(s.holdings || []).length) return window.toast('Connect a wallet or add an address first.'); openViewer({ type: 'line', title: 'Portfolio performance', subtitle: `${pfRange} · ${s.holdings.length} priced holdings`, layout: 'full', source: { kind: 'portfolio', range: pfRange } }); })]);
    const stats = mk('div', 'ws-statbar');
    stats.append(metric('Wallet value', money(s.total)), metric('24h change', s.change24h != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—', change >= 0 ? 'hf-up' : 'hf-down'), metric('Holdings', String(holdings.length)), metric('Paper equity', money(p?.equity)), metric('Paper cash', money(p?.cash)));
    root.append(stats);

    if (holdings.length) {
      const perf = mk('div', 'ws-chart');
      root.append(panel('Portfolio performance', { actions: rangeBar(pfRange, r => { pfRange = r; draw(); }) }, perf));
      call2(window.aurora.walletPortfolioSeries(pfRange)).then(result => { const res = Array.isArray(result) ? { points: result } : (result || {}); drawChart(perf, res.points || [], 220); if (res.holdings && res.covered < res.holdings) { const last = (res.points || []).slice(-1)[0]; perf.append(mk('p', 'ws-sub', `Chart covers ${res.covered} of ${res.holdings} priced holdings${last ? ` (${money(last.p)} tracked of ${money(res.total)} total)` : ''}.`)); } }).catch(() => drawChart(perf, [], 220));
      const overview = mk('div', 'ws-overview'); overview.append(panel('Allocation', {}, donut(holdings))); root.append(overview);
    } else {
      const addr = mk('input', 'hf-input'); addr.type = 'text'; addr.placeholder = 'Paste a Solana address'; addr.spellcheck = false; addr.setAttribute('aria-label', 'Solana address');
      const add = btn('Add address', { variant: 'primary', sm: true, icon: 'plus' }, run(async () => { const value = addr.value.trim(); if (!value) { window.toast('Paste a Solana address first.'); return null; } return call2(window.aurora.walletAddressAdd(value)); }));
      addr.addEventListener('keydown', event => { if (event.key === 'Enter') add.click(); });
      const form = mk('div', 'ws-connect-form'); form.append(addr, add, btn('Connect wallet', { sm: true, variant: 'ghost', icon: 'wallet' }, () => el('wallet-open')?.click()));
      const msg = mk('div', 'ws-connect-msg'); msg.append(mk('strong', '', 'No wallet connected'), mk('p', 'ws-sub', 'Add a Solana address to track it, or connect a wallet. The markets below stay live either way.'));
      const body = mk('div', 'hf-body'); body.append(msg, form);
      const card = mk('div', 'hf-panel ws-connect'); card.append(body); root.append(card);
    }

    if (holdings.length) {
      const filterInput = mk('input', 'hf-input'); filterInput.type = 'search'; filterInput.placeholder = 'Filter holdings'; filterInput.value = pfFilter;
      const visible = holdings.filter(h => !pfFilter || `${h.symbol} ${h.mint}`.toLowerCase().includes(pfFilter.toLowerCase()));
      visible.sort((a, b) => { const k = pfSort.key; const av = a[k] ?? 0, bv = b[k] ?? 0; return (av > bv ? 1 : av < bv ? -1 : 0) * pfSort.dir; });
      filterInput.oninput = () => { pfFilter = filterInput.value; draw(); };
      const table = mk('table', 'hf-table'); const cols = [['symbol', 'Token'], ['amount', 'Amount'], ['price', 'Price'], ['value', 'Value'], ['change24h', '24h'], ['__pl', 'Est. P/L'], ['__spark', 'Trend'], ['share', 'Allocation']];
      const thead = mk('thead'); const htr = mk('tr'); for (const [key, label] of cols) { const th = mk('th', ['amount', 'price', 'value', 'change24h', '__pl', '__spark'].includes(key) ? 'num' : '', label); if (key[0] !== '_') { th.style.cursor = 'pointer'; th.onclick = () => { if (pfSort.key === key) pfSort.dir *= -1; else pfSort = { key, dir: -1 }; draw(); }; if (pfSort.key === key) th.textContent = `${label} ${pfSort.dir < 0 ? '↓' : '↑'}`; } htr.append(th); } thead.append(htr); table.append(thead);
      const tb = mk('tbody'); if (!visible.length) { const tr = mk('tr'); const td = mk('td'); td.colSpan = cols.length; td.append(emptyState('portfolio', 'No matches', 'Try another filter.')); tr.append(td); tb.append(tr); }
      for (const h of visible.slice(0, 20)) { const tr = mk('tr'); tr.dataset.mint = h.mint; tr.style.cursor = 'pointer'; tr.onclick = e => { if (e.target.closest('.ws-spark')) return; section = 'trade'; selectToken(h.mint); }; const xinfo = xstockNames.get(h.mint); tr.innerHTML = `<td><span class="ws-sym">${xinfo ? xinfo.symbol : h.symbol}</span>${xinfo ? ' <span class="hf-badge">xStock</span>' : ''}</td><td class="num">${amount(h.amount)}</td><td class="num">${money(h.price)}</td><td class="num">${money(h.value)}</td><td class="num ${(h.change24h || 0) >= 0 ? 'hf-up' : 'hf-down'}">${(h.change24h || 0) >= 0 ? '+' : ''}${(h.change24h || 0).toFixed(2)}%</td><td class="num ws-pl" title="Estimated change since Aurora started watching">—</td><td class="num ws-spark" style="color:var(--accent)"></td><td><span class="ws-bar"><i style="width:${Math.max(2, Math.round((h.share || 0) * 100))}%"></i></span></td>`; tb.append(tr); }
      table.append(tb); root.append(panel('Holdings', { actions: filterInput }, table));
      for (const h of visible.slice(0, 15)) seriesOf(h.mint).then(points => { const row = tb.querySelector(`tr[data-mint="${CSS.escape(h.mint)}"]`); if (!row || !points || points.length < 2) return; row.querySelector('.ws-spark')?.append(sparkline(points)); const vs = points.map(pt => pt.p); const pl = (vs[vs.length - 1] - vs[0]) / vs[0] * 100; const cell = row.querySelector('.ws-pl'); if (cell) { cell.textContent = `${pl >= 0 ? '+' : ''}${pl.toFixed(2)}%`; cell.className = `num ws-pl ${pl >= 0 ? 'hf-up' : 'hf-down'}`; } });
    }

    if (p) { const list = mk('div', 'ws-list'); for (const pos of p.positions) { const badge = mk('span', `hf-badge${(pos.roe || 0) >= 0 ? ' ok' : ' live'}`, `${(pos.roe || 0) >= 0 ? '+' : ''}${Number(pos.roe || 0).toFixed(2)}%`); list.append(listItem(pos.symbol, `${amount(pos.amount)} @ ${money(pos.avgPrice)} · ${(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}${money(pos.unrealizedPnl)}`, money(pos.value), undefined, undefined, badge)); } const actions = mk('div', 'ws-ctrls'); actions.append(btn('Exit & pause', { sm: true }, run(async () => call2(window.aurora.walletSessionPause({ exit: true })))), btn('Reset', { sm: true, variant: 'ghost' }, run(async () => call2(window.aurora.walletPaperReset({}))))); root.append(panel(`Paper · cash ${money(p.cash)} · equity ${money(p.equity)} · P/L ${(p.totalPnl || 0) >= 0 ? '+' : ''}${money(p.totalPnl)}`, { actions }, p.positions.length ? list : emptyState('trade', 'No paper positions', 'Buy in Trade to open one.'))); }
    if ((s.watchlist || []).length) {
      const list = mk('div', 'ws-list');
      for (const it of s.watchlist) {
        const ct = mk('div', 'ws-ctrls');
        ct.append(
          ibtn('alert', 'Set alert', () => { watchMint = it.mint; section = 'alerts'; savePrefs(); draw(); }),
          ibtn('trade', 'Trade', () => { section = 'trade'; selectToken(it.mint); }),
          ibtn('delete', 'Remove', run(async () => call2(window.aurora.walletWatchlistRemove(it.mint))))
        );
        list.append(listItem(it.symbol, 'watched', money(it.price), it.change24h, ct));
      }
      root.append(panel(`Watchlist · ${s.watchlist.length}`, {}, list));
    }
    if (markets.length) root.append(panel('Markets', {}, marketsTable(markets)));
  }

  function marketsTable(markets) {
    const table = mk('table', 'hf-table ws-market-table');
    const thead = mk('thead'); const htr = mk('tr'); for (const [label, num] of [['Token', false], ['Price', true], ['24h', true]]) { const th = mk('th', num ? 'num' : '', label); htr.append(th); } thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    for (const m of markets) {
      const row = mk('tr'); row.style.cursor = 'pointer'; row.onclick = () => { section = 'trade'; selectToken(m.mint); };
      const td1 = mk('td'); td1.append(mk('span', 'ws-sym', m.symbol), mk('small', 'ws-market-name', m.name || short(m.mint)));
      const ch = m.change24h || 0;
      row.append(td1, mk('td', 'num', money(m.price)), mk('td', `num ${ch >= 0 ? 'hf-up' : 'hf-down'}`, `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`));
      tb.append(row);
    }
    table.append(tb); return table;
  }

  function openOrdersBody() {
    const pending = paper()?.pending || [];
    if (!pending.length) return emptyState('journal', 'No open orders', 'Limit and stop orders you place appear here.');
    const list = mk('div', 'ws-list');
    for (const o of pending) { const ct = mk('div', 'ws-ctrls'); ct.append(ibtn('delete', 'Cancel order', run(async () => call2(window.aurora.walletPaperCancel(o.id))))); list.append(listItem(`${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.symbol || short(o.mint)}`, `${o.kind} @ ${money(o.trigger)}${o.usd ? ` · ${money(o.usd)}` : ` · ${o.percent}%`}${o.lastError ? ' · ' + o.lastError : ''}`, undefined, undefined, ct, mk('span', `hf-badge${o.side === 'buy' ? ' ok' : ' live'}`, o.side))); }
    return list;
  }
  function fillsBody(mint) {
    const orders = (paper()?.orders || []).filter(o => o.mint === mint).slice(-10).reverse();
    if (!orders.length) return emptyState('journal', 'No fills yet', 'Paper trades on this token appear here.');
    const list = mk('div', 'ws-list');
    for (const o of orders) list.append(listItem(`${o.side === 'buy' ? 'Bought' : 'Sold'} ${o.symbol || short(o.mint)}`, `${amount(o.amount)} @ ${money(o.priceUsd)} · ${new Date(o.at).toLocaleString()}`, money(o.valueUsd), undefined, undefined, mk('span', `hf-badge${o.side === 'buy' ? ' ok' : ' live'}`, o.side)));
    return list;
  }
  function tradeInfo(mint, symName, s) {
    const bar = mk('div', 'hf-tabs ws-subtabs');
    const box = mk('div', 'ws-subpanel');
    const renderTab = () => {
      for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.t === tradeTab));
      box.replaceChildren(tradeTab === 'fills' ? fillsBody(mint) : tradeTab === 'holders' ? holdersBody(mint) : openOrdersBody());
    };
    for (const [id, label] of [['orders', 'Open orders'], ['fills', 'Recent fills'], ['holders', 'Holders']]) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.t = id; b.setAttribute('role', 'tab'); b.append(mk('span', '', label)); b.onclick = () => { tradeTab = id; savePrefs(); renderTab(); }; bar.append(b); }
    const card = mk('div', 'hf-panel ws-info'); const body = mk('div', 'hf-body'); body.append(bar, box); card.append(body);
    renderTab();
    return card;
  }
  function pumpPanel(pair, pump, s) {
    const completed = pump?.completed === true;
    const card = mk('div', 'hf-panel ws-pumppanel');
    const headr = mk('header');
    headr.append(mk('h3', '', 'Pump.fun'), mk('span', 'ws-top-spacer'), mk('span', `hf-badge${completed ? ' ok' : ''}`, completed ? 'graduated' : 'bonding curve'));
    const body = mk('div', 'hf-body');
    const progress = mk('div', 'ws-pump-progress');
    const bar = mk('div', 'ws-pump-bar'); const fill = mk('i'); fill.style.width = `${Math.min(100, Number(pump?.graduationPercentage || 0))}%`; bar.append(fill);
    const line = mk('div', 'ws-pump-progress-line');
    line.append(mk('strong', '', completed ? 'Bonded' : `${Number(pump?.graduationPercentage || 0).toFixed(1)}% bonded`), mk('span', '', completed ? 'Trading on PumpSwap' : 'Bonding curve progress'));
    progress.append(line, bar); body.append(progress);
    const stats = mk('div', 'ws-stats ws-pump-stats');
    stats.append(metric('Age', pair.createdAt ? ageLabel(pair.createdAt) : '—'), metric('Market cap', pair.marketCap ? `$${compact(pair.marketCap)}` : '—'), metric('24h volume', pair.volume24h ? `$${compact(pair.volume24h)}` : '—'), metric('Liquidity', pair.liquidityUsd ? `$${compact(pair.liquidityUsd)}` : '—'));
    body.append(stats);
    if (!completed) {
      const allow = checkField('Allow live bonding-curve trades through PumpPortal');
      const box = allow.querySelector('input'); box.checked = cfg().pumpLiveEnabled === true;
      box.onchange = run(async () => { const data = await call2(window.aurora.walletConfig({ pumpLiveEnabled: box.checked })); window.toast(box.checked ? 'Live bonding-curve trades enabled.' : 'Live bonding-curve trades disabled.'); return data; });
      body.append(allow, mk('p', 'ws-sub ws-note', 'PumpPortal charges 0.5% per trade. Bonding-curve prices move fast and can lose most of their value. Paper is the safe default.'));
    }
    const slip = field('Slippage %', 'number'); const slipInput = slip.querySelector('input'); slipInput.value = String(pumpSlippage); slipInput.min = '0.1'; slipInput.max = '50';
    const prio = field('Priority fee (SOL)', 'number'); const prioInput = prio.querySelector('input'); prioInput.value = String(pumpPriority); prioInput.min = '0'; prioInput.max = '0.05';
    slipInput.onchange = () => { pumpSlippage = Math.min(50, Math.max(0.1, Number(slipInput.value) || 10)); savePrefs(); };
    prioInput.onchange = () => { pumpPriority = Math.min(0.05, Math.max(0, Number(prioInput.value) || 0.0005)); savePrefs(); };
    const settings = mk('div', 'ws-form ws-pump-settings'); settings.append(slip, prio); body.append(settings);
    card.append(headr, body); return card;
  }
  async function executePumpLive({ mint, side, usd, amountUi, symbol }) {
    const preview = await call2(window.aurora.walletPumpPreview({ mint, side, usd, amountUi, slippagePct: pumpSlippage, priorityFeeSol: pumpPriority }));
    const summary = preview.summary || {};
    const sim = preview.simulation?.ok ? 'simulation ok' : `simulation failed${preview.simulation?.error ? `: ${preview.simulation.error}` : ''}`;
    const readiness = preview.readiness;
    const walletLine = readiness ? `${readiness.signerType === 'vault' ? 'Bot wallet' : 'Connected wallet'} ${amount(readiness.balanceSol)} SOL · RPC ${readiness.rpcOk ? 'ok' : 'unreachable'}` : 'Wallet not checked';
    const detail = side === 'buy' ? `Buy ≈${summary.estimate ? amount(summary.estimate) : '…'} ${(symbol || short(mint)).trim()} for ${money(usd)}` : `Sell ${amount(amountUi)} ${(symbol || short(mint)).trim()}`;
    if (!window.confirm(`${detail}\n${walletLine}\nPumpPortal ${summary.pool} · fee ${summary.feePct}% · slippage ${summary.slippagePct}% · priority ${summary.priorityFeeSol} SOL · ${sim}\n\nSign this live pump trade?`)) return null;
    const result = await call2(window.aurora.walletPumpExecute({ mint, side, usd, amountUi, slippagePct: pumpSlippage, priorityFeeSol: pumpPriority }));
    window.toast(`Live ${side} ${result.status}${result.signature ? ` · ${result.signature.slice(0, 8)}…` : ''}`);
    return call2(window.aurora.load());
  }
  function ensureXStocksAck() {
    try { if (localStorage.getItem('aurora-xstocks-ack-v1') === '1') return Promise.resolve(true); } catch {}
    return new Promise(resolve => {
      const dialog = document.createElement('dialog'); dialog.className = 'ws-ack';
      const box = mk('div', 'ws-ack-box');
      box.append(mk('h2', '', 'Tokenized securities'));
      box.append(mk('p', 'ws-sub', 'xStocks are tokenized US equities and ETFs. Aurora is not a broker, exchange or investment adviser. Availability depends on your jurisdiction. Underlying market hours, halts and premiums apply. On-chain prices can trade at a premium or discount when the US market is closed.'));
      box.append(mk('p', 'ws-sub ws-note', 'You are responsible for your own decisions and for any tax, legal or regulatory obligations that apply to you.'));
      const actions = mk('div', 'ws-ack-actions');
      const cancel = btn('Cancel', { sm: true, variant: 'ghost' }, () => dialog.close('no'));
      const accept = btn('I understand', { sm: true, variant: 'primary' }, () => dialog.close('yes'));
      actions.append(cancel, accept); box.append(actions); dialog.append(box); document.body.append(dialog);
      dialog.addEventListener('close', () => { const accepted = dialog.returnValue === 'yes'; if (accepted) { try { localStorage.setItem('aurora-xstocks-ack-v1', '1'); } catch {} } dialog.remove(); resolve(accepted); });
      dialog.showModal();
    });
  }
  function xstockPanel(xstock, pair, s) {
    const asset = xstock.asset || xstock;
    const status = xstockStatus(asset);
    const card = mk('div', 'hf-panel ws-xstockpanel');
    const headr = mk('header');
    const line = mk('div', 'ws-xstock-line'); line.append(xstockLogo(asset));
    const names = mk('div', 'ws-xstock-names'); names.append(mk('strong', '', asset.symbol || 'xStock'), mk('small', '', asset.name || ''));
    line.append(names);
    headr.append(line, mk('span', 'ws-top-spacer'), mk('span', `hf-badge${status.cls}`, status.label));
    const body = mk('div', 'hf-body');
    const onChain = Number(pair?.priceUsd || xstock.pair?.priceUsd || 0), quote = Number(xstock.quote || 0), factor = Number(xstock.multiplier || 1), premium = xstock.premium;
    const stats = mk('div', 'ws-stats ws-xstock-stats');
    stats.append(metric('On-chain', onChain ? money(onChain) : '—'), metric('Underlying', quote ? money(quote) : '—'), metric('Premium', premium == null ? '—' : `${premium >= 0 ? '+' : ''}${Number(premium).toFixed(2)}%`, premium == null ? '' : premium >= 0 ? 'hf-up' : 'hf-down'), metric('Multiplier', factor ? `${factor.toFixed(4)}` : '—'));
    body.append(stats);
    const meta = mk('div', 'ws-xstock-meta');
    meta.append(mk('span', '', asset.underlyingSymbol ? `${asset.underlyingSymbol}${asset.exchange ? ` · ${asset.exchange}` : ''}` : 'Underlying unavailable'));
    if (asset.nextChangeAt) meta.append(mk('span', '', `Next session change ${new Date(asset.nextChangeAt).toLocaleString()}`));
    if (xstock.reserves) { const held = Number(xstock.reserves.sharesHeld || 0), supply = Number(xstock.reserves.circulatingSupply || 0); if (held > 0 && supply > 0) meta.append(mk('span', '', `Reserves ${held.toLocaleString()} shares / ${supply.toLocaleString()} circulating`)); }
    if (xstock.stock) { const stock = xstock.stock; const parts = [stock.previousClose ? `Prev close ${money(stock.previousClose)}` : '', stock.high52 ? `52w high ${money(stock.high52)}` : '', stock.low52 ? `52w low ${money(stock.low52)}` : '', stock.dayHigh && stock.dayLow ? `Day ${money(stock.dayLow)} to ${money(stock.dayHigh)}` : ''].filter(Boolean); if (parts.length) meta.append(mk('span', '', parts.join(' · '))); }
    body.append(meta);
    if (asset.isTradingHalted) body.append(mk('p', 'ws-warning', 'Trading is halted for this xStock. Review before placing any order.'));
    else if (!asset.openNow) body.append(mk('p', 'ws-warning', 'The underlying US market is closed. The on-chain price can trade at a premium or discount and the quote may be stale.'));
    const actions = mk('div', 'ws-xstock-actions');
    actions.append(btn('Open xStocks', { sm: true, variant: 'ghost', icon: 'external' }, () => call2(window.aurora.openLink('https://xstocks.fi/')).catch(error => window.toast(error.message))));
    body.append(actions);
    body.append(mk('p', 'ws-sub ws-note', 'Tokenized securities. Not a brokerage account. Aurora is not an investment adviser.'));
    card.append(headr, body); return card;
  }
  async function confirmXStockLive(xstock) {
    if (!xstock) return true;
    if (!(await ensureXStocksAck())) return false;
    const asset = xstock.asset || xstock;
    if (asset.isTradingHalted) return window.confirm('This xStock is halted. The underlying market is not trading normally. Continue anyway?');
    if (!asset.openNow) return window.confirm('The underlying US market is closed. The on-chain price may trade at a premium or discount and the quote may be stale. Continue?');
    return true;
  }
  function orderCard(mint, symName, pair, s, pumpInfo, xstockInfo) {
    const live = cfg().execution === 'live' && wallet()?.wc?.connected === true;
    const oco = tradeType === 'oco';
    const buy = tradeSide === 'buy' && !oco;
    const cash = Number(paper()?.cash || 0);
    const held = (paper()?.positions || []).find(x => x.mint === mint);
    const price = Number(pair.priceUsd || 0);
    const pumpLive = !!pumpInfo;
    const pumpCompleted = pumpInfo?.completed === true;
    const solPrice = Number((s.markets || []).find(m => m.symbol === 'SOL')?.price || 0);
    const head = mk('header'); head.append(mk('h3', '', 'Place order'), mk('span', 'ws-top-spacer'), mk('span', `ws-mode ${cfg().execution === 'live' ? 'live' : 'paper'}`, cfg().execution === 'live' ? (pumpLive ? 'LIVE · PUMPPORTAL' : 'LIVE') : 'PAPER'));
    const body = mk('div', 'hf-body');
    body.append(mk('p', 'ws-order-help', cfg().execution === 'live' && live ? (pumpLive ? (pumpCompleted ? 'PumpSwap via PumpPortal · 0.5% venue fee · real funds move.' : 'Bonding curve via PumpPortal · 0.5% venue fee · real funds move.') : 'Live mode · real funds move. You confirm every trade.') : `Paper trading · simulated balance ${money(cash)}. No real funds move.`));
    if (!oco) { const sideSeg = mk('div', 'ws-seg ws-sideseg'); for (const [label, val] of [['Buy', 'buy'], ['Sell', 'sell']]) { const b = mk('button', tradeSide === val ? `active ${val}` : val, label); b.type = 'button'; b.onclick = () => { tradeSide = val; savePrefs(); draw(); }; sideSeg.append(b); } body.append(sideSeg); }
    const TYPES = [['Market', 'market'], ['Limit', 'limit'], ['Stop', 'stop'], ['Stop-limit', 'stopLimit'], ['Trailing stop', 'trailing'], ['Take-profit / Stop-loss', 'oco']];
    const typeSel = mk('select', 'hf-input'); for (const [label, val] of TYPES) { const o = mk('option', '', label); o.value = val; typeSel.append(o); } typeSel.value = tradeType; typeSel.onchange = () => { tradeType = typeSel.value; savePrefs(); draw(); };
    const typeField = mk('div', 'hf-field'); typeField.append(mk('label', '', 'Order type'), typeSel); body.append(typeField);
    const hint = tradeType === 'market' ? (buy ? 'Fill now at the market price.' : 'Sell now at the market price.')
      : tradeType === 'limit' ? (buy ? 'Buy only at your price or lower.' : 'Sell only at your price or higher.')
        : tradeType === 'stop' ? (buy ? 'Buy when the price rises to your trigger.' : 'Sell if the price falls to your trigger.')
          : tradeType === 'stopLimit' ? (buy ? 'Arm a limit buy once the price reaches the stop.' : 'Arm a limit sell once the price falls to the stop.')
            : tradeType === 'trailing' ? (buy ? 'Buy when price rises from a recent low by the trail.' : 'Sell if price falls from its high by the trail.')
              : 'Sell a position automatically at a take-profit or stop-loss.';
    body.append(mk('p', 'ws-order-hint', hint));
    const refField = label => { const f = field(label, 'number'); const inp = f.querySelector('input'); if (price > 0) inp.value = String(Number(price.toPrecision(6))); return f; };
    let triggerField = null, limitField = null, trailField = null, tpField = null, slField = null;
    if (tradeType === 'limit' || tradeType === 'stop') triggerField = refField('Trigger price (USD)');
    else if (tradeType === 'stopLimit') { triggerField = refField('Stop price (USD)'); limitField = refField('Limit price (USD)'); }
    else if (tradeType === 'trailing') { trailField = field('Trail (%)', 'number'); trailField.querySelector('input').value = '10'; }
    else if (tradeType === 'oco') { tpField = field('Take-profit (%)', 'number'); tpField.querySelector('input').value = '25'; slField = field('Stop-loss (%)', 'number'); slField.querySelector('input').value = '10'; }
    for (const f of [triggerField, limitField, trailField, tpField, slField]) if (f) body.append(f);
    const amountField = field(oco || !buy ? 'Percent of position' : 'Amount (USD)', 'number'); const amountInput = amountField.querySelector('input'); amountInput.value = oco || !buy ? '100' : '25'; body.append(amountField);
    const avail = mk('div', 'ws-ticket-avail'); avail.append(mk('span', '', oco || !buy ? 'Position' : 'Available'), mk('b', '', oco || !buy ? (held ? `${amount(held.amount)} ${symName}` : `0 ${symName}`) : money(cash))); body.append(avail);
    const presets = mk('div', 'ws-seg ws-presets'); for (const v of [25, 50, 100]) { const b = mk('button', '', `${v}%`); b.type = 'button'; b.onclick = () => { amountInput.value = oco || !buy ? String(v) : String(Math.round(cash * v) / 100); update(); }; presets.append(b); } body.append(presets);
    const est = mk('div', 'ws-ticket-est');
    const update = () => {
      if (oco) { const pct = Number(amountInput.value) || 0; est.replaceChildren(mk('span', '', 'Bracket on'), mk('b', '', held ? `${amount(held.amount * pct / 100)} ${symName}` : 'no position')); return; }
      if (buy) { const usd = Number(amountInput.value) || 0; est.replaceChildren(mk('span', '', 'You receive'), mk('b', '', pair.priceUsd && usd > 0 ? `${amount(usd / pair.priceUsd)} ${symName}` : '—')); }
      else { const pct = Number(amountInput.value) || 0; est.replaceChildren(mk('span', '', 'You sell'), mk('b', '', held ? `${amount(held.amount * pct / 100)} ${symName}` : 'no position')); }
    };
    amountInput.oninput = update; update(); body.append(est);
    const actions = mk('div', 'ws-ticket-actions');
    const TYPELABEL = { limit: 'limit', stop: 'stop', stopLimit: 'stop-limit', trailing: 'trailing' };
    const label = oco ? 'Set take-profit / stop-loss' : tradeType === 'market' ? `Paper ${buy ? 'buy' : 'sell'} ${symName}` : `Paper ${TYPELABEL[tradeType]} ${buy ? 'buy' : 'sell'}`;
    actions.append(btn(label, { variant: oco || !buy ? 'sell' : 'buy' }, run(async () => {
      const symbol = pair.symbol;
      if (oco) { const tp = Number(inputOf(tpField)), sl = Number(inputOf(slField)); if (!(tp > 0) || !(sl > 0)) throw Error('Set take-profit and stop-loss percentages.'); if (!(price > 0)) throw Error('No live price yet.'); return call2(window.aurora.walletPaperCondition({ mint, symbol, kind: 'oco', side: 'sell', percent: Number(amountInput.value), takeProfit: price * (1 + tp / 100), stopLoss: price * (1 - sl / 100) })); }
      if (tradeType === 'market') return buy ? call2(window.aurora.walletPaperBuy({ mint, symbol, usd: Number(amountInput.value) })) : call2(window.aurora.walletPaperSell({ mint, percent: Number(amountInput.value) }));
      const payload = { mint, symbol, side: buy ? 'buy' : 'sell' };
      if (buy) payload.usd = Number(amountInput.value); else payload.percent = Number(amountInput.value);
      if (tradeType === 'trailing') payload.trailPercent = Number(inputOf(trailField));
      else { payload.kind = tradeType === 'stopLimit' ? 'stopLimit' : tradeType; payload.trigger = Number(inputOf(triggerField)); if (tradeType === 'stopLimit') payload.limitPrice = Number(inputOf(limitField)); }
      return call2(window.aurora.walletPaperCondition(payload));
    })));
    if (live && !oco) {
      const realHeld = (s.holdings || []).find(x => x.mint === mint);
      if (xstockInfo) {
        actions.append(btn('Live buy', { variant: 'primary' }, run(async () => {
          if (!(await confirmXStockLive(xstockInfo))) return null;
          const usd = Number(amountInput.value); if (!(usd > 0)) throw Error('Enter a USD amount.'); if (!(solPrice > 0)) throw Error('No SOL price yet.'); const limits = cfg().limits || {}; const heldValue = (s.holdings || []).filter(x => x.mint === mint).reduce((sum, x) => sum + x.value, 0); if (limits.maxPositionUsd && heldValue + usd > limits.maxPositionUsd) throw Error(`Position cap is ${money(limits.maxPositionUsd)}.`); return executeLive({ mint, side: 'buy', amountUi: usd / solPrice, usd, symbol: symName });
        })));
        if (realHeld) actions.append(btn('Live sell all', { variant: 'sell' }, run(async () => { if (!(await confirmXStockLive(xstockInfo))) return null; return executeLive({ mint, side: 'sell', amountUi: realHeld.amount, symbol: symName }); })));
      } else if (pumpLive) {
        actions.append(btn('Live buy (PumpPortal)', { variant: 'primary' }, run(async () => {
          if (!pumpCompleted && cfg().pumpLiveEnabled !== true) throw Error('Enable live bonding-curve trades in the Pump.fun panel first.');
          const usd = Number(amountInput.value); if (!(usd > 0)) throw Error('Enter a USD amount.');
          return executePumpLive({ mint, side: 'buy', usd, amountUi: 0, symbol: symName });
        })));
        if (realHeld) actions.append(btn('Live sell (PumpPortal)', { variant: 'sell' }, run(async () => {
          const pct = Math.min(100, Math.max(1, Number(amountInput.value) || 100));
          return executePumpLive({ mint, side: 'sell', usd: 0, amountUi: realHeld.amount * pct / 100, symbol: symName });
        })));
      } else {
        actions.append(btn('Live buy', { variant: 'primary' }, run(async () => { const usd = Number(amountInput.value); if (!(usd > 0)) throw Error('Enter a USD amount.'); if (!(solPrice > 0)) throw Error('No SOL price yet.'); const limits = cfg().limits || {}; const heldValue = (s.holdings || []).filter(x => x.mint === mint).reduce((sum, x) => sum + x.value, 0); if (limits.maxPositionUsd && heldValue + usd > limits.maxPositionUsd) throw Error(`Position cap is ${money(limits.maxPositionUsd)}.`); return executeLive({ mint, side: 'buy', amountUi: usd / solPrice, usd, symbol: symName }); })));
        if (realHeld) actions.append(btn('Live sell all', { variant: 'sell' }, run(async () => executeLive({ mint, side: 'sell', amountUi: realHeld.amount, symbol: symName }))));
      }
    }
    body.append(actions);
    if (cfg().execution === 'live' && !live) body.append(mk('p', 'ws-ticket-slip', 'Live mode is on but no wallet is connected. Connect one in Settings, Wallet to place real trades.'));
    body.append(mk('p', 'ws-ticket-slip', 'Paper fills assume a 1% fee and 0.5% slippage.'));
    const card = mk('div', 'hf-panel ws-ticket'); card.append(head, body); return card;
  }

  function gigiCard(mint, symName, s) {
    const ctx = mk('div', 'ws-gigi-ctx'); ctx.append(mk('b', '', symName), mk('span', '', `${cfg().execution === 'live' ? 'LIVE' : 'PAPER'} · ${money(paper()?.cash)}`));
    const ta = mk('textarea', 'hf-input ws-gigi-input'); ta.rows = 2; ta.placeholder = 'Ask Gigi to trade or watch for you: “buy $50 paper if it dips 5%”, “alert me above $120”, “build a strategy and ask before executing”.';
    const chips = mk('div', 'ws-chips ws-gigi-chips');
    for (const q of ['Buy $50 paper now', 'Limit buy 5% below', 'Alert on a 10% move', 'Strategy with approval']) { const c = mk('button', 'ws-chip', q); c.type = 'button'; c.onclick = () => { ta.value = q; ta.focus(); }; chips.append(c); }
    const send = btn('Send to Gigi', { variant: 'primary' }, () => {
      const text = ta.value.trim(); if (!text) { window.toast('Type what you want Gigi to do.'); return; }
      const prompt = `Trade desk: ${symName} (${mint}). Execution mode ${cfg().execution || 'paper'}, paper cash ${money(paper()?.cash)}. Instruction: ${text}\n\nExecute paper trades on my behalf and tell me exactly what you did. Never place a live trade without my explicit approval; if I only want a heads-up, create a signal or alert instead.`;
      ta.value = ''; chatOpen = true; savePrefs(); draw();
      call2(window.aurora.send(prompt, [])).then(() => window.toast('Sent to Gigi.')).catch(error => window.toast(error.message));
    });
    const head = mk('header'); head.append(mk('h3', '', 'Ask Gigi'), mk('span', 'ws-top-spacer'));
    const body = mk('div', 'hf-body'); body.append(ctx, ta, chips, send);
    const card = mk('div', 'hf-panel ws-gigibox'); card.append(head, body); return card;
  }
  function drawTrade(root, s) {
    if (!chartMint) {
      const first = (s.markets || [])[0];
      if (first) { chartMint = first.mint; if (!tokenCache.has(first.mint)) { tokenCache.set(first.mint, { loading: true }); call2(window.aurora.walletTokenInfo(first.mint)).then(info => { tokenCache.set(first.mint, info); if (open) draw(); }).catch(error => { tokenCache.set(first.mint, { error: error.message }); if (open) draw(); }); } }
      else { head(root, 'Trade', 'Search a token above.'); root.append(panel('', {}, emptyState('trade', 'Pick a token', 'Search or tap a holding.'))); return; }
    }
    const info = tokenCache.get(chartMint) || {}; const hint = pumpHints.get(chartMint) || null; const xstockDetail = info.xstock || null; const xstockHint = xstockHints.get(chartMint) || null; const xstock = xstockDetail?.asset ? xstockDetail : (xstockHint ? { asset: xstockHint, pair: xstockHint.pair, quote: xstockHint.quote, multiplier: xstockHint.multiplier, premium: xstockHint.premium, reserves: null, tradingStatus: null } : null); const pair = { ...(info.pair || xstock?.pair || {}) }, token = info.token || {}, safety = info.safety || {};
    if (xstock?.asset) { if (!pair.symbol) pair.symbol = xstock.asset.symbol; if (!pair.name) pair.name = xstock.asset.name; xstockNames.set(chartMint, xstock.asset); }
    if (!pair.symbol && (token.symbol || hint?.symbol)) pair.symbol = token.symbol || hint.symbol;
    if (!pair.name && (token.name || hint?.name)) pair.name = token.name || hint.name;
    if (!pair.priceUsd && (token.priceUsd || hint?.priceUsd)) pair.priceUsd = token.priceUsd || hint.priceUsd;
    if (!pair.volume24h && (token.volume24h || hint?.volume24h)) pair.volume24h = token.volume24h || hint.volume24h;
    if (!pair.marketCap && (token.fdv || hint?.marketCap)) pair.marketCap = token.fdv || hint.marketCap;
    if (!pair.dex && hint?.dex) pair.dex = hint.dex;
    if (!pair.createdAt && hint?.createdAt) pair.createdAt = hint.createdAt;
    if (!pair.liquidityUsd && hint?.liquidityUsd) pair.liquidityUsd = hint.liquidityUsd;
    if (!pair.change24h && hint?.change24h) pair.change24h = hint.change24h;
    if (xstock) { if (xstock.premium == null && Number(pair.priceUsd) > 0 && Number(xstock.quote) > 0) xstock.premium = (Number(pair.priceUsd) / (Number(xstock.quote) * (Number(xstock.multiplier) || 1)) - 1) * 100; if (!xstock.pair) xstock.pair = pair; }
    const pump = info.launchpad || (hint ? { graduationPercentage: hint.graduationPercentage, graduationKnown: hint.graduationKnown, completed: hint.completed } : null) || (pair.dex && /^pump/.test(pair.dex) ? { graduationPercentage: pair.dex === 'pumpswap' ? 100 : 0, completed: pair.dex === 'pumpswap' } : null);
    const symbolName = pair.symbol || sym(chartMint, s);
    const change = Number(pair.change24h || 0);
    const actions = [
      btn('Watch', { sm: true, variant: 'ghost', icon: 'watch' }, run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(chartMint)); window.toast(`${symbolName.trim()} added to your watchlist.`); return data; })),
      btn('Ask Gigi', { sm: true, variant: 'ghost', icon: 'chat' }, () => askGigi(`Research ${symbolName} (${chartMint}): market, holders, behavior, controls, locks and narrative. Separate facts from inference.`)),
      btn('Holders', { sm: true, variant: 'ghost', icon: 'holders' }, run(async () => { await call2(window.aurora.walletViewShow({ type: 'holders', title: `Holders · ${symbolName}`, source: { kind: 'holders', mint: chartMint } })); }))
    ];
    const header = mk('div', 'ws-head ws-trade-head');
    const heading = mk('div', 'ws-trade-heading');
    const nameRow = mk('div', 'ws-trade-name'); nameRow.append(mk('h1', 'ws-h1', pair.name || symbolName), mk('span', 'ws-tick', symbolName));
    const priceRow = mk('div', 'ws-trade-price'); priceRow.append(mk('b', '', money(pair.priceUsd))); if (pair.change24h != null) priceRow.append(mk('span', `ws-change ${change >= 0 ? 'hf-up' : 'hf-down'}`, `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`)); priceRow.append(mk('span', 'ws-mint', short(chartMint)));
    heading.append(nameRow, priceRow);
    const ha = mk('div', 'ws-head-actions'); ha.append(tutorialButton(), ...actions);
    header.append(heading, ha); root.append(header);
    const meta = mk('div', 'ws-trademeta');
    meta.append(mk('span', '', `Liquidity ${pair.liquidityUsd ? '$' + compact(pair.liquidityUsd) : '—'}`), mk('span', '', `Vol 24h ${pair.volume24h ? '$' + compact(pair.volume24h) : '—'}`), mk('span', '', `Mkt cap ${pair.marketCap ? '$' + compact(pair.marketCap) : '—'}`));
    if (pump) meta.append(mk('span', `hf-badge${pump.completed ? ' ok' : ''}`, pump.completed ? 'Pump.fun migrated' : `Pump.fun ${Number(pump.graduationPercentage || 0).toFixed(0)}%`));
    meta.append(mk('span', 'ws-top-spacer'), mk('span', `hf-badge ${safety.level ? safeCls(safety.level) : 'muted'}`, safety.level ? (safety.level === 'ok' ? 'mint/freeze revoked' : (safety.flags?.[0] || safety.level)) : 'safety unknown'));
    root.append(meta);
    if ((s.markets || []).length) { const chips = mk('div', 'ws-chips ws-trade-chips'); for (const m of s.markets) { const chip = mk('button', 'ws-chip' + (m.mint === chartMint ? ' active' : ''), m.symbol); chip.type = 'button'; chip.onclick = () => selectToken(m.mint); chips.append(chip); } root.append(chips); }
    if (pump) root.append(pumpPanel(pair, pump, s));
    if (xstock) root.append(xstockPanel(xstock, pair, s));
    const grid = mk('div', 'ws-trade'); const left = mk('div', 'ws-trade-left'); const right = mk('div', 'ws-trade-right');
    const RANGE_LABEL = { '1D': '15m', '7D': '1h', '30D': '4h', '3M': '1D', '6M': '1D', '1Y': '1D', ALL: '1W' };
    const legend = mk('div', 'ws-ohlc');
    const typeSeg = mk('div', 'ws-seg ws-charttype');
    for (const [label, val] of [['Line', false], ['Candles', true]]) { const b = mk('button', tradeCandles === val ? 'active' : '', label); b.type = 'button'; b.setAttribute('aria-pressed', String(tradeCandles === val)); b.onclick = () => { tradeCandles = val; savePrefs(); draw(); }; typeSeg.append(b); }
    const chHead = mk('header', 'ws-chartcard-head'); const chartControls = [rangeBar(tradeRange, r => { tradeRange = r; draw(); }), mk('span', 'ws-top-spacer')];
    if (xstock) { const sourceSeg = mk('div', 'ws-seg ws-charttype'); for (const [label, value] of [['Stock', 'underlying'], ['On-chain', 'onchain']]) { const b = mk('button', xChartSource === value ? 'active' : '', label); b.type = 'button'; b.setAttribute('aria-pressed', String(xChartSource === value)); b.onclick = () => { xChartSource = value; savePrefs(); draw(); }; sourceSeg.append(b); } chartControls.push(sourceSeg); }
    chartControls.push(typeSeg); chHead.append(...chartControls);
    const chart = mk('div', 'ws-chart');
    const chartBody = mk('div', 'hf-body'); chartBody.append(chart);
    const chartCard = mk('div', 'hf-panel ws-chartcard'); chartCard.append(chHead, legend, chartBody); left.append(chartCard);
    const STOCK_RANGE_LABEL = { '1D': '5m', '7D': '1h', '30D': '1D', '3M': '1D', '6M': '1D', '1Y': '1D', ALL: '1W' };
    const stockTicker = xstock?.asset?.underlyingSymbol || xstock?.stock?.symbol || '';
    const useStockChart = !!xstock && xChartSource === 'underlying' && !!stockTicker;
    const renderSeries = (points, label, interval, source) => {
      const last = points[points.length - 1] || {};
      legend.replaceChildren(mk('b', '', label), mk('span', 'ws-leg-i', `${source ? source + ' · ' : ''}${interval}`));
      if (last.o != null) { legend.append(mk('span', '', `O ${money(last.o)}`), mk('span', '', `H ${money(last.h)}`), mk('span', '', `L ${money(last.l)}`), mk('span', '', `C ${money(last.c)}`)); const ch = last.o > 0 ? (last.c - last.o) / last.o * 100 : 0; legend.append(mk('span', ch >= 0 ? 'hf-up' : 'hf-down', `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`)); }
      if (tradeCandles && points.some(point => point.o != null)) drawCandles(chart, points, 360); else drawChart(chart, points, 320);
    };
    if (useStockChart) {
      call2(window.aurora.walletStockHistory({ symbol: stockTicker, range: tradeRange })).then(stock => renderSeries(stock.points || [], stockTicker, STOCK_RANGE_LABEL[tradeRange] || '', 'STOCK')).catch(error => { legend.replaceChildren(mk('b', '', stockTicker), mk('span', 'ws-leg-i', 'STOCK')); chart.replaceChildren(); chart.append(mk('div', 'ws-sub', `Stock history unavailable: ${error.message}`)); });
    } else if (!info.loading) seriesOf(chartMint, tradeRange).then(points => renderSeries(points, symbolName, RANGE_LABEL[tradeRange] || '', xstock ? 'ON-CHAIN' : ''));
    else chart.append(skeleton(3));
    left.append(tradeInfo(chartMint, symbolName, s));
    right.append(orderCard(chartMint, symbolName, pair, s, pump, xstock), gigiCard(chartMint, symbolName, s));
    grid.append(left, right); root.append(grid);
  }

  function ageLabel(ms) { if (!ms) return '—'; const diff = Date.now() - Number(ms); const m = Math.floor(diff / 60000); if (m < 60) return `${Math.max(1, m)}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; const d = Math.floor(h / 24); return `${d}d`; }
  const changeTd = v => { const n = Number(v || 0); return mk('td', `num ${n >= 0 ? 'hf-up' : 'hf-down'}`, `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`); };
  function screenerTable(rows, render) {
    if (!rows.length) return emptyState('discover', 'No tokens match', 'Loosen the filters or hit refresh.');
    const cols = [['token', 'Token'], ['priceUsd', 'Price'], ['change5m', '5m'], ['change1h', '1h'], ['change24h', '24h'], ['liquidityUsd', 'Liquidity'], ['volume24h', 'Volume'], ['marketCap', 'Mkt cap'], ['createdAt', 'Age'], ['__', '']];
    const table = mk('table', 'hf-table ws-screener');
    const thead = mk('thead'); const htr = mk('tr');
    for (const [key, label] of cols) { const th = mk('th', key === 'token' || key === '__' ? '' : 'num', label); if (['priceUsd', 'change5m', 'change1h', 'change24h', 'liquidityUsd', 'volume24h', 'marketCap'].includes(key)) { th.style.cursor = 'pointer'; th.onclick = () => { if (discoverSort.key === key) discoverSort.dir *= -1; else discoverSort = { key, dir: -1 }; render(); }; if (discoverSort.key === key) th.textContent = `${label} ${discoverSort.dir < 0 ? '↓' : '↑'}`; } htr.append(th); }
    thead.append(htr); table.append(thead);
    const sorted = [...rows].sort((a, b) => ((a[discoverSort.key] ?? 0) - (b[discoverSort.key] ?? 0)) * discoverSort.dir);
    const tb = mk('tbody');
    for (const t of sorted) {
      const tr = mk('tr'); tr.style.cursor = 'pointer'; tr.onclick = e => { if (e.target.closest('button')) return; section = 'trade'; selectToken(t.address); };
      const td0 = mk('td'); const pumpRow = /^pump/.test(t.dex || ''); td0.append(mk('span', 'ws-sym', t.symbol || short(t.address)), mk('small', 'ws-row-name', `${t.name || ''}${t.dex ? `${t.name ? ' · ' : ''}${pumpRow ? 'Pump.fun' : t.dex}` : ''}`));
      const act = mk('td', 'num'); act.append(ibtn('watch', 'Watch', run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(t.address)); window.toast(`${(t.symbol || short(t.address)).trim()} added to your watchlist.`); return data; })));
      tr.append(td0, mk('td', 'num', money(t.priceUsd)), changeTd(t.change5m), changeTd(t.change1h), changeTd(t.change24h), mk('td', 'num', t.liquidityUsd ? `$${compact(t.liquidityUsd)}` : '—'), mk('td', 'num', t.volume24h ? `$${compact(t.volume24h)}` : '—'), mk('td', 'num', t.marketCap ? `$${compact(t.marketCap)}` : '—'), mk('td', 'num', ageLabel(t.createdAt)), act);
      tb.append(tr);
    }
    table.append(tb); return table;
  }
  function narrativesTable(items) {
    if (!items.length) return emptyState('discover', 'No narratives', 'DexScreener returned nothing right now.');
    const table = mk('table', 'hf-table ws-screener');
    const thead = mk('thead'); const htr = mk('tr'); for (const [label, num] of [['Narrative', false], ['Tokens', true], ['Mkt cap', true], ['Volume', true], ['24h', true]]) htr.append(mk('th', num ? 'num' : '', label)); thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    for (const m of [...items].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))) { const tr = mk('tr'); const td0 = mk('td'); td0.append(mk('span', 'ws-sym', m.name || m.slug), mk('small', 'ws-row-name', m.description || '')); tr.append(td0, mk('td', 'num', num(m.tokenCount)), mk('td', 'num', m.marketCap ? `$${compact(m.marketCap)}` : '—'), mk('td', 'num', m.volume ? `$${compact(m.volume)}` : '—'), changeTd(m.change24h)); tb.append(tr); }
    table.append(tb); return table;
  }
  const PUMP_STAGES = [['new', 'New'], ['trending', 'Trending'], ['graduated', 'Graduated']];
  const pumpStageLabel = id => (PUMP_STAGES.find(stage => stage[0] === id) || ['', id])[1];
  async function loadPumpStage(stage, force = false) {
    if (pumpFeed.loading[stage]) return;
    pumpFeed.loading[stage] = true; pumpFeed.error[stage] = '';
    if (open && platform === 'pumpfun' && section === 'discover') draw();
    try {
      const result = await call2(window.aurora.walletPumpDiscover({ stage, force }));
      pumpFeed.items[stage] = result.rows || [];
      for (const row of result.rows || []) pumpHints.set(row.mint, row);
      pumpFeed.at[stage] = result.at || Date.now();
      pumpFeed.stale[stage] = result.stale === true;
      pumpFeed.counts = result.counts || pumpFeed.counts;
      pumpFeed.error[stage] = result.error || '';
    } catch (error) { pumpFeed.error[stage] = error.message; }
    finally { pumpFeed.loading[stage] = false; if (open && platform === 'pumpfun' && section === 'discover') draw(); }
  }
  function ensurePumpTimer() {
    if (pumpRefreshTimer || (typeof window !== 'undefined' && window.__auroraTest)) return;
    pumpRefreshTimer = setInterval(() => {
      if (!open || platform !== 'pumpfun' || section !== 'discover' || pumpFeed.loading[pumpStage]) return;
      loadPumpStage(pumpStage).catch(() => {});
    }, 30000);
    pumpRefreshTimer.unref?.();
  }
  function mergePumpLaunches(rows, at = Date.now()) {
    if (!Array.isArray(rows) || !rows.length) return;
    const existing = pumpFeed.items.new || [];
    const byMint = new Map(existing.map(row => [row.mint, row]));
    let added = 0;
    for (const row of rows) {
      if (!row?.mint || byMint.has(row.mint)) continue;
      byMint.set(row.mint, row); pumpHints.set(row.mint, row); added += 1;
    }
    if (!added) return;
    pumpFeed.items.new = [...byMint.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
    pumpFeed.at.new = at;
    pumpFeed.counts = { ...pumpFeed.counts, new: pumpFeed.items.new.length };
    if (open && platform === 'pumpfun' && section === 'discover' && pumpStage === 'new') draw();
  }
  function pumpScanPrompt(row) {
    const change = Number(row.change1h || 0);
    return `Scan this Pump.fun token: ${row.symbol} (${row.mint}). Stage ${row.stage}, bond ${Number(row.graduationPercentage || 0).toFixed(1)}%, age ${ageLabel(row.createdAt)}, market cap ${money(row.marketCap)}, 1h volume ${money(row.volume1h)}, 1h change ${change >= 0 ? '+' : ''}${change.toFixed(2)}%, liquidity ${money(row.liquidityUsd)}. Use pump_scan, check the chart, safety and holders, and tell me whether it is worth paper trading. Do not invent dev, bundle or insider data.`;
  }
  function scanPumpRow(row) {
    chatOpen = true; savePrefs(); draw();
    call2(window.aurora.send(pumpScanPrompt(row), [])).then(() => window.toast(`Asked Gigi about ${row.symbol}.`)).catch(error => window.toast(error.message));
  }
  function scanPumpPage(rows) {
    const payload = rows.slice(0, 20).map(row => ({ symbol: row.symbol, mint: row.mint, ageMin: Math.round(row.ageMs / 60000), bond: Number(row.graduationPercentage || 0).toFixed(1), mc: row.marketCap, vol1h: row.volume1h, change1h: row.change1h, liquidity: row.liquidityUsd }));
    const prompt = `Scan the Pump.fun ${pumpStage} page. Use pump_discover('${pumpStage}') for a fresh pull, then rank the top 5 tokens for a paper trade. Name the setup, bond progress, liquidity, volume, risk and invalidation for each. Do not invent dev, bundle or insider data.\n\nVisible rows: ${JSON.stringify(payload)}`;
    chatOpen = true; savePrefs(); draw();
    call2(window.aurora.send(prompt, [])).then(() => window.toast('Asked Gigi to scan the page.')).catch(error => window.toast(error.message));
  }
  function pumpBondCell(row) {
    const cell = mk('td', 'ws-bond-cell');
    if (row.graduationKnown === false) { cell.append(mk('small', '', 'bonding')); return cell; }
    const bar = mk('span', 'ws-bondbar'); const fill = mk('i'); fill.style.width = `${Math.min(100, Number(row.graduationPercentage || 0))}%`; bar.append(fill);
    bar.title = row.curveSource === 'reserves' ? 'PumpPortal bonding-curve reserves' : row.curveSource === 'market-cap' ? 'Estimated from current market cap' : row.curveSource === 'launchpad' ? 'Pump.fun graduation data' : '';
    cell.append(bar, mk('small', '', `${Number(row.graduationPercentage || 0).toFixed(0)}%`));
    return cell;
  }
  function pumpTable(rows) {
    if (!rows.length) return emptyState('discover', 'No pump tokens match', 'Try another stage, loosen the filters or refresh.');
    const table = mk('table', 'hf-table ws-pump-table');
    const thead = mk('thead'); const htr = mk('tr');
    for (const [label, n] of [['Token', false], ['Age', true], ['MC', true], ['Price', true], ['1h', true], ['1h Vol', true], ['Liq', true], ['Buys/Sells', true], ['Bond', false], ['', false]]) htr.append(mk('th', n ? 'num' : '', label));
    thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    for (const row of rows) {
      const tr = mk('tr'); tr.style.cursor = 'pointer';
      tr.onclick = event => { if (event.target.closest('button')) return; section = 'trade'; selectToken(row.mint); savePrefs(); draw(); };
      const td0 = mk('td'); const sym = mk('div', 'ws-pump-sym'); sym.append(mk('span', 'ws-sym', row.symbol || short(row.mint)), mk('small', 'ws-row-name', row.name || row.dex || ''));
      if (row.aboutToGraduate) sym.append(mk('span', 'hf-badge ok', 'about to bond'));
      const verdictBadge = pumpVerdictBadge(row); if (verdictBadge) sym.append(verdictBadge);
      const autoBadge = pumpAutoBadge(row); if (autoBadge) sym.append(autoBadge);
      const tokenCell = mk('div', 'ws-pump-tokencell'); tokenCell.append(pumpLogo(row), sym);
      const tableSocials = pumpSocials(row); if (tableSocials) tokenCell.append(tableSocials);
      td0.append(tokenCell);
      const change = Number(row.change1h || 0);
      const act = mk('td', 'num');
      act.append(
        ibtn('trade', 'Trade', () => { section = 'trade'; selectToken(row.mint); savePrefs(); draw(); }),
        ibtn('gigi', 'Gigi scan', () => scanPumpRow(row)),
        ibtn('watch', 'Watch', run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(row.mint)); window.toast(`${row.symbol || short(row.mint)} watched.`); return data; })),
        ibtn('external', 'Solscan', () => call2(window.aurora.openLink(`https://solscan.io/token/${row.mint}`)).catch(error => window.toast(error.message)))
      );
      tr.append(td0, mk('td', 'num', ageLabel(row.createdAt)), mk('td', 'num', row.marketCap ? `$${compact(row.marketCap)}` : '—'), mk('td', 'num', money(row.priceUsd)), mk('td', `num ${change >= 0 ? 'hf-up' : 'hf-down'}`, `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`), mk('td', 'num', row.volume1h ? `$${compact(row.volume1h)}` : '—'), mk('td', 'num', row.liquidityUsd ? `$${compact(row.liquidityUsd)}` : '—'), mk('td', 'num', `${num(row.buys1h)}/${num(row.sells1h)}`), pumpBondCell(row), act);
      tb.append(tr);
    }
    table.append(tb); const wrap = mk('div', 'ws-table-scroll'); wrap.append(table); return wrap;
  }
  function applyPumpAuto(value) { if (!value) return; Object.assign(pumpAutoState, value); savePrefs(); if (open && platform === 'pumpfun' && section === 'discover') draw(); }
  async function updatePumpAuto(overrides = {}) {
    const next = { enabled: pumpAutoState.enabled, stage: pumpStage, autoPaper: pumpAutoState.autoPaper, budgetUsd: pumpAutoState.budgetUsd, maxBuys: pumpAutoState.maxBuys, intervalSec: pumpAutoState.intervalSec, ...overrides };
    next.runNow = overrides.enabled === true && !pumpAutoState.enabled;
    try { const result = await call2(window.aurora.walletPumpAuto(next)); applyPumpAuto(result); }
    catch (error) { window.toast(error.message); }
  }
  function pumpVerdictBadge(row) {
    const verdict = pumpAutoState.verdicts?.[row.mint];
    if (!verdict) return null;
    const cls = verdict.verdict === 'buy' ? ' ok' : verdict.verdict === 'avoid' ? ' live' : '';
    const badge = mk('span', `hf-badge${cls}`, `GIGI ${String(verdict.verdict || '').toUpperCase()} ${Number(verdict.score || 0)}`);
    badge.title = verdict.reason || '';
    return badge;
  }
  function pumpAutoBadge(row) {
    const item = (pumpAutoState.autoMints || []).find(entry => entry.mint === row.mint);
    if (!item) return null;
    const badge = mk('span', 'hf-badge ok', 'AUTO');
    badge.title = `Paper bought ${money(item.usd)} at score ${item.score}`;
    return badge;
  }
  function pulseGradient(text) {
    let hash = 0; for (const character of String(text || '?')) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `linear-gradient(135deg,hsl(${hue} 55% 30%),hsl(${(hue + 45) % 360} 55% 18%))`;
  }
  function pumpLogo(row) {
    const box = mk('span', 'ws-pulse-logo');
    if (row.imageUrl) {
      const img = mk('img'); img.src = row.imageUrl; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.remove(); box.classList.add('mono'); box.style.background = pulseGradient(row.symbol); box.append(mk('span', '', (row.symbol || '?').slice(0, 2).toUpperCase())); };
      box.append(img);
    } else { box.classList.add('mono'); box.style.background = pulseGradient(row.symbol); box.append(mk('span', '', (row.symbol || '?').slice(0, 2).toUpperCase())); }
    return box;
  }
  function loadPulseSpark(row) {
    if (!row.mint || pulseSparks.has(row.mint) || pulseSparkLoading.has(row.mint)) return;
    pulseSparkLoading.add(row.mint);
    seriesOf(row.mint, '1D').then(points => {
      if (!points || points.length < 2) return;
      pulseSparks.set(row.mint, points);
      const target = ws.querySelector(`.ws-pulse-spark[data-mint="${CSS.escape(row.mint)}"]`);
      if (target) target.replaceChildren(sparkline(points, 150, 36));
    }).catch(() => {}).finally(() => pulseSparkLoading.delete(row.mint));
  }
  function pumpSocialLabel(type) {
    const value = String(type || '').toLowerCase();
    if (value === 'twitter' || value === 'x') return 'X';
    if (value === 'telegram') return 'TG';
    if (value === 'website') return 'WEB';
    if (value === 'pump') return 'PF';
    if (value === 'dexscreener') return 'DS';
    return value.slice(0, 3).toUpperCase() || 'LINK';
  }
  function pumpSocials(row) {
    const links = [...(row.links || [])];
    if (row.mint) links.push({ type: 'pump', url: `https://pump.fun/coin/${row.mint}` });
    if (row.pair?.url) links.push({ type: 'dexscreener', url: row.pair.url });
    const unique = [...new Map(links.filter(link => link && /^https:\/\//.test(link.url)).map(link => [link.url, link])).values()].slice(0, 5);
    if (!unique.length) return null;
    const wrap = mk('div', 'ws-pulse-links');
    for (const link of unique) {
      const button = mk('button', 'ws-social', pumpSocialLabel(link.type)); button.type = 'button'; button.title = link.url;
      button.onclick = event => { event.stopPropagation(); call2(window.aurora.openLink(link.url)).catch(error => window.toast(error.message)); };
      wrap.append(button);
    }
    return wrap;
  }
  function pumpCard(row) {
    const card = mk('article', 'ws-pulse-card');
    card.onclick = event => { if (event.target.closest('button')) return; section = 'trade'; selectToken(row.mint); savePrefs(); draw(); };
    const top = mk('div', 'ws-pulse-top');
    const token = mk('div', 'ws-pulse-token'); token.append(pumpLogo(row));
    const names = mk('div', 'ws-pulse-names'); names.append(mk('strong', '', row.symbol), mk('small', '', row.name || row.dex || ''));
    token.append(names);
    const badges = mk('div', 'ws-pulse-badges');
    badges.append(mk('span', `hf-badge${row.completed ? ' ok' : ''}`, row.completed ? 'graduated' : row.aboutToGraduate ? 'about to bond' : 'bonding'));
    const verdict = pumpVerdictBadge(row); if (verdict) badges.append(verdict);
    const auto = pumpAutoBadge(row); if (auto) badges.append(auto);
    top.append(token, badges); card.append(top);
    const meta = mk('div', 'ws-pulse-meta');
    meta.append(mk('span', '', ageLabel(row.createdAt))); if (Number(row.buys1h) + Number(row.sells1h) > 0) meta.append(mk('span', '', `${num(row.buys1h)} buys / ${num(row.sells1h)} sells`));
    const socials = pumpSocials(row); if (socials) meta.append(socials);
    card.append(meta);
    const price = mk('div', 'ws-pulse-price'); const change = Number(row.change1h || 0);
    price.append(mk('b', '', money(row.priceUsd)), mk('span', change >= 0 ? 'hf-up' : 'hf-down', `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`));
    card.append(price);
    const spark = mk('div', 'ws-pulse-spark'); spark.dataset.mint = row.mint; spark.title = 'Trend from 5m, 1h and 24h change; replaced by live candles when available';
    if (pulseSparks.has(row.mint)) spark.append(sparkline(pulseSparks.get(row.mint), 150, 36));
    else { const changes = [Number(row.change24h || 0), Number(row.change1h || 0), Number(row.change5m || 0)]; spark.append(sparkline(changes.map(value => ({ p: value > -99 ? 100 / (1 + value / 100) : 1 })).concat([{ p: 100 }]), 150, 36)); }
    card.append(spark);
    const stats = mk('div', 'ws-pulse-stats');
    for (const [label, value] of [['MC', row.marketCap ? `$${compact(row.marketCap)}` : '—'], ['1h vol', row.volume1h ? `$${compact(row.volume1h)}` : '—'], ['Liq', row.liquidityUsd ? `$${compact(row.liquidityUsd)}` : '—']]) { const cell = mk('span'); cell.append(mk('small', '', label), mk('b', '', value)); stats.append(cell); }
    card.append(stats);
    const bond = mk('div', 'ws-pulse-bond');
    const bar = mk('div', 'ws-pulse-bar'); const fill = mk('i'); fill.style.width = row.graduationKnown === false ? '0%' : `${Math.min(100, Number(row.graduationPercentage || 0))}%`; bar.append(fill);
    bar.title = row.curveSource === 'reserves' ? 'PumpPortal bonding-curve reserves' : row.curveSource === 'market-cap' ? 'Estimated from current market cap' : row.curveSource === 'launchpad' ? 'Pump.fun graduation data' : '';
    bond.append(bar, mk('small', '', row.graduationKnown === false ? 'bonding' : `${Number(row.graduationPercentage || 0).toFixed(0)}% bonded`));
    card.append(bond);
    if (pumpAutoState.verdicts?.[row.mint]?.reason) card.append(mk('p', 'ws-pulse-reason', pumpAutoState.verdicts[row.mint].reason));
    const actions = mk('div', 'ws-pulse-actions');
    actions.append(
      btn('Trade', { sm: true, variant: 'primary' }, () => { section = 'trade'; selectToken(row.mint); savePrefs(); draw(); }),
      btn('Buy $25', { sm: true, variant: 'buy' }, run(async () => { const data = await call2(window.aurora.walletPaperBuy({ mint: row.mint, symbol: row.symbol, usd: 25, price: row.priceUsd })); window.toast(`Paper bought $25 of ${row.symbol}.`); return data; })),
      ibtn('watch', 'Watch', run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(row.mint)); window.toast(`${row.symbol} watched.`); return data; }))
    );
    const scan = btn('Gigi scan', { sm: true, variant: 'ghost', icon: 'gigi' }, () => scanPumpRow(row));
    scan.classList.add('ws-gigi-scan');
    actions.append(scan);
    card.append(actions); return card;
  }
  function pumpCards(rows) {
    if (!rows.length) return emptyState('discover', 'No pump tokens match', 'Try another stage, loosen the filters or refresh.');
    const grid = mk('div', 'ws-pulse-grid');
    for (const row of rows) grid.append(pumpCard(row));
    setTimeout(() => { for (const row of rows.slice(0, 8)) loadPulseSpark(row); }, 0);
    return grid;
  }
  function pumpAutoBar() {
    const wrap = mk('div', 'ws-pulse-auto');
    const main = mk('div', 'ws-pulse-auto-main');
    const dot = mk('span', `ws-pulse-dot${pumpAutoState.enabled ? ' on' : ''}`);
    const text = mk('div'); text.append(mk('strong', '', 'Gigi auto scan'), mk('small', '', pumpAutoState.running ? 'Scanning the current stage…' : pumpAutoState.lastAt ? `Last scan ${new Date(pumpAutoState.lastAt).toLocaleTimeString()}${pumpAutoState.lastBought ? ` · ${pumpAutoState.lastBought} paper buy${pumpAutoState.lastBought === 1 ? '' : 's'}` : ''}` : 'Off. Turn it on to keep scanning these tokens.'));
    main.append(dot, text);
    const toggle = btn(pumpAutoState.enabled ? 'Auto scan on' : 'Auto scan off', { sm: true, variant: pumpAutoState.enabled ? 'primary' : 'ghost', icon: 'gigi' }, run(async () => { await updatePumpAuto({ enabled: !pumpAutoState.enabled, stage: pumpStage }); }));
    const settings = mk('div', 'ws-pulse-auto-settings');
    const paper = checkField('Auto paper'); const paperBox = paper.querySelector('input'); paperBox.checked = pumpAutoState.autoPaper === true; paperBox.disabled = pumpAutoState.running;
    paperBox.onchange = run(async () => { pumpAutoState.autoPaper = paperBox.checked; savePrefs(); if (pumpAutoState.enabled) await updatePumpAuto({ autoPaper: paperBox.checked }); else draw(); });
    const budget = field('Budget $', 'number'); const budgetInput = budget.querySelector('input'); budgetInput.value = String(pumpAutoState.budgetUsd || 10); budgetInput.disabled = pumpAutoState.running;
    budgetInput.onchange = run(async () => { pumpAutoState.budgetUsd = Math.min(100, Math.max(1, Number(budgetInput.value) || 10)); savePrefs(); if (pumpAutoState.enabled) await updatePumpAuto({ budgetUsd: pumpAutoState.budgetUsd }); else draw(); });
    const maxBuys = field('Max buys', 'select', ['1', '2', '3']); const maxSelect = maxBuys.querySelector('select'); maxSelect.value = String(pumpAutoState.maxBuys || 1); maxSelect.disabled = pumpAutoState.running;
    maxSelect.onchange = run(async () => { pumpAutoState.maxBuys = Number(maxSelect.value) || 1; savePrefs(); if (pumpAutoState.enabled) await updatePumpAuto({ maxBuys: pumpAutoState.maxBuys }); else draw(); });
    const INTERVALS = [['60', '60s'], ['90', '90s'], ['120', '2m'], ['300', '5m']];
    const interval = field('Every', 'select', INTERVALS.map(pair => pair[1])); const intervalSelect = interval.querySelector('select'); const intervalOptions = intervalSelect.querySelectorAll('option'); INTERVALS.forEach(([value], index) => { intervalOptions[index].value = value; }); intervalSelect.value = String(pumpAutoState.intervalSec || 90); intervalSelect.disabled = pumpAutoState.running;
    intervalSelect.onchange = run(async () => { pumpAutoState.intervalSec = Number(intervalSelect.value) || 90; savePrefs(); if (pumpAutoState.enabled) await updatePumpAuto({ intervalSec: pumpAutoState.intervalSec }); else draw(); });
    settings.append(paper, budget, maxBuys, interval, toggle);
    wrap.append(main, settings);
    if (pumpAutoState.error && pumpAutoState.enabled) wrap.append(mk('p', 'ws-sub ws-note hf-down', pumpAutoState.error));
    wrap.append(mk('p', 'ws-sub ws-note', 'Pump auto is paper only. Uses your selected model and may cost credits. Runs while Aurora is open. Live strategy auto is controlled separately in Strategies.'));
    return wrap;
  }
  function drawPumpfun(root, s) {
    ensurePumpTimer();
    if (!pumpAutoLoaded) { pumpAutoLoaded = true; setTimeout(() => call2(window.aurora.walletPumpAutoStatus()).then(auto => { applyPumpAuto(auto); if (!auto.enabled && persisted.pumpAutoEnabled === true) { window.toast('Gigi auto scan resumed.'); updatePumpAuto({ enabled: true, stage: pumpStage }); } }).catch(() => {}), 0); }
    const stage = pumpStage;
    const stageLabel = pumpStageLabel(stage);
    const actions = [
      btn('Refresh', { sm: true, variant: 'ghost', icon: 'refresh', disabled: pumpFeed.loading[stage] }, () => loadPumpStage(stage, true)),
      btn('Scan page', { sm: true, variant: 'primary', icon: 'gigi' }, () => scanPumpPage(filterPumpRows(pumpFeed.items[stage] || []))),
      btn('Ask Gigi', { sm: true, variant: 'ghost', icon: 'chat' }, () => askGigi(`Give me a read on the Pump.fun ${stageLabel} page. Focus on bonding progress, liquidity, volume quality and which tokens deserve paper trades. Do not invent dev or bundle data.`))
    ];
    head(root, 'Pump.fun', 'New launches, tokens climbing the bond curve, and graduated strength.', actions);
    root.append(pumpAutoBar());
    const tabs = mk('div', 'hf-tabs ws-pump-tabs');
    for (const [id, label] of PUMP_STAGES) {
      const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.stage = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(id === stage));
      b.append(mk('span', '', label));
      const count = pumpFeed.counts[id]; if (count != null) b.append(mk('span', 'hf-badge', String(count)));
      b.onclick = () => { pumpStage = id; pumpSort = id === 'new' ? 'age' : 'score'; savePrefs(); if (pumpAutoState.enabled) updatePumpAuto({ stage: id }); draw(); };
      tabs.append(b);
    }
    const viewSeg = mk('div', 'ws-seg ws-charttype'); for (const [label, value] of [['Cards', 'cards'], ['Table', 'table']]) { const b = mk('button', pumpViewMode === value ? 'active' : '', label); b.type = 'button'; b.onclick = () => { pumpViewMode = value; savePrefs(); draw(); }; viewSeg.append(b); }
    const search = mk('input', 'hf-input ws-pump-search'); search.type = 'search'; search.placeholder = 'Filter by symbol, name or mint'; search.value = pumpQuery;
    const sort = mk('select', 'hf-input ws-pump-sort');
    for (const [value, label] of [['score', 'Stage score'], ['marketCap', 'Market cap'], ['volume1h', '1h volume'], ['volume24h', '24h volume'], ['change1h', '1h change'], ['age', 'Age']]) { const o = mk('option', '', label); o.value = value; sort.append(o); } sort.value = pumpSort;
    const minVol = mk('select', 'hf-input ws-pump-minvol'); for (const [value, label] of [['0', 'Any volume'], ['1000', '≥ $1k 1h'], ['10000', '≥ $10k 1h'], ['50000', '≥ $50k 1h']]) { const o = mk('option', '', label); o.value = value; minVol.append(o); } minVol.value = String(pumpMinVol);
    const updated = mk('span', 'ws-pump-updated', pumpFeed.at[stage] ? `Live · 30s · ${new Date(pumpFeed.at[stage]).toLocaleTimeString()}` : 'Live · loading…');
    if (pumpFeed.stale[stage]) updated.append(' · stale');
    const controls = mk('div', 'ws-disco-controls ws-pump-controls'); controls.append(viewSeg, search, sort, minVol, updated, mk('span', 'ws-top-spacer'));
    const body = mk('div', 'ws-pump-body');
    root.append(tabs, controls, body);
    search.oninput = () => { pumpQuery = search.value; renderPumpBody(); };
    sort.onchange = () => { pumpSort = sort.value; savePrefs(); renderPumpBody(); };
    minVol.onchange = () => { pumpMinVol = Number(minVol.value) || 0; renderPumpBody(); };
    function filterPumpRows(rows) {
      const q = pumpQuery.trim().toLowerCase();
      return rows.filter(row => (Number(row.volume1h) || 0) >= pumpMinVol && (!q || `${row.symbol} ${row.name} ${row.mint}`.toLowerCase().includes(q)));
    }
    function sortPumpRows(rows) {
      const sorted = [...rows];
      if (pumpSort === 'age') sorted.sort((a, b) => b.createdAt - a.createdAt);
      else if (pumpSort === 'score') sorted.sort((a, b) => b.score - a.score);
      else sorted.sort((a, b) => (Number(b[pumpSort]) || 0) - (Number(a[pumpSort]) || 0));
      return sorted;
    }
    function renderPumpBody() {
      if (pumpFeed.error[stage] && !pumpFeed.items[stage]) { body.replaceChildren(emptyState('discover', 'Could not load Pump.fun', pumpFeed.error[stage])); body.append(btn('Retry', { sm: true, variant: 'ghost', icon: 'refresh' }, () => loadPumpStage(stage, true))); return; }
      const rows = pumpFeed.items[stage];
      if (!rows) { body.replaceChildren(skeleton(8)); if (!pumpFeed.loading[stage]) setTimeout(() => loadPumpStage(stage), 0); return; }
      if (pumpFeed.loading[stage]) updated.textContent = 'Refreshing…';
      const visible = sortPumpRows(filterPumpRows(rows)); body.replaceChildren(pumpViewMode === 'table' ? pumpTable(visible) : pumpCards(visible));
    }
    renderPumpBody();
  }
  const XSTOCK_TABS = [['featured', 'Featured'], ['all', 'All'], ['etfs', 'ETFs']];
  function xstockStatus(row) {
    if (row.isTradingHalted) return { label: 'halted', cls: ' live' };
    if (row.currentPeriod === 'market') return { label: 'open', cls: ' ok' };
    if (row.currentPeriod === 'extended') return { label: 'extended', cls: ' ok' };
    if (row.currentPeriod === 'overnight') return { label: 'overnight', cls: '' };
    if (row.openNow) return { label: 'open', cls: ' ok' };
    return { label: 'closed', cls: ' muted' };
  }
  async function loadXStocks() {
    const generation = ++xGeneration;
    xFeed.loading = true; xFeed.error = '';
    if (open && platform === 'xstocks' && section === 'discover') draw();
    try {
      const result = await call2(window.aurora.walletXStocksDiscover({ tab: xTab, query: xQuery, status: xStatus, page: xPage, pageSize: 20 }));
      if (generation !== xGeneration) return;
      xFeed.data = result;
      for (const row of result.rows || []) { xstockHints.set(row.mint, row); xstockNames.set(row.mint, row); }
    } catch (error) { if (generation === xGeneration) xFeed.error = error.message; }
    finally { if (generation === xGeneration) { xFeed.loading = false; if (open && platform === 'xstocks' && section === 'discover') draw(); } }
  }
  function scanXStock(row) {
    const status = xstockStatus(row);
    const prompt = `Scan this xStock: ${row.symbol} (${row.name}), underlying ${row.underlyingSymbol} on ${row.exchange || 'US market'}. Market state ${status.label}, on-chain price ${money(row.pair?.priceUsd || 0)}, underlying quote ${money(row.quote || 0)}, multiplier ${row.multiplier || 1}, premium ${row.premium == null ? 'unknown' : row.premium.toFixed(2) + '%'}, 24h volume ${money(row.pair?.volume24h || 0)}, liquidity ${money(row.pair?.liquidityUsd || 0)}. Use xstocks_scan, check the chart, safety and holders, and explain the premium or discount and market-hours risk. Do not present this as investment advice.`;
    chatOpen = true; savePrefs(); draw();
    call2(window.aurora.send(prompt, [])).then(() => window.toast(`Asked Gigi about ${row.symbol}.`)).catch(error => window.toast(error.message));
  }
  function xstockLogo(row) {
    const box = mk('span', 'ws-xstock-logo');
    if (row.logo) { const img = mk('img'); img.src = row.logo; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.onerror = () => img.remove(); box.append(img); }
    else box.append(mk('span', '', (row.underlyingSymbol || row.symbol || '?').slice(0, 1)));
    return box;
  }
  function xstockTable(rows) {
    if (!rows.length) return emptyState('research', 'No xStocks match', 'Try another tab, search or market-status filter.');
    const table = mk('table', 'hf-table ws-xstock-table');
    const thead = mk('thead'); const htr = mk('tr');
    for (const [label, n] of [['Asset', false], ['Underlying', false], ['Market', false], ['On-chain', true], ['Quote', true], ['Premium', true], ['24h', true], ['Vol 24h', true], ['Liquidity', true], ['', false]]) htr.append(mk('th', n ? 'num' : '', label));
    thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    for (const row of rows) {
      const tr = mk('tr'); tr.style.cursor = 'pointer';
      tr.onclick = event => { if (event.target.closest('button')) return; if (!row.pair) { window.toast('No on-chain xStock market for this asset yet.'); return; } xstockHints.set(row.mint, row); xstockNames.set(row.mint, row); section = 'trade'; selectToken(row.mint); savePrefs(); draw(); };
      const td0 = mk('td'); const line = mk('div', 'ws-xstock-line'); line.append(xstockLogo(row));
      const names = mk('div', 'ws-xstock-names'); names.append(mk('strong', '', row.symbol), mk('small', '', row.name));
      line.append(names); td0.append(line);
      const td1 = mk('td'); td1.append(mk('span', 'ws-sym', row.underlyingSymbol || '—'), mk('small', 'ws-row-name', row.exchange || ''));
      const status = xstockStatus(row);
      const market = mk('span', `hf-badge${status.cls}`, status.label);
      const marketCell = mk('td'); marketCell.append(market);
      const change = Number(row.pair?.change24h || 0);
      const premium = row.premium == null ? null : Number(row.premium);
      const tradable = !!row.pair;
      const onChain = mk('td', 'num'); if (tradable) onChain.textContent = money(row.pair.priceUsd); else onChain.append(mk('span', 'hf-badge muted', 'no DEX'));
      const act = mk('td', 'num');
      if (tradable) act.append(ibtn('trade', 'Trade', () => { xstockHints.set(row.mint, row); xstockNames.set(row.mint, row); section = 'trade'; selectToken(row.mint); savePrefs(); draw(); }));
      act.append(
        ibtn('research', 'Scan with Gigi', () => scanXStock(row)),
        ibtn('watch', 'Watch', run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(row.mint)); xstockNames.set(row.mint, row); window.toast(`${row.symbol} watched.`); return data; })),
        ibtn('external', 'Open xStocks', () => call2(window.aurora.openLink('https://xstocks.fi/')).catch(error => window.toast(error.message)))
      );
      tr.append(td0, td1, marketCell, onChain, mk('td', 'num', row.quote ? money(row.quote) : '—'), mk('td', `num ${premium == null ? '' : premium >= 0 ? 'hf-up' : 'hf-down'}`, premium == null ? '—' : `${premium >= 0 ? '+' : ''}${premium.toFixed(2)}%`), mk('td', `num ${change >= 0 ? 'hf-up' : 'hf-down'}`, row.pair ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'), mk('td', 'num', row.pair?.volume24h ? `$${compact(row.pair.volume24h)}` : '—'), mk('td', 'num', row.pair?.liquidityUsd ? `$${compact(row.pair.liquidityUsd)}` : '—'), act);
      tb.append(tr);
    }
    table.append(tb); const wrap = mk('div', 'ws-table-scroll'); wrap.append(table); return wrap;
  }
  function drawXStocks(root, s) {
    const data = xFeed.data;
    const actions = [
      btn('Refresh', { sm: true, variant: 'ghost', icon: 'refresh', disabled: xFeed.loading }, () => loadXStocks()),
      btn('Ask Gigi', { sm: true, variant: 'primary', icon: 'chat' }, () => askGigi('Scan the xStocks board. Focus on premium or discount to the underlying, liquidity, volume quality, market hours and which names deserve paper trades. Do not present it as investment advice.'))
    ];
    head(root, 'xStocks', 'Tokenized US equities and ETFs. On-chain 24/7, underlying market hours and halts still apply.', actions);
    const counts = data?.counts || {};
    const stats = mk('div', 'ws-statbar');
    stats.append(metric('Assets', String(counts.total ?? '—')), metric('Open now', String(counts.open ?? '—')), metric('Halted', String(counts.halted ?? '—')), metric('Showing', String(data?.rows?.length || 0)), metric('Page', data ? `${data.page}/${data.pages}` : '—'));
    root.append(stats);
    const tabs = mk('div', 'hf-tabs ws-xstock-tabs');
    for (const [id, label] of XSTOCK_TABS) {
      const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.xTab = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(id === xTab));
      b.append(mk('span', '', label)); b.disabled = xFeed.loading; b.onclick = () => { if (xFeed.loading) return; xTab = id; xPage = 1; xFeed.data = null; loadXStocks(); }; tabs.append(b);
    }
    const search = mk('input', 'hf-input ws-xstock-search'); search.type = 'search'; search.placeholder = 'Search ticker, company or underlying'; search.value = xQuery; search.disabled = xFeed.loading;
    const status = mk('select', 'hf-input ws-xstock-status');
    for (const [value, label] of [['all', 'All market states'], ['open', 'Open'], ['extended', 'Extended'], ['overnight', 'Overnight'], ['closed', 'Closed'], ['halted', 'Halted']]) { const o = mk('option', '', label); o.value = value; status.append(o); } status.value = xStatus; status.disabled = xFeed.loading;
    const updated = mk('span', 'ws-pump-updated', data?.at ? `Updated ${new Date(data.at).toLocaleTimeString()}` : 'Loading…');
    if (xFeed.loading) updated.textContent = 'Refreshing…';
    const controls = mk('div', 'ws-disco-controls ws-xstock-controls'); controls.append(search, status, updated, mk('span', 'ws-top-spacer'));
    const body = mk('div', 'ws-xstock-body');
    root.append(tabs, controls, body);
    search.oninput = () => { clearTimeout(xSearchTimer); xSearchTimer = setTimeout(() => { xQuery = search.value; xPage = 1; xFeed.data = null; loadXStocks(); }, 300); };
    status.onchange = () => { if (xFeed.loading) return; xStatus = status.value; xPage = 1; xFeed.data = null; savePrefs(); loadXStocks(); };
    const pager = mk('div', 'ws-pager');
    const prev = btn('Previous', { sm: true, variant: 'ghost' }, () => { if (data && data.page > 1) { xPage = data.page - 1; xFeed.data = null; loadXStocks(); } });
    const next = btn('Next', { sm: true, variant: 'ghost' }, () => { if (data && data.page < data.pages) { xPage = data.page + 1; xFeed.data = null; loadXStocks(); } });
    prev.disabled = xFeed.loading || !data || data.page <= 1; next.disabled = xFeed.loading || !data || data.page >= data.pages;
    pager.append(prev, mk('span', '', data ? `Page ${data.page} of ${data.pages}` : 'Page 1'), next);
    if (xFeed.error) { body.replaceChildren(emptyState('research', 'Could not load xStocks', xFeed.error)); body.append(btn('Retry', { sm: true, variant: 'ghost', icon: 'refresh' }, () => loadXStocks())); }
    else if (!data) { body.replaceChildren(skeleton(8)); if (!xFeed.loading) setTimeout(() => loadXStocks(), 0); }
    else body.replaceChildren(xstockTable(data.rows || []), pager);
    root.append(mk('p', 'ws-sub ws-note', 'xStocks are tokenized securities, not a brokerage account. Availability depends on your jurisdiction. Premium or discount can widen when the US market is closed. Aurora is not an investment adviser.'));
  }
  function drawDiscover(root, s) {
    if (platform === 'xstocks') return drawXStocks(root, s);
    if (platform === 'pumpfun') return drawPumpfun(root, s);
    head(root, 'Discover', 'Screen Solana tokens: trending, new pairs, takeovers and narratives.');
    const TABS = [['trending', 'Trending'], ['new', 'New pairs'], ['takeovers', 'Takeovers'], ['narratives', 'Narratives']];
    const tabs = mk('div', 'hf-tabs ws-disco-tabs');
    for (const [id, label] of TABS) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.t = id; b.setAttribute('role', 'tab'); b.append(mk('span', '', label)); b.onclick = () => { discoverTab = id; savePrefs(); render(); }; tabs.append(b); }
    const search = mk('input', 'hf-input ws-disco-search'); search.type = 'search'; search.placeholder = 'Filter by symbol, name or mint'; search.value = discoverQuery;
    const liq = mk('select', 'hf-input ws-disco-liq'); for (const [label, val] of [['Any liquidity', 0], ['≥ $10k', 1e4], ['≥ $50k', 5e4], ['≥ $250k', 25e4], ['≥ $1M', 1e6]]) { const o = mk('option', '', label); o.value = String(val); liq.append(o); } liq.value = String(discoverMinLiq);
    const dex = mk('select', 'hf-input ws-disco-dex'); for (const [label, value] of [['All DEX', 'all'], ['Pump.fun', 'pumpfun'], ['PumpSwap', 'pumpswap']]) { const option = mk('option', '', label); option.value = value; dex.append(option); } dex.value = discoverDex;
    const refresh = btn('Refresh', { sm: true, variant: 'ghost', icon: 'refresh' }, () => { discover.items[discoverTab] = null; discover.error[discoverTab] = ''; render(); });
    const controls = mk('div', 'ws-disco-controls'); controls.append(search, dex, liq, mk('span', 'ws-top-spacer'), refresh);
    const body = mk('div', 'ws-disco-body');
    root.append(tabs, controls, body);
    search.oninput = () => { discoverQuery = search.value; render(); };
    liq.onchange = () => { discoverMinLiq = Number(liq.value); render(); };
    dex.onchange = () => { discoverDex = dex.value; savePrefs(); render(); };
    const load = async () => {
      const tab = discoverTab;
      if (discover.loading[tab]) return;
      discover.loading[tab] = true; discover.error[tab] = '';
      body.replaceChildren(skeleton(6));
      try { discover.items[tab] = await call2(window.aurora.walletDiscover(tab)); }
      catch (error) { discover.error[tab] = error.message; }
      finally { discover.loading[tab] = false; }
      if (open && section === 'discover') render();
    };
    function render() {
      for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.t === discoverTab));
      const isNarr = discoverTab === 'narratives';
      search.hidden = isNarr; liq.hidden = isNarr; dex.hidden = isNarr; refresh.hidden = false;
      if (discover.error[discoverTab]) { body.replaceChildren(emptyState('discover', 'Could not load', discover.error[discoverTab])); body.append(btn('Retry', { sm: true, variant: 'ghost', icon: 'refresh' }, () => { discover.error[discoverTab] = ''; discover.items[discoverTab] = null; render(); })); return; }
      if (!discover.items[discoverTab]) { if (!discover.loading[discoverTab]) load(); return; }
      const items = discover.items[discoverTab] || [];
      if (isNarr) { body.replaceChildren(narrativesTable(items)); return; }
      const q = discoverQuery.trim().toLowerCase();
      const rows = items.filter(t => (t.liquidityUsd || 0) >= discoverMinLiq && (discoverDex === 'all' || t.dex === discoverDex) && (!q || `${t.symbol} ${t.name} ${t.address}`.toLowerCase().includes(q)));
      body.replaceChildren(screenerTable(rows, render));
    }
    render();
  }

  const GRAPH_COLORS = { dev: '#5ef0ac', kol: '#b58cff', influencer: '#ff8ccf', trader: '#5b8cff', smart: '#ffcf7a', followed: '#8fa8d8', token: '#38bdf8', other: '#8a8796' };
  const GRAPH_IGNORE = new Set([
    'So11111111111111111111111111111111111111112',
    'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  ]);
  function graphWalletMints(wallet) {
    const scan = wallet?.scan || wallet || {};
    const map = new Map();
    for (const holding of [...(scan.holdings || []), ...(scan.unpriced || [])]) {
      if (!holding?.mint || GRAPH_IGNORE.has(holding.mint)) continue;
      map.set(holding.mint, holding.symbol || short(holding.mint));
    }
    return map;
  }
  function graphComponents(nodes, edges) {
    const parent = new Map(nodes.map(node => [node.id, node.id]));
    const find = id => parent.get(id) === id ? id : find(parent.get(id));
    const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent.set(x, y); };
    for (const edge of edges) union(edge.a, edge.b);
    return new Set(nodes.map(node => find(node.id))).size;
  }
  function buildWalletGraph({ focusMint = '', focusSymbol = '', dev = null, holders = null } = {}) {
    const wallets = [], seen = new Set();
    for (const person of (wallet()?.people || [])) {
      if (!person.scan || seen.has(person.address)) continue;
      seen.add(person.address);
      wallets.push({ ...person, source: 'people', mints: graphWalletMints(person) });
    }
    for (const item of (wallet()?.followed || [])) {
      if (!item.scan || seen.has(item.address)) continue;
      seen.add(item.address);
      wallets.push({ id: `followed:${item.id}`, address: item.address, label: item.label || short(item.address), kind: followedKind(item), tags: item.tags || [], scan: item.scan, scanAt: item.scanAt, source: 'followed', mints: graphWalletMints(item) });
    }
    const holderAddresses = focusMint ? new Set((holders || []).map(item => item.address)) : null;
    let selected = focusMint ? wallets.filter(item => holderAddresses.has(item.address)) : wallets;
    if (!focusMint) selected = [...selected].sort((a, b) => (b.scan?.total || 0) - (a.scan?.total || 0)).slice(0, 9);
    else selected = selected.slice(0, 9);
    const nodes = selected.map(item => ({
      id: item.address, address: item.address, label: item.label || short(item.address), kind: item.kind || 'other',
      value: item.scan?.total || 0, mints: item.mints, source: item.source
    }));
    const byId = new Map(nodes.map(node => [node.id, node]));
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const shared = [...nodes[i].mints.keys()].filter(mint => mint !== focusMint && nodes[j].mints.has(mint));
        if (!shared.length) continue;
        edges.push({ a: nodes[i].id, b: nodes[j].id, kind: 'shared', shared, label: shared.slice(0, 3).map(mint => nodes[i].mints.get(mint) || short(mint)).join(', ') });
      }
    }
    let center = null;
    if (focusMint) {
      if (dev?.address && !byId.has(dev.address)) {
        const node = { id: dev.address, address: dev.address, label: dev.label || 'Dev', kind: 'dev', value: dev.value || 0, mints: new Map(), source: 'dev' };
        nodes.push(node); byId.set(node.id, node);
      }
      center = { id: 'token', label: focusSymbol || 'TOKEN', kind: 'token', value: 0, mints: new Map(), center: true };
      nodes.push(center);
      for (const node of nodes) {
        if (node.center) continue;
        const held = node.id === dev?.address || (node.mints && node.mints.has(focusMint));
        if (!held && node.id !== dev?.address) continue;
        edges.push({ a: node.id, b: center.id, kind: node.id === dev?.address ? 'created' : 'holds', shared: [focusMint], label: node.id === dev?.address ? 'creator' : 'holder' });
      }
    }
    return { nodes, edges, sharedEdges: edges.filter(edge => edge.kind === 'shared'), components: graphComponents(nodes, edges) };
  }
  function renderWalletGraph(options = {}) {
    const graph = buildWalletGraph(options);
    const wrap = mk('div', 'ws-graph');
    const nodes = graph.nodes;
    if (!nodes.length || (options.focusMint && nodes.length < 2) || (!options.focusMint && !graph.sharedEdges.length)) {
      wrap.append(emptyState('holders', options.focusMint ? 'No tracked holders to map' : 'No linked wallets yet', options.focusMint ? 'Add and scan KOLs, traders or devs in People, then refresh intel.' : 'Track and scan at least two wallets with a common non-SOL token to see the cluster.'));
      return wrap;
    }
    const info = mk('div', 'ws-graph-head');
    const walletCount = nodes.filter(node => !node.center).length;
    const summary = options.focusMint ? `${walletCount} wallet${walletCount === 1 ? '' : 's'} · ${graph.edges.length} connection${graph.edges.length === 1 ? '' : 's'}` : `${nodes.length} wallets · ${graph.sharedEdges.length} shared links · ${graph.components} cluster${graph.components === 1 ? '' : 's'}`;
    info.append(mk('strong', '', options.focusMint ? 'Holder cluster' : 'Shared-holding graph'), mk('span', 'ws-sub', summary));
    const legend = mk('div', 'ws-graph-legend');
    for (const kind of [...new Set(nodes.map(node => node.kind))]) { const key = mk('span', 'ws-graph-key', personRole(kind)); key.style.setProperty('--graph-color', GRAPH_COLORS[kind] || GRAPH_COLORS.other); legend.append(key); }
    info.append(legend); wrap.append(info);
    const W = 640, H = 300, cx = W / 2, cy = H / 2;
    const svg = svgEl('svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', options.focusMint ? 'Token holder cluster' : 'Wallet shared-holding graph');
    const positions = new Map();
    const others = nodes.filter(node => !node.center);
    if (nodes.some(node => node.center)) positions.set('token', { x: cx, y: cy });
    if (others.length === 1) positions.set(others[0].id, { x: cx, y: cy - 92 });
    else others.forEach((node, i) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / Math.max(1, others.length);
      positions.set(node.id, { x: cx + Math.cos(angle) * 122, y: cy + Math.sin(angle) * 88 });
    });
    for (const edge of graph.edges) {
      const a = positions.get(edge.a), b = positions.get(edge.b);
      if (!a || !b) continue;
      const line = svgEl('line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', `ws-graph-edge ${edge.kind}`);
      line.setAttribute('stroke-width', String(edge.kind === 'shared' ? 1 + Math.min(3, edge.shared.length * 0.4) : 1.2));
      const title = svgEl('title'); title.textContent = edge.kind === 'shared' ? `Shared: ${edge.label}` : edge.label; line.append(title); svg.append(line);
    }
    for (const node of nodes) {
      const point = positions.get(node.id); if (!point) continue;
      const r = node.center ? 31 : node.kind === 'dev' ? 22 : 16 + Math.min(5, Math.log10((node.value || 0) + 10));
      const g = svgEl('g'); g.setAttribute('class', 'ws-graph-node');
      const circle = svgEl('circle'); circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', r);
      circle.setAttribute('fill', GRAPH_COLORS[node.kind] || GRAPH_COLORS.other);
      circle.setAttribute('fill-opacity', node.center ? '0.96' : '0.88');
      circle.setAttribute('stroke', node.center ? '#d6f4ff' : 'rgba(255,255,255,.3)');
      circle.setAttribute('stroke-width', node.center ? '1.4' : '1');
      const title = svgEl('title'); title.textContent = `${node.label} · ${personRole(node.kind)}${node.value ? ` · ${money(node.value)}` : ''}${node.address ? `\n${node.address}` : ''}`; circle.append(title);
      if (node.address) { circle.style.cursor = 'pointer'; circle.onclick = () => call2(window.aurora.openLink(`https://solscan.io/account/${node.address}`)).catch(error => window.toast(error.message)); }
      const label = svgEl('text'); label.setAttribute('x', point.x); label.setAttribute('y', point.y + r + 14); label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'ws-graph-label');
      label.textContent = node.center ? node.label.slice(0, 12).toUpperCase() : (node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label);
      g.append(circle, label); svg.append(g);
    }
    wrap.append(svg);
    if (graph.sharedEdges.length) {
      const list = mk('div', 'ws-graph-links');
      for (const edge of graph.sharedEdges.slice(0, 5)) {
        const a = nodes.find(node => node.id === edge.a), b = nodes.find(node => node.id === edge.b);
        if (!a || !b) continue;
        const row = mk('div', 'ws-graph-link');
        row.append(mk('strong', '', `${a.label} ↔ ${b.label}`), mk('span', 'ws-sub', `${edge.shared.length} shared: ${edge.label}`));
        list.append(row);
      }
      wrap.append(list);
    }
    wrap.append(mk('p', 'ws-sub ws-note', options.focusMint ? 'Links use the latest tracked-wallet scans and launch data. Shared holdings are not proof of shared funding or team ownership.' : 'Links mean two tracked wallets hold the same token in their latest scan. This is not proof of common ownership.'));
    return wrap;
  }
  const PEOPLE_ROLES = [['all', 'All'], ['dev', 'Devs'], ['kol', 'KOLs'], ['influencer', 'Influencers'], ['trader', 'Traders'], ['smart', 'Smart money'], ['other', 'Other']];
  function personRole(kind) {
    return ({ dev: 'Dev', kol: 'KOL', influencer: 'Influencer', trader: 'Trader', smart: 'Smart money', followed: 'Followed', token: 'Token', other: 'Other' })[kind] || 'Other';
  }
  function personRoleBadge(kind) {
    return mk('span', `hf-badge${kind === 'dev' ? ' ok' : kind === 'kol' || kind === 'influencer' ? '' : ' muted'}`, personRole(kind));
  }
  function personSourceLabel(source) {
    return source === 'axiom' ? 'Axiom' : source === 'pumpfun-padre' ? 'Pump / Padre' : source === 'kolscan' ? 'Kolscan' : source ? source : 'Manual';
  }
  function drawPeople(root, s) {
    const tracked = wallet()?.people || [];
    const active = tracked.filter(person => person.watchActivity !== false).length;
    const actions = [];
    if (peopleScanState?.running) actions.push(mk('span', 'ws-sub', `Scanning ${peopleScanState.done}/${peopleScanState.total}…`));
    else if (tracked.length) actions.push(btn('Scan all', { sm: true, variant: 'ghost', icon: 'refresh' }, run(async () => { const data = await call2(window.aurora.walletPeopleScanAll()); peopleScanState = data.peopleScanJob || null; window.toast('Scanning tracked people…'); return data; })));
    actions.push(btn('Starter pack', { sm: true, variant: 'ghost', icon: 'holders', title: 'Restore the top-trader starter pack' }, run(async () => { const data = await call2(window.aurora.walletRadarStarter({ force: true })); window.toast(data.radarStarter?.added ? `${data.radarStarter.added} starter wallets added.` : 'Starter pack is already complete.'); return data; })));
    actions.push(btn(peopleAddOpen ? 'Close add' : 'Add person', { sm: true, variant: peopleAddOpen ? 'ghost' : 'primary', icon: 'plus' }, () => { peopleAddOpen = !peopleAddOpen; draw(); }));
    head(root, 'People', 'Devs, KOLs, influencers and traders you track. Radar watches them read-only.', actions);
    const address = field('Wallet address', 'text'); address.querySelector('input').placeholder = 'Paste a Solana wallet'; address.querySelector('input').spellcheck = false;
    const label = field('Label', 'text'); label.querySelector('input').placeholder = 'e.g. Cobie, launch dev, smart trader';
    const role = field('Role', 'select', ['KOL', 'Influencer', 'Trader', 'Smart', 'Dev', 'Other']);
    const roleValues = ['kol', 'influencer', 'trader', 'smart', 'dev', 'other'];
    [...role.querySelectorAll('option')].forEach((option, i) => { option.value = roleValues[i]; });
    role.querySelector('select').value = peopleAddKind;
    role.querySelector('select').onchange = () => { peopleAddKind = role.querySelector('select').value; };
    const tags = field('Tags', 'text'); tags.querySelector('input').placeholder = 'kol, ai, solana';
    const note = field('Note', 'text'); note.querySelector('input').placeholder = 'Why this wallet matters';
    const form = mk('div', 'ws-people-form');
    const submit = btn('Add & scan', { variant: 'primary', sm: true, icon: 'plus' }, run(async () => {
      const value = (inputOf(address) || '').trim();
      if (!value) throw Error('Paste a wallet address.');
      const data = await call2(window.aurora.walletPeopleSave({ address: value, label: inputOf(label) || '', kind: selectOf(role) || 'other', tags: inputOf(tags) || '', note: inputOf(note) || '' }));
      window.toast(`${inputOf(label) || short(value)} added and scanned.`);
      return data;
    })); submit.classList.add('ws-people-submit');
    form.append(address, label, role, tags, note, submit);
    if (peopleAddOpen || !tracked.length) root.append(panel('Track a wallet', {}, form));
    const toolbar = mk('div', 'ws-people-toolbar');
    const search = mk('input', 'hf-input ws-people-search'); search.type = 'search'; search.placeholder = 'Search label, address, tag or note'; search.value = peopleQuery;
    const source = mk('select', 'hf-input ws-people-source');
    for (const [value, text] of [['all', 'All sources'], ['axiom', 'Axiom'], ['pumpfun-padre', 'Pump / Padre'], ['kolscan', 'Kolscan'], ['manual', 'Manual']]) { const o = mk('option', '', text); o.value = value; source.append(o); }
    source.value = peopleSource;
    const status = mk('select', 'hf-input ws-people-status');
    for (const [value, text] of [['all', 'All status'], ['active', 'Radar active'], ['paused', 'Radar paused']]) { const o = mk('option', '', text); o.value = value; status.append(o); }
    status.value = peopleStatus;
    const sort = mk('select', 'hf-input ws-people-sort');
    for (const [value, text] of [['order', 'Starter order'], ['lastMove', 'Last move'], ['name', 'Name'], ['value', 'Value']]) { const o = mk('option', '', text); o.value = value; sort.append(o); }
    sort.value = peopleSort;
    toolbar.append(search, source, status, sort);
    const filters = mk('div', 'ws-seg ws-people-filters');
    for (const [id, text] of PEOPLE_ROLES) {
      const count = id === 'all' ? tracked.length : tracked.filter(person => person.kind === id).length;
      const b = mk('button', peopleFilter === id ? 'active' : '', `${text}${count ? ` ${count}` : ''}`);
      b.type = 'button'; b.onclick = () => { peopleFilter = id; draw(); }; filters.append(b);
    }
    const count = mk('span', 'ws-sub ws-people-count');
    const list = mk('div', 'ws-list ws-people-list');
    function renderPeopleRows() {
      const q = peopleQuery.trim().toLowerCase();
      let visible = tracked.filter(person => {
        if (peopleFilter !== 'all' && person.kind !== peopleFilter) return false;
        if (peopleSource === 'manual' && person.source) return false;
        if (peopleSource !== 'all' && peopleSource !== 'manual' && person.source !== peopleSource) return false;
        if (peopleStatus === 'active' && person.watchActivity === false) return false;
        if (peopleStatus === 'paused' && person.watchActivity !== false) return false;
        if (q && !`${person.label} ${person.address} ${(person.tags || []).join(' ')} ${person.note || ''} ${personSourceLabel(person.source)}`.toLowerCase().includes(q)) return false;
        return true;
      });
      if (peopleSort === 'name') visible = [...visible].sort((a, b) => a.label.localeCompare(b.label));
      else if (peopleSort === 'value') visible = [...visible].sort((a, b) => (b.scan?.total || 0) - (a.scan?.total || 0));
      else if (peopleSort === 'lastMove') visible = [...visible].sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
      count.textContent = `Showing ${visible.length} of ${tracked.length} · ${active} on radar`;
      list.replaceChildren();
      if (!visible.length) { list.append(emptyState('holders', tracked.length ? 'No people match these filters' : 'No people tracked yet', tracked.length ? 'Try another role, source or status.' : 'Add a dev, KOL, influencer or trader above.')); return; }
      for (const person of visible) {
        const scan = person.scan;
        const activity = person.watchActivity === false ? 'radar paused' : person.lastActivityAt ? `last move ${ageLabel(person.lastActivityAt)}` : 'on radar';
        const sourceLabel = personSourceLabel(person.source);
        const rank = person.sourceRank ? ` #${person.sourceRank}` : '';
        const metric = person.pnlUsd ? `$${compact(person.pnlUsd)} PnL` : person.winRate ? `${Number(person.winRate).toFixed(1)}% win` : '';
        const scanText = scan ? `${scan.pricedCount || scan.holdings?.length || 0} priced · ${ageLabel(person.scanAt || scan.at)} ago` : 'not scanned';
        const item = mk('div', 'ws-item ws-person');
        item.title = person.note || '';
        const initials = String(person.label || person.address || '?').trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';
        const avatar = mk('span', 'ws-person-avatar', initials);
        avatar.style.background = pulseGradient(person.address || person.label);
        const body = mk('div', 'ws-person-body');
        const top = mk('div', 'ws-person-head');
        top.append(mk('strong', '', person.label || short(person.address)), personRoleBadge(person.kind), mk('span', 'ws-person-source', `${sourceLabel}${rank}`));
        if (person.watchActivity === false) top.append(mk('span', 'hf-badge muted', 'paused'));
        const meta = mk('div', 'ws-person-meta');
        meta.append(mk('span', '', short(person.address)), mk('span', '', activity), mk('span', '', scanText));
        if (metric) meta.append(mk('span', '', metric));
        body.append(top, meta);
        if (scan?.holdings?.length) {
          const holdings = mk('div', 'ws-people-holdings');
          for (const holding of scan.holdings.slice(0, 4)) holdings.append(mk('span', 'ws-social', `${holding.symbol} ${money(holding.value)}`));
          body.append(holdings);
        }
        if (person.note && !person.starter) body.append(mk('p', 'ws-person-note', person.note));
        if (person.lastError) body.append(mk('p', 'ws-person-note hf-down', person.lastError));
        const right = mk('div', 'ws-person-right');
        const value = mk('div', 'ws-person-value');
        value.append(mk('b', '', scan ? money(scan.total) : '—'), mk('small', '', scan ? `scanned ${ageLabel(person.scanAt || scan.at)} ago` : 'not scanned'));
        const actions = mk('div', 'ws-ctrls ws-person-actions');
        actions.append(ibtn('refresh', 'Scan wallet', run(async () => call2(window.aurora.walletPeopleScan(person.id)))));
        const menu = mk('details', 'ws-wallet-menu ws-person-menu');
        const summary = mk('summary', ''); summary.textContent = '⋯'; summary.title = 'Person actions'; summary.setAttribute('aria-label', 'Person actions'); menu.append(summary);
        const menuPanel = mk('div', 'ws-wallet-menu-panel');
        const menuAction = (iconName, label, action, danger = false) => {
          const button = mk('button', danger ? 'danger' : ''); button.type = 'button'; button.setAttribute('aria-label', label);
          button.append(ic(iconName, 14), mk('span', '', label)); button.onclick = action; return button;
        };
        menuPanel.append(
          menuAction(person.watchActivity === false ? 'play' : 'pause', person.watchActivity === false ? 'Resume radar' : 'Pause radar', run(async () => call2(window.aurora.walletPeopleWatch({ id: person.id, enabled: person.watchActivity === false })))),
          menuAction('research', 'Open token intel', () => { section = 'research'; intelMint = ''; intelData = null; const first = scan?.holdings?.[0]?.mint; if (first) loadIntel(first); else window.toast('Scan this person to get a token to research.'); }),
          menuAction('external', 'Open on Solscan', () => call2(window.aurora.openLink(`https://solscan.io/account/${person.address}`)).catch(error => window.toast(error.message))),
          menuAction('delete', 'Remove', run(async () => call2(window.aurora.walletPeopleRemove(person.id))), true)
        );
        menu.append(menuPanel); actions.append(menu);
        right.append(value, actions);
        item.append(avatar, body, right);
        list.append(item);
      }
    }
    search.oninput = () => { peopleQuery = search.value; renderPeopleRows(); };
    source.onchange = () => { peopleSource = source.value; renderPeopleRows(); };
    status.onchange = () => { peopleStatus = status.value; renderPeopleRows(); };
    sort.onchange = () => { peopleSort = sort.value; renderPeopleRows(); };
    renderPeopleRows();
    const peoplePanel = panel('People on radar', {}, toolbar, filters, count, list);
    peoplePanel.classList.add('ws-people-panel');
    root.append(peoplePanel);
    root.append(panel('', {}, renderWalletGraph()));
  }
  async function loadIntel(mint) {
    const value = String(mint || '').trim();
    if (!value) return;
    intelMint = value; intelLoading = true; intelError = '';
    if (open && section === 'research') draw();
    try {
      intelData = await call2(window.aurora.walletTokenIntel({ mint: value, creator: pumpHints.get(value)?.creator || '' }));
    } catch (error) { intelError = error.message; }
    finally { intelLoading = false; if (open && section === 'research') draw(); }
  }
  function trackIntelDev(intel) {
    const dev = intel?.dev;
    if (!dev) return Promise.reject(Error('Creator is unknown for this token.'));
    return call2(window.aurora.walletPeopleSave({ address: dev.address, label: dev.tracked ? dev.label : `Dev · ${intel.symbol}`.slice(0, 40), kind: 'dev', tags: 'dev, pumpfun', note: `Creator of ${intel.symbol} (${intel.mint})` }));
  }
  function renderTokenIntel(root, intel) {
    const pair = intel.pair || {};
    const actions = [
      mk('span', 'hf-badge', intel.curve?.known ? `bond ${Number(intel.curve.percentage || 0).toFixed(0)}%` : 'bond —'),
      intel.safety?.level ? mk('span', `hf-badge${intel.safety.level === 'ok' ? ' ok' : intel.safety.level === 'risk' ? ' live' : ''}`, intel.safety.level) : null,
      btn('Refresh intel', { sm: true, variant: 'ghost', icon: 'refresh' }, run(async () => { await loadIntel(intel.mint); return null; })),
      btn('Trade', { sm: true, variant: 'primary', icon: 'trade' }, () => { section = 'trade'; selectToken(intel.mint); savePrefs(); draw(); }),
      ibtn('share', 'Copy mint', async () => { try { await navigator.clipboard.writeText(intel.mint); window.toast('Mint copied.'); } catch { window.toast('Could not copy.'); } }),
      ibtn('external', 'Open on Solscan', () => call2(window.aurora.openLink(`https://solscan.io/token/${intel.mint}`)).catch(error => window.toast(error.message)))
    ].filter(Boolean);
    const summary = mk('div', 'ws-intel-summary');
    const identity = mk('div', 'ws-intel-identity');
    identity.append(pumpLogo({ symbol: intel.symbol, imageUrl: pair.imageUrl }), mk('div', 'ws-intel-name'));
    identity.querySelector('.ws-intel-name').append(mk('strong', '', intel.symbol), mk('small', '', `${intel.name} · ${short(intel.mint)}${intel.ageMs ? ` · ${ageLabel(Date.now() - intel.ageMs)}` : ''}`));
    const socials = pumpSocials({ mint: intel.mint, links: intel.links, pair });
    if (socials) identity.append(socials);
    summary.append(identity);
    const metricValues = intel.metrics || {};
    const metricsBox = mk('div', 'ws-intel-metrics');
    for (const [label, value] of [['Price', metricValues.priceUsd ? money(metricValues.priceUsd) : '—'], ['Market cap', metricValues.marketCap ? `$${compact(metricValues.marketCap)}` : '—'], ['Liquidity', metricValues.liquidityUsd ? `$${compact(metricValues.liquidityUsd)}` : '—'], ['24h', `${Number(metricValues.change24h || 0) >= 0 ? '+' : ''}${Number(metricValues.change24h || 0).toFixed(2)}%`]]) {
      const cell = mk('span'); cell.append(mk('small', '', label), mk('b', '', value)); metricsBox.append(cell);
    }
    summary.append(metricsBox);
    root.append(panel('Token intel', { actions }, summary));

    const dev = intel.dev;
    const devActions = [];
    if (dev?.tracked) devActions.push(mk('span', 'hf-badge ok', 'tracked dev'));
    else if (dev) devActions.push(btn('Track dev', { sm: true, variant: 'primary', icon: 'plus' }, run(async () => { const data = await trackIntelDev(intel); window.toast(`Tracking ${intel.symbol} dev.`); return data; })));
    if (dev) devActions.push(ibtn('external', 'Open dev on Solscan', () => call2(window.aurora.openLink(`https://solscan.io/account/${dev.address}`)).catch(error => window.toast(error.message))));
    const devBody = mk('div', 'ws-intel-dev');
    if (!dev) {
      devBody.append(mk('p', 'ws-sub', 'Creator is unknown for this token. Aurora learns creators from new Pump.fun launches while it is open.'));
    } else {
      const stats = mk('div', 'ws-intel-metrics');
      for (const [label, value] of [['Dev wallet', short(dev.address)], ['Holds', dev.balance > 0 ? `${num(dev.balance)}${dev.pct ? ` · ${dev.pct.toFixed(2)}%` : ''}` : 'none found'], ['Observed launches', String(dev.stats?.launches || 0)], ['Graduated', String(dev.stats?.completed || 0)]]) {
        const cell = mk('span'); cell.append(mk('small', '', label), mk('b', '', value)); stats.append(cell);
      }
      devBody.append(stats);
      if (dev.lastError) devBody.append(mk('p', 'ws-note hf-down', dev.lastError));
      if (dev.launches?.length) {
        const list = mk('div', 'ws-list');
        for (const launch of dev.launches.slice(0, 6)) {
          const item = listItem(launch.symbol || short(launch.mint), `${ageLabel(launch.createdAt)} · ${launch.completed ? 'graduated' : 'still bonding'}`, launch.marketCap ? `$${compact(launch.marketCap)}` : '—', undefined, undefined, mk('span', `hf-badge${launch.completed ? ' ok' : ''}`, launch.completed ? 'bonded' : 'bonding'));
          item.style.cursor = 'pointer';
          item.onclick = () => { section = 'trade'; selectToken(launch.mint); savePrefs(); draw(); };
          list.append(item);
        }
        devBody.append(list);
      } else {
        devBody.append(mk('p', 'ws-sub', 'No other launches observed yet. This is a local view, not a complete on-chain history.'));
      }
    }
    root.append(panel('Dev rap sheet', { actions: devActions }, devBody));

    const convergence = intel.convergence || {};
    const peopleActions = [mk('span', `hf-badge${convergence.kol > 0 ? ' ok' : ' muted'}`, convergence.kol > 0 ? `${convergence.kol} KOL convergence` : 'no KOL convergence')];
    const peopleBody = mk('div', 'ws-list');
    if (!intel.people?.length) peopleBody.append(emptyState('holders', 'No tracked people hold this token', 'Add KOLs or traders in People, scan them, then refresh intel.'));
    for (const person of intel.people || []) {
      const item = listItem(person.label, `${personRole(person.kind)} · ${short(person.address)} · ${person.source === 'followed' ? 'followed wallet' : 'tracked person'}${person.scanAt ? ` · scanned ${ageLabel(person.scanAt)}` : ''}`, money(person.value), undefined, undefined, personRoleBadge(person.kind));
      peopleBody.append(item);
    }
    if (convergence.kol > 0) peopleBody.prepend(mk('p', 'ws-note', `${convergence.kol} tracked KOL${convergence.kol === 1 ? '' : 's'} currently hold this token. Convergence is based on the latest wallet scans.`));
    root.append(panel('People & convergence', { actions: peopleActions }, peopleBody));
    root.append(panel('', {}, renderWalletGraph({ focusMint: intel.mint, focusSymbol: intel.symbol, dev: intel.dev, holders: intel.people })));

    const holders = intel.holders || {};
    const holderTable = mk('table', 'hf-table ws-holders-table');
    const thead = mk('thead'); const htr = mk('tr'); for (const [label, n] of [['Holder', false], ['Share', true], ['Tag', false]]) htr.append(mk('th', n ? 'num' : '', label)); thead.append(htr); holderTable.append(thead);
    const tb = mk('tbody');
    for (const account of (holders.accounts || []).slice(0, 10)) {
      const tr = mk('tr'); const td = mk('td'); td.append(mk('span', 'mono', short(account.address)));
      tr.append(td, mk('td', 'num', `${Number(account.pct || 0).toFixed(2)}%`), mk('td', '', account.isDev ? 'Dev' : account.label ? personRole(account.kind) : ''));
      tb.append(tr);
    }
    holderTable.append(tb);
    const holderSummary = mk('div', 'ws-intel-metrics');
    for (const [label, value] of [['Top 1', `${Number(holders.top1 || 0).toFixed(2)}%`], ['Top 10', `${Number(holders.top10 || 0).toFixed(2)}%`], ['Holders', holders.holders ? num(holders.holders) : '—'], ['Risk flags', String(intel.safety?.flags?.length || 0)]]) {
      const cell = mk('span'); cell.append(mk('small', '', label), mk('b', '', value)); holderSummary.append(cell);
    }
    root.append(panel('Top holders', {}, holderSummary, holderTable));
  }
  function drawResearch(root, s) {
    const target = intelMint || chartMint || (s.holdings || [])[0]?.mint || '';
    const reports = wallet()?.research || [];
    head(root, 'Research', 'Token intel, dev rap sheets, tracked holders and deep reports in one place.');
    const token = field('Token mint', 'text'); token.querySelector('input').value = target; token.querySelector('input').spellcheck = false;
    const runForm = mk('div', 'ws-runform');
    runForm.append(
      token,
      btn('Open intel', { variant: 'primary', sm: true, icon: 'research' }, run(async () => { const mint = (inputOf(token) || '').trim(); if (!mint) throw Error('Enter a token mint.'); await loadIntel(mint); return null; })),
      btn('Run report', { sm: true, variant: 'ghost', icon: 'chat' }, run(async () => { const mint = (inputOf(token) || '').trim(); if (!mint) throw Error('Enter a token mint.'); return call2(window.aurora.walletResearchStart({ mint, symbol: sym(mint, s) })); })),
      btn('Use current token', { sm: true, variant: 'ghost' }, () => { const mint = chartMint || (s.holdings || [])[0]?.mint || ''; token.querySelector('input').value = mint; })
    );
    root.append(panel('Token lookup', {}, runForm));
    if (intelLoading) root.append(panel('Token intel', {}, skeleton(4)));
    else if (intelError) {
      const retry = btn('Retry intel', { sm: true, variant: 'ghost', icon: 'refresh' }, run(async () => { await loadIntel(intelMint); return null; }));
      root.append(panel('Token intel', {}, emptyState('research', 'Could not load token intel', intelError), retry));
    } else if (intelData) renderTokenIntel(root, intelData);
    else {
      const intro = mk('div', 'ws-intel-empty');
      intro.append(mk('strong', '', 'Open a token to see its people'), mk('p', 'ws-sub', 'Paste a mint or use the current token. Gigi will show the dev, tracked holders, KOL convergence and top-holder labels.'));
      root.append(panel('Token intel', {}, intro));
    }
    const list = mk('div', 'ws-list');
    if (!reports.length) list.append(emptyState('research', 'No reports yet', 'Run a report above to keep its evidence.'));
    for (const item of reports) {
      const ct = mk('div', 'ws-ctrls');
      if (item.status === 'running') ct.append(ibtn('pause', 'Cancel', run(async () => call2(window.aurora.walletResearchCancel()))));
      else if (item.hasReport) ct.append(ibtn(reportOpen === item.id ? 'chevron' : 'external', reportOpen === item.id ? 'Close' : 'Open', run(async () => { if (reportOpen === item.id) { reportOpen = ''; reportText = ''; } else { const r = await call2(window.aurora.walletResearchReport(item.id)); reportOpen = item.id; reportText = r.report; } draw(); })));
      ct.append(ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletResearchRemove(item.id)))));
      const badge = mk('span', `hf-badge${item.status === 'ready' ? ' ok' : item.status === 'running' ? '' : ' muted'}`, item.status);
      const title = item.kind === 'wallet' ? (item.symbol || short(item.address)) : (item.symbol || short(item.mint));
      const kind = item.kind === 'wallet' ? 'wallet brief' : 'token';
      list.append(listItem(`${title} · ${kind}`, `${new Date(item.createdAt).toLocaleString()}${item.error ? ' · ' + item.error : ''}`, undefined, undefined, ct, badge));
      if (reportOpen === item.id && reportText) {
        const report = mk('div', 'ws-report');
        const rhead = mk('div', 'ws-report-head');
        rhead.append(mk('strong', '', item.kind === 'wallet' ? (item.symbol || short(item.address)) : (item.symbol || short(item.mint))), mk('span', 'ws-sub', `${item.kind === 'wallet' ? 'wallet brief' : 'token report'} · ${new Date(item.createdAt).toLocaleString()}`), mk('span', 'ws-top-spacer'), btn('Copy', { sm: true, variant: 'ghost', icon: 'share' }, async () => { try { await navigator.clipboard.writeText(reportText); window.toast('Report copied.'); } catch { window.toast('Could not copy.'); } }));
        const rbody = mk('div', 'ws-report-body');
        try { if (window.AuroraMarkdown) window.AuroraMarkdown.render(rbody, reportText); else rbody.textContent = reportText; } catch { rbody.textContent = reportText; }
        report.append(rhead, rbody); list.append(report);
      }
    }
    root.append(panel('Saved reports', {}, list));
  }

  function thesisCard(t) { const card = mk('div', 'ws-view'); const headr = mk('div', 'ws-view-head'); const ico = mk('div', 'ws-view-ico'); ico.append(ic('strategies', 16)); const title = mk('div', 'ws-view-title'); title.append(mk('strong', '', t.name), mk('small', '', t.rationale || '')); const actions = mk('div', 'ws-ctrls'); if (t.status !== 'active') actions.append(btn('Run in paper', { sm: true, variant: 'primary' }, run(async () => call2(window.aurora.walletThesisActivate(t.id))))); actions.append(ibtn('share', 'Copy call card', run(async () => { const r = await call2(window.aurora.walletThesisShare(t.id)); try { await navigator.clipboard.writeText(r.text); window.toast('Call card copied.'); } catch { window.toast('Could not copy.'); } }))); actions.append(ibtn('delete', 'Delete thesis', run(async () => call2(window.aurora.walletThesisRemove(t.id))))); headr.append(ico, title, mk('span', 'ws-top-spacer'), mk('span', `hf-badge${t.status === 'active' ? ' ok' : ' muted'}`, t.status), actions); card.append(headr); const body = mk('div', 'ws-view-body'); for (const leg of t.legs || []) { const row = mk('div', 'ws-leg'); row.append(mk('span', `ws-leg-side ${leg.side}`, leg.side), mk('strong', '', leg.symbol || short(leg.mint)), mk('span', 'ws-sub', leg.side === 'long' ? money(leg.sizeUsd) : 'note'), mk('span', 'ws-top-spacer'), mk('span', 'ws-sub', leg.note || '')); body.append(row); } if (t.exits?.text || t.exits?.stopLossPct || t.exits?.takeProfitPct) body.append(mk('p', 'ws-sub', `Exit: ${[t.exits.stopLossPct ? `stop ${t.exits.stopLossPct}%` : '', t.exits.takeProfitPct ? `target ${t.exits.takeProfitPct}%` : '', t.exits.text].filter(Boolean).join(' · ')}`)); card.append(body); return card; }
  function openNotification(n) {
    if (!n) return;
    if (!open) openWorkspace(true);
    if (!open) return;
    const followed = (wallet()?.followed || []).find(item => item.address === n.wallet);
    if (n.kind === 'wallet' && followed) { followSelected = followed.id; section = 'wallets'; savePrefs(); draw(); return; }
    if (n.url) call2(window.aurora.openLink(n.url)).catch(error => window.toast(error.message));
    else if (n.wallet) window.toast('That wallet is no longer followed.');
  }
  function alertKind(n) {
    return n.kind === 'person' ? { label: 'Radar', cls: ' ok', icon: 'live' } : n.kind === 'wallet' ? { label: 'Wallet', cls: '', icon: 'wallet' } : n.kind === 'signal' ? { label: 'Signal', cls: '', icon: 'strategies' } : n.kind === 'alert' ? { label: 'Price', cls: ' ok', icon: 'alert' } : n.kind === 'fill' ? { label: 'Fill', cls: ' muted', icon: 'trade' } : { label: 'System', cls: ' muted', icon: 'chat' };
  }
  function alertFills(s) {
    const rows = [];
    for (const order of (paper()?.orders || []).slice(-30)) rows.push({
      id: `paper-${order.id || order.at}-${order.mint}`, at: Number(order.at) || Date.now(), kind: 'fill', read: true,
      title: `Paper ${order.side} ${order.symbol || short(order.mint)}`,
      body: `${money(order.valueUsd)}${order.price ? ` at ${money(order.price)}` : ''}`
    });
    for (const execution of (wallet()?.executions || []).slice(-20)) rows.push({
      id: `live-${execution.id || execution.at}`, at: Number(execution.at) || Date.now(), kind: 'fill', read: true,
      title: `Live ${execution.side} ${execution.symbol || short(execution.mint)}`,
      body: `${execution.status || 'submitted'}${execution.valueUsd ? ` · ${money(execution.valueUsd)}` : ''}${execution.signature ? ` · ${execution.signature.slice(0, 8)}…` : ''}`,
      url: execution.signature ? `https://solscan.io/tx/${encodeURIComponent(execution.signature)}` : ''
    });
    return rows;
  }
  function alertCard(n) {
    const kind = alertKind(n);
    const card = mk('div', 'ws-alert-card' + (n.read ? '' : ' unread'));
    const icon = mk('span', 'ws-alert-icon'); icon.append(ic(kind.icon, 15));
    const body = mk('div', 'ws-alert-body');
    const top = mk('div', 'ws-alert-top');
    top.append(mk('strong', '', n.title), mk('span', `hf-badge${kind.cls}`, kind.label), mk('span', 'ws-alert-time', new Date(n.at).toLocaleTimeString()));
    body.append(top, mk('p', '', n.body || ''));
    if (n.url) {
      const open = btn('Open', { sm: true, variant: 'ghost', icon: 'external' }, () => call2(window.aurora.openLink(n.url)).catch(error => window.toast(error.message)));
      open.setAttribute('aria-label', 'Open transaction');
      body.append(open);
    }
    card.append(icon, body);
    if (n.kind === 'wallet' && n.wallet) { card.style.cursor = 'pointer'; card.onclick = event => { if (event.target.closest('button')) return; openNotification(n); }; }
    return card;
  }
  function drawAlerts(root, s) {
    const marks = (typeof view !== 'undefined' && view.notifications) || [];
    const fills = alertFills(s);
    const events = [...marks, ...fills].sort((a, b) => b.at - a.at);
    const alerts = s.alerts || [];
    const unread = marks.filter(item => !item.read).length;
    head(root, 'Alerts', 'Price alerts, signals and Radar events in one clean feed.', [
      btn('Mark all read', { sm: true, variant: 'ghost', disabled: !unread }, run(async () => call2(window.aurora.notificationsRead()))),
      btn('Clear', { sm: true, variant: 'ghost', disabled: !marks.length }, run(async () => call2(window.aurora.notificationsClear())))
    ]);
    const stats = mk('div', 'ws-statbar');
    stats.append(metric('Unread', String(unread)), metric('Events', String(events.length)), metric('Price alerts', String(alerts.length)), metric('Last event', events[0] ? ageLabel(events[0].at) : '—'));
    const filters = mk('div', 'ws-seg ws-alert-filters');
    const kinds = [['all', 'All', events.length], ['alert', 'Price', events.filter(item => item.kind === 'alert').length], ['signal', 'Signals', events.filter(item => item.kind === 'signal').length], ['person', 'Radar', events.filter(item => item.kind === 'person').length], ['wallet', 'Wallets', events.filter(item => item.kind === 'wallet').length], ['fill', 'Fills', fills.length], ['info', 'System', events.filter(item => item.kind === 'info').length]];
    for (const [id, label, count] of kinds) {
      const b = mk('button', alertFilter === id ? 'active' : '', `${label}${count ? ` ${count}` : ''}`); b.type = 'button';
      b.onclick = () => { alertFilter = id; draw(); }; filters.append(b);
    }
    const visible = alertFilter === 'all' ? events : events.filter(item => item.kind === alertFilter);
    const feed = mk('div', 'ws-alert-feed');
    if (!visible.length) feed.append(emptyState('alert', events.length ? 'Nothing in this filter' : 'No alerts yet', events.length ? 'Choose another filter.' : 'Price alerts, signals, Radar moves and wallet activity land here.'));
    for (const item of visible) feed.append(alertCard(item));
    root.append(panel('Activity', {}, filters, feed));
    const target = watchMint || chartMint || (s.markets || [])[0]?.mint || '';
    root.append(panel('Price alerts', {}, alertForm(target, sym(target, s), s), alertsBody(s)));
  }
  const STRATEGY_TEMPLATES = [
    {
      id: 'dip', kicker: 'MEAN REVERSION', title: 'Buy the dip',
      desc: 'Wait for a sharp 24h drawdown, then enter only when the short window turns up.',
      conditions: [{ metric: 'change24h', op: 'below', value: -15, windowMinutes: 0 }, { metric: 'change', op: 'above', value: 0, windowMinutes: 60 }],
      logic: 'and', sizingUsd: 25, cooldownSec: 3600, takeProfit: 30, stopLoss: 12
    },
    {
      id: 'breakout', kicker: 'MOMENTUM', title: 'Breakout',
      desc: 'Enter when the last hour accelerates while the token is already positive on 24h.',
      conditions: [{ metric: 'change', op: 'above', value: 8, windowMinutes: 60 }, { metric: 'change24h', op: 'above', value: 5, windowMinutes: 0 }],
      logic: 'and', sizingUsd: 25, cooldownSec: 1800, takeProfit: 40, stopLoss: 15
    },
    {
      id: 'trend', kicker: 'TREND', title: 'Trend follow',
      desc: 'Join strength only when both the day and the short window agree.',
      conditions: [{ metric: 'change24h', op: 'above', value: 10, windowMinutes: 0 }, { metric: 'change', op: 'above', value: 2, windowMinutes: 60 }],
      logic: 'and', sizingUsd: 25, cooldownSec: 3600, takeProfit: 35, stopLoss: 12
    },
    {
      id: 'panic', kicker: 'CAPITULATION', title: 'Panic reclaim',
      desc: 'Wait for a violent 24h flush, then buy only after the short window turns positive.',
      conditions: [{ metric: 'change24h', op: 'below', value: -25, windowMinutes: 0 }, { metric: 'change', op: 'above', value: 3, windowMinutes: 60 }],
      logic: 'and', sizingUsd: 15, cooldownSec: 14400, takeProfit: 35, stopLoss: 15
    },
    {
      id: 'pullback', kicker: 'PULLBACK', title: 'Strength pullback',
      desc: 'Buy a short-term dip while the token is still strongly positive on the day.',
      conditions: [{ metric: 'change24h', op: 'above', value: 15, windowMinutes: 0 }, { metric: 'change', op: 'below', value: -4, windowMinutes: 60 }],
      logic: 'and', sizingUsd: 25, cooldownSec: 3600, takeProfit: 25, stopLoss: 10
    },
    {
      id: 'reclaim', kicker: 'RECLAIM', title: 'First green hour',
      desc: 'After a weak day, enter when the last hour crosses back above flat.',
      conditions: [{ metric: 'change24h', op: 'below', value: -10, windowMinutes: 0 }, { metric: 'change', op: 'crossAbove', value: 0, windowMinutes: 60 }],
      logic: 'and', sizingUsd: 20, cooldownSec: 7200, takeProfit: 30, stopLoss: 12
    },
    {
      id: 'ignition', kicker: 'IGNITION', title: 'Momentum ignition',
      desc: 'A faster, higher-conviction entry when both the hour and the day accelerate.',
      conditions: [{ metric: 'change', op: 'above', value: 12, windowMinutes: 60 }, { metric: 'change24h', op: 'above', value: 10, windowMinutes: 0 }],
      logic: 'and', sizingUsd: 20, cooldownSec: 1800, takeProfit: 50, stopLoss: 18
    },
    {
      id: 'custom', kicker: 'YOUR RULES', title: 'Start from scratch',
      desc: 'Begin with one simple condition and build the rule yourself.',
      conditions: [{ metric: 'change24h', op: 'below', value: -10, windowMinutes: 0 }],
      logic: 'and', sizingUsd: 25, cooldownSec: 3600, takeProfit: 25, stopLoss: 10
    }
  ];
  const STRATEGY_PROFILES = [
    { id: 'conservative', title: 'Conservative', desc: 'Smaller entries, slower cadence, tighter stop.', sizingUsd: 10, cooldownSec: 14400, takeProfit: 20, stopLoss: 8 },
    { id: 'balanced', title: 'Balanced', desc: 'A measured default for most paper tests.', sizingUsd: 25, cooldownSec: 3600, takeProfit: 30, stopLoss: 12 },
    { id: 'aggressive', title: 'Aggressive', desc: 'Larger entries and wider targets. More variance.', sizingUsd: 50, cooldownSec: 900, takeProfit: 50, stopLoss: 20 }
  ];
  const STRATEGY_METRICS = [['change24h', '24h change'], ['change', 'Window change'], ['price', 'Price']];
  const STRATEGY_OPS = [['above', 'is above'], ['below', 'is below'], ['crossAbove', 'crosses above'], ['crossBelow', 'crosses below']];
  function strategyMetricLabel(metric) { return (STRATEGY_METRICS.find(item => item[0] === metric) || ['', 'Metric'])[1]; }
  function strategyOpLabel(op) { return (STRATEGY_OPS.find(item => item[0] === op) || ['', 'condition'])[1]; }
  function strategyWindowLabel(minutes) { const n = Number(minutes) || 0; return n >= 1440 ? `${Math.round(n / 1440)}d` : n >= 60 ? `${Math.round(n / 60)}h` : n > 0 ? `${n}m` : 'window'; }
  function strategyConditionText(condition, windowMinutes = 60) {
    const value = condition.metric === 'price' ? money(condition.value) : `${Number(condition.value || 0).toFixed(condition.metric === 'price' ? 0 : 1)}%`;
    return `${condition.metric === 'change' ? `${strategyWindowLabel(windowMinutes)} change` : strategyMetricLabel(condition.metric)} ${strategyOpLabel(condition.op)} ${value}`;
  }
  function strategySummary(conditions, logic = 'and', windowMinutes = 60) {
    return (conditions || []).map(condition => strategyConditionText(condition, windowMinutes)).join(logic === 'or' ? ' OR ' : ' AND ') || 'No conditions yet.';
  }
  function strategyCooldown(seconds) { const n = Number(seconds) || 0; return n >= 86400 ? `${Math.round(n / 86400)}d` : n >= 3600 ? `${Math.round(n / 3600)}h` : `${Math.max(1, Math.round(n / 60))}m`; }
  function strategyProfileFor(draft) {
    if (!draft) return 'custom';
    const match = STRATEGY_PROFILES.find(profile => Number(draft.sizingUsd) === profile.sizingUsd && Number(draft.cooldownSec) === profile.cooldownSec && Number(draft.takeProfit) === profile.takeProfit && Number(draft.stopLoss) === profile.stopLoss);
    return match ? match.id : 'custom';
  }
  function startStrategyBuilder(templateId = 'custom', existing = null) {
    const template = STRATEGY_TEMPLATES.find(item => item.id === templateId) || STRATEGY_TEMPLATES[0];
    strategyEditingId = existing?.id || '';
    strategyDraft = existing ? {
      name: existing.name || '', mint: existing.mint || '', symbol: existing.symbol || '',
      conditions: (existing.conditions || []).map(condition => ({ ...condition })), logic: existing.logic === 'or' ? 'or' : 'and',
      sizingUsd: Number(existing.sizingUsd) || 25, cooldownSec: Number(existing.cooldownSec) || 3600,
      windowMinutes: Number(existing.windowMinutes) || (existing.conditions || []).find(condition => condition.metric === 'change')?.windowMinutes || 60,
      takeProfit: Number(existing.exits?.takeProfit) || 0, stopLoss: Number(existing.exits?.stopLoss) || 0,
      execution: existing.execution === 'live' ? 'live' : 'paper'
    } : {
      name: '', mint: chartMint || '', symbol: chartMint ? sym(chartMint, state()) : '',
      conditions: template.conditions.map(condition => ({ ...condition })), logic: template.logic,
      sizingUsd: template.sizingUsd, cooldownSec: template.cooldownSec,
      windowMinutes: template.conditions.find(condition => condition.metric === 'change')?.windowMinutes || 60,
      takeProfit: template.takeProfit, stopLoss: template.stopLoss, execution: 'paper'
    };
    if (!strategyDraft.conditions.length) strategyDraft.conditions = [{ metric: 'change24h', op: 'below', value: -10, windowMinutes: 0 }];
    strategyTemplate = existing ? 'custom' : templateId;
    strategyStep = 0; strategyBuilderOpen = true; strategyBacktest = null; strategyBacktestError = ''; strategyBacktestLoading = false; strategyBacktestRange = '7D'; strategyProfile = existing ? 'custom' : strategyProfileFor(strategyDraft); draw();
  }
  function closeStrategyBuilder() { strategyBuilderOpen = false; strategyDraft = null; strategyEditingId = ''; strategyStep = 0; strategyBacktest = null; strategyBacktestError = ''; strategyBacktestLoading = false; draw(); }
  function applyStrategyTemplate(id) {
    const template = STRATEGY_TEMPLATES.find(item => item.id === id); if (!template || !strategyDraft) return;
    strategyTemplate = id;
    strategyDraft.conditions = template.conditions.map(condition => ({ ...condition }));
    strategyDraft.logic = template.logic;
    strategyDraft.windowMinutes = template.conditions.find(condition => condition.metric === 'change')?.windowMinutes || 60;
    strategyDraft.sizingUsd = template.sizingUsd;
    strategyDraft.cooldownSec = template.cooldownSec;
    strategyDraft.takeProfit = template.takeProfit;
    strategyDraft.stopLoss = template.stopLoss;
    strategyProfile = strategyProfileFor(strategyDraft);
    strategyBacktest = null; strategyBacktestError = '';
    draw();
  }
  async function saveStrategyDraft(status) {
    const draft = strategyDraft; if (!draft) return null;
    const conditions = (draft.conditions || []).filter(condition => STRATEGY_METRICS.some(item => item[0] === condition.metric) && STRATEGY_OPS.some(item => item[0] === condition.op) && Number.isFinite(Number(condition.value)));
    if (!draft.mint || draft.mint.trim().length < 32) throw Error('Choose a valid token mint first.');
    if (!conditions.length) throw Error('Add at least one trigger.');
    const symbol = (draft.symbol || sym(draft.mint, state()) || '').slice(0, 24);
    const name = (draft.name || `${symbol || 'Token'} ${strategyTemplate === 'custom' ? 'strategy' : (STRATEGY_TEMPLATES.find(item => item.id === strategyTemplate)?.title || 'strategy')}`).slice(0, 60);
    const data = await call2(window.aurora.walletStrategySave({
      ...(strategyEditingId ? { id: strategyEditingId } : {}),
      name, mint: draft.mint.trim(), symbol,
      conditions: conditions.map(condition => ({ metric: condition.metric, op: condition.op, value: Number(condition.value), windowMinutes: Number(condition.windowMinutes) || 0 })),
      logic: draft.logic, windowMinutes: Number(draft.windowMinutes) || 60, sizingUsd: Number(draft.sizingUsd) || 25, cooldownSec: Number(draft.cooldownSec) || 3600,
      exits: { takeProfit: Number(draft.takeProfit) || 0, stopLoss: Number(draft.stopLoss) || 0 },
      execution: draft.execution === 'live' ? 'live' : 'paper', status, mode: 'auto'
    }));
    strategyBuilderOpen = false; strategyDraft = null; strategyEditingId = ''; strategyStep = 0; strategyBacktest = null; strategyBacktestError = ''; strategyBacktestLoading = false;
    window.toast(status === 'active' ? 'Strategy activated in paper.' : 'Strategy saved as a draft.');
    return data;
  }
  function strategyTemplateCard(template, onClick) {
    const card = mk('button', 'ws-strategy-template' + (strategyTemplate === template.id ? ' active' : ''));
    card.type = 'button';
    card.append(mk('span', 'ws-strategy-kicker', template.kicker), mk('strong', '', template.title), mk('p', '', template.desc), mk('small', '', strategySummary(template.conditions, template.logic, template.conditions.find(condition => condition.metric === 'change')?.windowMinutes || 60)));
    card.onclick = onClick;
    return card;
  }
  function strategyConditionRow(condition, index) {
    const row = mk('div', 'ws-condition-row');
    const metric = mk('select', 'hf-input ws-condition-metric');
    for (const [value, label] of STRATEGY_METRICS) { const option = mk('option', '', label); option.value = value; metric.append(option); }
    metric.value = condition.metric;
    const op = mk('select', 'hf-input ws-condition-op');
    for (const [value, label] of STRATEGY_OPS) { const option = mk('option', '', label); option.value = value; op.append(option); }
    op.value = condition.op;
    const value = mk('input', 'hf-input ws-condition-value'); value.type = 'number'; value.step = 'any'; value.value = String(condition.value ?? '');
    const remove = ibtn('delete', 'Remove trigger', () => {
      if (!strategyDraft) return;
      strategyDraft.conditions.splice(index, 1);
      if (!strategyDraft.conditions.length) strategyDraft.conditions.push({ metric: 'change24h', op: 'below', value: -10, windowMinutes: 0 });
      strategyBacktest = null; strategyBacktestError = '';
      draw();
    });
    metric.onchange = () => { condition.metric = metric.value; strategyBacktest = null; strategyBacktestError = ''; draw(); };
    op.onchange = () => { condition.op = op.value; strategyBacktest = null; strategyBacktestError = ''; };
    value.oninput = () => { condition.value = Number(value.value); strategyBacktest = null; strategyBacktestError = ''; };
    row.append(metric, op, value, remove);
    return row;
  }
  function applyStrategyProfile(id) {
    const profile = STRATEGY_PROFILES.find(item => item.id === id); if (!profile || !strategyDraft) return;
    strategyProfile = id;
    strategyDraft.sizingUsd = profile.sizingUsd;
    strategyDraft.cooldownSec = profile.cooldownSec;
    strategyDraft.takeProfit = profile.takeProfit;
    strategyDraft.stopLoss = profile.stopLoss;
    strategyBacktest = null; strategyBacktestError = '';
    draw();
  }
  async function runStrategyBacktest() {
    if (!strategyDraft) return;
    strategyBacktestLoading = true; strategyBacktestError = '';
    draw();
    try {
      const result = await call2(window.aurora.walletStrategyBacktest({
        mint: strategyDraft.mint, conditions: strategyDraft.conditions, logic: strategyDraft.logic,
        windowMinutes: strategyDraft.windowMinutes,
        sizingUsd: strategyDraft.sizingUsd, takeProfit: strategyDraft.takeProfit, stopLoss: strategyDraft.stopLoss,
        cooldownSec: strategyDraft.cooldownSec, range: strategyBacktestRange, startingCash: 1000, feePct: 0.5
      }));
      strategyBacktest = result;
    } catch (error) { strategyBacktestError = error.message; }
    finally { strategyBacktestLoading = false; draw(); }
  }
  function strategyBuilderPanel(s) {
    const draft = strategyDraft;
    const wrap = mk('div', 'ws-strategy-builder');
    const bar = mk('div', 'ws-stepper');
    [['Asset', 'Pick the token'], ['Idea', 'Choose a setup'], ['Rules', 'Tune triggers'], ['Distill', 'Shape the risk'], ['Test', 'Check history'], ['Launch', 'Review and save']].forEach(([label, hint], index) => {
      const step = mk('button', 'ws-stepper-step' + (index === strategyStep ? ' active' : '') + (index < strategyStep ? ' done' : ''));
      step.type = 'button'; step.disabled = index > strategyStep;
      const stepLabel = mk('span', 'ws-stepper-label'); stepLabel.append(mk('strong', '', label), mk('small', '', hint));
      step.append(mk('span', 'ws-stepper-num', index < strategyStep ? '✓' : String(index + 1)), stepLabel);
      step.onclick = () => { if (index <= strategyStep) { strategyStep = index; draw(); } };
      bar.append(step);
    });
    wrap.append(bar);
    const body = mk('div', 'ws-strategy-step');
    if (strategyStep === 0) {
      body.append(mk('h3', 'ws-strategy-step-title', 'What are we trading?'));
      const token = field('Token mint', 'text'); token.querySelector('input').value = draft.mint || ''; token.querySelector('input').spellcheck = false; token.querySelector('input').placeholder = 'Paste a Solana mint';
      token.querySelector('input').oninput = () => { draft.mint = token.querySelector('input').value.trim(); if (!draft.symbol) draft.symbol = sym(draft.mint, s); strategyBacktest = null; };
      const use = btn('Use current token', { sm: true, variant: 'ghost' }, () => {
        const mint = chartMint || (s.holdings || [])[0]?.mint || '';
        if (!mint) return window.toast('Open a token in Trade first.');
        draft.mint = mint; draft.symbol = sym(mint, s); strategyBacktest = null; draw();
      });
      body.append(token, use);
      const picks = [...(s.holdings || []), ...(s.watchlist || [])].filter(item => item.mint).slice(0, 5);
      if (picks.length) {
        const chips = mk('div', 'ws-strategy-picks');
        for (const item of picks) {
          const chip = mk('button', 'ws-chip', item.symbol || short(item.mint)); chip.type = 'button';
          chip.onclick = () => { draft.mint = item.mint; draft.symbol = item.symbol || sym(item.mint, s); strategyBacktest = null; draw(); };
          chips.append(chip);
        }
        body.append(mk('span', 'ws-sub', 'Quick picks'), chips);
      }
      body.append(mk('p', 'ws-sub ws-note', 'A strategy watches this token. It does not place a live order until you explicitly activate it.'));
    } else if (strategyStep === 1) {
      body.append(mk('h3', 'ws-strategy-step-title', 'Choose an idea'));
      body.append(mk('p', 'ws-sub ws-note', 'Start with a proven shape, then tune every trigger on the next step.'));
      const templates = mk('div', 'ws-strategy-templates');
      for (const template of STRATEGY_TEMPLATES) templates.append(strategyTemplateCard(template, () => applyStrategyTemplate(template.id)));
      body.append(templates);
      const chosen = STRATEGY_TEMPLATES.find(item => item.id === strategyTemplate);
      if (chosen) body.append(mk('p', 'ws-strategy-preview', `${chosen.title}: buy when ${strategySummary(chosen.conditions, chosen.logic, draft.windowMinutes)}.`));
    } else if (strategyStep === 2) {
      body.append(mk('h3', 'ws-strategy-step-title', 'Tune the triggers'));
      body.append(mk('p', 'ws-sub ws-note', 'Keep it simple. Two or three triggers are usually enough. Every change clears the old test result.'));
      const conditions = mk('div', 'ws-condition-list');
      const renderConditions = () => { conditions.replaceChildren(); draft.conditions.forEach((condition, index) => conditions.append(strategyConditionRow(condition, index))); };
      renderConditions();
      const add = btn('Add trigger', { sm: true, variant: 'ghost', icon: 'plus' }, () => {
        if (draft.conditions.length >= 8) return window.toast('Eight triggers is the maximum.');
        draft.conditions.push({ metric: 'change24h', op: 'below', value: -10, windowMinutes: 0 }); strategyBacktest = null; draw();
      });
      const logic = mk('div', 'ws-seg');
      for (const [value, label] of [['and', 'Match all'], ['or', 'Match any']]) { const b = mk('button', draft.logic === value ? 'active' : '', label); b.type = 'button'; b.onclick = () => { draft.logic = value; strategyBacktest = null; draw(); }; logic.append(b); }
      const logicWrap = mk('div', 'ws-strategy-logic'); logicWrap.append(mk('span', 'ws-sub', 'Logic'), logic);
      const windowField = field('Window for change triggers', 'select', ['15m', '1h', '4h', '24h']); const windowValues = [15, 60, 240, 1440]; [...windowField.querySelectorAll('option')].forEach((option, index) => { option.value = String(windowValues[index]); }); windowField.querySelector('select').value = String(draft.windowMinutes || 60); windowField.querySelector('select').onchange = () => { draft.windowMinutes = Number(windowField.querySelector('select').value) || 60; strategyBacktest = null; draw(); };
      body.append(conditions, add, logicWrap, window, mk('p', 'ws-strategy-preview', `Buy when ${strategySummary(draft.conditions, draft.logic, draft.windowMinutes)}.`));
    } else if (strategyStep === 3) {
      body.append(mk('h3', 'ws-strategy-step-title', 'Distill the risk'));
      body.append(mk('p', 'ws-sub ws-note', 'Choose a risk profile, then adjust it. Smaller size and tighter stops survive more mistakes.'));
      const profiles = mk('div', 'ws-strategy-profiles');
      const activeProfile = strategyProfileFor(draft);
      for (const profile of STRATEGY_PROFILES) {
        const card = mk('button', 'ws-strategy-profile' + (activeProfile === profile.id ? ' active' : '')); card.type = 'button';
        card.append(mk('strong', '', profile.title), mk('p', '', profile.desc), mk('small', '', `${money(profile.sizingUsd)} entry · ${strategyCooldown(profile.cooldownSec)} cooldown · ${profile.takeProfit}% TP · ${profile.stopLoss}% SL`));
        card.onclick = () => applyStrategyProfile(profile.id);
        profiles.append(card);
      }
      body.append(profiles);
      const size = field('Size per entry (USD)', 'number'); size.querySelector('input').value = String(draft.sizingUsd || 25); size.querySelector('input').oninput = () => { draft.sizingUsd = Number(size.querySelector('input').value) || 25; strategyProfile = 'custom'; strategyBacktest = null; };
      const cooldown = field('Cooldown', 'select', ['5m', '15m', '1h', '4h', '24h']); const cooldownValues = [300, 900, 3600, 14400, 86400]; [...cooldown.querySelectorAll('option')].forEach((option, index) => { option.value = String(cooldownValues[index]); }); cooldown.querySelector('select').value = String(draft.cooldownSec || 3600); cooldown.querySelector('select').onchange = () => { draft.cooldownSec = Number(cooldown.querySelector('select').value); strategyProfile = 'custom'; strategyBacktest = null; };
      const tp = field('Take profit %', 'number'); tp.querySelector('input').value = String(draft.takeProfit || 0); tp.querySelector('input').oninput = () => { draft.takeProfit = Number(tp.querySelector('input').value) || 0; strategyProfile = 'custom'; strategyBacktest = null; };
      const sl = field('Stop loss %', 'number'); sl.querySelector('input').value = String(draft.stopLoss || 0); sl.querySelector('input').oninput = () => { draft.stopLoss = Number(sl.querySelector('input').value) || 0; strategyProfile = 'custom'; strategyBacktest = null; };
      const fields = mk('div', 'ws-strategy-riskfields'); fields.append(size, cooldown, tp, sl);
      body.append(fields, mk('p', 'ws-sub ws-note', `Approx. max loss per entry at the stop: ${money((draft.sizingUsd || 0) * (draft.stopLoss || 0) / 100)} plus fees.`));
    } else if (strategyStep === 4) {
      body.append(mk('h3', 'ws-strategy-step-title', 'Test the idea'));
      body.append(mk('p', 'ws-sub ws-note', 'Run the rule over cached candles. Fees are included at 0.5% per side. This is a sanity check, not a promise.'));
      const controls = mk('div', 'ws-strategy-testbar');
      const range = mk('select', 'hf-input'); for (const value of ['1D', '7D', '30D']) { const option = mk('option', '', value); option.value = value; range.append(option); } range.value = strategyBacktestRange;
      range.onchange = () => { strategyBacktestRange = range.value; strategyBacktest = null; strategyBacktestError = ''; draw(); };
      controls.append(range, btn(strategyBacktestLoading ? 'Testing…' : 'Run test', { sm: true, variant: 'primary', icon: 'run', disabled: strategyBacktestLoading }, () => runStrategyBacktest().catch(error => window.toast(error.message))));
      body.append(controls);
      if (strategyBacktestLoading) body.append(skeleton(3));
      else if (strategyBacktestError) body.append(mk('p', 'ws-sub ws-note hf-down', strategyBacktestError));
      else if (strategyBacktest) {
        const metrics = strategyBacktest.metrics || {};
        const stats = mk('div', 'ws-backtest-metrics');
        for (const [label, value, cls] of [
          ['Win rate', `${Number(metrics.winRate || 0).toFixed(1)}%`, metrics.winRate >= 50 ? 'hf-up' : ''],
          ['Trades', `${metrics.trades || 0} · W/L ${metrics.wins || 0}/${metrics.losses || 0}`, ''],
          ['Net P&L', `${(metrics.netPnl || 0) >= 0 ? '+' : ''}${money(metrics.netPnl || 0)}`, (metrics.netPnl || 0) >= 0 ? 'hf-up' : 'hf-down'],
          ['Return', `${(metrics.returnPct || 0) >= 0 ? '+' : ''}${Number(metrics.returnPct || 0).toFixed(2)}%`, (metrics.returnPct || 0) >= 0 ? 'hf-up' : 'hf-down'],
          ['Max drawdown', `${Number(metrics.maxDrawdownPct || 0).toFixed(1)}%`, 'hf-down'],
          ['Profit factor', metrics.profitFactor == null ? '∞' : Number(metrics.profitFactor).toFixed(2), '']
        ]) { const cell = mk('span'); cell.append(mk('small', '', label), mk('b', cls, value)); stats.append(cell); }
        body.append(stats);
        const chart = mk('div', 'ws-backtest-chart'); chart.append(sparkline((strategyBacktest.equity || []).map(point => ({ p: point.p })), 560, 120)); body.append(chart);
        const tradeList = mk('div', 'ws-list ws-backtest-trades');
        for (const trade of (strategyBacktest.trades || []).slice(0, 5)) tradeList.append(listItem(new Date(trade.entryAt).toLocaleString(), `${trade.reason} · ${trade.holdMinutes >= 60 ? `${(trade.holdMinutes / 60).toFixed(1)}h` : `${Math.round(trade.holdMinutes)}m`}`, `${trade.pnl >= 0 ? '+' : ''}${money(trade.pnl)}`, undefined, undefined, mk('span', `hf-badge${trade.pnl >= 0 ? ' ok' : ' live'}`, trade.pnl >= 0 ? 'win' : 'loss')));
        if ((strategyBacktest.trades || []).length) body.append(panel('Recent test trades', {}, tradeList));
        body.append(mk('p', 'ws-sub ws-note', `${strategyBacktest.candles} candles · ${strategyBacktest.range} · starts at ${money(strategyBacktest.startingCash)}. Past results do not predict future returns.`));
      } else body.append(emptyState('strategies', 'Ready to test', 'Run the test to see win rate, trades, P&L and drawdown.'));
    } else {
      body.append(mk('h3', 'ws-strategy-step-title', 'Review and launch'));
      const name = field('Strategy name', 'text'); name.querySelector('input').value = draft.name || `${draft.symbol || 'Token'} setup`; name.querySelector('input').oninput = () => { draft.name = name.querySelector('input').value; };
      body.append(name);
      const review = mk('div', 'ws-strategy-review');
      review.append(mk('strong', '', 'The distilled rule'), mk('p', '', `Buy ${draft.symbol || short(draft.mint)} when ${strategySummary(draft.conditions, draft.logic, draft.windowMinutes)}.`), mk('small', '', `${money(draft.sizingUsd)} per entry · ${strategyCooldown(draft.cooldownSec)} cooldown · take profit ${draft.takeProfit || 0}% · stop loss ${draft.stopLoss || 0}%${draft.execution === 'live' ? ' · live execution preserved' : ' · paper only'}`));
      body.append(review);
      if (!strategyBacktest) body.append(mk('p', 'ws-sub ws-note', 'No test result yet. You can launch anyway, but testing first is recommended.'));
      body.append(mk('p', 'ws-sub ws-note', 'Paper first. Aurora asks before any live execution.'));
    }
    const nav = mk('div', 'ws-strategy-nav');
    if (strategyStep > 0) nav.append(btn('Back', { sm: true, variant: 'ghost' }, () => { strategyStep -= 1; draw(); }));
    nav.append(mk('span', 'ws-top-spacer'));
    if (strategyStep < 5) nav.append(btn('Continue', { sm: true, variant: 'primary' }, () => {
      if (strategyStep === 0) { if (!draft.mint || draft.mint.length < 32) return window.toast('Paste a valid token mint.'); draft.symbol = draft.symbol || sym(draft.mint, s); draft.name = draft.name || `${draft.symbol || 'Token'} ${strategyTemplate === 'custom' ? 'strategy' : STRATEGY_TEMPLATES.find(item => item.id === strategyTemplate)?.title || 'strategy'}`; }
      if (strategyStep === 2 && !draft.conditions.length) return window.toast('Add at least one trigger.');
      strategyStep += 1; draw();
    }));
    if (strategyStep === 5) {
      nav.append(btn('Save draft', { sm: true, variant: 'ghost' }, run(async () => saveStrategyDraft('draft'))));
      nav.append(btn('Activate paper', { sm: true, variant: 'primary', icon: 'play' }, run(async () => saveStrategyDraft('active'))));
    }
    wrap.append(body, nav);
    return panel(strategyEditingId ? 'Edit strategy' : 'Build a strategy', { actions: [btn('Cancel', { sm: true, variant: 'ghost' }, closeStrategyBuilder)] }, wrap);
  }
  function strategyCard(st) {
    const card = mk('div', `ws-strategy-card${st.status === 'active' ? ' active' : ''}`);
    const head = mk('div', 'ws-strategy-card-head');
    const title = mk('div', 'ws-strategy-card-title');
    title.append(mk('strong', '', st.name), mk('small', '', `${st.symbol || short(st.mint)} · ${(st.execution || 'paper').toUpperCase()}`));
    const badge = mk('span', `hf-badge${st.status === 'active' ? ' ok' : ' muted'}`, st.status);
    head.append(title, badge);
    const rule = mk('p', 'ws-strategy-rule', `Buy when ${strategySummary(st.conditions, st.logic, st.windowMinutes)}.`);
    const chips = mk('div', 'ws-strategy-chips');
    for (const [label, value] of [['Entry', money(st.sizingUsd)], ['Every', strategyCooldown(st.cooldownSec)], ['TP', st.exits?.takeProfit ? `${st.exits.takeProfit}%` : '—'], ['SL', st.exits?.stopLoss ? `${st.exits.stopLoss}%` : '—'], ['Triggers', String(st.triggers || 0)]]) chips.append(mk('span', 'ws-strategy-chip', `${label} ${value}`));
    const actions = mk('div', 'ws-strategy-card-actions');
    actions.append(btn('Edit', { sm: true, variant: 'ghost', icon: 'strategies' }, () => startStrategyBuilder('custom', st)));
    actions.append(btn(st.status === 'active' ? 'Pause' : 'Activate', { sm: true, variant: st.status === 'active' ? 'ghost' : 'primary', icon: st.status === 'active' ? 'pause' : 'play' }, run(async () => call2(window.aurora.walletStrategyStatus({ id: st.id, status: st.status === 'active' ? 'paused' : 'active' })))));
    actions.append(ibtn('run', 'Run once', run(async () => { const r = await call2(window.aurora.walletStrategyRun(st.id)); window.toast(r.executed ? 'Triggered.' : (r.error || 'Conditions not met.')); })));
    actions.append(ibtn('switch', st.execution === 'live' ? 'Switch to paper' : 'Switch to live', run(async () => call2(window.aurora.walletStrategySave({ ...st, execution: st.execution === 'live' ? 'paper' : 'live' })))));
    actions.append(ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletStrategyRemove(st.id)))));
    card.append(head, rule, chips, actions);
    if (st.lastDetail) card.append(mk('p', 'ws-strategy-last', `Last: ${st.lastDetail}`));
    if (st.lastError) card.append(mk('p', 'ws-strategy-last hf-down', st.lastError));
    return card;
  }
  function drawStrategies(root, s) {
    const limits = cfg().limits || {};
    const strategies = wallet()?.strategies || [];
    const theses = wallet()?.theses || [];
    const liveAuto = cfg().liveAutoEnabled === true;
    const actions = [
      btn(strategyBuilderOpen ? 'Close builder' : 'New strategy', { variant: 'primary', sm: true, icon: strategyBuilderOpen ? 'chevron' : 'plus' }, () => strategyBuilderOpen ? closeStrategyBuilder() : startStrategyBuilder('custom')),
      btn(liveAuto ? 'Live auto on' : 'Live auto off', { sm: true, variant: liveAuto ? 'primary' : 'ghost', icon: 'switch' }, run(async () => {
        if (!liveAuto) {
          if (cfg().execution !== 'live') throw Error('Switch to Live first.');
          if (!cfg().vaultWalletId && !wallet()?.wc?.connected) throw Error('Select a live signing wallet first.');
          if (!window.confirm('Enable live auto? Active LIVE strategies can place real trades automatically after their cooldown. Start with small caps.')) return null;
        }
        return call2(window.aurora.walletConfig({ liveAutoEnabled: !liveAuto }));
      })),
      btn('Ask Gigi', { sm: true, variant: 'ghost', icon: 'chat' }, () => askGigi('Help me build a Solana strategy: token, trigger, sizing, cooldown, take profit and stop loss. Explain the rule in plain language first, then create it as a paper strategy.'))
    ];
    head(root, 'Strategies', `Guided paper rules. Limits: position ${limits.maxPositionUsd ? money(limits.maxPositionUsd) : 'off'} · total ${limits.maxTotalUsd ? money(limits.maxTotalUsd) : 'off'} · daily ${limits.dailyCapUsd ? money(limits.dailyCapUsd) : 'off'}.`, actions);
    if (liveAuto) root.append(mk('p', 'ws-sub ws-note hf-down', 'Live auto is ON. Active LIVE strategies can execute real trades after their cooldown.'));
    if (strategyBuilderOpen) root.append(strategyBuilderPanel(s));
    else {
      const templates = mk('div', 'ws-strategy-templates ws-strategy-templates-page');
      for (const template of STRATEGY_TEMPLATES) templates.append(strategyTemplateCard(template, () => startStrategyBuilder(template.id)));
      root.append(panel('Start with a setup', {}, templates));
    }
    const grid = mk('div', 'ws-strategy-grid');
    if (!strategies.length) grid.append(emptyState('strategies', 'No strategies yet', 'Pick a setup above and Aurora will walk you through it.'));
    else for (const st of strategies) grid.append(strategyCard(st));
    root.append(panel(`Your strategies${strategies.length ? ` · ${strategies.length}` : ''}`, {}, grid));
    if (theses.length) { const thesisGrid = mk('div', 'ws-canvas'); for (const t of theses) thesisGrid.append(thesisCard(t)); root.append(panel('Theses', {}, thesisGrid)); }
    root.append(panel('Signals', {}, signalForm(s), signalListBody()));
  }
  function signalListBody() {
    const list = mk('div', 'ws-list'); const sigs = wallet()?.signals || [];
    if (!sigs.length) list.append(emptyState('alert', 'No signals yet', 'Create one above, or ask Gigi: “ping me when SOL drops 20%.”'));
    for (const sg of sigs) {
      const ct = mk('div', 'ws-ctrls');
      ct.append(ibtn(sg.enabled ? 'pause' : 'play', sg.enabled ? 'Disable' : 'Enable', run(async () => call2(window.aurora.walletSignalToggle(sg.id, !sg.enabled)))), ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletSignalRemove(sg.id)))));
      const badge = mk('span', `hf-badge${sg.enabled ? ' ok' : ' muted'}`, sg.action === 'paper-buy' ? 'paper buy' : 'notify');
      list.append(listItem(`${sg.name} · ${sg.symbol || short(sg.mint)}`, `${sg.condition.metric} ${sg.condition.op} ${num(sg.condition.value)}${sg.requireResearch ? ' · needs fresh research' : ''}${sg.lastTriggeredAt ? ' · last ' + new Date(sg.lastTriggeredAt).toLocaleString() : ''}`, undefined, undefined, ct, badge));
    }
    return list;
  }
  function csvDownload(name, rows) { const csv = rows.map(row => row.map(cell => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = mk('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function journalRows(p, s) { const rows = []; for (const o of p?.orders || []) rows.push({ kind: 'paper', at: o.at, mint: o.mint, symbol: o.symbol || short(o.mint), side: o.side, value: o.valueUsd, pnl: o.side === 'sell' ? o.realizedPnlUsd : '', status: '', signature: '' }); for (const ex of wallet()?.executions || []) rows.push({ kind: 'live', at: ex.at, mint: ex.mint, symbol: sym(ex.mint, s), side: ex.side, value: ex.valueUsd ? money(ex.valueUsd) : '', pnl: '', status: ex.status, signature: ex.signature || '', venue: ex.venue || '', pool: ex.pool || '' }); return rows.sort((a, b) => b.at - a.at); }
  function drawJournal(root, s) {
    const p = paper(); const all = journalRows(p, s);
    head(root, 'Journal', 'Every paper order and live execution, tied to research and revisions.', [btn('Export CSV', { sm: true, variant: 'ghost', icon: 'external', disabled: !all.length }, () => { if (!all.length) return; csvDownload(`aurora-journal-${Date.now()}.csv`, [['kind', 'when', 'symbol', 'side', 'value', 'pnl', 'status', 'signature'], ...all.map(row => [row.kind, new Date(row.at).toISOString(), row.symbol, row.side, row.value, row.pnl, row.status, row.signature])]); window.toast('Journal exported.'); })]);
    const filtered = all.filter(row => (journalKind === 'all' || row.kind === journalKind) && (!journalFilter || `${row.symbol} ${row.mint || ''}`.toLowerCase().includes(journalFilter.toLowerCase())));
    const filter = mk('input', 'hf-input'); filter.type = 'search'; filter.placeholder = 'Filter by token'; filter.value = journalFilter; filter.oninput = () => { journalFilter = filter.value; draw(); };
    const kindSel = mk('select', 'hf-input'); for (const k of ['all', 'paper', 'live']) { const opt = mk('option', '', k === 'all' ? 'All orders' : k === 'paper' ? 'Paper' : 'Live'); opt.value = k; kindSel.append(opt); } kindSel.value = journalKind; kindSel.onchange = () => { journalKind = kindSel.value; draw(); };
    const controls = mk('div', 'ws-form'); controls.append(filter, kindSel); root.append(panel('', {}, controls));
    const list = mk('div', 'ws-list');
    for (const row of filtered.slice(0, 60)) { const pnl = row.pnl !== '' && row.pnl != null ? ` · P/L ${money(row.pnl)}` : ''; const sub = `${new Date(row.at).toLocaleString()} · ${row.kind}${row.venue ? ' · ' + row.venue : ''}${row.pool ? ' · ' + row.pool : ''}${row.signature ? ' · ' + row.signature.slice(0, 8) + '…' : ''}${row.status ? ' · ' + row.status : ''}${pnl}`; list.append(listItem(`${row.side === 'buy' ? 'Bought' : 'Sold'} ${row.symbol}`, sub, row.value !== '' ? money(row.value) : undefined, undefined, undefined, mk('span', `hf-badge${row.status === 'confirmed' ? ' ok' : row.status === 'failed' ? ' live' : ' muted'}`, row.kind))); }
    root.append(panel('Orders', {}, filtered.length ? list : emptyState('journal', all.length ? 'No matches' : 'No orders yet', all.length ? 'Try another filter.' : 'Paper trades, conditions and live swaps appear here.')));
  }

  // ---- command palette ----
  function paletteCommands() { const cmds = []; for (const [id, label] of SECTIONS) cmds.push({ label: `Go to ${label}`, hint: 'section', id, run: () => { section = id; savePrefs(); draw(); } }); if (chartMint) { cmds.push({ label: 'Paper buy 25', hint: 'action', run: () => call2(window.aurora.walletPaperBuy({ mint: chartMint, usd: 25 })) }); cmds.push({ label: 'Start research', hint: 'action', run: () => call2(window.aurora.walletResearchStart({ mint: chartMint, symbol: sym(chartMint, state()) })) }); cmds.push({ label: 'Show holders', hint: 'action', run: () => call2(window.aurora.walletViewShow({ type: 'holders', title: `Holders · ${sym(chartMint, state())}`, source: { kind: 'holders', mint: chartMint } })) }); } cmds.push({ label: platform === 'pumpfun' ? 'Switch to Solana' : 'Switch to Pump.fun', hint: 'platform', run: () => { platform = platform === 'pumpfun' ? 'solana' : 'pumpfun'; section = 'discover'; savePrefs(); draw(); } });
    cmds.push({ label: cfg().execution === 'live' ? 'Switch to Paper' : 'Switch to Live', hint: 'action', run: () => call2(window.aurora.walletConfig({ execution: cfg().execution === 'live' ? 'paper' : 'live' })) }); cmds.push({ label: 'Open Settings', hint: 'settings', run: () => { close(); el('wallet-open')?.click(); } }); return cmds; }
  function renderPalette(query = '') { paletteList.replaceChildren(); const q = query.toLowerCase(); const cmds = paletteCommands().filter(c => !q || c.label.toLowerCase().includes(q)); for (const cmd of cmds) { const item = listItem(cmd.label, cmd.hint); item.style.cursor = 'pointer'; item.onclick = () => runPalette(cmd); paletteList.append(item); } if (query.trim().length >= 2) call2(window.aurora.walletSearch(query)).then(found => { for (const token of found.slice(0, 6)) { const item = listItem(`${token.symbol} · ${money(token.priceUsd)}`, 'search'); item.style.cursor = 'pointer'; item.onclick = () => { closePalette(); section = 'trade'; selectToken(token.address); }; paletteList.append(item); } }).catch(() => {}); }
  function runPalette(cmd) { closePalette(); Promise.resolve(cmd.run && cmd.run()).then(data => { if (isSnapshot(data)) window.render(data); }).catch(error => window.toast(error.message)); }
  function openPalette() { palette.hidden = false; paletteInput.value = ''; renderPalette(''); paletteInput.focus(); }
  function closePalette() { palette.hidden = true; }
  paletteInput.oninput = () => renderPalette(paletteInput.value);
  paletteInput.onkeydown = event => { if (event.key === 'Enter') { const first = paletteList.querySelector('.ws-item'); if (first) first.click(); } if (event.key === 'Escape') closePalette(); };
  palette.onclick = event => { if (event.target === palette) closePalette(); };

  // ---- wiring ----
  for (const b of ws.querySelectorAll('#ws-seg button')) b.onclick = run(async () => call2(window.aurora.walletConfig({ execution: b.dataset.exec })));
  el('ws-close').onclick = close; el('ws-settings').onclick = () => el('wallet-open')?.click();
  ws.querySelector('#ws-viewer-close').onclick = closeViewer; viewer.onclick = event => { if (event.target === viewer) closeViewer(); };
  for (const b of ws.querySelectorAll('#ws-platform button')) b.onclick = () => { platform = ['pumpfun', 'xstocks'].includes(b.dataset.platform) ? b.dataset.platform : 'solana'; if (platform !== 'solana') section = 'discover'; if (platform === 'xstocks') { xTab = 'featured'; xPage = 1; } savePrefs(); draw(); };
  el('ws-chat-visible').onclick = () => { chatOpen = !chatOpen; savePrefs(); draw(); };
  el('ws-chat-collapse').onclick = () => { chatOpen = false; savePrefs(); draw(); };
  const resizer = el('ws-resizer'); resizer.onpointerdown = event => { event.preventDefault(); const startX = event.clientX, startW = chatW; const move = e => { chatW = Math.max(300, Math.min(720, startW - (e.clientX - startX))); chat.style.width = `${chatW}px`; }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); savePrefs(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); };
  const search = el('ws-search'); let searchTimer;
  search.oninput = () => { clearTimeout(searchTimer); const q = search.value.trim(); if (!q) { results.hidden = true; return; } searchTimer = setTimeout(async () => { try { const found = await call2(window.aurora.walletSearch(q)); results.replaceChildren(); for (const token of found.slice(0, 10)) { const item = listItem(token.symbol, `${money(token.priceUsd)} · ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`); item.style.cursor = 'pointer'; item.onclick = () => { results.hidden = true; search.value = ''; section = 'trade'; selectToken(token.address); }; results.append(item); } results.hidden = !found.length; } catch (error) { window.toast(error.message); } }, 300); };
  document.addEventListener('click', event => { if (!event.target.closest('.ws-search')) results.hidden = true; });
  document.addEventListener('keydown', event => { if (!open) return; if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); } if (event.key === 'Escape') { if (!tutorial.hidden) { closeTutorial(); return; } closePalette(); results.hidden = true; if (!viewer.hidden) closeViewer(); } });

  window.AuroraWorkspace = { open: openWorkspace, enter: () => openWorkspace(true), close, isOpen: () => open, toggle: () => open ? close() : openWorkspace(true) };
  window.addEventListener('aurora-view-rendered', () => { if (!open) return; draw(); });
  window.aurora.onEvent(event => {
    if (event.type === 'wallet' && open) { if (typeof view !== 'undefined') view.wallet = event.wallet; draw(); }
    if (event.type === 'view' && open) { if (typeof view !== 'undefined' && view.wallet) view.wallet.view = event.view; draw(); openViewer(event.view); }
    if (event.type === 'wallet-signal') window.toast(`Signal · ${event.signal.name}${event.signal.detail ? ' · ' + event.signal.detail : ''}`);
    if (event.type === 'notification') { if (typeof view !== 'undefined') view.notifications = event.notifications; if (open) draw(); }
    if (event.type === 'pump-auto') applyPumpAuto(event.auto);
    if (event.type === 'pump-launch') mergePumpLaunches(event.rows, event.at);
    if (event.type === 'wallet-scan-progress') { if (typeof view !== 'undefined') view.scanJob = event.job; if (open) draw(); }
    if (event.type === 'people-activity') { const item = event.item || {}; if (item.action === 'launch') window.toast(`${item.label} launched ${item.symbol}.`); else if (item.action === 'graduated') window.toast(`${item.symbol} graduated.`); else if (item.action === 'convergence') window.toast(`${item.label} hold ${item.symbol}.`); else if (item.label) window.toast(`${item.label} ${item.action} ${item.symbol || ''}`.trim()); if (open && section === 'people') draw(); }
    if (event.type === 'people-scan-progress') { peopleScanState = event.job; if (open) draw(); }
    if (event.type === 'people-scan-complete') { peopleScanState = event.job; if (open) draw(); if (event.job) window.toast(`Scanned ${event.job.done} person${event.job.done === 1 ? '' : 's'}${event.job.errors ? ` · ${event.job.errors} failed` : ''}.`); }
    if (event.type === 'wallet-scan-complete') { if (typeof view !== 'undefined') view.scanJob = event.job; if (open) draw(); if (event.job) window.toast(`Scanned ${event.job.done} wallet${event.job.done === 1 ? '' : 's'}${event.job.errors ? ` · ${event.job.errors} failed` : ''}.`); }
    if (event.type === 'notification-open') openNotification(event.notification);
    if (event.type === 'wallet-alert') window.toast(`Alert · ${event.alert.symbol || short(event.alert.mint)} ${event.alert.direction} ${money(event.alert.price)} (now ${money(event.alert.current)})`);
  });
  const navButton = el('trading-open'); if (navButton) navButton.onclick = () => window.AuroraWorkspace.toggle();
  const cryptoButton = el('crypto-open'); if (cryptoButton) cryptoButton.onclick = () => window.AuroraWorkspace.open(true);
})();
