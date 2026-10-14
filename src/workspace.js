// Gigi's Solana desk. Mounts inside <main> so the app sidebar stays. Built on
// the shared ui.css components. Only reachable while Gigi is the active waifu.
(() => {
  const el = id => document.getElementById(id);
  const wallet = () => (typeof view !== 'undefined' && view.wallet) ? view.wallet : null;
  const cfg = () => wallet()?.config || {};
  const state = () => wallet()?.state || {};
  const paper = () => wallet()?.paper || null;
  const money = v => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 1 ? 4 : 2 })}`;
  const amount = v => Number(v || 0) >= 1 ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }) : Number(v || 0).toPrecision(4);
  const short = m => typeof m === 'string' && m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : String(m || '');
  const sym = (m, st) => (st?.holdings || []).find(h => h.mint === m)?.symbol || (st?.watchlist || []).find(w => w.mint === m)?.symbol || short(m);
  const call2 = promise => promise.then(result => result.ok ? result.value : Promise.reject(Error(result.error)));
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = tag => document.createElementNS(SVG, tag);

  const persisted = (() => { try { return JSON.parse(localStorage.getItem('aurora-desk') || '{}') || {}; } catch { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('aurora-desk', JSON.stringify({ section, chatW, chatOpen })); } catch {} };

  const SECTIONS = [['portfolio', 'Portfolio', '▤'], ['trade', 'Trade', '⇄'], ['discover', 'Discover', '⌕'], ['research', 'Research', '◎'], ['strategies', 'Strategies', '◇'], ['journal', 'Journal', '▦']];
  let section = SECTIONS.some(x => x[0] === persisted.section) ? persisted.section : 'portfolio';
  let chatW = persisted.chatW || 400, chatOpen = persisted.chatOpen !== false;
  let open = false, chartMint = '', reportOpen = '', reportText = '';
  let pfSort = { key: 'value', dir: -1 }, pfFilter = '';
  const tokenCache = new Map();
  const trending = { loaded: false, items: [], loading: false };

  const ws = mk('div'); ws.id = 'trading-workspace'; ws.hidden = true;
  ws.innerHTML = `<header class="ws-top"><div class="ws-brand"><img src="assets/agents/gigi.webp" alt=""><div><strong><span class="dot"></span>Gigi</strong><small id="ws-conn">Solana desk</small></div></div><label class="ws-search"><span>⌕</span><input id="ws-search" type="search" placeholder="Search tokens by name or mint" maxlength="60" aria-label="Search tokens"><kbd>⌘K</kbd></label><div class="ws-search-results" id="ws-search-results" hidden></div><span class="ws-top-spacer"></span><div class="ws-seg" id="ws-seg"><button data-exec="paper">Paper</button><button data-exec="live">Live</button></div><button id="ws-chat-visible" class="hf-btn ghost" type="button">Chat</button><button id="ws-settings" class="hf-btn ghost" type="button">Settings</button><button id="ws-close" class="hf-btn" type="button">Back to chat</button></header><nav class="ws-tabs hf-tabs" id="ws-tabs" role="tablist" aria-label="Trading sections"></nav><div class="ws-split" id="ws-split"><div class="ws-content" id="ws-content"></div><aside class="ws-chat" id="ws-chat" role="complementary"><div class="ws-resizer" id="ws-resizer" role="separator" aria-label="Resize chat"></div><div class="ws-chat-head"><img src="assets/agents/gigi.webp" alt=""><div><strong>Gigi</strong> <small>markets sister</small></div><span class="ws-chat-spacer"></span><button class="hf-btn icon sm" id="ws-chat-collapse" type="button" title="Collapse chat">›</button></div><div class="ws-chat-slot" id="ws-chat-slot"></div></aside></div><div class="ws-palette" id="ws-palette" hidden><div class="ws-palette-box"><input id="ws-palette-input" class="hf-input" placeholder="Search tokens or type a command…" aria-label="Command palette" autocomplete="off"><div class="ws-list" id="ws-palette-list"></div></div></div>`;
  (document.querySelector('main') || document.body).append(ws);
  const content = ws.querySelector('#ws-content'); const tabs = ws.querySelector('#ws-tabs'); const results = ws.querySelector('#ws-search-results'); const split = ws.querySelector('#ws-split'); const chat = ws.querySelector('#ws-chat');
  const palette = ws.querySelector('#ws-palette'); const paletteInput = ws.querySelector('#ws-palette-input'); const paletteList = ws.querySelector('#ws-palette-list');

  for (const [id, label, icon] of SECTIONS) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.ws = id; b.setAttribute('role', 'tab'); if (id === section) b.setAttribute('aria-selected', 'true'); b.append(mk('span', 'hf-tab-ico', icon), mk('span', '', label)); if (id === 'portfolio') b.append(mk('span', 'hf-badge', '0')); if (id === 'research') b.append(Object.assign(mk('span', 'hf-badge', '0'), { hidden: true })); b.onclick = () => { section = id; results.hidden = true; savePrefs(); draw(); }; b.onkeydown = e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); const list = [...tabs.querySelectorAll('.hf-tab')]; const i = list.indexOf(e.currentTarget); const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]; next.click(); next.focus(); }; tabs.append(b); }

  const btn = (label, opts = {}, fn) => { const b = mk('button', `hf-btn${opts.variant ? ' ' + opts.variant : ''}${opts.sm ? ' sm' : ''}`); b.type = 'button'; b.textContent = label; b.onclick = fn; b.disabled = opts.disabled === true || !label; if (opts.title) b.title = opts.title; return b; };
  const ibtn = (glyph, tip, fn) => { const b = mk('button', 'hf-btn icon sm hf-tooltip', glyph); b.type = 'button'; b.setAttribute('aria-label', tip); b.dataset.tip = tip; b.onclick = fn; return b; };
  function panel(title, opts = {}, ...body) { const p = mk('div', `hf-panel${opts.flush ? ' flush' : ''}`); if (title) { const h = mk('header'); h.append(mk('h3', '', title)); if (opts.actions) h.append(opts.actions); p.append(h); } const b = mk('div', 'hf-body'); b.append(...body); p.append(b); return p; }
  const emptyState = (mark, title, hint) => { const e = mk('div', 'hf-empty'); e.append(mk('div', 'hf-empty-mark', mark), mk('strong', '', title), mk('small', '', hint || '')); return e; };
  const skeleton = (rows = 4) => { const box = mk('div', 'ws-list'); for (let i = 0; i < rows; i++) { const s = mk('div', 'hf-skeleton'); s.style.width = `${70 + (i % 3) * 10}%`; box.append(s); } return box; };
  const safeCls = level => `hf-safety-${level || 'unknown'}`;
  const run = fn => async () => { try { const data = await fn(); if (data) window.render(data); } catch (error) { window.toast(error.message); } };
  const askGigi = text => { const p = el('prompt'); if (p) { p.value = text; p.focus(); } };

  function selectToken(mint) { chartMint = mint; if (!tokenCache.has(mint)) { tokenCache.set(mint, { loading: true }); call2(window.aurora.walletTokenInfo(mint)).then(info => { tokenCache.set(mint, info); if (open) draw(); }).catch(error => { tokenCache.set(mint, { error: error.message }); if (open) draw(); }); } if (open) draw(); }
  function enterAnimation() { ws.classList.remove('ws-entering'); void ws.offsetWidth; ws.classList.add('ws-entering'); setTimeout(() => ws.classList.remove('ws-entering'), 520); }
  function openWorkspace(animate) { if (open) { if (animate) enterAnimation(); return; } if (typeof view !== 'undefined' && view.agent !== 'gigi') { window.toast('The trading desk is Gigi’s. Switch to Gigi first.'); return; } open = true; ws.hidden = false; const conversation = document.querySelector('.conversation'); if (conversation) el('ws-chat-slot').append(conversation); el('trading-open')?.setAttribute('aria-current', 'page'); if (animate) enterAnimation(); draw(); }
  function close() { if (!open) return; open = false; ws.hidden = true; palette.hidden = true; el('trading-open')?.removeAttribute('aria-current'); const conversation = document.querySelector('.conversation'); const mainContent = document.querySelector('.main-content'); if (conversation && mainContent) mainContent.insertBefore(conversation, mainContent.querySelector('.companion')); }

  function sparkline(points, width = 64, height = 18) { const svg = svgEl('svg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', width); svg.setAttribute('height', height); if (!points || points.length < 2) { return svg; } const vs = points.map(p => p.p); const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1; const poly = svgEl('polyline'); poly.setAttribute('points', points.map((p, i) => `${((i / (points.length - 1)) * width).toFixed(1)},${(height - 1 - ((p.p - min) / span) * (height - 2)).toFixed(1)}`).join(' ')); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1.2'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly); return svg; }
  async function seriesOf(mint) { return call2(window.aurora.walletSeries(mint)).catch(() => []); }

  async function chartInto(box) {
    box.replaceChildren(); if (!chartMint) return;
    const points = await seriesOf(chartMint);
    const svg = svgEl('svg'); svg.setAttribute('viewBox', '0 0 100 36'); svg.setAttribute('preserveAspectRatio', 'none');
    if (!points || points.length < 2) { const t = svgEl('text'); t.setAttribute('x', '2'); t.setAttribute('y', '20'); t.setAttribute('font-size', '5'); t.setAttribute('fill', 'currentColor'); t.textContent = 'collecting price history…'; svg.append(t); box.append(svg); return; }
    const vs = points.map(p => p.p); const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1, last = vs[vs.length - 1];
    const coord = i => `${((i / (points.length - 1)) * 100).toFixed(2)},${(34 - ((points[i].p - min) / span) * 32).toFixed(2)}`;
    const line = points.map((_, i) => coord(i)).join(' ');
    const area = svgEl('polygon'); area.setAttribute('points', `0,36 ${line} 100,36`); area.setAttribute('fill', 'currentColor'); area.setAttribute('opacity', '.1'); svg.append(area);
    const poly = svgEl('polyline'); poly.setAttribute('points', line); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly);
    box.append(svg);
    const meta = mk('div', 'ws-sub'); meta.style.display = 'flex'; meta.style.justifyContent = 'space-between'; meta.style.marginTop = '6px'; meta.append(mk('span', '', `Low ${money(min)}`), mk('span', '', `High ${money(max)}`), mk('span', '', `Last ${money(last)}`)); box.append(meta);
  }

  function draw() {
    if (!open) return;
    for (const b of tabs.querySelectorAll('.hf-tab')) b.setAttribute('aria-selected', String(b.dataset.ws === section));
    const isLive = cfg().execution === 'live';
    for (const b of ws.querySelectorAll('#ws-seg button')) b.setAttribute('aria-pressed', String((b.dataset.exec === 'live') === isLive));
    ws.querySelector('#ws-seg button[data-exec=live]').classList.toggle('live', isLive);
    const w = wallet(); el('ws-conn').textContent = !w ? 'Loading…' : (w.wc?.connected ? `Connected · ${((w.wc.accounts[0] || '').split(':').pop() || '').slice(0, 6)}…` : (cfg().addresses?.length ? `${cfg().addresses.length} watched` : 'Not connected'));
    chat.style.width = `${chatW}px`; split.classList.toggle('collapsed', !chatOpen);
    content.replaceChildren();
    const col = mk('div', 'ws-col');
    const bPortfolio = tabs.querySelector('.hf-tab[data-ws=portfolio] .hf-badge');
    const bResearch = tabs.querySelector('.hf-tab[data-ws=research] .hf-badge');
    if (bPortfolio) bPortfolio.textContent = (w?.state?.holdings || []).length;
    if (bResearch) { const n = (w?.research || []).filter(r => r.status === 'running').length; bResearch.textContent = n; bResearch.hidden = !n; }
    if (!w) { col.append(skeleton(5)); content.append(col); return; }
    const session = w.session;
    if (session && session.state !== 'RUNNING') { const banner = mk('div', 'ws-banner'); banner.append(mk('span', '', `${session.state.replaceAll('_', ' ')}${session.note ? ` · ${session.note}` : ''}`)); const acts = mk('div', 'ws-ctrls'); if (session.needsConfirmation) acts.append(btn('Reconcile', { sm: true }, run(async () => call2(window.aurora.walletSessionReconcile())))); acts.append(btn('Resume', { sm: true }, run(async () => call2(window.aurora.walletSessionResume())))); banner.append(acts); col.append(banner); }
    if (section === 'portfolio') drawPortfolio(col, w.state);
    else if (section === 'trade') drawTrade(col, w.state);
    else if (section === 'discover') drawDiscover(col, w.state);
    else if (section === 'research') drawResearch(col, w.state);
    else if (section === 'strategies') drawStrategies(col, w.state);
    else if (section === 'journal') drawJournal(col, w.state);
    content.append(col);
  }

  function head(root, title, sub, actions) { const h = mk('div', 'ws-head'); const left = mk('div'); left.append(mk('h1', 'ws-h1', title), mk('p', 'ws-sub', sub)); h.append(left); if (actions) { const a = mk('div', 'ws-head-actions'); a.append(...actions); h.append(a); } root.append(h); }
  const metric = (label, value, span) => { const c = mk('div', 'hf-card'); c.append(mk('small', '', label), mk('b', '', value)); if (span) c.append(mk('span', '', span)); return c; };
  function listItem(name, sub, value, change, controls, badge) { const item = mk('div', 'ws-item'); const left = mk('div'); left.append(mk('strong', '', name)); if (sub) left.append(mk('small', '', sub)); const right = mk('div', 'ws-ctrls'); if (change !== undefined && change !== null) right.append(mk('small', change >= 0 ? 'hf-up' : 'hf-down', `${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}%`)); if (value !== undefined) right.append(mk('strong', '', value)); if (badge) right.append(badge); if (controls) right.append(controls); item.append(left, right); return item; }
  function field(label, type, options) { const d = mk('div', 'hf-field'); d.append(mk('label', '', label)); if (type === 'select') { const s = mk('select', 'hf-input'); for (const o of options) s.append(mk('option', '', o)); d.append(s); } else { const i = mk('input', 'hf-input'); i.type = type; i.step = 'any'; if (/buy/i.test(label)) i.value = '25'; d.append(i); } return d; }
  const inputOf = d => d.querySelector('input')?.value;
  const selectOf = d => d.querySelector('select')?.value;

  function donut(holdings) {
    const wrap = mk('div', 'ws-donut'); const total = holdings.reduce((a, h) => a + h.value, 0) || 1;
    const segs = holdings.slice(0, 6); const R = 40, C = 2 * Math.PI * R;
    const svg = svgEl('svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('role', 'img');
    const track = svgEl('circle'); track.setAttribute('cx', '50'); track.setAttribute('cy', '50'); track.setAttribute('r', String(R)); track.setAttribute('fill', 'none'); track.setAttribute('stroke', 'var(--line)'); track.setAttribute('stroke-width', '12'); svg.append(track);
    let offset = 0;
    segs.forEach((h, i) => { const len = (h.value / total) * C; const c = svgEl('circle'); c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(R)); c.setAttribute('fill', 'none'); c.setAttribute('stroke', i % 2 ? 'var(--accent-2)' : 'var(--accent)'); c.setAttribute('stroke-opacity', String(Math.max(.3, 1 - i * .13))); c.setAttribute('stroke-width', '12'); c.setAttribute('stroke-dasharray', `${len} ${C - len}`); c.setAttribute('stroke-dashoffset', String(-offset)); c.setAttribute('transform', 'rotate(-90 50 50)'); svg.append(c); offset += len; });
    wrap.append(svg);
    const legend = mk('div', 'ws-legend'); for (const h of segs.slice(0, 5)) { const row = mk('div'); const dot = mk('span', 'ws-legend-dot'); dot.style.background = 'var(--accent)'; const b = mk('b', '', `${Math.round((h.value / total) * 100)}%`); row.append(dot, mk('span', '', h.symbol), b); legend.append(row); } wrap.append(legend);
    return wrap;
  }

  function drawPortfolio(root, s) {
    head(root, 'Portfolio', 'Read-only holdings across your addresses, kept separate from the paper account.');
    const cards = mk('div', 'ws-cards'); cards.append(metric('Wallet value', money(s.total), s.change24h ? `${(s.change24h * 100).toFixed(2)}% 24h` : 'read-only'), metric('Holdings', String((s.holdings || []).length), 'tokens'), metric('Paper equity', money(paper()?.equity), paper() ? `${paper().totalPnl >= 0 ? '+' : ''}${money(paper().totalPnl)} P/L` : 'simulated'));
    root.append(cards);
    const holdings = [...(s.holdings || [])];
    if (holdings.length) { const overview = mk('div', 'ws-overview'); overview.append(panel('Allocation', {}, donut(holdings))); root.append(overview); }
    // filter + sort
    const filterBox = mk('div', 'hf-field'); const filterInput = mk('input', 'hf-input'); filterInput.type = 'search'; filterInput.placeholder = 'Filter holdings'; filterInput.value = pfFilter; filterBox.append(filterInput);
    let visible = holdings.filter(h => !pfFilter || `${h.symbol} ${h.mint}`.toLowerCase().includes(pfFilter.toLowerCase()));
    visible.sort((a, b) => { const k = pfSort.key; const av = a[k] ?? 0, bv = b[k] ?? 0; return (av > bv ? 1 : av < bv ? -1 : 0) * pfSort.dir; });
    filterInput.oninput = () => { pfFilter = filterInput.value; draw(); };
    const table = mk('table', 'hf-table');
    const cols = [['symbol', 'Token', 'left'], ['amount', 'Amount', 'num'], ['price', 'Price', 'num'], ['value', 'Value', 'num'], ['change24h', '24h', 'num'], ['__pl', 'Est. P/L', 'num'], ['__spark', 'Trend', 'num'], ['share', 'Allocation', 'left']];
    const thead = mk('thead'); const htr = mk('tr'); for (const [key, label, align] of cols) { const th = mk('th', align === 'num' ? 'num' : '', label); if (key[0] !== '_') { th.style.cursor = 'pointer'; th.onclick = () => { if (pfSort.key === key) pfSort.dir *= -1; else { pfSort = { key, dir: -1 }; } draw(); }; if (pfSort.key === key) th.textContent = `${label} ${pfSort.dir < 0 ? '↓' : '↑'}`; } htr.append(th); } thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    if (!visible.length) { const tr = mk('tr'); const td = mk('td'); td.colSpan = cols.length; td.append(emptyState('▤', holdings.length ? 'No matches' : 'No holdings yet', holdings.length ? 'Try another filter.' : 'Add an address or connect a wallet in Settings.')); tr.append(td); tb.append(tr); }
    for (const h of visible.slice(0, 20)) { const tr = mk('tr'); tr.dataset.mint = h.mint; tr.style.cursor = 'pointer'; tr.onclick = e => { if (e.target.closest('.ws-spark')) return; section = 'trade'; selectToken(h.mint); }; tr.innerHTML = `<td><span class="ws-sym">${h.symbol}</span></td><td class="num">${amount(h.amount)}</td><td class="num">${money(h.price)}</td><td class="num">${money(h.value)}</td><td class="num ${(h.change24h || 0) >= 0 ? 'hf-up' : 'hf-down'}">${(h.change24h || 0) >= 0 ? '+' : ''}${(h.change24h || 0).toFixed(2)}%</td><td class="num ws-pl" title="Estimated change since Aurora started watching">—</td><td class="num ws-spark" style="color:var(--accent)"></td><td><span class="ws-bar"><i style="width:${Math.max(2, Math.round((h.share || 0) * 100))}%"></i></span></td>`; tb.append(tr); }
    table.append(tb);
    const actions = mk('div', 'ws-ctrls'); actions.append(filterBox);
    root.append(panel('Holdings', { actions }, table));
    // async sparkline + estimated P/L
    for (const h of visible.slice(0, 15)) { seriesOf(h.mint).then(points => { const row = tb.querySelector(`tr[data-mint="${CSS.escape(h.mint)}"]`); if (!row || !points || points.length < 2) return; const spark = row.querySelector('.ws-spark'); if (spark) spark.append(sparkline(points)); const vs = points.map(p => p.p); const pl = (vs[vs.length - 1] - vs[0]) / vs[0] * 100; const cell = row.querySelector('.ws-pl'); if (cell) { cell.textContent = `${pl >= 0 ? '+' : ''}${pl.toFixed(2)}%`; cell.className = `num ws-pl ${pl >= 0 ? 'hf-up' : 'hf-down'}`; } }); }
    const byWallet = {}; for (const h of s.holdings || []) { if (!h.address) continue; byWallet[h.address] = (byWallet[h.address] || 0) + h.value; }
    if (Object.keys(byWallet).length) { const list = mk('div', 'ws-list'); for (const [address, value] of Object.entries(byWallet)) list.append(listItem(`${address.slice(0, 6)}…${address.slice(-6)}`, 'cost basis unavailable', money(value))); root.append(panel('By wallet', {}, list)); }
    const p = paper(); if (p) { const list = mk('div', 'ws-list'); for (const pos of p.positions) list.append(listItem(pos.symbol, `${amount(pos.amount)} tokens`, money(pos.value), pos.unrealizedPnl)); const actions2 = mk('div', 'ws-ctrls'); actions2.append(btn('Exit & pause', { sm: true }, run(async () => call2(window.aurora.walletSessionPause({ exit: true })))), btn('Reset paper', { sm: true, variant: 'ghost' }, run(async () => call2(window.aurora.walletPaperReset({}))))); root.append(panel(`Paper account · cash ${money(p.cash)} · equity ${money(p.equity)}`, { actions: actions2 }, (p.positions.length ? list : emptyState('▤', 'No paper positions', 'Buy in Trade to open one.')))); }
    if ((s.watchlist || []).length) { const list = mk('div', 'ws-list'); for (const it of s.watchlist) list.append(listItem(it.symbol, 'watched', money(it.price), it.change24h)); root.append(panel('Watchlist', {}, list)); }
  }

  const metric2 = (label, value, cls) => { const d = mk('div'); d.append(mk('small', '', label)); const b = mk('b', '', value); if (cls) b.className = cls; d.append(b); return d; };
  function drawTrade(root, s) {
    head(root, 'Trade', 'Paper by default. Live swaps sign through your connected wallet.');
    if (!chartMint) { root.append(panel('', {}, emptyState('⇄', 'Pick a token', 'Search above or tap a holding in Portfolio.'))); return; }
    const info = tokenCache.get(chartMint) || {}; const pair = info.pair || {}, safety = info.safety || {};
    const grid = mk('div', 'ws-trade'); const left = mk('div'); const right = mk('div', 'ws-list');
    const metrics = mk('div', 'ws-metrics'); metrics.append(metric2('Price', pair.priceUsd ? money(pair.priceUsd) : '—'), metric2('24h', pair.change24h ? `${pair.change24h >= 0 ? '+' : ''}${pair.change24h.toFixed(2)}%` : '—'), metric2('Liquidity', pair.liquidityUsd ? money(pair.liquidityUsd) : '—'), metric2('Volume', pair.volume24h ? money(pair.volume24h) : '—'), metric2('Market cap', pair.marketCap ? money(pair.marketCap) : '—'), metric2('Safety', safety.level ? (safety.level === 'ok' ? 'revoked' : (safety.flags?.[0] || safety.level)) : 'unknown', safeCls(safety.level)));
    const chart = mk('div', 'ws-chart'); left.append(panel(`${sym(chartMint, s)} · ${short(chartMint)}`, {}, info.loading ? skeleton(3) : metrics, chart)); if (!info.loading) chartInto(chart);
    const spend = field('Paper buy (USD)', 'number'); const spendInput = spend.querySelector('input');
    const est = mk('small', 'ws-sub'); const estimate = () => { const usd = Number(spendInput.value) || 0; est.textContent = (pair.priceUsd && usd > 0) ? `≈ ${amount(usd / pair.priceUsd)} ${sym(chartMint, s)} before fees` : ''; }; spendInput.oninput = estimate; estimate();
    const presets = mk('div', 'ws-ctrls'); for (const v of [25, 50, 100]) presets.append(btn(`$${v}`, { sm: true, variant: 'ghost' }, () => { spendInput.value = String(v); estimate(); }));
    const slip = field('Slippage (bps)', 'number'); slip.querySelector('input').value = '50';
    const held = (paper()?.positions || []).find(x => x.mint === chartMint);
    const tradeActions = mk('div', 'ws-ctrls'); tradeActions.append(btn('Paper buy', { variant: 'primary', sm: true }, run(async () => call2(window.aurora.walletPaperBuy({ mint: chartMint, usd: Number(spendInput.value), symbol: pair.symbol }))))); if (held) tradeActions.append(btn('Sell all', { sm: true }, run(async () => call2(window.aurora.walletPaperSell({ mint: chartMint, percent: 100 })))));
    right.append(panel('Paper order', {}, spend, est, presets, slip, tradeActions));
    const kind = field('Condition', 'select', ['Limit buy', 'Limit sell', 'Stop-loss', 'Take-profit']); const trig = field('Trigger price', 'number');
    right.append(panel('Conditional order', {}, kind, trig, btn('Add condition', { sm: true }, run(async () => { const map = { 'Limit buy': ['limit', 'buy'], 'Limit sell': ['limit', 'sell'], 'Stop-loss': ['stop', 'sell'], 'Take-profit': ['takeProfit', 'sell'] }; const [k, sd] = map[selectOf(kind)]; const payload = { mint: chartMint, symbol: pair.symbol, kind: k, side: sd, trigger: Number(inputOf(trig)) }; if (sd === 'buy') payload.usd = 25; else payload.percent = 100; return call2(window.aurora.walletPaperCondition(payload)); }))));
    right.append(btn('Research with Gigi', { sm: true, variant: 'ghost' }, () => askGigi(`Research ${pair.symbol || chartMint} (${chartMint}): market, holders, behavior, controls, locks and narrative. Separate facts from inference.`)));
    grid.append(left, right); root.append(grid);
  }

  function drawDiscover(root, s) {
    head(root, 'Discover', 'Browse popular pairs or search. Snapshots are not trade history; verify before acting.');
    const box = field('Search', 'search'); const input = box.querySelector('input'); const grid = mk('div', 'ws-grid'); root.append(box, panel('Popular Solana pairs', {}, grid));
    const render = items => { grid.replaceChildren(); if (!items.length) { grid.append(emptyState('⌕', 'No pairs found', 'Try another name or mint.')); return; } for (const token of items) grid.append(tokenCard(token)); };
    const loadTrending = async () => { trending.loading = true; grid.replaceChildren(skeleton(4)); try { trending.items = await call2(window.aurora.walletSearch('SOL')); trending.loaded = true; render(trending.items); } catch (error) { grid.replaceChildren(emptyState('⌕', 'Could not load pairs', error.message)); } finally { trending.loading = false; } };
    input.oninput = () => { clearTimeout(input._t); const q = input.value.trim(); if (!q) { render(trending.items); return; } input._t = setTimeout(async () => { grid.replaceChildren(skeleton(4)); try { render(await call2(window.aurora.walletSearch(q))); } catch (error) { grid.replaceChildren(emptyState('⌕', 'Search failed', error.message)); } }, 320); };
    if (!trending.loaded && !trending.loading) loadTrending();
  }
  function tokenCard(token) { const c = mk('div', 'ws-token'); const r1 = mk('div', 'ws-token-row'); r1.append(mk('strong', '', token.symbol), mk('span', token.change24h >= 0 ? 'hf-up' : 'hf-down', `${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`)); const r2 = mk('div', 'ws-token-row'); r2.append(mk('small', '', money(token.priceUsd)), mk('small', '', `${money(token.liquidityUsd)} liq`)); c.append(r1, r2, ibtn('＋', 'Watch', run(async () => call2(window.aurora.walletWatchlistAdd(token.address))))); c.onclick = e => { if (e.target.closest('button')) return; section = 'trade'; selectToken(token.address); }; return c; }

  function drawResearch(root, s) {
    const target = chartMint || (s.holdings || [])[0]?.mint || '';
    head(root, 'Research', 'Deep reports run as a job, save a revision, and say what could not be verified.', [btn(target ? `Research ${sym(target, s)}` : 'Open a token first', { variant: 'primary', sm: true, disabled: !target }, run(async () => target ? call2(window.aurora.walletResearchStart({ mint: target, symbol: sym(target, s) })) : null))]);
    const list = mk('div', 'ws-list'); const reports = wallet()?.research || [];
    if (!reports.length) list.append(emptyState('◎', 'No reports yet', 'Run a report on a token to keep its evidence.'));
    for (const item of reports) { const ct = mk('div', 'ws-ctrls'); if (item.status === 'running') ct.append(ibtn('■', 'Cancel', run(async () => call2(window.aurora.walletResearchCancel())))); else if (item.hasReport) ct.append(ibtn('▤', 'Open', run(async () => { if (reportOpen === item.id) { reportOpen = ''; reportText = ''; } else { const r = await call2(window.aurora.walletResearchReport(item.id)); reportOpen = item.id; reportText = r.report; } draw(); }))); ct.append(ibtn('×', 'Delete', run(async () => call2(window.aurora.walletResearchRemove(item.id))))); const badge = mk('span', `hf-badge${item.status === 'ready' ? ' ok' : item.status === 'running' ? '' : ' muted'}`, item.status); list.append(listItem(item.symbol || short(item.mint), `${new Date(item.createdAt).toLocaleString()}${item.error ? ' · ' + item.error : ''}`, undefined, undefined, ct, badge)); if (reportOpen === item.id && reportText) list.append(mk('pre', 'ws-report', reportText)); }
    root.append(panel('Saved reports', {}, list));
  }

  function drawStrategies(root, s) {
    const limits = cfg().limits || {};
    head(root, 'Strategies', 'Typed rules, paper by default. Aggregated limits are enforced before any entry.', [btn('Describe to Gigi', { variant: 'primary', sm: true }, () => askGigi('Help me build a Solana strategy: token, signal, threshold, window, size in USD, cooldown, exits and limits. Show the rules, then activate it in paper.'))]);
    root.append(panel('Limits', {}, mk('p', 'ws-sub', `Position ${limits.maxPositionUsd ? money(limits.maxPositionUsd) : 'off'} · Total ${limits.maxTotalUsd ? money(limits.maxTotalUsd) : 'off'} · Daily ${limits.dailyCapUsd ? money(limits.dailyCapUsd) : 'off'} — edit in Settings`)));
    const list = mk('div', 'ws-list'); const strategies = wallet()?.strategies || [];
    if (!strategies.length) list.append(emptyState('◇', 'No strategies yet', 'Describe one to Gigi or build it here.'));
    for (const st of strategies) { const ct = mk('div', 'ws-ctrls'); ct.append(ibtn('⇄', 'Switch paper/live', run(async () => call2(window.aurora.walletStrategySave({ ...st, execution: st.execution === 'live' ? 'paper' : 'live' }))))), ibtn(st.status === 'active' ? '■' : '▶', st.status === 'active' ? 'Pause' : 'Activate', run(async () => call2(window.aurora.walletStrategyStatus({ id: st.id, status: st.status === 'active' ? 'paused' : 'active' })))), ibtn('⚡', 'Run once', run(async () => { const r = await call2(window.aurora.walletStrategyRun(st.id)); window.toast(r.executed ? 'Triggered.' : (r.error || 'Conditions not met.')); })), ibtn('×', 'Delete', run(async () => call2(window.aurora.walletStrategyRemove(st.id)))); const badge = mk('span', `hf-badge${st.status === 'active' ? ' ok' : ' muted'}`, st.status === 'active' ? `${(st.execution || 'paper').toUpperCase()} · ACTIVE` : (st.execution || 'paper').toUpperCase()); list.append(listItem(`${st.name} · ${st.symbol || short(st.mint)}`, `${(st.conditions || []).map(c => `${c.metric} ${c.op} ${c.value}`).join(st.logic === 'or' ? ' OR ' : ' AND ')}${st.lastError ? ' · ' + st.lastError : ''} · size ${money(st.sizingUsd)}`, undefined, undefined, ct, badge)); }
    root.append(panel('Strategies', {}, list));
  }

  function drawJournal(root, s) {
    head(root, 'Journal', 'Every paper order and live execution, tied to research and revisions.');
    const p = paper(); const orders = mk('div', 'ws-list'); for (const o of (p?.orders || []).slice(0, 40)) orders.append(listItem(`${o.side === 'buy' ? 'Bought' : 'Sold'} ${o.symbol || short(o.mint)}`, `${amount(o.amount)} @ ${money(o.priceUsd)} · ${new Date(o.at).toLocaleString()}`, money(o.valueUsd), o.side === 'sell' ? o.realizedPnlUsd : undefined)); root.append(panel('Paper orders', {}, (p?.orders || []).length ? orders : emptyState('▦', 'No paper orders', 'Paper trades and conditions appear here.')));
    const execs = mk('div', 'ws-list'); for (const ex of wallet()?.executions || []) execs.append(listItem(`${ex.side === 'buy' ? 'Bought' : 'Sold'} ${sym(ex.mint, s)}`, `${new Date(ex.at).toLocaleString()}${ex.signature ? ' · ' + ex.signature.slice(0, 8) + '…' : ''}${ex.error ? ' · ' + ex.error : ''}`, 'live', undefined, undefined, mk('span', `hf-badge${ex.status === 'confirmed' ? ' ok' : ex.status === 'failed' ? ' live' : ' muted'}`, ex.status))); root.append(panel('Live executions', {}, (wallet()?.executions || []).length ? execs : emptyState('⇄', 'No live executions', 'Live swaps you confirm appear here.')));
  }

  // ---- command palette ----
  function paletteCommands() { const cmds = []; for (const [id, label] of SECTIONS) cmds.push({ label: `Go to ${label}`, hint: 'section', run: () => { section = id; savePrefs(); } }); if (chartMint) { cmds.push({ label: 'Paper buy 25', hint: 'action', run: () => call2(window.aurora.walletPaperBuy({ mint: chartMint, usd: 25 })) }); cmds.push({ label: 'Start research', hint: 'action', run: () => call2(window.aurora.walletResearchStart({ mint: chartMint, symbol: sym(chartMint, state()) })) }); } cmds.push({ label: cfg().execution === 'live' ? 'Switch to Paper' : 'Switch to Live', hint: 'action', run: () => call2(window.aurora.walletConfig({ execution: cfg().execution === 'live' ? 'paper' : 'live' })) }); cmds.push({ label: 'Open Settings', hint: 'settings', run: () => { close(); el('wallet-open')?.click(); } }); return cmds; }
  function renderPalette(query = '') { paletteList.replaceChildren(); const q = query.toLowerCase(); const cmds = paletteCommands().filter(c => !q || c.label.toLowerCase().includes(q)); for (const cmd of cmds) { const item = listItem(cmd.label, cmd.hint); item.style.cursor = 'pointer'; item.onclick = () => runPalette(cmd); paletteList.append(item); } if (query.trim().length >= 2) { call2(window.aurora.walletSearch(query)).then(found => { for (const token of found.slice(0, 6)) { const item = listItem(`${token.symbol} · ${money(token.priceUsd)}`, `${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}% · search`); item.style.cursor = 'pointer'; item.onclick = () => { closePalette(); section = 'trade'; selectToken(token.address); }; paletteList.append(item); } }).catch(() => {}); } }
  function runPalette(cmd) { closePalette(); Promise.resolve(cmd.run && cmd.run()).then(data => { if (data) window.render(data); else if (cmd.hint === 'section') draw(); }).catch(error => window.toast(error.message)); }
  function openPalette() { palette.hidden = false; paletteInput.value = ''; renderPalette(''); paletteInput.focus(); }
  function closePalette() { palette.hidden = true; }
  paletteInput.oninput = () => renderPalette(paletteInput.value);
  paletteInput.onkeydown = event => { if (event.key === 'Enter') { const first = paletteList.querySelector('.ws-item'); if (first) first.click(); } if (event.key === 'Escape') closePalette(); };
  palette.onclick = event => { if (event.target === palette) closePalette(); };

  // ---- wiring ----
  for (const b of ws.querySelectorAll('#ws-seg button')) b.onclick = run(async () => call2(window.aurora.walletConfig({ execution: b.dataset.exec })));
  el('ws-close').onclick = close; el('ws-settings').onclick = () => el('wallet-open')?.click();
  el('ws-chat-visible').onclick = () => { chatOpen = !chatOpen; savePrefs(); draw(); };
  el('ws-chat-collapse').onclick = () => { chatOpen = false; savePrefs(); draw(); };
  const resizer = el('ws-resizer'); resizer.onpointerdown = event => { event.preventDefault(); const startX = event.clientX, startW = chatW; const move = e => { chatW = Math.max(300, Math.min(720, startW - (e.clientX - startX))); chat.style.width = `${chatW}px`; }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); savePrefs(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); };
  const search = el('ws-search'); let searchTimer;
  search.oninput = () => { clearTimeout(searchTimer); const q = search.value.trim(); if (!q) { results.hidden = true; return; } searchTimer = setTimeout(async () => { try { const found = await call2(window.aurora.walletSearch(q)); results.replaceChildren(); for (const token of found.slice(0, 10)) { const item = listItem(token.symbol, `${money(token.priceUsd)} · ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`); item.style.cursor = 'pointer'; item.onclick = () => { results.hidden = true; search.value = ''; section = 'trade'; selectToken(token.address); }; results.append(item); } results.hidden = !found.length; } catch (error) { window.toast(error.message); } }, 300); };
  document.addEventListener('click', event => { if (!event.target.closest('.ws-search')) results.hidden = true; });
  document.addEventListener('keydown', event => { if (!open) return; if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); } if (event.key === 'Escape') { closePalette(); results.hidden = true; } });

  window.AuroraWorkspace = { open: openWorkspace, enter: () => openWorkspace(true), close, isOpen: () => open, toggle: () => open ? close() : openWorkspace(true) };
  window.addEventListener('aurora-view-rendered', () => { if (!open) return; draw(); });
  window.aurora.onEvent(event => { if (event.type === 'wallet' && open) { if (typeof view !== 'undefined') view.wallet = event.wallet; draw(); } });
  const navButton = el('trading-open'); if (navButton) navButton.onclick = () => window.AuroraWorkspace.toggle();
})();
