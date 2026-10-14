const { test } = require('node:test'), assert = require('node:assert/strict');
const aura = require('../src/aura');

test('minted Aura keys verify and look like real membership codes', () => {
  const code = aura.mint();
  assert.match(code, /^HFAI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[0-9A-F]{6}$/);
  assert.equal(aura.verify(code), true);
  assert.equal(aura.verify(code.toLowerCase()), true);
  assert.equal(aura.verify(`  ${code}  `), true);
  assert.equal(new Set([aura.mint(), aura.mint(), aura.mint()]).size, 3);
});
test('Aura verification rejects tampered and malformed codes', () => {
  const code = aura.mint();
  const [prefix, a, b, sum] = code.split('-');
  const flipped = sum[0] === 'A' ? 'B' : 'A';
  assert.equal(aura.verify(`${prefix}-${a}-${b}-${flipped}${sum.slice(1)}`), false);
  assert.equal(aura.verify('HFAI-AAAA-BBBB-000000'), false);
  for (const bad of ['', 'nope', 'HFAI', 'HFAI-ABCD-EFGH', 'HFAI-ABCD-EFGH-12345', null, 42, undefined]) assert.equal(aura.verify(bad), false);
});
test('Aura masking never reveals the full code', () => {
  const code = aura.mint();
  const masked = aura.mask(code);
  assert.equal(masked.includes(code), false);
  assert.match(masked, /^HFAI-[A-HJ-NP-Z2-9]{4}…[0-9A-F]{4}$/);
  assert.equal(aura.mask(''), '');
});
