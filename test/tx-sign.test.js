const { test } = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vault = require('../src/wallet/vault');
const { signSerializedTransaction, readCompactU16 } = require('../src/wallet/tx-sign');

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
function verify(publicKey, message, signature) {
  const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, vault.base58decode(publicKey)]), format: 'der', type: 'spki' });
  return crypto.verify(null, message, key, vault.base58decode(signature));
}
function fakeTransaction(publicKey, { versioned = false } = {}) {
  const pub = vault.base58decode(publicKey);
  const header = Buffer.from([1, 0, 0]);
  const keyCount = Buffer.from([1]);
  const blockhash = Buffer.alloc(32, 7);
  const message = Buffer.concat([...(versioned ? [Buffer.from([0x80])] : []), header, keyCount, pub, blockhash, Buffer.from([0])]);
  return { wire: Buffer.concat([Buffer.from([1]), Buffer.alloc(64), message]), message };
}

test('signSerializedTransaction signs a single-signer legacy transaction', () => {
  const { publicKey, secretKey } = vault.generateKeypair();
  const { wire, message } = fakeTransaction(publicKey);
  const signed = signSerializedTransaction(wire.toString('base64'), secretKey, publicKey);
  assert.equal(signed.publicKey, publicKey);
  assert.ok(verify(publicKey, message, signed.signature));
});

test('signSerializedTransaction signs a versioned transaction', () => {
  const { publicKey, secretKey } = vault.generateKeypair();
  const { wire, message } = fakeTransaction(publicKey, { versioned: true });
  const signed = signSerializedTransaction(wire.toString('base64'), secretKey, publicKey);
  assert.ok(verify(publicKey, message, signed.signature));
});

test('signSerializedTransaction rejects a different expected wallet', () => {
  const first = vault.generateKeypair();
  const second = vault.generateKeypair();
  const { wire } = fakeTransaction(first.publicKey);
  assert.throws(() => signSerializedTransaction(wire.toString('base64'), first.secretKey, second.publicKey), /does not match/);
});

test('compact-u16 parses a multi-byte value', () => {
  const parsed = readCompactU16(Buffer.from([0x80, 0x01]), 0);
  assert.equal(parsed.value, 128);
  assert.equal(parsed.offset, 2);
});
