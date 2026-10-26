import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const instant = new Date("2026-10-21T14:30:00Z"); // 17:30 in Uzhhorod.
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant.toISOString()])); } static now() { return instant.getTime(); } }
function load(path, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date: Clock, Intl, setInterval: () => 1, clearInterval() {}, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const cityTime = load("../src/utils/cityTime.ts");
const { visibleScheduleDepartures } = load("../src/utils/transportSchedule.ts", { "./cityTime": cityTime });
const departures = [18 * 3600, 7 * 3600, 17.5 * 3600, 25 * 3600].map((seconds, i) => ({ routeVariantId: `v${i}`, departureTimeSeconds: seconds }));
const seconds = (date, now, all) => Array.from(visibleScheduleDepartures(departures, date, now, all), d => d.departureTimeSeconds);
assert.deepEqual(seconds("2026-10-21", instant, false), [63000, 64800, 90000]);
assert.deepEqual(seconds("2026-10-21", instant, true), [25200, 63000, 64800, 90000]);
for (const date of ["2026-10-20", "2026-10-22"]) assert.deepEqual(seconds(date, instant, false), [25200, 63000, 64800, 90000]);
assert.deepEqual(departures.map(d => d.departureTimeSeconds), [64800, 25200, 63000, 90000]);
assert.equal(visibleScheduleDepartures(departures.slice(0, 3), "2026-10-21", new Date("2026-10-21T20:00:00Z"), false).length, 0);
assert.equal(visibleScheduleDepartures([], "2026-10-21", instant, false).length, 0);
assert.deepEqual(seconds("2026-10-22", new Date("2026-10-21T22:30:00Z"), false), [25200, 63000, 64800, 90000]);
console.log("PASS: upcoming/full-day schedules use Kyiv time, include the boundary departure, sort without mutating, retain GTFS >24h, and handle past/future dates and midnight");

const civic = load("../src/civic/demoCivic.ts", { "../utils/cityTime": cityTime, "../i18n/locale": { getLocale: () => "uk-UA" } });
const appointment = civic.createAppointment("extract", civic.appointmentDates(instant)[0], "10:30", instant);
let history = [appointment], writes = 0, completeWrite, hardwareBack, exited = 0;
function hooks() {
  const slots = [], effects = [], queued = []; let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  return { start() { cursor = 0; }, flush() { for (const fn of queued.splice(0)) fn(); }, react: {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(effects[i], deps)) { effects[i] = deps; queued.push(fn); } },
  } };
}
const h = hooks(), jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const screen = load("../src/components/CnapAppointmentsScreen.tsx", {
  react: h.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "../i18n/ui": { Pressable: "Button", Text: "Text" }, "@expo/vector-icons": { Ionicons: "Icon" }, "expo-status-bar": { StatusBar: "Status" },
  "react-native": { ActivityIndicator: "Spinner", Linking: {}, ScrollView: "Scroll", View: "View" }, "../ui/Screen": { ScreenSafeArea: "Screen" }, "../ui/ScreenStack": { LocalScreenStack: "Stack" },
  "../civic/demoCivic": civic, "../storage/demoCivic": { restoreAppointments: async () => history,
    persistAppointments: next => { writes++; return new Promise((resolve, reject) => { completeWrite = success => { if (success) { history = next; resolve(); } else reject(Error("full")); }; }); } },
  "./CivicServiceUI": { civicStyles: () => ({}), civicTheme: () => ({}), PrimaryButton: "Primary", SecondaryButton: "Secondary", ChoiceRow: "Choice", ServiceHeader: "Header", ServiceSheet: "Sheet", ServiceTabs: "Tabs", useHardwareBack: fn => { hardwareBack = fn; }, useServiceSwipeBack: () => ({}) },
});
let tree;
function render() { h.start(); tree = screen.CnapAppointmentsScreen({ isDarkTheme: false, onBack: () => exited++ }); h.flush(); return tree; }
const button = title => nodes(tree).find(node => ["Primary", "Secondary"].includes(node.type) && node.props.title === title);
function openRecord() { nodes(tree).find(node => node.type === "Button" && node.props.accessibilityLabel?.includes("Переглянути запис")).props.onPress(); render(); }
render(); await new Promise(setImmediate); render(); openRecord();
assert.equal(button("Готово").type, "Primary"); assert.equal(button("Скасувати тестовий запис").type, "Secondary");
button("Скасувати тестовий запис").props.onPress(); render(); assert.equal(writes, 0);
button("Залишити запис").props.onPress(); render(); assert.equal(writes, 0);
button("Готово").props.onPress(); render(); assert.equal(history.length, 1); assert.equal(writes, 0);
openRecord(); button("Скасувати тестовий запис").props.onPress(); render();
hardwareBack(); render(); assert.ok(button("Готово")); assert.equal(writes, 0);
button("Скасувати тестовий запис").props.onPress(); render();
const confirm = button("Так, скасувати запис").props.onPress; confirm(); confirm(); render(); hardwareBack(); render();
assert.equal(writes, 1); assert.equal(history[0].cancelledAt, undefined); assert.equal(exited, 0);
await completeWrite(false); await new Promise(setImmediate); render();
assert.equal(history[0].cancelledAt, undefined); assert.ok(button("Так, скасувати запис"));
assert.ok(nodes(tree).some(node => typeof node.props?.children === "string" && node.props.children.startsWith("Зміни не збережено")));
button("Так, скасувати запис").props.onPress(); await completeWrite(true); await new Promise(setImmediate); render();
assert.ok(history[0].cancelledAt); assert.equal(writes, 2);
console.log("PASS: actual CNAP has primary Done, secondary cancellation, explicit confirmation, safe Back/Keep, blocked double writes and durable-only archive with retry after failure");
