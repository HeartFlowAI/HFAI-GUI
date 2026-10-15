const { randomUUID } = require('node:crypto');

// Typed view specs. Gigi (or the user) composes these and the desk canvas
// renders them. Pure validation so both the main process and the UI agree.
const TYPES = ['line', 'area', 'bar', 'table', 'metrics', 'thesis', 'holders', 'list', 'note'];
const KINDS = ['series', 'pair', 'holdings', 'research', 'holders', 'static'];
const LAYOUTS = ['full', 'half', 'third'];

function normalizeView(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid view.');
  const type = TYPES.includes(input.type) ? input.type : 'note';
  const source = input.source && typeof input.source === 'object' ? input.source : { kind: 'static' };
  const kind = KINDS.includes(source.kind) ? source.kind : 'static';
  return {
    id: typeof input.id === 'string' && input.id ? input.id : randomUUID(),
    type,
    title: String(input.title || '').slice(0, 80),
    subtitle: String(input.subtitle || '').slice(0, 140),
    layout: LAYOUTS.includes(input.layout) ? input.layout : 'half',
    source: {
      kind,
      mint: typeof source.mint === 'string' ? source.mint.slice(0, 60) : '',
      metric: typeof source.metric === 'string' ? source.metric.slice(0, 40) : '',
      range: Math.max(0, Math.min(10080, Math.floor(Number(source.range) || 0))),
      rows: Array.isArray(source.rows) ? source.rows.slice(0, 200) : [],
      data: source.data
    },
    pinned: input.pinned === true,
    createdBy: input.createdBy === 'user' ? 'user' : 'gigi',
    createdAt: Number(input.createdAt) || Date.now()
  };
}
function normalizeViews(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(view => view && view.id).slice(-40).map(view => { try { return { ...normalizeView(view), createdAt: Number(view.createdAt) || Date.now() }; } catch { return null; } }).filter(Boolean);
}
module.exports = { TYPES, KINDS, LAYOUTS, normalizeView, normalizeViews };
