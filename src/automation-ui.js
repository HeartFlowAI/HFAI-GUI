// Automations: create, schedule and run recurring Aurora routines. Runs happen
// while the app is open; the scheduler lives in the main process.
(() => {
  const el = id => document.getElementById(id);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let editing = '';

  const dialog = el('automation-dialog');
  dialog.innerHTML = `<div class="dialog-heading"><div><div class="eyebrow">AUTOMATION</div><h2>Automations</h2></div><button id="automation-close" class="icon-button" aria-label="Close automations">×</button></div><p>Recurring Aurora routines. They run in their own session while the app is open, then hand focus back to you.</p><div id="automation-list" class="automation-list"></div><h3 id="automation-form-title">New automation</h3><form id="automation-form"><label for="automation-name">Name</label><input id="automation-name" maxlength="80" placeholder="Morning brief" required><label for="automation-prompt">Prompt</label><textarea id="automation-prompt" rows="3" maxlength="8000" placeholder="Summarize my workspace notes and list today's priorities." required></textarea><label for="automation-schedule-type">Schedule</label><select id="automation-schedule-type"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="minutes">Every few minutes</option></select><div id="automation-time-row" class="automation-row"><label for="automation-time">Time</label><input id="automation-time" type="time" value="09:00"></div><div id="automation-days-row" class="automation-row" hidden><span class="automation-row-label">Days</span><div id="automation-days" class="automation-days"></div></div><div id="automation-minutes-row" class="automation-row" hidden><label for="automation-minutes">Every</label><input id="automation-minutes" type="number" min="5" max="1440" step="5" value="30"><span class="automation-row-label">minutes</span></div><label class="automation-toggle"><input id="automation-enabled" type="checkbox" checked> Enabled</label><div id="automation-status" role="status"></div><div class="dialog-footer"><button id="automation-new" type="button" class="text-button">Clear form</button><button class="secondary" id="automation-plan" type="button">Plan with Aurora</button><button class="primary" type="submit">Save automation</button></div></form>`;

  const days = el('automation-days');
  DAYS.forEach((name, index) => {
    const label = document.createElement('label');
    label.className = 'automation-day';
    const box = document.createElement('input');
    box.type = 'checkbox'; box.value = String(index); box.dataset.day = String(index);
    const span = document.createElement('span'); span.textContent = name;
    label.append(box, span); days.append(label);
  });

  function scheduleFields() {
    const type = el('automation-schedule-type').value;
    el('automation-time-row').hidden = type === 'minutes';
    el('automation-days-row').hidden = type !== 'weekly';
    el('automation-minutes-row').hidden = type !== 'minutes';
  }
  function resetForm() {
    editing = '';
    el('automation-form').reset();
    el('automation-enabled').checked = true;
    el('automation-time').value = '09:00';
    el('automation-minutes').value = '30';
    el('automation-schedule-type').value = 'daily';
    for (const box of days.querySelectorAll('input')) box.checked = false;
    el('automation-form-title').textContent = 'New automation';
    el('automation-status').textContent = '';
    scheduleFields();
  }
  function scheduleFromForm() {
    const type = el('automation-schedule-type').value;
    if (type === 'minutes') return { type, every: Number(el('automation-minutes').value) };
    if (type === 'weekly') return { type, time: el('automation-time').value, days: [...days.querySelectorAll('input:checked')].map(box => Number(box.dataset.day)) };
    return { type, time: el('automation-time').value };
  }
  function scheduleToForm(schedule) {
    el('automation-schedule-type').value = schedule.type;
    if (schedule.type === 'minutes') el('automation-minutes').value = String(schedule.every);
    if (schedule.time) el('automation-time').value = schedule.time;
    for (const box of days.querySelectorAll('input')) box.checked = schedule.type === 'weekly' && schedule.days.includes(Number(box.dataset.day));
    scheduleFields();
  }
  function when(item) {
    if (!item.enabled) return 'Paused';
    if (item.nextRun) return `${item.description} · next ${new Date(item.nextRun).toLocaleString()}`;
    return item.description;
  }
  function renderList() {
    if (typeof view === 'undefined') return;
    const list = view.automations || [], container = el('automation-list');
    container.replaceChildren();
    if (!list.length) { const empty = document.createElement('p'); empty.className = 'field-help'; empty.textContent = 'No automations yet. Add one below.'; container.append(empty); return; }
    for (const item of list) {
      const row = document.createElement('div'); row.className = 'automation-item' + (item.enabled ? '' : ' paused');
      const info = document.createElement('div'); info.className = 'automation-item-info';
      const name = document.createElement('strong'); name.textContent = item.name;
      const meta = document.createElement('small'); meta.textContent = when(item) + (item.lastRun ? ` · last ran ${new Date(item.lastRun).toLocaleString()}${item.lastStatus === 'error' ? ' (failed)' : ''}` : '');
      const prompt = document.createElement('small'); prompt.className = 'automation-item-prompt'; prompt.textContent = item.prompt;
      info.append(name, meta, prompt);
      const controls = document.createElement('div'); controls.className = 'automation-controls';
      for (const [label, handler] of [['Run now', () => runNow(item)], [item.enabled ? 'Pause' : 'Resume', () => toggle(item)], ['Edit', () => edit(item)], ['Delete', () => remove(item)]]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = label; button.onclick = action(handler); controls.append(button);
      }
      row.append(info, controls); container.append(row);
    }
  }
  async function refresh(result) { if (result) render(result); renderList(); }
  async function save(form) {
    const payload = { id: editing || undefined, name: el('automation-name').value, prompt: el('automation-prompt').value, schedule: scheduleFromForm(), enabled: el('automation-enabled').checked };
    await refresh(await call(window.aurora.automationSave(payload)));
    resetForm();
    el('automation-status').textContent = 'Saved. It will run while Aurora is open.';
  }
  async function toggle(item) { await refresh(await call(window.aurora.automationToggle(item.id, !item.enabled))); }
  async function remove(item) { if (!confirm(`Delete the automation "${item.name}"?`)) return; await refresh(await call(window.aurora.automationDelete(item.id))); if (editing === item.id) resetForm(); }
  async function runNow(item) {
    el('automation-status').textContent = `Running "${item.name}"…`;
    try { await refresh(await call(window.aurora.automationRun(item.id))); el('automation-status').textContent = `"${item.name}" finished.`; }
    catch (error) { el('automation-status').textContent = error.message; }
  }
  function edit(item) {
    editing = item.id;
    el('automation-name').value = item.name;
    el('automation-prompt').value = item.prompt;
    el('automation-enabled').checked = item.enabled;
    scheduleToForm(item.schedule);
    el('automation-form-title').textContent = 'Edit automation';
    el('automation-name').focus();
  }
  el('automation-schedule-type').onchange = scheduleFields;
  el('automation-new').onclick = resetForm;
  el('automation-form').onsubmit = event => { event.preventDefault(); action(() => save())(); };
  el('automation-close').onclick = () => dialog.close();
  el('automation-plan').onclick = () => { dialog.close(); el('prompt').value = 'Help me plan a recurring automation for this workspace. Ask what I want to run and how often, then set it up.'; el('prompt').focus(); };
  el('automation-nav').onclick = () => { renderList(); resetForm(); dialog.showModal(); };
  window.addEventListener('aurora-view-rendered', () => { if (dialog.open) renderList(); });
  window.aurora.onEvent(event => { if ((event.type === 'snapshot' || event.type === 'automation-end') && dialog.open) renderList(); });
})();
