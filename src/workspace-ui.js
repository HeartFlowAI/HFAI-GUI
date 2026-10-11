// Local presentation preferences never change saved sessions, voice or desktop state.
(() => {
  const byId = id => document.getElementById(id);
  const sidebar = document.querySelector('.sidebar');
  const companion = document.querySelector('.companion');
  sidebar.id = 'navigation-sidebar'; companion.id = 'companion-panel';
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem('aurora-workspace-ui') || '{}') || {}; } catch {}
  const save = () => { try { localStorage.setItem('aurora-workspace-ui', JSON.stringify(preferences)); } catch {} };
  function panel(name, hidden) {
    preferences[name] = !!hidden;
    document.body.dataset[name + 'Hidden'] = String(!!hidden);
    if(name==='sidebar')document.body.classList.toggle('sidebar-collapsed',!!hidden);
    const button = byId(name + '-toggle');
    button.setAttribute('aria-expanded', String(!hidden));
    button.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} ${name === 'sidebar' ? 'navigation' : 'companion panel'}`);
    save();
  }
  for (const name of ['sidebar', 'companion']) {
    // Keep the conversation canvas focused by default. Aurora remains one click away in the header.
    panel(name, name === 'companion' ? preferences.companion !== false : preferences[name] === true);
    byId(name + '-toggle').onclick = () => panel(name, !preferences[name]);
  }
  const mark = document.createElement('div'); mark.className = 'welcome-mark'; mark.textContent = '✦'; mark.setAttribute('aria-hidden', 'true');
  byId('welcome').prepend(mark);
  const projectsHeading = document.querySelector('.library-heading');
  const toggle = document.createElement('button'); toggle.id = 'projects-toggle'; toggle.className = 'projects-toggle'; toggle.setAttribute('aria-controls', 'projects');
  const heading = document.createElement('div'); heading.className = 'projects-heading';
  heading.append(toggle, projectsHeading.querySelector('.section-label')); projectsHeading.prepend(heading);
  function foldProjects(collapsed) {
    preferences.projects = !!collapsed; byId('projects').hidden = !!collapsed;
    toggle.textContent = collapsed ? '›' : '⌄'; toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expand projects' : 'Collapse projects'); save();
  }
  foldProjects(preferences.projects === true); toggle.onclick = () => foldProjects(!preferences.projects);
  byId('project-add').addEventListener('click', () => foldProjects(false));
  const section = companion.querySelector(':scope > .section-label'); section.textContent = 'YOUR COMPANION';
  const companionTop = document.createElement('div'); companionTop.className = 'companion-top';
  const appearance = document.createElement('button'); appearance.textContent = 'Appearance'; appearance.onclick = () => byId('appearance-open').click();
  section.replaceWith(companionTop); companionTop.append(section, appearance);
  companion.querySelector('.activity-heading .section-label').textContent = 'ACTIVITY';
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.altKey) return;
    const typing = event.target.closest?.('input,textarea,[contenteditable=true]');
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b' && !typing) {
      event.preventDefault(); panel('sidebar', !preferences.sidebar);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); panel('sidebar', false); byId('session-search').focus(); byId('session-search').select();
    }
  });
  byId('session-search').placeholder = 'Search sessions · Ctrl+K';
})();
