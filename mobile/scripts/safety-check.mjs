import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/maps/safety.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { decodeSafetyMapPoints } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const editor = await import(new URL("../../backend/src/main/resources/static/admin/model.js", import.meta.url));
const fields = { name: "QA point", address: "QA address", latitude: "48,6208", longitude: "22.2879", description: "QA entrance", sourceUrl: "https://example.org/qa", verifiedAt: "2026-01-01" };
for (const kind of ["shelters", "resilience"]) {
  const point = editor.pointFromFields(fields, null, `${kind}-qa`, kind);
  assert.equal(point.latitude, 48.6208); assert.equal(point.longitude, 22.2879);
  const next = editor.pointFromFields({ ...fields, address: "QA corrected", description: "", verifiedAt: "" }, { ...point, unknown: "preserve" }, "ignored", kind);
  assert.equal(next.id, point.id); assert.equal(next.unknown, "preserve"); assert.equal(next.description, undefined); assert.equal(next.verifiedAt, undefined);
  for (const bad of [{ latitude: "" }, { latitude: "22.28" }, { longitude: "48.62" }, { longitude: "NaN" }, { name: "" }, { address: "" }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://127.0.0.1/x" }, { verifiedAt: "2026-02-30" }, { verifiedAt: "2099-01-01" }]) assert.throws(() => editor.pointFromFields({ ...fields, ...bad }, null, "qa", kind));
  assert.throws(() => editor.validateDocument({ items: [point, point] }, kind));
  assert.deepEqual(editor.validateDocument({ items: [] }, kind), { items: [] });
  const payload = { fetchedAt: "2026-10-09T12:00:00Z", stale: true, source: "editorial", points: [point] };
  assert.deepEqual(decodeSafetyMapPoints(payload).points[0], point);
  assert.equal(decodeSafetyMapPoints(payload).source, "editorial");
  assert.equal(decodeSafetyMapPoints({ ...payload, points: [] }).points.length, 0);
  assert.equal(decodeSafetyMapPoints({ ...payload, source: undefined }).source, "source");
  assert.equal(decodeSafetyMapPoints({ ...payload, points: [{ ...point, sourceUrl: "javascript:alert(1)" }] }).points[0].sourceUrl, undefined);
  for (const invalid of [{ points: [point, point] }, { points: [{ ...point, longitude: 48.62 }] }, { points: [{ ...point, latitude: "48.62" }] }, { points: [{ ...point, id: "" }] }, { fetchedAt: "bad" }, { stale: "true" }, { points: null }]) assert.throws(() => decodeSafetyMapPoints({ ...payload, ...invalid }));
}
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
assert.ok(app.includes('isShelters && !editorialSource ?'));
assert.ok(app.includes('selectedPoint.description'));
assert.ok(app.includes('setRefreshSignal(value => value + 1)'));
console.log("PASS: map forms, comma coordinates, stable IDs, invalid/duplicate data, source metadata, empty lists, safe decoder and editorial tile exclusion");
