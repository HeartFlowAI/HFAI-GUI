// One inline-SVG icon set for the desk and app chrome. 24px grid, 1.6 stroke,
// currentColor. Replaces the old unicode glyphs.
(() => {
  const P = {
    portfolio: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>',
    trade: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    discover: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    research: '<circle cx="12" cy="12" r="8"/><path d="M15 9l-2 5-5 2 2-5z"/>',
    strategies: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 3v12a3 3 0 0 0 3 3h6"/>',
    journal: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.2-2-3.4-2.1.9a8 8 0 0 0-1.7-1L15.2 3h-3.9l-.4 2.3a8 8 0 0 0-1.7 1L7 5.4 5 8.8 7 10a7.9 7.9 0 0 0 0 2l-2 1.2 2 3.4 2.1-.9a8 8 0 0 0 1.7 1l.4 2.3h3.9l.4-2.3a8 8 0 0 0 1.7-1l2.1.9 2-3.4z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    run: '<path d="M13 4 5 14h6l-1 6 8-10h-6z"/>',
    switch: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    delete: '<path d="M6 6l12 12M18 6 6 18"/>',
    watch: '<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.9 6.9 19l1.2-5.6L4 9.6 9.6 9z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5H5V6h5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1"/>',
    live: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    paper: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-1.6 4.8"/><path d="M20 5v6h-6"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4 4 10-11"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    pin: '<path d="M14 3l7 7-3 1-4 4-1 5-3-3-4-4 5-1 4-4z"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 13v6h14v-6"/>',
    chart: '<path d="M4 20V5M4 20h16"/><path d="M8 16l3-4 3 3 4-6"/>',
    holders: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-4.9"/>',
    dot: '<circle cx="12" cy="12" r="2"/>'
  };
  function svg(name, size) { return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.dot}</svg>`; }
  function icon(name, size = 18) { const span = document.createElement('span'); span.className = 'hf-ico'; span.style.display = 'inline-flex'; span.innerHTML = svg(name, size); return span; }
  window.AuroraIcons = { icon, svg, has: name => Object.hasOwn(P, name) };
})();
