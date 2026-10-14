// Info buttons: a small "i" that opens a plain-language explainer.
(() => {
  let popover = null;
  const terms = () => window.AuroraHelp?.terms || {};
  function close() {
    if (popover) { popover.remove(); popover = null; }
    document.querySelectorAll('.info-tip[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }
  function open(button, id) {
    const info = terms()[id];
    if (!info) return;
    close();
    popover = document.createElement('div');
    popover.className = 'info-popover';
    popover.dataset.term = id;
    popover.setAttribute('role', 'dialog');
    const title = document.createElement('strong'); title.textContent = info.title;
    const body = document.createElement('p'); body.textContent = info.body;
    const ask = document.createElement('button'); ask.type = 'button'; ask.className = 'text-button'; ask.textContent = 'Ask Gigi';
    ask.onclick = () => { const prompt = document.getElementById('prompt'); if (prompt) { prompt.value = `Explain ${info.title.toLowerCase()} simply.`; prompt.focus(); } close(); };
    popover.append(title, body, ask);
    document.body.append(popover);
    const rect = button.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    popover.style.width = `${width}px`;
    popover.style.left = `${Math.min(window.innerWidth - width - 12, Math.max(12, rect.left - 8))}px`;
    popover.style.top = `${rect.bottom + 8}px`;
    button.setAttribute('aria-expanded', 'true');
  }
  document.addEventListener('click', event => { if (popover && !event.target.closest('.info-popover') && !event.target.closest('.info-tip')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && popover) close(); });
  window.auroraInfo = id => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'info-tip';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'i';
    const info = terms()[id];
    button.setAttribute('aria-label', info ? `What is ${info.title}` : 'More information');
    button.title = info ? `What is ${info.title}` : 'More information';
    button.onclick = () => { if (popover && popover.dataset.term === id) { close(); return; } open(button, id); };
    return button;
  };
})();
