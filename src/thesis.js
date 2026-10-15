const { randomUUID } = require('node:crypto');

// A thesis is a human-readable, multi-leg conviction: "trade your worldview".
// Solana spot has no shorts, so short and hedge legs are notes, not orders.
const SIDES = ['long', 'hedge', 'short'];

function normalizeLeg(input) {
  if (!input || typeof input !== 'object') return null;
  const side = SIDES.includes(input.side) ? input.side : 'long';
  const mint = typeof input.mint === 'string' ? input.mint.trim().slice(0, 60) : '';
  if (!mint) return null;
  return {
    mint,
    symbol: typeof input.symbol === 'string' ? input.symbol.slice(0, 24) : '',
    side,
    sizeUsd: Math.max(0, Number(input.sizeUsd) || 0),
    leverage: Math.max(0, Number(input.leverage) || 0),
    note: typeof input.note === 'string' ? input.note.slice(0, 160) : ''
  };
}
function normalizeThesis(input, existing) {
  if (!input || typeof input !== 'object') throw new Error('Invalid thesis.');
  const name = (typeof input.name === 'string' ? input.name.trim() : '').slice(0, 60) || (existing?.name || 'Untitled thesis');
  const rationale = (typeof input.rationale === 'string' ? input.rationale.trim() : (existing?.rationale || '')).slice(0, 2000);
  const legs = (Array.isArray(input.legs) ? input.legs.map(normalizeLeg).filter(Boolean) : (existing?.legs || [])).slice(0, 6);
  if (!legs.length) throw new Error('Add at least one leg with a token.');
  if (!legs.some(leg => leg.side === 'long' && leg.sizeUsd > 0)) throw new Error('Give at least one long leg a USD size so it can run in paper.');
  const exits = input.exits && typeof input.exits === 'object' ? input.exits : (existing?.exits || {});
  return {
    id: existing?.id || randomUUID(),
    name, rationale, legs,
    exits: { text: (typeof exits.text === 'string' ? exits.text.trim() : '').slice(0, 400), stopLossPct: Math.max(0, Number(exits.stopLossPct) || 0), takeProfitPct: Math.max(0, Number(exits.takeProfitPct) || 0) },
    status: ['draft', 'active', 'closed'].includes(input.status) ? input.status : (existing?.status || 'draft'),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    activatedAt: Number(input.activatedAt) || existing?.activatedAt || 0,
    fills: Array.isArray(existing?.fills) ? existing.fills : []
  };
}
function normalizeTheses(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => item && item.id).slice(-30).map(item => ({ ...item, legs: Array.isArray(item.legs) ? item.legs.slice(0, 6) : [] }));
}
const executableLegs = thesis => (thesis.legs || []).filter(leg => leg.side === 'long' && leg.sizeUsd > 0);
function toShareText(thesis) {
  const lines = [thesis.name];
  if (thesis.rationale) lines.push('', thesis.rationale);
  lines.push('');
  for (const leg of thesis.legs) { const side = leg.side === 'long' ? 'Long' : leg.side === 'hedge' ? 'Hedge' : 'Short'; lines.push(`• ${side} ${leg.symbol || leg.mint}${leg.sizeUsd ? ` · $${leg.sizeUsd}` : ''}${leg.leverage ? ` · ${leg.leverage}x` : ''}${leg.note ? ` (${leg.note})` : ''}`); }
  const exits = [];
  if (thesis.exits?.stopLossPct) exits.push(`stop ${thesis.exits.stopLossPct}%`);
  if (thesis.exits?.takeProfitPct) exits.push(`target ${thesis.exits.takeProfitPct}%`);
  if (thesis.exits?.text) exits.push(thesis.exits.text);
  if (exits.length) lines.push('', `Exit: ${exits.join(' · ')}`);
  lines.push('', 'A Heartflow Aurora call.');
  return lines.join('\n');
}
module.exports = { SIDES, normalizeLeg, normalizeThesis, normalizeTheses, executableLegs, toShareText };
