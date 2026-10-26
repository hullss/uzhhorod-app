import { readFileSync, writeFileSync } from "node:fs";

const [beforePath, incomingPath, outputPath] = process.argv.slice(2);
if (!outputPath) throw Error("Usage: node merge-shelters-import.mjs before.json incoming.json merged.json");
const before = JSON.parse(readFileSync(beforePath, "utf8"));
const incoming = JSON.parse(readFileSync(incomingPath, "utf8"));
if (![before, incoming].every(doc => Array.isArray(doc.items) && new Set(doc.items.map(p => p.id)).size === doc.items.length)) throw Error("Invalid document or duplicate IDs");
const distance = (a, b) => {
  const r = Math.PI / 180, x = (b.latitude - a.latitude) * r, y = (b.longitude - a.longitude) * r;
  return 12742000 * Math.asin(Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(y / 2) ** 2));
};
const missingAddress = p => /не опублікована|не вказана/i.test(p.address ?? "") || !p.address?.trim();
const edges = [];
for (let i = 0; i < incoming.items.length; i++) for (let j = 0; j < before.items.length; j++) {
  const item = incoming.items[i], previous = before.items[j], meters = distance(item, previous);
  const sameSource = previous.name === item.name && previous.address === item.address;
  if (meters <= 1 && (missingAddress(previous) || sameSource)) edges.push({ i, j, meters, rank: sameSource ? 0 : 1 });
}
// One-to-one matching tolerates rounding by less than a metre. It never assigns
// an address to a nearby different building or removes an unmatched old point.
edges.sort((a, b) => a.rank - b.rank || a.meters - b.meters || before.items[a.j].id.localeCompare(before.items[b.j].id) || incoming.items[a.i].id.localeCompare(incoming.items[b.i].id));
const matchedIncoming = new Map(), usedPrevious = new Set();
for (const edge of edges) if (!matchedIncoming.has(edge.i) && !usedPrevious.has(edge.j)) {
  matchedIncoming.set(edge.i, edge.j); usedPrevious.add(edge.j);
}
const items = before.items.map(item => ({ ...item }));
let added = 0;
for (let i = 0; i < incoming.items.length; i++) {
  const point = incoming.items[i], j = matchedIncoming.get(i);
  if (j !== undefined) items[j] = { ...items[j], ...point, id: items[j].id };
  else if (!items.some(item => item.id === point.id)) { items.push(point); added++; }
}
if (new Set(items.map(p => p.id)).size !== items.length) throw Error("Merged IDs must be unique");
writeFileSync(outputPath, JSON.stringify({ ...before, items }, null, 2));
const summary = { before: before.items.length, source: incoming.items.length, matched: matchedIncoming.size, added, removed: 0, after: items.length,
  withAddress: items.filter(p => !missingAddress(p)).length, withoutAddress: items.filter(missingAddress).length,
  unmatchedPreviousIds: before.items.filter((_, index) => !usedPrevious.has(index)).map(p => p.id) };
writeFileSync(outputPath.replace(/\.json$/, "-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
