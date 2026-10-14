const { test } = require('node:test'), assert = require('node:assert/strict');
const a = require('../src/automations');
const D = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi, 0, 0).getTime();

test('schedules validate their type and required fields', () => {
  assert.deepEqual(a.normalizeSchedule({ type: 'minutes', every: 30 }), { type: 'minutes', every: 30 });
  assert.deepEqual(a.normalizeSchedule({ type: 'daily', time: '09:05' }), { type: 'daily', time: '09:05' });
  assert.deepEqual(a.normalizeSchedule({ type: 'weekly', days: [3, 1, 1], time: '18:00' }), { type: 'weekly', days: [1, 3], time: '18:00' });
  assert.throws(() => a.normalizeSchedule({ type: 'minutes', every: 2 }), /interval/);
  assert.throws(() => a.normalizeSchedule({ type: 'daily', time: '25:00' }), /time/);
  assert.throws(() => a.normalizeSchedule({ type: 'weekly', days: [], time: '09:00' }), /day/);
  assert.throws(() => a.normalizeSchedule({ type: 'sometimes' }), /schedule type/);
});

test('next run math covers intervals, daily, weekdays and weekly', () => {
  assert.equal(a.nextRun({ type: 'minutes', every: 30 }, 1000), 1000 + 30 * 60000);
  assert.equal(a.nextRun({ type: 'daily', time: '09:00' }, D(2026, 1, 5, 8, 0)), D(2026, 1, 5, 9, 0));
  assert.equal(a.nextRun({ type: 'daily', time: '07:00' }, D(2026, 1, 5, 8, 0)), D(2026, 1, 6, 7, 0));
  assert.equal(a.nextRun({ type: 'weekdays', time: '09:00' }, D(2026, 1, 5, 10, 0)), D(2026, 1, 6, 9, 0));
  assert.equal(a.nextRun({ type: 'weekdays', time: '09:00' }, D(2026, 1, 9, 10, 0)), D(2026, 1, 12, 9, 0));
  assert.equal(a.nextRun({ type: 'weekly', days: [1], time: '09:00' }, D(2026, 1, 5, 10, 0)), D(2026, 1, 12, 9, 0));
  assert.equal(a.nextRun({ type: 'weekly', days: [1], time: '09:00' }, D(2026, 1, 4, 12, 0)), D(2026, 1, 5, 9, 0));
});

test('schedules describe themselves in plain language', () => {
  assert.equal(a.describe({ type: 'minutes', every: 60 }), 'Every 1 h');
  assert.equal(a.describe({ type: 'minutes', every: 15 }), 'Every 15 min');
  assert.equal(a.describe({ type: 'daily', time: '09:00' }), 'Daily at 09:00');
  assert.equal(a.describe({ type: 'weekdays', time: '08:30' }), 'Weekdays at 08:30');
  assert.equal(a.describe({ type: 'weekly', days: [1, 3, 5], time: '18:00' }), 'Weekly on Mon, Wed, Fri at 18:00');
});

test('automations validate input and schedule the next run', () => {
  assert.throws(() => a.normalizeAutomation({ name: '', prompt: 'x', schedule: { type: 'daily', time: '09:00' } }), /name/);
  assert.throws(() => a.normalizeAutomation({ name: 'Brief', prompt: '', schedule: { type: 'daily', time: '09:00' } }), /prompt/);
  const created = a.normalizeAutomation({ name: 'Morning brief', prompt: 'Summarize the market', schedule: { type: 'weekdays', time: '09:00' } });
  assert.equal(created.enabled, true);
  assert.ok(created.id && created.nextRun > Date.now());
  const paused = a.normalizeAutomation({ name: 'Brief', prompt: 'x', schedule: { type: 'daily', time: '09:00' }, enabled: false });
  assert.equal(paused.enabled, false);
  assert.equal(paused.nextRun, 0);
  const updated = a.normalizeAutomation({ name: 'Renamed', prompt: 'x', schedule: { type: 'daily', time: '09:00' } }, created);
  assert.equal(updated.id, created.id);
});

test('normalizeList keeps only well-formed automations', () => {
  const list = a.normalizeList([{ id: 'a', name: 'A', prompt: 'x', schedule: { type: 'daily', time: '09:00' }, enabled: true }, { name: 'no id' }, 'junk', null, { id: 'b', prompt: '' }]);
  assert.deepEqual(list.map(item => item.id), ['a']);
});
