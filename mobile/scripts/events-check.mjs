import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function module(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => { if (name === "../i18n/locale") return { getLocale: () => "uk-UA" }; assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; }, Intl, Date, Math, JSON, URL });
  return exports;
}
const time = module("../src/utils/cityTime.ts");
const events = module("../src/events/catalog.ts", { "../utils/cityTime": time });
const seed = JSON.parse(readFileSync(new URL("../src/events/verified-events.json", import.meta.url), "utf8"));
const backendSeed = JSON.parse(readFileSync(new URL("../../backend/src/main/resources/editorial/events.json", import.meta.url), "utf8"));
assert.deepEqual(seed, backendSeed);
const catalog = events.decodeEventCatalog(seed);
assert.equal(catalog.items.length, 8); assert.equal(catalog.rejected, 0);
const now = new Date("2026-10-08T10:00:00Z");
assert.deepEqual(Array.from(events.selectEvents(catalog.items, false, "Усі", now), e => e.id), ["misto", "homin", "einaudi", "queen"]);
assert.deepEqual(Array.from(events.selectEvents(catalog.items, true, "Усі", now), e => e.id), ["zimmer", "zukhvala", "klavdia", "philharmonic-80"]);
assert.deepEqual(Array.from(events.selectEvents(catalog.items, false, "Театр", now), e => e.id), ["misto"]);
assert.equal(events.selectEvents(catalog.items, false, "Інше", now).length, 0);
assert.deepEqual(Array.from(events.availableEventCategories(catalog.items, false, now)), ["Усі", "Концерти", "Театр"]);
assert.deepEqual(Array.from(events.availableEventCategories([], false, now)), ["Усі"]);
assert.deepEqual(Array.from(events.availableEventCategories([{ ...catalog.items[0], category: "Спорт", date: "2026-10-01" }], true, now)), ["Усі", "Спорт"]);
assert.deepEqual(Array.from(events.availableEventCategories([{ ...catalog.items[0], category: "Спорт", date: "2026-10-17" }], false, new Date("2026-10-17T21:00:00Z"))), ["Усі"]);
assert.ok(events.eventDateLabel("2026-10-17").includes("2026"));
console.log("PASS: verified catalogue, category filters, full dates, ascending upcoming and descending archive");

for (const category of ["Виставки", "Лекції та зустрічі", "Майстер-класи", "Спорт", "Для дітей", "Фестивалі"]) {
  const expanded = events.decodeEventCatalog({ items: [{ ...catalog.items[0], category }] });
  assert.equal(expanded.items.length, 1);
  assert.equal(events.selectEvents(expanded.items, true, category, now).length, 1);
}
console.log("PASS: exhibitions, talks, workshops, sport, family events and festivals");

const event = catalog.items.find(e => e.id === "misto");
assert.equal(events.isArchived(event, new Date("2026-10-17T20:59:00Z")), false);
assert.equal(events.isArchived(event, new Date("2026-10-17T21:00:00Z")), true);
assert.equal(events.isArchived({ ...event, date: "2026-10-25" }, new Date("2026-10-25T21:59:00Z")), false);
assert.equal(events.isArchived({ ...event, date: "2026-10-25" }, new Date("2026-10-25T22:00:00Z")), true);
assert.equal(events.isArchived({ ...event, date: "2026-12-31" }, new Date("2026-12-31T22:01:00Z")), true);
console.log("PASS: Kyiv midnight, DST, new year; no invented event end times");

for (const replacement of [{ date: "2026-02-30" }, { date: "17 жовтня", day: 17 }, { time: "25:00" }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://user:pass@concert.ua" }, { sourceUrl: "https://192.168.1.1/" }, { category: "unknown" }, { title: null }]) {
  const result = events.decodeEventCatalog({ items: [{ ...event, ...replacement }] });
  assert.equal(result.items.length, 0); assert.equal(result.rejected, 1);
}
assert.equal(events.decodeEventCatalog({ items: [event, { ...event, id: ` ${event.id} ` }] }).items.length, 1);
assert.equal(events.decodeEventCatalog({ items: [null, event] }).rejected, 1);
assert.equal(events.decodeEventCatalog({ items: [{ ...event, posterUrl: "file:///secret", address: null }] }).items[0].posterUrl, undefined);
assert.throws(() => events.decodeEventCatalog(null));
assert.throws(() => events.decodeEventCatalog({ items: {} }));
assert.equal(events.decodeEventCatalog({ items: [] }).items.length, 0);
console.log("PASS: missing year, invalid dates, duplicate IDs, unsafe links, broken posters, null fields and real empty catalogue");

const api = module("../src/api/cityServices.ts", { "./request": { requestJson: async () => ({ items: [] }) }, "./catalogues": {}, "../miniatures/catalog": {}, "../events/catalog": events, "../news/article": module("../src/news/article.ts"), "../maps/safety": module("../src/maps/safety.ts") });
assert.equal((await api.getEditorialEvents()).items.length, 0);
const latest = module("../src/utils/latestRequest.ts"); const requests = new latest.LatestRequest();
const first = requests.begin(); const second = requests.begin();
assert.equal(requests.isCurrent(first), false); assert.equal(requests.isCurrent(second), true);
requests.invalidate(); assert.equal(requests.isCurrent(second), false);
console.log("PASS: successful empty API response and late/unmounted request guard");
