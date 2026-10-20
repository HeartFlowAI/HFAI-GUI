const data = require('./starter-data.json');
const { normalizePeople } = require('./people');

const AS_OF = data.asOf;
const VERSION = 4;
const PEOPLE = data.people;

function starterPeople() {
  return normalizePeople(PEOPLE.map(person => ({ ...person, starter: true })));
}

function mergeStarterPeople(current = []) {
  const existing = normalizePeople(current);
  const byAddress = new Map(existing.map(person => [person.address, person]));
  const pack = starterPeople();
  const packAddresses = new Set(pack.map(person => person.address));
  let added = 0;
  const ordered = pack.map(person => {
    const old = byAddress.get(person.address);
    if (!old) { added += 1; return person; }
    return {
      ...person, id: old.id, label: old.label || person.label, kind: old.kind || person.kind, addedAt: old.addedAt, scan: old.scan, scanAt: old.scanAt,
      launches: old.launches, watchActivity: old.watchActivity, activityAt: old.activityAt,
      lastSignature: old.lastSignature, lastActivityAt: old.lastActivityAt, activityError: old.activityError
    };
  });
  const rest = existing.filter(person => person.starter !== true && !packAddresses.has(person.address));
  return { people: normalizePeople([...ordered, ...rest]).slice(0, 100), added };
}

module.exports = { AS_OF, VERSION, PEOPLE, starterPeople, mergeStarterPeople };
