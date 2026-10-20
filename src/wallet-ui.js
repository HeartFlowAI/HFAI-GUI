// Wallet settings only. The market/trading surface lives in workspace.js (the
// full-page Gigi desk); the companion dock tab opens that desk.
(() => {
  const el = id => document.getElementById(id);
  const wallet = () => (typeof view !== 'undefined' && view.wallet) ? view.wallet : null;
  const config = () => wallet()?.config || {};
  const state = () => wallet()?.state || null;

  function renderSettings() {
    const cfg = config();
    const list = el('wallet-addresses'); if (!list) return;
    list.replaceChildren();
    if (!cfg.addresses?.length) { const empty = document.createElement('p'); empty.className = 'field-help'; empty.textContent = 'No addresses watched yet. Add one below, or connect a wallet, to let Gigi read your holdings.'; list.append(empty); }
    for (const address of cfg.addresses || []) {
      const chip = document.createElement('div'); chip.className = 'wallet-chip';
      const text = document.createElement('span'); text.textContent = `${address.slice(0, 6)}…${address.slice(-6)}`; text.title = address;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wallet-chip-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Stop watching this address');
      remove.onclick = action(async () => { render(await call(window.aurora.walletAddressRemove(address))); renderSettings(); });
      chip.append(text, remove); list.append(chip);
    }
    el('wallet-rpc').value = cfg.rpc || '';
    el('wallet-hide').checked = cfg.hideBalances === true;
    document.querySelectorAll('#wallet-dialog [data-wallet-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.walletMode === cfg.mode)));
    document.querySelectorAll('#wallet-dialog [data-wallet-exec]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.walletExec === (cfg.execution || 'paper'))));
    const st = state();
    el('wallet-status').textContent = st?.error ? st.error : st?.watching ? (st.loading ? 'Reading your wallet…' : `Updated ${st.updated ? new Date(st.updated).toLocaleTimeString() : ''}`) : 'Read-only for watched wallets. Bot wallets stay encrypted on this device.';
    if (el('wallet-wc-project')) {
      el('wallet-wc-project').value = cfg.wcProjectId || '';
      const connected = wallet()?.wc?.connected === true;
      el('wallet-wc-connect').hidden = connected;
      el('wallet-wc-disconnect').hidden = !connected;
      if (connected) el('wallet-wc-status').textContent = `Connected ${((wallet().wc.accounts[0] || '').split(':').pop() || '').slice(0, 8)}…`; else if (!el('wallet-wc-status').dataset.busy) el('wallet-wc-status').textContent = '';
    }
    if (el('wallet-limit-position')) { const limits = cfg.limits || {}; el('wallet-limit-position').value = limits.maxPositionUsd || ''; el('wallet-limit-total').value = limits.maxTotalUsd || ''; el('wallet-limit-daily').value = limits.dailyCapUsd || ''; }
    if (el('wallet-vault-list')) {
      const bots = wallet()?.vault || [];
      el('wallet-vault-list').replaceChildren();
      if (!bots.length) { const empty = document.createElement('p'); empty.className = 'field-help'; empty.textContent = 'No bot wallets yet.'; el('wallet-vault-list').append(empty); }
      for (const bot of bots) { const chip = document.createElement('div'); chip.className = 'wallet-chip'; const text = document.createElement('span'); text.textContent = `${bot.label} · ${bot.publicKey.slice(0, 6)}…${bot.publicKey.slice(-6)}`; text.title = bot.publicKey; const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wallet-chip-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove this bot wallet'); remove.onclick = action(async () => { render(await call(window.aurora.walletVaultRemove(bot.id))); renderSettings(); }); chip.append(text, remove); el('wallet-vault-list').append(chip); }
      if (el('wallet-vault-live')) {
        const select = el('wallet-vault-live'); select.replaceChildren(); const connected = document.createElement('option'); connected.value = ''; connected.textContent = 'Connected WalletConnect wallet'; select.append(connected);
        for (const bot of bots) { const option = document.createElement('option'); option.value = bot.id; option.textContent = `${bot.label} · ${bot.publicKey.slice(0, 6)}…${bot.publicKey.slice(-6)}`; select.append(option); }
        select.value = bots.some(bot => bot.id === cfg.vaultWalletId) ? cfg.vaultWalletId : '';
        select.onchange = action(async () => { render(await call(window.aurora.walletConfig({ vaultWalletId: select.value }))); renderSettings(); });
      }
    }
  }

  if (el('wallet-open')) {
    el('wallet-open').onclick = () => { renderSettings(); el('wallet-dialog').showModal(); };
    el('wallet-close').onclick = () => el('wallet-dialog').close();
    el('wallet-close-2').onclick = () => el('wallet-dialog').close();
    el('wallet-address-form').onsubmit = event => { event.preventDefault(); const input = el('wallet-address-input'); action(async () => { render(await call(window.aurora.walletAddressAdd(input.value))); input.value = ''; renderSettings(); })(); };
    el('wallet-refresh').onclick = action(async () => { render(await call(window.aurora.walletRefresh())); renderSettings(); });
    el('wallet-rpc').onchange = action(async () => { render(await call(window.aurora.walletConfig({ rpc: el('wallet-rpc').value.trim() }))); renderSettings(); });
    el('wallet-hide').onchange = action(async () => { render(await call(window.aurora.walletConfig({ hideBalances: el('wallet-hide').checked }))); });
    document.querySelectorAll('#wallet-dialog [data-wallet-mode]').forEach(b => { b.onclick = action(async () => { render(await call(window.aurora.walletConfig({ mode: b.dataset.walletMode }))); renderSettings(); }); });
    document.querySelectorAll('#wallet-dialog [data-wallet-exec]').forEach(b => { b.onclick = action(async () => { render(await call(window.aurora.walletConfig({ execution: b.dataset.walletExec }))); renderSettings(); }); });
    ['wallet-limit-position', 'wallet-limit-total', 'wallet-limit-daily'].forEach((id, i) => { const key = ['maxPositionUsd', 'maxTotalUsd', 'dailyCapUsd'][i]; const input = el(id); if (input) input.onchange = action(async () => { render(await call(window.aurora.walletLimits({ [key]: Number(input.value) || 0 }))); }); });
    if (el('wallet-vault-generate')) el('wallet-vault-generate').onclick = action(async () => { render(await call(window.aurora.walletVaultGenerate({ label: el('wallet-vault-label').value }))); el('wallet-vault-label').value = ''; renderSettings(); });
    if (el('wallet-wc-project')) {
      el('wallet-wc-project').onchange = action(async () => { render(await call(window.aurora.walletConfig({ wcProjectId: el('wallet-wc-project').value.trim() }))); });
      el('wallet-wc-connect').onclick = action(async () => { const status = el('wallet-wc-status'); status.dataset.busy = '1'; status.textContent = 'Opening WalletConnect…'; try { const { uri } = await call(window.aurora.walletWcConnect()); if (uri) { try { await navigator.clipboard.writeText(uri); status.textContent = `URI copied. Open your wallet and paste or scan to approve. ${uri}`; } catch { status.textContent = uri; } } else status.textContent = 'Waiting for your wallet…'; } finally { delete status.dataset.busy; } });
      el('wallet-wc-disconnect').onclick = action(async () => { render(await call(window.aurora.walletWcDisconnect())); renderSettings(); });
    }
  }
  window.aurora.onEvent(event => { if (event.type === 'wallet' && el('wallet-dialog')?.open) renderSettings(); if (event.type === 'wallet-wc-error') { const status = el('wallet-wc-status'); if (status) { delete status.dataset.busy; status.textContent = event.message; } } });
})();
