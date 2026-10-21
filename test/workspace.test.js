const { test } = require('node:test'), assert = require('node:assert/strict');
const { createDesk, walletFixture, followedFixture, SOL, BONK } = require('./helpers/desk');

test('Crypto opens the desk and Back to chat returns to the normal chat view', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush(4);
  desk.window.AuroraWorkspace.close();
  await desk.flush(2);
  const crypto = desk.document.getElementById('crypto-open');
  const workspace = desk.document.getElementById('trading-workspace');
  assert.equal(workspace.hidden, true);
  assert.equal(crypto.hidden, false, 'Crypto button is visible after closing');
  crypto.click();
  await desk.flush(4);
  assert.equal(workspace.hidden, false, 'Crypto opens the desk');
  assert.equal(crypto.hidden, true, 'Crypto button hides inside the desk');
  desk.document.getElementById('ws-close').click();
  await desk.flush(2);
  assert.equal(workspace.hidden, true, 'Back to chat closes the desk');
  assert.equal(crypto.hidden, false, 'Crypto button returns');
});

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

test('Portfolio Chart opens the real portfolio chart overlay', async () => {
  const wallet = walletFixture();
  wallet.state = { ...wallet.state, total: 100, change24h: 1, holdings: [{ mint: SOL, symbol: 'SOL', amount: 1, price: 100, value: 100, change24h: 1, share: 1 }] };
  const desk = createDesk({ wallet });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('portfolio').click();
  await desk.flush(4);
  const chart = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'Chart');
  assert.ok(chart, 'portfolio chart button renders');
  chart.click();
  await desk.flush(6);
  assert.equal(desk.document.getElementById('ws-viewer').hidden, false, 'portfolio viewer opens');
  assert.ok((desk.calls.walletPortfolioSeries || 0) >= 1, 'portfolio series requested');
});

