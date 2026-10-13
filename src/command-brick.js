// A floating, draggable "command brick": a glassy, see-through bar that appears
// when the app is minimised, becomes solid on hover, accepts typed commands and
// voice, streams the reply back in place, and can be pinned open or collapsed.
const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { keepOverlayOnTop } = require('./overlay-window');

const SIZE = { width: 470, height: 84 };
const SIZE_EXPANDED = { width: 470, height: 250 };

function createCommandBrick({ getMain, getBounds, saveBounds, getPinned, savePinned, onAction, enabled = true }) {
  let disposed = false, hideTimer;
  const model = { state: 'idle', status: '', busy: false, reply: '', transcript: '', partial: '', error: '', pinned: false, collapsed: false, agent: { name: 'Aurora', avatar: 'assets/agents/aurora.webp' }, voice: { enabled: false, status: 'off' } };
  const listening = () => model.voice.enabled && !['off', 'wake', 'starting'].includes(model.voice.status);
  const activity = () => model.busy || !!model.reply || !!model.error || !!model.transcript || !!model.partial || listening();
  const expanded = () => model.pinned || (!model.collapsed && activity());

  const win = new BrowserWindow({
    ...SIZE, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, focusable: true, show: false,
    ...(process.platform === 'darwin' ? { vibrancy: 'under-window', visualEffectState: 'active', backgroundColor: '#00000000' } : { backgroundColor: '#00000000' }),
    webPreferences: { preload: path.join(__dirname, 'brick-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const layer = keepOverlayOnTop(win);
  let manual = false;
  model.pinned = !!(getPinned && getPinned());

  function place() {
    const main = getMain();
    const reference = main && !main.isDestroyed() && main.getBounds ? main.getBounds() : screen.getPrimaryDisplay().bounds;
    const area = screen.getDisplayMatching(reference).workArea;
    const saved = getBounds && getBounds();
    const width = expanded() ? SIZE_EXPANDED.width : SIZE.width, height = expanded() ? SIZE_EXPANDED.height : SIZE.height;
    let x, y;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) { x = saved.x; y = saved.y; }
    else { x = Math.round(area.x + (area.width - width) / 2); y = Math.round(area.y + area.height - height - 24); }
    x = Math.round(Math.max(area.x + 6, Math.min(x, area.x + area.width - width - 6)));
    y = Math.round(Math.max(area.y + 6, Math.min(y, area.y + area.height - height - 6)));
    win.setBounds({ x, y, width, height });
  }
  function payload() { return { ...model, expanded: expanded(), visible: win.isVisible() }; }
  function send() { if (!win.isDestroyed() && !win.webContents.isLoading()) win.webContents.send('brick-event', payload()); }
  function show(focus = false) {
    if (disposed || win.isDestroyed()) return;
    clearTimeout(hideTimer); hideTimer = null;
    if (win.webContents.isLoading()) { win.webContents.once('did-finish-load', () => { place(); (focus ? win.show() : win.showInactive()); layer.raise(); send(); }); return; }
    place(); focus ? win.show() : win.showInactive(); if (focus) win.focus(); layer.raise(); send();
  }
  function hide() { if (disposed || win.isDestroyed()) return; send(); hideTimer = setTimeout(() => { hideTimer = null; if (!win.isDestroyed()) win.hide(); }, 160); }
  function sync() {
    if (disposed || win.isDestroyed()) return;
    const main = getMain();
    const showNow = enabled && manual !== 'hidden' && (!main || main.isMinimized() || model.pinned);
    if (showNow) { if (!win.isVisible()) show(false); else { place(); send(); } }
    else if (win.isVisible()) hide();
  }
  function event(value) {
    if (!value || !value.type) return;
    switch (value.type) {
      case 'reply-start': model.reply = ''; model.busy = true; model.collapsed = false; break;
      case 'token': model.reply += value.text; model.collapsed = false; break;
      case 'reply-end': model.busy = false; break;
      case 'state': model.state = value.state; model.status = value.detail || ''; model.busy = ['thinking', 'browsing', 'coding'].includes(value.state); break;
      case 'voice-state': model.voice = { enabled: value.voice.enabled, status: value.voice.status }; if (value.voice.status === 'waking') { model.reply = ''; model.transcript = ''; model.partial = ''; model.error = ''; } break;
      case 'voice-partial': model.partial = value.text; model.collapsed = false; break;
      case 'voice-transcript': model.transcript = value.text; model.partial = ''; model.collapsed = false; break;
      case 'error': model.error = value.message; model.collapsed = false; break;
      default: return;
    }
    if (win.isVisible()) { if (expanded() || model.reply || model.error) place(); send(); }
  }
  function setPinned(value) { model.pinned = !!value; if (savePinned) savePinned(model.pinned); sync(); if (win.isVisible()) { place(); send(); } }
  const expected = pathToFileURL(path.join(__dirname, 'brick.html')).href;
  ipcMain.handle('brick-action', async (event, message) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== expected) throw Error('Untrusted brick sender.');
    const action = message && message.action;
    try {
      if (action === 'send') { const text = String(message.value || '').trim(); if (!text) throw Error('Type a command first.'); model.transcript = text; model.reply = ''; model.error = ''; model.busy = true; model.collapsed = false; send(); const result = await onAction('send', text); model.busy = false; if (result && typeof result === 'object' && result.error) model.error = result.error; send(); return { ok: true, value: model.reply }; }
      if (action === 'listen') { const result = await onAction('listen'); return { ok: true, value: result }; }
      if (action === 'open') { await onAction('open'); return { ok: true, value: true }; }
      if (action === 'hide') { manual = 'hidden'; hide(); return { ok: true, value: true }; }
      if (action === 'pin') { setPinned(!model.pinned); return { ok: true, value: model.pinned }; }
      if (action === 'collapse') { model.collapsed = !model.collapsed; place(); send(); return { ok: true, value: model.collapsed }; }
      if (action === 'drag-end') { if (saveBounds) saveBounds(win.getBounds()); return { ok: true, value: true }; }
      throw Error('Unknown brick action.');
    } catch (error) { model.error = error.message; model.busy = false; send(); return { ok: false, error: error.message }; }
  });
  win.webContents.once('did-finish-load', () => { place(); send(); });
  win.on('moved', () => { if (saveBounds) saveBounds(win.getBounds()); });
  win.loadFile(path.join(__dirname, 'brick.html'));
  win.on('closed', () => { if (!disposed) dispose(); });
  function showForInput() { manual = manual === 'hidden' ? null : manual; show(true); }
  function setAgent(value) { if (value && value.avatar) { model.agent = { name: value.name || 'Aurora', avatar: value.avatar }; if (win.isVisible()) send(); } }
  function dispose() { if (disposed) return; disposed = true; clearTimeout(hideTimer); layer.dispose(); ipcMain.removeHandler('brick-action'); if (!win.isDestroyed()) win.destroy(); }
  return { sync, event, show, hide, showForInput, setAgent, setPinned, dispose, window: win };
}
module.exports = { createCommandBrick };
