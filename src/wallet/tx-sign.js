const crypto = require('node:crypto');
const vault = require('./vault');

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function readCompactU16(buffer, offset) {
  let value = 0, shift = 0, cursor = offset;
  for (let i = 0; i < 3; i++) {
    if (cursor >= buffer.length) throw new Error('Truncated transaction.');
    const byte = buffer[cursor++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return { value, offset: cursor };
    shift += 7;
  }
  throw new Error('Invalid compact-u16 value.');
}
function privateKeyFromSeed(seed) {
  if (!seed || seed.length !== 32) throw new Error('Invalid ed25519 seed.');
  return crypto.createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
}
function signSerializedTransaction(transactionBase64, secretKey, expectedPublicKey = '') {
  if (typeof transactionBase64 !== 'string' || !transactionBase64) throw new Error('Missing transaction.');
  const secret = vault.base58decode(secretKey);
  if (secret.length !== 64) throw new Error('A Solana secret key must be 64 bytes.');
  const publicKey = vault.base58encode(secret.subarray(32));
  if (expectedPublicKey && expectedPublicKey !== publicKey) throw new Error('The selected bot wallet does not match its encrypted key.');
  const bytes = Buffer.from(transactionBase64, 'base64');
  if (bytes.length < 4) throw new Error('Transaction is too short.');
  const signatures = readCompactU16(bytes, 0);
  if (signatures.value < 1) throw new Error('Transaction has no signature slots.');
  const signatureStart = signatures.offset;
  const messageStart = signatureStart + signatures.value * 64;
  if (messageStart >= bytes.length) throw new Error('Transaction message is missing.');
  const versioned = (bytes[messageStart] & 0x80) !== 0;
  const headerStart = messageStart + (versioned ? 1 : 0);
  if (headerStart + 3 > bytes.length) throw new Error('Transaction header is missing.');
  const requiredSignatures = bytes[headerStart];
  if (requiredSignatures !== 1) throw new Error('This transaction needs multiple signers. Use WalletConnect instead.');
  const keys = readCompactU16(bytes, headerStart + 3);
  const keysStart = keys.offset;
  if (keysStart + keys.value * 32 > bytes.length) throw new Error('Transaction account keys are missing.');
  let signerIndex = -1;
  for (let i = 0; i < requiredSignatures; i++) {
    const key = vault.base58encode(bytes.subarray(keysStart + i * 32, keysStart + (i + 1) * 32));
    if (key === publicKey) { signerIndex = i; break; }
  }
  if (signerIndex < 0) throw new Error('The selected bot wallet is not a signer for this transaction.');
  const message = bytes.subarray(messageStart);
  const signature = crypto.sign(null, message, privateKeyFromSeed(secret.subarray(0, 32)));
  signature.copy(bytes, signatureStart + signerIndex * 64);
  return { transaction: bytes.toString('base64'), signature: vault.base58encode(signature), publicKey };
}
module.exports = { readCompactU16, signSerializedTransaction };
