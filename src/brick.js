// Renderer for the floating command brick. Pure presentation: the main process
// owns visibility, position, expansion and the model; this file reflects it.
(() => {
  const $ = id => document.getElementById(id);
  const brick = $('brick'), input = $('input'), form = $('form');
  let lastReply = '';

  function render(model) {
    if (!model) return;
    const agent = model.agent || {};
    if (agent.avatar) { $('avatar').src = agent.avatar; input.placeholder = `Tell ${agent.name || 'your waifu'} what to do…`; }
    const state = model.state || 'idle';
    brick.dataset.state = state;
    brick.dataset.expanded = String(!!model.expanded);
    $('status').textContent = model.status || 'Ready';
    const thinking = !!model.busy || ['thinking', 'browsing', 'coding'].includes(state);
    $('thinking').hidden = !thinking;
    const listening = model.voice && model.voice.enabled && !['off', 'wake'].includes(model.voice.status);
    $('mic').classList.toggle('listening', !!listening);

    const heard = model.partial || model.transcript || '';
    $('heard').hidden = !heard;
    $('heard').dataset.partial = String(!!model.partial);
    $('heard').textContent = heard ? (model.partial ? heard : `You: ${heard}`) : '';
    $('reply').textContent = model.reply || '';
    $('error').hidden = !model.error;
    $('error').textContent = model.error || '';
    $('panel').hidden = !model.expanded;
    $('pin').setAttribute('aria-pressed', String(!!model.pinned));
    $('pin').title = model.pinned ? 'Stop keeping open' : 'Keep open';
    $('collapse').title = model.collapsed ? 'Expand' : 'Collapse';
    if (model.reply && model.reply !== lastReply) { lastReply = model.reply; $('reply').scrollIntoView({ block: 'end' }); }
  }

  async function run(action, value) {
    try { return await window.brick.action(action, value); }
    catch (error) { $('error').hidden = false; $('error').textContent = error.message; }
  }

  form.addEventListener('submit', async event => { event.preventDefault(); const text = input.value.trim(); if (!text) return; input.value = ''; await run('send', text); input.focus(); });
  $('mic').addEventListener('click', async () => { await run('listen'); input.focus(); });
  $('pin').addEventListener('click', () => run('pin'));
  $('collapse').addEventListener('click', () => run('collapse'));
  $('open').addEventListener('click', () => run('open'));
  $('hide').addEventListener('click', () => run('hide'));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') run('hide'); });
  window.addEventListener('mouseup', () => run('drag-end'));

  window.brick.onEvent(render);
  input.focus();
})();