test('wallets section renders followed wallets, a scan summary and actions', async () => {
  const desk = createDesk({ wallet: walletFixture({ followed: [followedFixture()] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('wallets').click();
  await desk.flush();
  const content = desk.document.getElementById('ws-content');
  assert.match(content.textContent, /Whale/);
  assert.match(content.textContent, /Wallets · 1/);
  assert.match(content.textContent, /Top-10 coverage/);
  assert.match(content.textContent, /BONK/);
  assert.equal(content.querySelectorAll('.ws-wallet-hero .ws-wallet-fact').length, 3, 'three wallet facts render');
  assert.ok(content.querySelector('.ws-position'), 'holdings render as position rows');
  assert.equal(content.querySelector('.ws-wallet-tabs').getAttribute('role'), 'tablist', 'wallet tabs are a segmented tablist');
  const add = [...content.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Add wallet');
  assert.ok(add, 'add wallet action renders');
  add.click();
  await desk.flush();
  assert.match(content.textContent, /Follow a wallet/);
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

test('alerts section renders the event feed and price alerts', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.view.notifications = [{ id: 'n1', at: Date.now(), kind: 'alert', title: 'SOL above 100', body: 'Now 105', read: false }];
  desk.window.view.wallet.paper.orders.push({ id: 'o1', at: Date.now(), mint: SOL, symbol: 'SOL', side: 'buy', valueUsd: 25, price: 100 });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('alerts').click();
  await desk.flush(8);
  const text = desk.document.getElementById('ws-content').textContent;
  assert.match(text, /Price alerts/);
  assert.match(text, /Activity/);
  assert.match(text, /SOL above 100/);
  const fills = [...desk.document.querySelectorAll('.ws-alert-filters button')].find(button => button.textContent.startsWith('Fills'));
  assert.ok(fills, 'fills filter renders');
  fills.click();
  await desk.flush(4);
  assert.match(desk.document.getElementById('ws-content').textContent, /Paper buy SOL/);
});


test('Tutorial opens on every section and switches languages', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('strategies').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  const tutorial = content.querySelector('.ws-tutorial-btn');
  assert.ok(tutorial, 'tutorial button renders in section header');
  assert.match(tutorial.getAttribute('aria-label'), /Tutorial|Guida|Guide|Anleitung|Обучение/);
  tutorial.click();
  await desk.flush(2);
  const modal = desk.document.getElementById('ws-tutorial');
  assert.equal(modal.hidden, false, 'tutorial opens');
  assert.match(modal.textContent, /How it works/);
  assert.match(modal.textContent, /Backtest/);
  const italian = [...modal.querySelectorAll('.ws-tutorial-langs button')].find(button => button.textContent === 'IT');
  italian.click();
  await desk.flush(2);
  assert.match(modal.textContent, /Come funziona/);
  assert.match(modal.textContent, /ristrutturare|rischio|backtest/i);
  desk.document.getElementById('ws-tutorial-close').click();
  await desk.flush();
  assert.equal(modal.hidden, true, 'tutorial closes');
});

test('guided strategy builder walks from template to saved paper strategy', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('strategies').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  assert.equal(content.querySelectorAll('.ws-strategy-templates-page .ws-strategy-template').length, 8);
  const dip = [...content.querySelectorAll('.ws-strategy-template')].find(button => /Buy the dip/.test(button.textContent));
  assert.ok(dip, 'dip template renders');
  dip.click();
  await desk.flush(4);
  assert.match(content.textContent, /What are we trading/);
  const token = content.querySelector('.ws-strategy-step .hf-field input');
  token.value = BONK;
  token.dispatchEvent(new desk.window.Event('input', { bubbles: true }));
  let next = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Continue');
  assert.ok(next, 'continue from token step');
  next.click();
  await desk.flush(4);
  assert.match(content.textContent, /Choose an idea/);
  next = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Continue');
  next.click();
  await desk.flush(4);
  assert.match(content.textContent, /Tune the triggers/);
  assert.match(content.textContent, /Add trigger/);
  next = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Continue');
  next.click();
  await desk.flush(4);
  assert.match(content.textContent, /Distill the risk/);
  assert.equal(content.querySelectorAll('.ws-strategy-profile').length, 3);
  assert.match(content.querySelector('.ws-strategy-profile.active')?.textContent || '', /Balanced/);
  next = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Continue');
  next.click();
  await desk.flush(4);
  assert.match(content.textContent, /Test the idea/);
  const runTest = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Run test');
  assert.ok(runTest, 'run test action renders');
  runTest.click();
  await desk.flush(8);
  assert.match(content.textContent, /Win rate/);
  assert.match(content.textContent, /75.0%/);
  next = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Continue');
  next.click();
  await desk.flush(4);
  assert.match(content.textContent, /Review and launch/);
  const save = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save draft');
  assert.ok(save, 'save draft action renders');
  save.click();
  await desk.flush(6);
  assert.ok((desk.calls.walletStrategySave || 0) >= 1, 'strategy saved through IPC');
  assert.ok(desk.toasts.some(message => /saved as a draft/i.test(message)), 'draft save toast');
});

test('live auto off requires explicit live signer and confirmation', async () => {
  const desk = createDesk({ wallet: walletFixture({ config: { execution: 'live', addresses: [], limits: {}, mode: 'simple', currency: 'USD' }, wc: { connected: true, accounts: ['solana:abc'] } }) });
  desk.window.confirm = () => true;
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('strategies').click();
  await desk.flush(4);
  const toggle = [...desk.document.querySelectorAll('#ws-content button')].find(button => button.textContent.trim() === 'Live auto off');
  assert.ok(toggle, 'live auto toggle renders');
  toggle.click();
  await desk.flush(4);
  assert.ok((desk.calls.walletConfig || 0) >= 1, 'live auto opt-in saved through wallet config');
});

test('signals use presets and a guided composer', async () => {
  const desk = createDesk({ wallet: walletFixture() });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('strategies').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  assert.equal(content.querySelectorAll('.ws-signal-preset').length, 5);
  const dip = [...content.querySelectorAll('.ws-signal-preset')].find(button => /24h dip/.test(button.textContent));
  assert.ok(dip, 'dip signal preset renders');
  dip.click();
  await desk.flush(4);
  assert.match(content.textContent, /Build a signal/);
  assert.match(content.textContent, /Notify me when 24h change is below -20.0%/);
  const create = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Create signal');
  assert.ok(create, 'create signal action renders');
  create.click();
  await desk.flush(6);
  assert.ok((desk.calls.walletSignalSave || 0) >= 1, 'signal saved through IPC');
  assert.ok(desk.toasts.some(message => /Signal created/.test(message)), 'signal toast');
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
  const automation = [...desk.document.querySelectorAll('#ws-content .ws-wallet-tabs button')].find(button => button.textContent.trim() === 'Automation');
  assert.ok(automation, 'automation tab renders');
  automation.click();
  await desk.flush();
  const open = [...desk.document.querySelectorAll('#ws-content .ws-wallet-automation-row button')].find(button => button.textContent.trim() === 'Copy to paper');
  assert.ok(open, 'copy action renders');
  open.click();
  await desk.flush();
  const submit = [...desk.document.querySelectorAll('#ws-content .ws-copyform button')].find(button => button.textContent.trim() === 'Copy to paper');
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
  const automation = [...content.querySelectorAll('.ws-wallet-tabs button')].find(button => button.textContent.trim() === 'Automation');
  assert.ok(automation, 'automation tab renders');
  automation.click();
  await desk.flush();
  assert.match(content.textContent, /Auto-mirror/);
  assert.match(content.textContent, /Paper only/);
  const save = [...content.querySelectorAll('.ws-mirrorform button')].find(button => button.textContent.trim() === 'Save mirror');
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
  desk.tab('alerts').click();
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
  const addPerson = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Add person');
  assert.ok(addPerson, 'add person action renders');
  addPerson.click();
  await desk.flush();
  assert.match(content.textContent, /Track a wallet/);
  assert.match(content.textContent, /Alpha KOL/);
  assert.match(content.textContent, /KOL/);
  assert.ok([...content.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'Scan wallet'));
  assert.match(content.textContent, /on radar/);
  const watch = [...content.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Pause radar');
  assert.ok(watch, 'activity watcher toggle renders');
  watch.click();
  await desk.flush(6);
  assert.ok((desk.calls.walletPeopleWatch || 0) >= 1, 'activity toggle calls the watcher IPC');
  const starters = [...content.querySelectorAll('button')].find(button => button.textContent.trim() === 'Starter pack');
  assert.ok(starters, 'starter pack button renders');
  starters.click();
  await desk.flush(6);
  assert.ok((desk.calls.walletRadarStarter || 0) >= 1, 'starter pack loads through IPC');
});

test('People search and source filters narrow the directory', async () => {
  const manual = {
    id: 'p1', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Alpha KOL', kind: 'kol', tags: ['kol'], note: 'manual pick', addedAt: Date.now(), scanAt: Date.now(), launches: [], stats: { launches: 0, completed: 0, lastLaunchAt: 0 }, scan: { at: Date.now(), total: 500, holdings: [], unpriced: [], recent: [] }
  };
  const starter = {
    id: 'p2', address: 'CFzVktB6sfK8rpewZeJ5VRPcvG5BBtK6pSbZ7FHVze4V', label: 'Axiom One', kind: 'trader', tags: ['starter', 'axiom'], note: 'starter pack', source: 'axiom', sourceRank: 1, starter: true, addedAt: Date.now(), scanAt: 0, launches: [], stats: { launches: 0, completed: 0, lastLaunchAt: 0 }, scan: null
  };
  const desk = createDesk({ wallet: walletFixture({ people: [manual, starter] }) });
  desk.window.AuroraWorkspace.open(true);
  await desk.flush();
  desk.tab('people').click();
  await desk.flush(4);
  const content = desk.document.getElementById('ws-content');
  assert.equal(content.querySelectorAll('.ws-people-list .ws-item').length, 2);
  const search = content.querySelector('.ws-people-search');
  search.value = 'Axiom One';
  search.dispatchEvent(new desk.window.Event('input', { bubbles: true }));
  await desk.flush(2);
  assert.equal(content.querySelectorAll('.ws-people-list .ws-item').length, 1);
  assert.match(content.textContent, /Axiom One/);
  search.value = '';
  search.dispatchEvent(new desk.window.Event('input', { bubbles: true }));
  const source = content.querySelector('.ws-people-source');
  source.value = 'axiom';
  source.dispatchEvent(new desk.window.Event('change', { bubbles: true }));
  await desk.flush(2);
  assert.equal(content.querySelectorAll('.ws-people-list .ws-item').length, 1);
  assert.match(content.textContent, /Showing 1 of 2/);
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
