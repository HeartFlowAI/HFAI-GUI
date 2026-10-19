const { test } = require('node:test'), assert = require('node:assert/strict');
const { createDesk, walletFixture, followedFixture, SOL, BONK } = require('./helpers/desk');

test('the desk mounts and the Trade section renders without [object ...] placeholders', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  assert.ok(desk.document.getElementById('trading-workspace'), 'desk mounted');
  desk.tab('trade').click();
  await desk.flush();
  const content = desk.document.getElementById('ws-content');
  assert.ok(content.querySelector('.ws-trade'), 'trade grid renders');
  assert.ok(content.querySelector('.ws-charttype'), 'line/candles control renders');
  assert.ok(!/\[object /.test(content.textContent), 'no [object ...] placeholder text');
  assert.match(content.textContent, /Pump\.fun migrated/, 'pump badge renders');
});

test('wallets section renders followed wallets, a scan summary and actions', async () => {
  const desk = createDesk({ wallet: walletFixture({ followed: [followedFixture()] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('wallets').click();
  await desk.flush();
  const content = desk.document.getElementById('ws-content');
  assert.match(content.textContent, /Whale/);
  assert.match(content.textContent, /Follow a wallet/);
  assert.match(content.textContent, /Top 10/);
  assert.match(content.textContent, /BONK/);
  const scan = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Scan');
  assert.ok(scan, 'scan action renders');
  scan.click();
  await desk.flush();
  assert.ok((desk.calls.walletFollowScan || 0) >= 1, 'walletFollowScan called');
});

test('holders render for a token that has holder accounts', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('trade').click();
  await desk.flush(8);
  const holdersTab = [...desk.document.querySelectorAll('#ws-content .ws-subtabs button')].find(b => /Holders/.test(b.textContent));
  assert.ok(holdersTab, 'holders subtab present');
  holdersTab.click();
  await desk.flush(12);
  const holders = desk.document.querySelector('#ws-content .ws-holders');
  assert.ok(holders, 'holders body rendered');
  assert.match(holders.textContent, /38\.3%|Top 10|Holders/i, 'holder stats rendered');
  assert.ok(!/\[object /.test(holders.textContent), 'holder rows do not stringify nodes');
});

test('sub-cent token prices are formatted, not rounded to $0', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('portfolio').click();
  await desk.flush();
  const rows = [...desk.document.querySelectorAll('#ws-content .ws-market-table tbody tr')];
  const bonk = rows.find(row => row.textContent.includes('BONK'));
  assert.ok(bonk, 'BONK market row present');
  assert.match(bonk.textContent, /\$0\.000003/, 'micro price uses significant digits');
});

test('discover renders a screener with formatted numbers and tabs', async () => {  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('discover').click();
  await desk.flush(12);
  const table = desk.document.querySelector('#ws-content .ws-screener');
  assert.ok(table, 'screener table rendered');
  assert.match(table.textContent, /BONK/, 'token row present');
  assert.match(table.textContent, /\$0\.000003/, 'price formatted');
  const tabs = [...desk.document.querySelectorAll('#ws-content .ws-disco-tabs button')].map(b => b.textContent);
  assert.deepEqual(tabs, ['Trending', 'New pairs', 'Takeovers', 'Narratives']);
});

test('watch section renders the watchlist, alerts and the notification inbox', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.view.notifications = [{ id: 'n1', at: Date.now(), kind: 'alert', title: 'SOL above 100', body: 'Now 105', read: false }];
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('watch').click();
  await desk.flush(8);
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /Price alerts/);
  assert.match(text, /Notifications/);
  assert.match(text, /SOL above 100/);
});


test('compare shows tokens shared by followed wallets', async () => {
  const first = followedFixture();
  const second = { ...followedFixture(), id: 'f2', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', label: 'Fund', scan: { ...first.scan, address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', holdings: first.scan.holdings.map(item => ({ ...item, value: item.value / 2 })) } };
  const desk = createDesk({ wallet: walletFixture({ followed: [first, second] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('wallets').click();
  await desk.flush();
  const compare = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'Compare');
  assert.ok(compare, 'compare action renders');
  compare.click();
  await desk.flush();
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /Shared tokens/);
  assert.match(text, /Held by/);
  assert.match(text, /Whale, Fund/);
});


test('copy to paper opens a budget form and calls the copy API', async () => {
  const desk = createDesk({ wallet: walletFixture({ followed: [followedFixture()] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('wallets').click();
  await desk.flush();
  const open = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'Copy');
  assert.ok(open, 'copy action renders');
  open.click();
  await desk.flush();
  const submit = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'Copy to paper');
  assert.ok(submit, 'copy form renders');
  submit.click();
  await desk.flush();
  assert.ok((desk.calls.walletFollowCopy || 0) >= 1, 'walletFollowCopy called');
  assert.ok(desk.toasts.some(message => /Copied 2 tokens/.test(message)), 'copy summary toast');
});


test('auto-mirror controls render and save through the followed-wallet update API', async () => {
  const desk = createDesk({ wallet: walletFixture({ followed: [followedFixture()] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('wallets').click();
  await desk.flush();
  const content = desk.document.getElementById('ws-content');
  assert.match(content.textContent, /Auto-mirror/);
  assert.match(content.textContent, /Paper only/);
  const save = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save mirror');
  assert.ok(save, 'save mirror action renders');
  save.click();
  await desk.flush();
  assert.ok((desk.calls.walletFollowUpdate || 0) >= 1, 'walletFollowUpdate called');
});


test('wallet notifications open Solscan and select the followed wallet', async () => {
  const followed = followedFixture();
  const desk = createDesk({ wallet: walletFixture({ followed: [followed] }) });
  desk.window.view.notifications = [{ id: 'n2', at: Date.now(), kind: 'wallet', title: 'Whale moved', body: '1 new transaction', read: false, wallet: followed.address, signature: 'sig', url: 'https://solscan.io/tx/sig' }];
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('watch').click();
  await desk.flush(8);
  const external = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.getAttribute('aria-label') === 'Open transaction');
  assert.ok(external, 'transaction link renders');
  external.click();
  await desk.flush();
  assert.ok((desk.calls.openLink || 0) >= 1, 'Solscan link opened');
  desk.eventHandler()({ type: 'notification-open', notification: desk.window.view.notifications[0] });
  await desk.flush();
  assert.equal(desk.tab('wallets').getAttribute('aria-selected'), 'true', 'wallet tab selected');
  assert.match(desk.document.getElementById('ws-content').textContent, /Whale/);
});


test('scan-all progress renders and updates from wallet scan events', async () => {
  const desk = createDesk({ wallet: walletFixture({ followed: [followedFixture()] }) });
  desk.window.view.scanJob = { running: true, total: 3, done: 1, current: 'Whale', errors: 0 };
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('wallets').click();
  await desk.flush();
  let text = desk.document.getElementById('ws-content').textContent.replace(/\s+/g, ' ');
  assert.match(text, /Scanning 1 of 3/);
  assert.match(text, /Reading Whale/);
  const scanAll = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.includes('Scanning 1/3'));
  assert.ok(scanAll?.disabled, 'scan all is disabled while running');
  desk.eventHandler()({ type: 'wallet-scan-progress', job: { running: true, total: 3, done: 2, current: 'Fund', errors: 0 } });
  await desk.flush();
  text = desk.document.getElementById('ws-content').textContent.replace(/\s+/g, ' ');
  assert.match(text, /Scanning 2 of 3/);
  assert.match(text, /Reading Fund/);
  desk.eventHandler()({ type: 'wallet-scan-complete', job: { running: false, total: 3, done: 3, current: '', errors: 1 } });
  await desk.flush();
  assert.ok(desk.toasts.some(message => /Scanned 3 wallets · 1 failed/.test(message)), 'completion toast reports errors');
});


test('discover filters Pump.fun rows and labels the dex', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('discover').click();
  await desk.flush(12);
  assert.match(desk.document.getElementById('ws-content').textContent, /Pump\.fun/);
  const filter = desk.document.querySelector('#ws-content .ws-disco-dex');
  assert.ok(filter, 'dex filter renders');
  filter.value = 'pumpfun';
  filter.dispatchEvent(new desk.window.Event('change'));
  await desk.flush();
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /PUMP/);
  assert.doesNotMatch(text, /BONK/);
});


test('trade falls back to Gecko token metadata when DexScreener has no pair', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.aurora.walletTokenInfo = () => Promise.resolve({ ok: true, value: { mint: SOL, pair: null, safety: null, token: { symbol: 'NEWPUMP', name: 'New Pump', priceUsd: 0.00042, fdv: 42000, volume24h: 9000 }, launchpad: { graduationPercentage: 12, completed: false } } });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('trade').click();
  await desk.flush(10);
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /New Pump/);
  assert.match(text, /NEWPUMP/);
  assert.match(text, /Pump\.fun 12%/);
});


test('platform switch opens Pump.fun stages and loads feed rows', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  const pumpButton = desk.document.querySelector('#ws-platform button[data-platform=pumpfun]');
  assert.ok(pumpButton, 'Pump.fun platform button renders');
  pumpButton.click();
  await desk.flush(12);
  const content = desk.document.getElementById('ws-content');
  assert.equal(desk.document.querySelector('#ws-tabs .hf-tab[data-ws=discover]').textContent.trim(), 'Pump.fun');
  assert.match(content.textContent, /CREW/);
  assert.match(content.textContent, /Trending/);
  const trending = [...content.querySelectorAll('.ws-pump-tabs button')].find(button => button.textContent.includes('Trending'));
  trending.click();
  await desk.flush(12);
  assert.match(desk.document.getElementById('ws-content').textContent, /AGI/);
});

test('pump trade panel shows the bond state and PumpPortal live controls', async () => {
  const desk = createDesk({ wallet: walletFixture({ config: { execution: 'live', addresses: [], limits: {}, mode: 'simple', currency: 'USD', pumpLiveEnabled: true }, wc: { connected: true, accounts: ['solana:abc'] } }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('trade').click();
  await desk.flush(10);
  const content = desk.document.getElementById('ws-content').textContent;
  assert.match(content, /Pump\.fun/);
  assert.match(content, /LIVE · PUMPPORTAL/);
  assert.match(content, /Live buy \(PumpPortal\)/);
});


test('a fresh pump row opens Trade with the pump panel even before token info indexes', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.aurora.walletTokenInfo = () => Promise.resolve({ ok: true, value: { mint: 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump', pair: null, safety: null } });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.window.document.querySelector('#ws-platform button[data-platform=pumpfun]').click();
  await desk.flush(12);
  const row = desk.document.querySelector('.ws-pulse-card');
  assert.ok(row, 'pump card rendered');
  row.click();
  await desk.flush(12);
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /Pump\.fun/);
  assert.match(text, /bonding curve/i);
});


test('xStocks platform loads Featured, All and ETF tabs', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  const xButton = desk.document.querySelector('#ws-platform button[data-platform=xstocks]');
  assert.ok(xButton, 'xStocks platform button renders');
  xButton.click();
  await desk.flush(12);
  const content = desk.document.getElementById('ws-content');
  const xTabs = desk.document.querySelector('#ws-tabs .hf-tab[data-ws=discover]');
  assert.equal(xTabs.textContent.trim(), 'xStocks');
  assert.ok(xTabs.querySelector('.hf-ico'), 'discover icon remains');
  assert.match(content.textContent, /Apple xStock/);
  assert.match(content.textContent, /TSLAx/);
  assert.deepEqual([...content.querySelectorAll('.ws-xstock-tabs button')].map(button => button.textContent), ['Featured', 'All', 'ETFs']);
  assert.ok(!/\[object /.test(content.textContent), 'xStock status cell does not stringify a node');
});

test('clicking an xStock row opens Trade with the xStocks panel', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.aurora.walletTokenInfo = () => Promise.resolve({ ok: true, value: { mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', pair: { address: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', symbol: 'AAPLx', name: 'Apple xStock', dex: 'raydium', priceUsd: 344.36, change24h: 1.2, volume24h: 5000000, liquidityUsd: 255306, marketCap: 1e9 }, safety: { level: 'ok', flags: [] } } });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.window.document.querySelector('#ws-platform button[data-platform=xstocks]').click();
  await desk.flush(12);
  const row = desk.document.querySelector('.ws-xstock-table tbody tr');
  assert.ok(row, 'xStock row rendered');
  row.click();
  await desk.flush(12);
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /Apple xStock/);
  assert.match(text, /Underlying/);
  assert.match(text, /Premium/);
  assert.match(text, /\+0\.48%/);
  assert.match(text, /Tokenized securities/);
  assert.ok([...desk.document.querySelectorAll('#ws-content button')].some(button => button.textContent.trim() === 'Stock'), 'Stock chart toggle renders');
  assert.ok([...desk.document.querySelectorAll('#ws-content button')].some(button => button.textContent.trim() === 'On-chain'), 'On-chain chart toggle renders');
  assert.ok((desk.calls.walletStockHistory || 0) >= 1, 'underlying stock history loads');
  const onChain = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'On-chain');
  onChain.click();
  await desk.flush(6);
  assert.ok((desk.calls.walletSeries || 0) >= 1, 'on-chain chart loads after switching');
  assert.match(desk.document.querySelector('.ws-ohlc')?.textContent || '', /ON-CHAIN/);
});

test('xStock live controls render when execution is live and a wallet is connected', async () => {
  const desk = createDesk({ wallet: walletFixture({ config: { execution: 'live', addresses: [], limits: {}, mode: 'simple', currency: 'USD' }, wc: { connected: true, accounts: ['solana:abc'] } }) });
  desk.window.aurora.walletTokenInfo = () => Promise.resolve({ ok: true, value: { mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', pair: { address: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', symbol: 'AAPLx', name: 'Apple xStock', dex: 'raydium', priceUsd: 344.36, change24h: 1.2, volume24h: 5000000, liquidityUsd: 255306, marketCap: 1e9 }, safety: { level: 'ok', flags: [] } } });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.window.document.querySelector('#ws-platform button[data-platform=xstocks]').click();
  await desk.flush(12);
  desk.window.document.querySelector('.ws-xstock-table tbody tr')?.click();
  await desk.flush(12);
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /Live buy/);
});


