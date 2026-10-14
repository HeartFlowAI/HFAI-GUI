// WalletConnect for Solana. Keys stay in the user's wallet; Aurora only receives
// signed transactions. Needs a WalletConnect (Reown) project ID.
const CHAIN_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const CHAIN_DEVNET = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';
const METHODS = ['solana_signTransaction', 'solana_signAndSendTransaction', 'solana_signMessage'];
const EVENTS = ['accountsChanged', 'chainChanged'];

function loadSignClient() {
  const mod = require('@walletconnect/sign-client');
  return mod.default || mod.SignClient || mod;
}
function createSolanaConnect({ getProjectId, getChain, getStorage, setStorage, metadata } = {}) {
  let client = null, initializing = null;
  async function ensure() {
    if (client) return client;
    if (initializing) return initializing;
    const projectId = String(getProjectId?.() || '').trim();
    if (!projectId) throw new Error('Add a WalletConnect project ID in Settings, Wallet first.');
    initializing = (async () => {
      const SignClient = loadSignClient();
      const store = (getStorage?.() || {});
      const memory = new Map(Object.entries(store));
      const storage = {
        getItem: async key => (memory.has(key) ? memory.get(key) : null),
        setItem: async (key, value) => { memory.set(key, value); setStorage?.(Object.fromEntries(memory)); },
        removeItem: async key => { memory.delete(key); setStorage?.(Object.fromEntries(memory)); }
      };
      client = await SignClient.init({
        projectId,
        metadata: metadata || { name: 'Heartflow Aurora', description: 'Aurora wallet', url: 'https://heartflowai.net', icons: ['https://heartflowai.net/assets/heart.webp'] },
        storage,
        logger: 'error'
      });
      return client;
    })();
    try { return await initializing; } catch (error) { initializing = null; throw error; }
  }
  function chain() { return getChain?.() || CHAIN_MAINNET; }
  async function pair() {
    const sign = await ensure();
    const { uri, approval } = await sign.connect({ requiredNamespaces: { solana: { methods: METHODS, chains: [chain()], events: EVENTS } } });
    return { uri, approval };
  }
  function session() {
    const sign = client;
    if (!sign) return null;
    const sessions = sign.session.getAll();
    const current = sessions[sessions.length - 1];
    if (!current) return null;
    const accounts = Object.values(current.namespaces || {}).flatMap(namespace => namespace.accounts || []);
    return { topic: current.topic, accounts, expiry: current.expiry || 0 };
  }
  async function disconnect() {
    const sign = client;
    const current = sign?.session.getAll().slice(-1)[0];
    if (sign && current) await sign.disconnect({ topic: current.topic, reason: { code: 6000, message: 'User disconnected' } }).catch(() => {});
  }
  async function signTransaction(topic, transactionBase64) {
    const sign = await ensure();
    return sign.request({ topic, chainId: chain(), request: { method: 'solana_signTransaction', params: { transaction: transactionBase64 } } });
  }
  async function signAndSendTransaction(topic, transactionBase64) {
    const sign = await ensure();
    return sign.request({ topic, chainId: chain(), request: { method: 'solana_signAndSendTransaction', params: { transaction: transactionBase64 } } });
  }
  function reset() { client = null; initializing = null; }
  return { ensure, pair, session, disconnect, signTransaction, signAndSendTransaction, reset, chain, CHAIN_MAINNET, CHAIN_DEVNET, METHODS };
}
module.exports = { createSolanaConnect, CHAIN_MAINNET, CHAIN_DEVNET, METHODS, EVENTS };
