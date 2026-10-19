const { test } = require('node:test'), assert = require('node:assert/strict');
const { normalizePumpMetadata, normalizeUri, linkUrl, fetchPumpMetadata } = require('../src/wallet/pump-stream');

test('pump metadata normalizes images and social links', () => {
  const meta = normalizePumpMetadata({ name: 'Test', symbol: 'TEST', image: 'ipfs://Qm123', twitter: 'https://x.com/test', telegram: '@testchan', website: 'example.com' }, 'uri');
  assert.equal(meta.name, 'Test');
  assert.equal(meta.symbol, 'TEST');
  assert.equal(meta.imageUrl, 'https://gateway.pinata.cloud/ipfs/Qm123');
  assert.deepEqual(meta.links.map(link => [link.type, link.url]), [['twitter', 'https://x.com/test'], ['telegram', 'https://t.me/testchan'], ['website', 'https://example.com']]);
  assert.equal(linkUrl('@handle', 'twitter'), 'https://x.com/handle');
  assert.equal(linkUrl('@handle', 'telegram'), 'https://t.me/handle');
  assert.equal(linkUrl('javascript:alert(1)', 'website'), '');
  assert.equal(normalizeUri('ar://abc'), 'https://arweave.net/abc');
});

test('fetchPumpMetadata fetches and caches metadata JSON', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ name: 'Cached', symbol: 'C', image: 'https://img.test/c.png', twitter: '@c' }) }; };
  const cache = new Map();
  const first = await fetchPumpMetadata('https://meta.test/c.json', { fetchImpl, cache });
  const second = await fetchPumpMetadata('https://meta.test/c.json', { fetchImpl, cache });
  assert.equal(calls, 1);
  assert.equal(first.name, 'Cached');
  assert.equal(second.imageUrl, 'https://img.test/c.png');
  assert.deepEqual(second.links, [{ type: 'twitter', url: 'https://x.com/c' }]);
});
