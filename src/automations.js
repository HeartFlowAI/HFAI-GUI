const { randomUUID } = require('node:crypto');

// Recurring routines Aurora runs while the app is open. This module is pure
// logic: validation, human-readable schedules, and next-run math. The scheduler
// and session handling live in main.js.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX = 50;

function normalizeSchedule(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choose a schedule.');
  if (input.type === 'minutes') {
    const every = Math.floor(Number(input.every));
    if (!Number.isFinite(every) || every < 5 || every > 1440) throw new Error('Choose an interval between 5 and 1440 minutes.');
    return { type: 'minutes', every };
  }
  if (input.type === 'daily' || input.type === 'weekdays') {
    if (typeof input.time !== 'string' || !TIME.test(input.time)) throw new Error('Choose a valid time.');
    return { type: input.type, time: input.time };
  }
  if (input.type === 'weekly') {
    const days = [...new Set((Array.isArray(input.days) ? input.days : []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
    if (!days.length) throw new Error('Choose at least one day of the week.');
    if (typeof input.time !== 'string' || !TIME.test(input.time)) throw new Error('Choose a valid time.');
    return { type: 'weekly', days, time: input.time };
  }
  throw new Error('Choose a schedule type.');
}
function nextRun(schedule, from = Date.now()) {
  const rule = normalizeSchedule(schedule);
  if (rule.type === 'minutes') return from + rule.every * 60000;
  const [hours, minutes] = rule.time.split(':').map(Number);
  const at = new Date(from); at.setSeconds(0, 0); at.setHours(hours, minutes, 0, 0);
  if (rule.type === 'daily') { if (at.getTime() <= from) at.setDate(at.getDate() + 1); return at.getTime(); }
  if (rule.type === 'weekdays') { if (at.getTime() <= from) at.setDate(at.getDate() + 1); while (at.getDay() === 0 || at.getDay() === 6) at.setDate(at.getDate() + 1); return at.getTime(); }
  for (let offset = 0; offset <= 7; offset++) { const candidate = new Date(at); candidate.setDate(at.getDate() + offset); if (candidate.getTime() > from && rule.days.includes(candidate.getDay())) return candidate.getTime(); }
  return from + 7 * 86400000;
}
function describe(schedule) {
  const rule = normalizeSchedule(schedule);
  if (rule.type === 'minutes') return rule.every % 60 === 0 ? `Every ${rule.every / 60} h` : `Every ${rule.every} min`;
  if (rule.type === 'daily') return `Daily at ${rule.time}`;
  if (rule.type === 'weekdays') return `Weekdays at ${rule.time}`;
  return `Weekly on ${rule.days.map(day => DAYS[day]).join(', ')} at ${rule.time}`;
}
function normalizeAutomation(input, existing = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid automation.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 80) throw new Error('Give the automation a name under 80 characters.');
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt || prompt.length > 8000) throw new Error('Write a prompt under 8,000 characters.');
  const schedule = normalizeSchedule(input.schedule);
  const enabled = input.enabled === undefined ? (existing ? existing.enabled === true : true) : input.enabled === true;
  return {
    id: existing && existing.id ? existing.id : randomUUID(),
    name, prompt, schedule, enabled,
    agent: typeof input.agent === 'string' ? input.agent.slice(0, 40) : (existing?.agent || ''),
    sessionId: existing?.sessionId || '',
    lastRun: existing?.lastRun || 0,
    lastStatus: existing?.lastStatus || '',
    nextRun: enabled ? nextRun(schedule) : 0,
    created: existing?.created || Date.now()
  };
}
function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.prompt === 'string')
    .slice(0, MAX)
    .map(item => {
      try { return { ...normalizeAutomation(item, item), enabled: item.enabled === true }; }
      catch { return null; }
    })
    .filter(Boolean);
}
module.exports = { DAYS, MAX, normalizeSchedule, nextRun, describe, normalizeAutomation, normalizeList };
