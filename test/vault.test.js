const { test } = require('node:test'), assert = require('node:assert/strict');
const vault = require('../src/wallet/vault');

test('base58 round-trips bytes', () => {
  const bytes = Buffer.from([0, 0, 1, 2, 3, 255, 128, 0, 42]);
  assert.deepEqual(vault.base58decode(vault.base58encode(bytes)), bytes);
  assert.throws(() => vault.base58decode('0OIl'), /base58/);
});

test('generated keypair is a valid 64-byte Solana key with a matching public key', () => {
  const { publicKey, secretKey } = vault.generateKeypair();
  assert.equal(vault.validateSecret(secretKey), true);
  assert.equal(vault.base58decode(secretKey).length, 64);
  assert.equal(vault.publicFromSecret(secretKey), publicKey);
  assert.equal(vault.validateSecret(vault.generateKeypair().secretKey), true);
});

test('invalid secrets are rejected without throwing on validate', () => {
  assert.equal(vault.validateSecret('not a key'), false);
  assert.equal(vault.validateSecret(vault.base58encode(Buffer.alloc(32))), false);
  assert.throws(() => vault.publicFromSecret(vault.base58encode(Buffer.alloc(32))), /64 bytes/);
});
