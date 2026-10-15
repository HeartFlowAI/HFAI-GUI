const { test } = require('node:test'), assert = require('node:assert/strict');
const markets = require('../src/wallet/markets');
const providers = require('../src/wallet/providers');

test('markets list is well formed and SOL is present', () => {
  const list = markets.listMarkets();
  assert.ok(list.length >= 8);
  assert.ok(list.every(m => typeof m.mint === 'string' && m.symbol && m.name));
  assert.ok(list.some(m => m.mint === 'So11111111111111111111111111111111111111112' && m.symbol === 'SOL'));
  assert.equal(markets.mintSet().size, list.length);
  assert.equal(markets.marketFor('So11111111111111111111111111111111111111112').symbol, 'SOL');
  assert.equal(markets.marketFor('unknown'), null);
});

test('priceHistory maps CoinGecko points and drops bad rows', async () => {
  const fetchImpl = async url => { assert.match(url, /api\.coingecko\.com\/api\/v3\/coins\/solana\/market_chart/); return { ok: true, json: async () => ({ prices: [[1000, 1.5], [2000, 0], [3000, 2.25]] }) }; };
  const points = await providers.priceHistory('solana', { fetchImpl });
  assert.deepEqual(points, [{ t: 1000, p: 1.5 }, { t: 3000, p: 2.25 }]);
});

test('priceHistory throws on a bad response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => providers.priceHistory('solana', { fetchImpl }), /429/);
});

test('tokenHistory reads CoinGecko contract history by mint', async () => {
  const fetchImpl = async url => { assert.match(url, /coins\/solana\/contract\/So11111111111111111111111111111111111111112\/market_chart\?vs_currency=usd&days=90/); return { ok: true, json: async () => ({ prices: [[1000, 2], [2000, 3]] }) }; };
  const points = await providers.tokenHistory('So11111111111111111111111111111111111111112', 90, { fetchImpl });
  assert.deepEqual(points, [{ t: 1000, p: 2 }, { t: 2000, p: 3 }]);
});

test('holders prefers RugCheck and reports holder count and risks', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ totalHolders: 12345, risks: [{ name: 'Low liquidity' }], topHolders: [{ owner: 'WalletAAA', uiAmount: 30, pct: 30 }, { owner: 'WalletBBB', uiAmount: 20, pct: 20 }] }) });
  const info = await providers.holders('MintAAA', { fetchImpl });
  assert.equal(info.source, 'rugcheck');
  assert.equal(info.holders, 12345);
  assert.equal(info.top10, 50);
  assert.equal(info.accounts[0].address, 'WalletAAA');
  assert.deepEqual(info.risks, ['Low liquidity']);
});
