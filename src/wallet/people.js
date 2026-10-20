const { randomUUID } = require('node:crypto');
const solana = require('./solana');
const follow = require('./follow');

const MAX_PEOPLE = 100;
const MAX_LAUNCHES = 50;
const KINDS = ['dev', 'kol', 'influencer', 'trader', 'smart', 'other'];
const KIND_SET = new Set(KINDS);

function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function shortAddress(address) { return typeof address === 'string' && address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : String(address || ''); }
function normalizeKind(value) { const kind = String(value || '').toLowerCase(); return KIND_SET.has(kind) ? kind : 'other'; }
function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map(tag => text(tag, 20).toLowerCase()).filter(Boolean))].slice(0, 8);
}
function normalizeLaunch(input) {
  if (!input || typeof input !== 'object' || !solana.validateAddress(input.mint)) return null;
  return {
    mint: input.mint.trim(), symbol: text(input.symbol, 20) || shortAddress(input.mint),
    name: text(input.name, 80), createdAt: number(input.createdAt) || Date.now(),
    marketCapSol: number(input.marketCapSol), vSolInBondingCurve: number(input.vSolInBondingCurve),
    completed: input.completed === true
  };
}
function normalizeLaunches(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set(), out = [];
  for (const item of input) {
    const launch = normalizeLaunch(item);
    if (!launch || seen.has(launch.mint)) continue;
    seen.add(launch.mint); out.push(launch);
    if (out.length >= MAX_LAUNCHES) break;
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
function normalizePerson(input) {
  if (!input || typeof input !== 'object') return null;
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  if (!solana.validateAddress(address)) return null;
  return {
    id: typeof input.id === 'string' && input.id ? input.id.slice(0, 60) : randomUUID(),
    address,
    label: text(input.label, 40) || shortAddress(address),
    kind: normalizeKind(input.kind),
    tags: normalizeTags(input.tags),
    note: text(input.note, 500),
    addedAt: number(input.addedAt) || Date.now(),
    scanAt: number(input.scanAt),
    scan: follow.normalizeScan(input.scan),
    launches: normalizeLaunches(input.launches),
    watchActivity: input.watchActivity !== false,
    activityAt: number(input.activityAt),
    lastSignature: text(input.lastSignature, 160),
    lastActivityAt: number(input.lastActivityAt),
    activityError: text(input.activityError, 300),
    source: text(input.source, 24),
    sourceRank: number(input.sourceRank),
    pnlUsd: number(input.pnlUsd),
    winRate: number(input.winRate),
    profileUrl: typeof input.profileUrl === 'string' && /^https:\/\//.test(input.profileUrl) ? input.profileUrl.slice(0, 300) : '',
    starter: input.starter === true,
    lastError: text(input.lastError, 300)
  };
}
function normalizePeople(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set(), out = [];
  for (const item of input) {
    const person = normalizePerson(item);
    if (!person || seen.has(person.address)) continue;
    seen.add(person.address); out.push(person);
    if (out.length >= MAX_PEOPLE) break;
  }
  return out;
}
function upsertPerson(people, value) {
  const list = normalizePeople(people);
  const person = normalizePerson(value);
  if (!person) throw new Error('Enter a valid Solana wallet address.');
  const index = list.findIndex(item => item.address === person.address);
  if (index >= 0) {
    const current = list[index];
    const patch = {};
    for (const key of ['label', 'kind', 'tags', 'note', 'scan', 'scanAt', 'launches', 'watchActivity', 'activityAt', 'lastSignature', 'lastActivityAt', 'activityError', 'source', 'sourceRank', 'pnlUsd', 'winRate', 'profileUrl', 'starter', 'lastError']) {
      if (value[key] !== undefined) patch[key] = value[key];
    }
    list[index] = normalizePerson({ ...current, ...patch, id: current.id, addedAt: current.addedAt });
  } else {
    list.unshift(person);
  }
  return list.slice(0, MAX_PEOPLE);
}
function mergeLaunch(person, launch) {
  if (!person) return person;
  const value = normalizeLaunch(launch);
  if (!value) return person;
  const launches = normalizeLaunches([value, ...(person.launches || [])]);
  person.launches = launches;
  return person;
}
function launchFromPumpEvent(event, completed = false) {
  if (!event || !solana.validateAddress(event.mint)) return null;
  return {
    mint: event.mint, symbol: text(event.symbol, 20), name: text(event.name, 80),
    createdAt: number(event.createdAt) || number(event.receivedAt) || Date.now(),
    completed: completed === true || event.completed === true
  };
}
function personStats(person) {
  const launches = normalizeLaunches(person?.launches);
  const completed = launches.filter(launch => launch.completed).length;
  return {
    launches: launches.length,
    completed,
    lastLaunchAt: launches[0]?.createdAt || 0
  };
}
async function scanPerson(person, options = {}) {
  const scan = await follow.scanWallet(person.address, options);
  person.scan = follow.normalizeScan(scan);
  person.scanAt = scan.at || Date.now();
  if (!person.lastSignature && scan.recent?.[0]?.signature) person.lastSignature = scan.recent[0].signature;
  if (scan.lastActive) person.lastActivityAt = Math.max(Number(person.lastActivityAt) || 0, Number(scan.lastActive) || 0);
  person.lastError = '';
  return person;
}

module.exports = {
  MAX_PEOPLE, MAX_LAUNCHES, KINDS,
  normalizePerson, normalizePeople, normalizeLaunch, normalizeLaunches,
  upsertPerson, mergeLaunch, launchFromPumpEvent, personStats, scanPerson, shortAddress
};
