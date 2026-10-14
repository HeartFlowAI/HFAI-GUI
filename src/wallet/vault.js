const crypto = require('node:crypto');

// Local bot wallet keys. Generated and stored encrypted (safeStorage); secrets
// never reach models, build code, logs or the renderer. Signing a Jupiter
// transaction from this vault still needs a reviewed crypto step, so live
// execution currently signs through the connected external wallet.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58encode(buffer) {
  let value = buffer.length ? BigInt(`0x${buffer.toString('hex')}`) : 0n;
  let out = '';
  while (value > 0n) { out = ALPHABET[Number(value % 58n)] + out; value /= 58n; }
  for (const byte of buffer) { if (byte === 0) out = `1${out}`; else break; }
  return out || '1';
}
function base58decode(text) {
  if (typeof text !== 'string' || !text) throw new Error('Empty key.');
  let value = 0n;
  for (const character of text) { const index = ALPHABET.indexOf(character); if (index < 0) throw new Error('Invalid base58 character.'); value = value * 58n + BigInt(index); }
  let hex = value.toString(16); if (hex.length % 2) hex = `0${hex}`;
  const body = value === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let padding = 0; for (const character of text) { if (character === '1') padding++; else break; }
  return Buffer.concat([Buffer.alloc(padding), body]);
}
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
  const secret = Buffer.concat([seed, pub]);
  return { publicKey: base58encode(pub), secretKey: base58encode(secret) };
}
function validateSecret(secret) {
  try { return base58decode(secret).length === 64; } catch { return false; }
}
function publicFromSecret(secret) {
  const bytes = base58decode(secret);
  if (bytes.length !== 64) throw new Error('A Solana secret key must be 64 bytes.');
  return base58encode(bytes.subarray(32));
}
module.exports = { base58encode, base58decode, generateKeypair, validateSecret, publicFromSecret };
