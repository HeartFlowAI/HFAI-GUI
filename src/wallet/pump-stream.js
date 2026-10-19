const WebSocket = require('ws');

function normalizeUri(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${text.slice(7).replace(/^ipfs\//, '')}`;
  if (text.startsWith('ar://')) return `https://arweave.net/${text.slice(5)}`;
  return /^https:\/\//.test(text) ? text : '';
}
function linkUrl(value, kind = 'website') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https:\/\//.test(text)) return text;
  if (/^http:\/\//.test(text)) return text.replace(/^http:/, 'https:');
  if (text.startsWith('@')) return kind === 'telegram' ? `https://t.me/${text.slice(1)}` : `https://x.com/${text.slice(1)}`;
  if (kind === 'website' && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return `https://${text}`;
  return '';
}
function normalizePumpMetadata(raw, uri) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const extensions = source.extensions && typeof source.extensions === 'object' ? source.extensions : {};
  const links = [
    { type: 'twitter', url: linkUrl(source.twitter || source.x || extensions.twitter, 'twitter') },
    { type: 'telegram', url: linkUrl(source.telegram || extensions.telegram, 'telegram') },
    { type: 'website', url: linkUrl(source.website || source.url || extensions.website, 'website') }
  ].filter(link => link.url).slice(0, 3);
  return {
    uri, name: String(source.name || '').slice(0, 80), symbol: String(source.symbol || '').slice(0, 20),
    description: String(source.description || '').slice(0, 300), imageUrl: normalizeUri(source.image || source.image_url || source.logo),
    links
  };
}
async function fetchPumpMetadata(uri, { fetchImpl = fetch, signal, cache = new Map(), ttl = 30 * 60000 } = {}) {
  const url = normalizeUri(uri);
  if (!url) return null;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < ttl) return cached.value;
  const candidates = [url];
  const ipfs = url.match(/\/ipfs\/([^/?#]+)/);
  if (ipfs) {
    const cid = ipfs[1];
    candidates.push(
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://ipfs.filebase.io/ipfs/${cid}`,
      `https://4everland.io/ipfs/${cid}`,
      `https://pump.mypinata.cloud/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`
    );
  }
  let lastError;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const response = await fetchImpl(candidate, { headers: { accept: 'application/json' }, signal: signal || AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Token metadata responded ${response.status}.`);
      const body = await response.json();
      const value = normalizePumpMetadata(body, candidate);
      cache.set(url, { at: Date.now(), value });
      return value;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Token metadata unavailable.');
}
function createPumpStream({ url = 'wss://pumpportal.fun/api/data', WebSocketImpl = WebSocket, onToken = () => {}, onMigration = () => {}, reconnectMax = 30000 } = {}) {
  let socket = null, stopped = false, retry = 1000, timer = null;
  function schedule() {
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = null; connect(); }, retry);
    timer.unref?.();
    retry = Math.min(reconnectMax, retry * 2);
  }
  function connect() {
    if (stopped || socket) return;
    try { socket = new WebSocketImpl(url); }
    catch { socket = null; schedule(); return; }
    socket.on('open', () => {
      retry = 1000;
      try {
        socket.send(JSON.stringify({ method: 'subscribeNewToken' }));
        socket.send(JSON.stringify({ method: 'subscribeMigration' }));
      } catch {}
    });
    socket.on('message', data => {
      let event;
      try { event = JSON.parse(String(data)); } catch { return; }
      if (!event || typeof event.mint !== 'string') return;
      if (event.txType === 'create' || event.pool === 'pump') onToken(event);
      else onMigration(event);
    });
    socket.on('error', () => {});
    socket.on('close', () => { socket = null; if (!stopped) schedule(); });
  }
  function start() { if (socket) return; stopped = false; connect(); }
  function stop() { stopped = true; if (timer) clearTimeout(timer); timer = null; try { socket?.close(); } catch {} socket = null; }
  return { start, stop, isOpen: () => !!socket && socket.readyState === 1 };
}
module.exports = { createPumpStream, normalizePumpMetadata, fetchPumpMetadata, normalizeUri, linkUrl };
