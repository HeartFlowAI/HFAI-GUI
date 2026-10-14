const crypto = require('node:crypto');

// HFAI Aura membership uses locally verified unlock codes. Codes are minted with
// scripts/aura-key.js using this shared secret, so a code only works if it was
// produced with the same secret. This is a client-side entitlement for now; a
// future release can swap verify() for a server or on-chain check without
// changing callers.
const SECRET = 'HFAI-AURA-2026::heartflowai::9f3c1d7ac4b8e2';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BODY = '[A-HJ-NP-Z2-9]{4}';
const CODE = new RegExp(`^HFAI-(${BODY})-(${BODY})-([0-9A-F]{6})$`);

function base32(bytes, length) {
  let out = '', bits = 0, value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return length ? out.slice(0, length) : out;
}
function checksum(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 6).toUpperCase();
}
function mint() {
  const payload = base32(crypto.randomBytes(6), 8);
  return `HFAI-${payload.slice(0, 4)}-${payload.slice(4, 8)}-${checksum(payload)}`;
}
function normalize(code) {
  return typeof code === 'string' ? code.trim().toUpperCase().replace(/[\s]+/g, '') : '';
}
function verify(code) {
  const match = CODE.exec(normalize(code));
  if (!match) return false;
  const expected = checksum(match[1] + match[2]);
  const actual = match[3];
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
function mask(code) {
  const value = normalize(code);
  return value ? `${value.slice(0, 9)}…${value.slice(-4)}` : '';
}
module.exports = { mint, verify, normalize, mask };