test('Pump.fun live launches prepend instantly and cap the grid at 50', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.window.document.querySelector('#ws-platform button[data-platform=pumpfun]').click();
  await desk.flush(14);
  const now = Date.now();
  const rows = Array.from({ length: 55 }, (_, i) => ({
    mint: `live${String(i).padStart(2, '0')}pump`, symbol: `LIVE${i}`, name: `Live ${i}`,
    imageUrl: '', links: [], createdAt: now + i, ageMs: 0, priceUsd: 0.00001 + i,
    marketCap: 10000 + i, fdv: 10000 + i, change5m: 1, change1h: 2, change24h: 3,
    volume5m: 0, volume1h: 0, volume24h: 0, liquidityUsd: 3000,
    buys1h: 0, sells1h: 0, buyers1h: 0, sellers1h: 0, graduationPercentage: 0,
    graduationKnown: false, completed: false, aboutToGraduate: false, score: 0
  }));
  desk.eventHandler()({ type: 'pump-launch', rows, at: now });
  await desk.flush(4);
  const cards = desk.document.querySelectorAll('.ws-pulse-card');
  assert.equal(cards.length, 50, 'grid caps at 50 cards');
  assert.match(cards[0].textContent, /LIVE54/, 'newest PumpPortal launch is first');
  assert.match(desk.document.getElementById('ws-content').textContent, /Live · 30s/);
});

