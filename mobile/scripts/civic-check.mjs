import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function module(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require: (name) => {
    if (name === "../i18n/locale") return { getLocale: () => "uk-UA" };
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, Intl, Date, Math, JSON, globalThis });
  return exports;
}
const cityTime = module("../src/utils/cityTime.ts");
const civic = module("../src/civic/demoCivic.ts", { "../utils/cityTime": cityTime });
const now = new Date("2026-10-08T21:30:00Z"); // Kyiv is already on Friday.
const dates = Array.from(civic.appointmentDates(now));
assert.deepEqual(dates, ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
assert.equal(civic.appointmentDates(new Date("2026-10-24T22:30:00Z"))[0], "2026-10-26"); // DST weekend
const appointment = civic.createAppointment("extract", dates[0], "10:30", now);
assert.ok(civic.isAppointment(appointment));
assert.ok(civic.isUpcoming(appointment, now));
assert.equal(civic.isUpcoming(appointment, new Date("2026-10-12T07:30:00Z")), false);
assert.equal(civic.isUpcoming({ ...appointment, cancelledAt: now.toISOString() }, now), false);
assert.equal(civic.isAppointment({ ...appointment, date: "2026-02-31" }), false);
assert.equal(civic.isAppointment({ ...appointment, time: "25:00" }), false);
assert.throws(() => civic.createAppointment("fake", dates[0], "10:30", now));
assert.throws(() => civic.createAppointment("extract", "2026-10-08", "10:30", now));
assert.throws(() => civic.createAppointment("extract", dates[0], "03:00", now));
console.log("PASS: Kyiv dates, DST, example slots, validation and appointment archive");

const vote = civic.createVote("parks", null, now);
assert.ok(civic.isPollVote(vote));
assert.equal(civic.isPollVote({ ...vote, optionId: "unknown" }), false);
assert.equal(civic.isPollVote({ ...vote, pollId: "unknown" }), false);
assert.throws(() => civic.createVote("transport", vote, now));
assert.throws(() => civic.createVote("unknown", null, now));
console.log("PASS: stable poll identity, invalid choices and repeat vote guard");

const values = new Map();
let failRead = false, failWrite = false;
const secure = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
  async getItemAsync(key) { if (failRead) throw Error("read unavailable"); return values.get(key) ?? null; },
  async setItemAsync(key, value, options) {
    assert.equal(options.keychainAccessible, "device-only");
    if (failWrite) throw Error("storage full");
    values.set(key, value);
  },
};
function store() { return module("../src/storage/demoCivic.ts", {
  "expo-secure-store": secure, "react-native": { Platform: { OS: "ios" } }, "../civic/demoCivic": civic,
}); }
let storage = store();
assert.equal((await storage.restoreAppointments()).length, 0);
assert.equal(await storage.restoreVote(), null);
await storage.persistAppointments([{ ...appointment, phone: "must-not-be-saved" }]);
await storage.persistVote({ ...vote, email: "must-not-be-saved" });
storage = store(); // New module instance simulates reopening, not just reading React state.
assert.equal((await storage.restoreAppointments())[0].id, appointment.id);
assert.equal((await storage.restoreVote()).optionId, "parks");
assert.ok([...values.values()].every((value) => !value.includes("must-not-be-saved")));
const cancelled = { ...appointment, cancelledAt: now.toISOString() };
await Promise.all([storage.persistAppointments([appointment]), storage.persistAppointments([cancelled])]);
assert.ok((await storage.restoreAppointments())[0].cancelledAt);
failWrite = true;
await assert.rejects(storage.persistVote(civic.createVote("transport", null, now)));
assert.equal((await storage.restoreVote()).optionId, "parks");
failWrite = false;
await storage.persistVote(vote); // Failure must not poison the write queue.
failRead = true;
await assert.rejects(storage.restoreAppointments());
failRead = false;
console.log("PASS: native persistence after reopening, serialized writes, failures, no contact data");
values.set("uzhhorod-digital.poll-v1", "{broken");
await assert.rejects(storage.restoreVote());
values.set("uzhhorod-digital.cnap.v1", JSON.stringify([{ ...appointment, serviceId: "fake" }]));
await assert.rejects(storage.restoreAppointments());
console.log("PASS: corrupted/obsolete histories reported rather than silently overwritten");

const originalStorage = globalThis.localStorage;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
} });
try {
  const web = module("../src/storage/demoCivic.ts", { "expo-secure-store": secure, "react-native": { Platform: { OS: "web" } }, "../civic/demoCivic": civic });
  await web.persistVote(vote);
  assert.equal((await web.restoreVote()).optionId, "parks");
  await web.persistAppointments([appointment]);
  assert.equal((await web.restoreAppointments())[0].id, appointment.id);
} finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage }); }
console.log("PASS: web localStorage persistence");

const ui = module("../src/components/CivicServiceUI.tsx", {
  "../i18n/ui": { Pressable: "Pressable", Text: "Text" },
  "@expo/vector-icons": {}, react: {}, "react/jsx-runtime": {},
  "react-native": { StyleSheet: { create: (value) => value } },
  "../ui/fonts": { APP_FONTS: {} }, "../ui/layout": { PAGE_LAYOUT: { gutter: 20, bottom: 32 } },
  "../ui/Screen": {}, "../ui/themeTokens": module("../src/ui/themeTokens.ts"), "react-native-safe-area-context": {},
});
const luminance = (hex) => hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255)
  .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
  .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const dark of [false, true]) {
  const c = ui.civicTheme(dark), styles = ui.civicStyles(dark);
  for (const background of [c.bg, c.surface, c.soft]) {
    for (const color of [c.ink, c.muted, c.accent]) assert.ok(contrast(color, background) >= 4.5, `${dark}: ${color}/${background}`);
  }
  assert.ok(contrast("#ffffff", c.button) >= 4.5);
  assert.ok(contrast(c.muted, c.surface) >= 3); // radio outline
  for (const name of ["button", "iconButton", "tab", "row"]) assert.ok(styles[name].minHeight >= 44, name);
}
console.log("PASS: actual civic theme colors (both themes), readable labels and 44+ touch zones");