test('People tab shows tracked roles and scan actions', async () => {
  const person = {
    id: 'p1', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Alpha KOL', kind: 'kol', tags: ['kol'], note: 'early buyer', addedAt: Date.now(), scanAt: Date.now(), launches: [], stats: { launches: 0, completed: 0, lastLaunchAt: 0 },
    scan: { at: Date.now(), total: 1200, holdings: [{ mint: SOL, symbol: 'SOL', amount: 12, price: 100, value: 1200, change24h: 1.5, share: 1 }], unpriced: [], recent: [] }
  };
  const desk = createDesk({ wallet: walletFixture({ people: [person] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('people').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  assert.match(content.textContent, /Track a wallet/);
  assert.match(content.textContent, /Alpha KOL/);
  assert.match(content.textContent, /KOL/);
  assert.ok([...content.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'Scan wallet'));
});

test('People wallet graph links wallets by shared holdings', async () => {
  const scan = { at: Date.now(), total: 1000, holdings: [{ mint: BONK, symbol: 'BONK', amount: 1000, value: 1000, change24h: 1, share: 1 }], unpriced: [], recent: [] };
  const people = [
    { id: 'p1', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Alpha', kind: 'kol', tags: ['kol'], note: '', addedAt: Date.now(), scanAt: Date.now(), scan, launches: [], stats: { launches: 0, completed: 0, lastLaunchAt: 0 } },
    { id: 'p2', address: '51yZyDSnec4xnUv7XLRVYcDyV4x3wUtzrDcRaYbmQU5j', label: 'Beta', kind: 'trader', tags: ['trader'], note: '', addedAt: Date.now(), scanAt: Date.now(), scan, launches: [], stats: { launches: 0, completed: 0, lastLaunchAt: 0 } }
  ];
  const desk = createDesk({ wallet: walletFixture({ people }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('people').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  assert.ok(content.querySelector('.ws-graph svg'), 'wallet graph renders');
  assert.equal(content.querySelectorAll('.ws-graph-edge.shared').length, 1, 'shared holding edge renders');
  assert.match(content.textContent, /Shared-holding graph/);
  assert.match(content.textContent, /BONK/);
});

test('Research token intel shows dev, KOL convergence and holders', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('research').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  const mint = 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump';
  content.querySelector('.ws-runform input').value = mint;
  const open = [...content.querySelectorAll('.ws-runform button')].find(button => button.textContent.trim() === 'Open intel');
  assert.ok(open, 'open intel button renders');
  open.click();
  await desk.flush(10);
  assert.match(content.textContent, /Dev rap sheet/);
  assert.match(content.textContent, /KOL convergence/);
  assert.match(content.textContent, /Alpha KOL/);
  assert.match(content.textContent, /Top holders/);
  assert.equal((desk.calls.walletTokenIntel || 0), 1);
  assert.ok(content.querySelector('.ws-graph svg'), 'token holder graph renders');
});

test('Pump.fun pulse cards show Gigi verdicts, quick buy and auto controls', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.window.document.querySelector('#ws-platform button[data-platform=pumpfun]').click();
  await desk.flush(14);
  const content = desk.document.getElementById('ws-content');
  assert.ok(content.querySelector('.ws-pulse-card'), 'pulse card grid renders');
  assert.ok(content.querySelectorAll('.ws-pulse-spark svg').length > 0, 'pulse sparks render');
  assert.ok(content.querySelector('.ws-pulse-logo img'), 'token image renders');
  assert.ok([...content.querySelectorAll('.ws-pulse-card .ws-social')].some(button => button.textContent === 'X'), 'social links render');
  assert.ok([...content.querySelectorAll('.ws-pulse-actions button')].some(button => button.textContent.trim() === 'Gigi scan'), 'Gigi scan button renders');
  assert.match(content.textContent, /GIGI BUY 9/);
  assert.match(content.textContent, /Gigi auto scan/);
  assert.match(content.textContent, /Buy \$25/);
  const table = [...content.querySelectorAll('.ws-charttype button')].find(button => button.textContent.trim() === 'Table');
  assert.ok(table, 'table toggle renders');
  table.click();
  await desk.flush();
  assert.ok(desk.document.querySelector('.ws-pump-table'), 'table view renders');
  const auto = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'Auto scan off');
  assert.ok(auto, 'auto scan toggle renders');
  auto.click();
  await desk.flush(8);
  assert.ok((desk.calls.walletPumpAuto || 0) >= 1, 'auto scan start called');
  assert.match(desk.document.getElementById('ws-content').textContent, /Auto scan on/);
});
