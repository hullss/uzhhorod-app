import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, URL, Intl, Math, console, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; }, ...globals });
  return exports;
}
const records = load("../src/utils/records.ts");
const catalogues = load("../src/api/catalogues.ts", { "../utils/records": records });
const base = { fetchedAt: "2026-10-12T12:00:00Z", stale: false };
const building = { id: "", name: "School", address: "Street 1", monitoredAt: null };
const buildings = catalogues.decodeBuildings({ ...base, buildings: [building, building, { ...building, name: "Library" }] }).buildings;
assert.equal(buildings.length, 2); assert.ok(buildings.every(item => item.id.trim()));
assert.equal(buildings[0].id, catalogues.decodeBuildings({ ...base, buildings: [building] }).buildings[0].id);
assert.throws(() => records.uniqueById([{ id: "" }]));
assert.throws(() => records.uniqueById([{ id: "one", name: "A" }, { id: "one", name: "B" }]));
const news = { title: "News", sourceUrl: "https://example.org/article", publishedLabel: null };
assert.equal(catalogues.decodeNews({ ...base, items: [news, news] }).items.length, 1);
assert.throws(() => catalogues.decodeNews({ ...base, items: [{ ...news, sourceUrl: "javascript:alert(1)" }] }));
for (const buy of [NaN, -1, null, "40"]) assert.throws(() => catalogues.decodeCurrency({ ...base, rates: [{ code: "USD", buy, sell: 41, updatedAt: base.fetchedAt }] }));
const rate = { code: "HUF", buy: .1, sell: .1, updatedAt: base.fetchedAt, reference: true };
assert.equal(catalogues.decodeCurrency({ ...base, rates: [rate] }).rates[0].reference, true);
const current = { temperatureC: 20, feelsLikeC: 20, windKph: 1, humidity: 70, condition: "Sunny", iconUrl: "https://example.org/icon.png", observedAt: base.fetchedAt, airQuality: null };
assert.equal(catalogues.decodeWeather({ ...base, current, days: [] }).current.temperatureC, 20);
assert.throws(() => catalogues.decodeWeather({ ...base, current: { ...current, temperatureC: null }, days: [] }));
const transport = load("../src/api/transportValidation.ts", { "../utils/records": records });
const stop = { id: "stop-1", name: "Stop", latitude: 48.62, longitude: 22.28 };
assert.equal(transport.decodeStops([stop, stop]).length, 1);
assert.throws(() => transport.decodeStops([{ ...stop, id: " " }]));
assert.throws(() => transport.decodeStops([{ ...stop, latitude: 999 }]));
const route = { id: "route-1", name: "Route", routeNumber: "7", active: true, variants: [{ id: "direction-1", name: "To centre", directionId: 0, stops: [stop, stop] }] };
assert.equal(transport.decodeRoute(route).variants[0].stops.length, 2); // circular stop sequence retained
assert.throws(() => transport.decodeRoute({ ...route, variants: [{ ...route.variants[0], id: "" }] }));
const power = load("../src/power/model.ts", { "../utils/records": records });
assert.equal(power.decodePlaces([{ id: 1, name: "Town" }, { id: 1, name: "Town" }]).length, 1);
assert.equal(power.decodeAddress({ city: { id: 1, name: "Town" }, street: { id: 1, name: "Street" }, building: "1" }).street.name, "Street");
console.log("PASS: stable nonblank identities, conflicting/duplicate records, unsafe links, invalid numbers; circular routes retained");

const payment = load("../src/payments/demoTransport.ts");
const parking = load("../src/payments/parkingSession.ts", { "./demoTransport": payment });
const draft = { zoneId: "example-a", plate: "AO1234AA", hours: 2, last4: "4242", requestId: "request_start_1" };
const now = new Date("2026-10-12T12:00:00Z");
const started = parking.applyParkingPayment([], draft, now);
assert.equal(started[0].endsAt, "2026-10-12T14:00:00.000Z"); assert.equal(started[0].charges[0].amountKopiykas, 5000);
assert.equal(parking.applyParkingPayment(started, draft, now), started);
const extended = parking.applyParkingPayment(started, { ...draft, hours: 1, requestId: "request_extend_1" }, new Date("2026-10-12T12:30:00Z"), started[0].id);
assert.equal(extended[0].endsAt, "2026-10-12T15:00:00.000Z"); assert.equal(extended[0].charges.length, 2);
assert.equal(parking.decodeParkingSessions(JSON.parse(JSON.stringify(extended)))[0].endsAt, extended[0].endsAt);
assert.throws(() => parking.applyParkingPayment(started, { ...draft, requestId: "request_second_1" }, now));
assert.throws(() => parking.applyParkingPayment(started, { ...draft, requestId: "request_expired_1" }, new Date("2026-10-12T15:00:00Z"), started[0].id));
assert.throws(() => parking.decodeParkingSessions([{ ...started[0], endsAt: "2026-10-12T20:00:00Z" }]));
for (const hours of [0, 9, 1.5]) assert.throws(() => parking.quoteParking("example-a", hours));
assert.equal(parking.quoteParking("example-b", 2).amountKopiykas, 4000);
const values = new Map(); let failWrite = false;
const dependencies = { "../payments/parkingSession": parking, "react-native": { Platform: { OS: "web" } }, "expo-secure-store": {} };
const globals = { globalThis: { localStorage: { getItem: key => values.get(key), setItem(key, value) { if (failWrite) throw Error("storage full"); values.set(key, value); } } } };
const storage = load("../src/storage/parkingSessions.ts", dependencies, globals);
await Promise.all([storage.payForParking(draft), storage.payForParking(draft)]);
assert.equal((await storage.restoreParkingSessions()).length, 1);
assert.equal((await load("../src/storage/parkingSessions.ts", dependencies, globals).restoreParkingSessions())[0].charges.length, 1);
failWrite = true; await assert.rejects(storage.payForParking({ ...draft, plate: "AO2222AA", requestId: "request_failure_1" })); failWrite = false;
assert.equal((await storage.restoreParkingSessions()).length, 1);
await storage.payForParking({ ...draft, plate: "AO2222AA", requestId: "request_failure_1", cvv: "never-store", pan: "never-store" });
assert.equal((await storage.restoreParkingSessions()).length, 2); assert.ok(![...values.values()].join().includes("never-store"));
values.set("uzhhorod-digital.parking.v1", "broken"); await assert.rejects(storage.payForParking(draft)); assert.equal(values.get("uzhhorod-digital.parking.v1"), "broken");
console.log("PASS: parking quotes, extension, expiry, concurrent/idempotent payment, native-independent reopen, write retries, no PAN/CVV, corrupt history preserved");

values.clear();
const { jsx, nodes } = (() => {
  const jsx = (type, props) => ({ type, props });
  const nodes = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
  return { jsx, nodes };
})();
function parkingScreen() {
  const slots = [], effects = [], pendingEffects = []; let cursor = 0, tree, dirty = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; dirty = true; }]; },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; if (!same(effects[i]?.deps, deps)) { pendingEffects.push({ i, fn }); effects[i] = { deps, cleanup: effects[i]?.cleanup }; } },
  };
  const native = { ...Object.fromEntries(["View", "ScrollView", "ActivityIndicator"].map(n => [n, n])), Linking: { openURL: async () => {} }, AppState: { addEventListener: () => ({ remove() {} }) } };
  const component = load("../src/components/ParkingDemoScreen.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" }, "react-native": native,
    "@expo/vector-icons": { Ionicons: "Icon" }, "../i18n/ui": { Text: "Text", Pressable: "Pressable", TextInput: "TextInput", useLanguage: () => ["uk"] },
    "../i18n/locale": { getLocale: () => "uk-UA" }, "../ui/Screen": { ScreenSafeArea: "Screen" },
    "../ui/ScreenStack": { LocalScreenStack: "LocalScreenStack" },
    "../payments/demoTransport": payment, "../payments/parkingSession": parking,
    "../storage/parkingSessions": storage,
    "./ParkingMap": { ParkingMap: "ParkingMap" },
    "./CivicServiceUI": { civicStyles: () => ({}), civicTheme: () => ({}), useHardwareBack() {}, useServiceSwipeBack: () => ({}), ...Object.fromEntries(["ChoiceRow", "PrimaryButton", "ServiceHeader", "ServiceSheet", "ServiceTabs"].map(n => [n, n])) },
  }, { setInterval: () => 1, clearInterval() {} });
  const props = { dark: false, card: { label: "Saved example", last4: "1111" }, onBack() {} };
  function render() {
    let runs = 0;
    do { dirty = false; cursor = 0; tree = component.ParkingDemoScreen(props); for (const { i, fn } of pendingEffects.splice(0)) { effects[i].cleanup?.(); effects[i].cleanup = fn(); } assert.ok(++runs < 20); } while (dirty);
    return tree;
  }
  async function settle() { await new Promise(setImmediate); render(); await new Promise(setImmediate); render(); }
  function find(type, predicate) { const found = nodes(tree).filter(n => n.type === type && predicate(n.props)); assert.equal(found.length, 1, `${type} matches: ${found.length}`); return found[0].props; }
  render(); return { render, settle, find };
}
const uiParking = parkingScreen(); await uiParking.settle();
const scrollLocks = [];
uiParking.find("ScrollView", () => true).ref({ setNativeProps: props => scrollLocks.push(props.scrollEnabled) });
uiParking.find("ParkingMap", () => true).onInteractionChange(true);
assert.deepEqual(scrollLocks, [false], "native scroll locks before the React render");
uiParking.render();
assert.equal(uiParking.find("ScrollView", () => true).scrollEnabled, false);
assert.equal(uiParking.find("ScrollView", () => true).pinchGestureEnabled, false);
uiParking.find("ParkingMap", () => true).onInteractionChange(false); uiParking.render();
assert.equal(uiParking.find("ScrollView", () => true).scrollEnabled, true);
assert.deepEqual(scrollLocks, [false, true], "native scroll unlocks after the map gesture");
const press = title => { const button = uiParking.find("PrimaryButton", props => props.title === title); assert.ok(!button.disabled); button.onPress(); uiParking.render(); };
uiParking.find("ParkingMap", () => true).onSelect("uzh-fedyntsia"); uiParking.render();
assert.equal(uiParking.find("ParkingMap", () => true).selectedId, "uzh-fedyntsia");
uiParking.find("Pressable", props => props.accessibilityLabel === "Вулиця Івана Чендея").onPress(); uiParking.render();
assert.equal(uiParking.find("ParkingMap", () => true).selectedId, "uzh-chendeia");
press("Нове паркування");
uiParking.find("Pressable", props => props.onPress && nodes(props.children).some(n => n.props?.children === "Змінити майданчик")).onPress(); uiParking.render();
uiParking.find("ParkingMap", () => true).onSelect("uzh-fedyntsia"); uiParking.render(); press("Продовжити");
assert.equal(uiParking.find("PrimaryButton", props => props.title === "Продовжити").disabled, true);
uiParking.find("TextInput", () => true).onChangeText("AO9876AA"); uiParking.render();
uiParking.find("Pressable", props => props.accessibilityLabel === "Збільшити тривалість").onPress(); uiParking.render();
press("Продовжити");
assert.equal(uiParking.find("ChoiceRow", props => props.title.startsWith("Saved example")).selected, true);
uiParking.find("ChoiceRow", props => props.title.includes("4242")).onPress(); uiParking.render(); press("Продовжити");
const confirm = uiParking.find("PrimaryButton", props => props.title === "Підтвердити тестову оплату"); confirm.onPress(); confirm.onPress(); await uiParking.settle();
const uiSessions = await storage.restoreParkingSessions(); assert.equal(uiSessions.length, 1); assert.equal(uiSessions[0].zoneId, "uzh-fedyntsia"); assert.equal(uiSessions[0].charges[0].amountKopiykas, 5000); assert.equal(uiSessions[0].charges[0].last4, "4242");
press("Продовжити паркування"); assert.equal(uiParking.find("TextInput", () => true).editable, false);
press("Продовжити"); press("Продовжити"); press("Підтвердити тестову оплату"); await uiParking.settle();
assert.equal((await storage.restoreParkingSessions())[0].charges.length, 2);
console.log("PASS: actual parking screen selects zone, validates plate, chooses card, confirms once and extends the same session");

const snapshotValues = new Map();
const savedTransport = load("../src/storage/transportSnapshots.ts", { "@react-native-async-storage/async-storage": { default: {} }, "react-native": { Platform: { OS: "web" } } }, { globalThis: { localStorage: { getItem: key => snapshotValues.get(key), setItem: (key, value) => snapshotValues.set(key, value) } } });
await savedTransport.persistTransportSnapshot("/api/transport/routes", [route]);
await savedTransport.persistTransportSnapshot("/api/transport/vehicles", { vehicles: [stop] });
assert.equal(await savedTransport.readTransportSnapshot("/api/transport/vehicles"), null);
assert.equal((await savedTransport.readTransportSnapshot("/api/transport/routes")).value.length, 1);
let transportRequests = 0;
const offlineApi = load("../src/api/transport.ts", { "./transportValidation": transport, "../storage/transportSnapshots": savedTransport, "./request": { requestJson: async () => { transportRequests++; throw Error("offline"); } } });
const offlineRoutes = await offlineApi.getRoutes();
assert.equal(offlineRoutes.length, 1); assert.equal(offlineApi.getTransportSnapshotInfo(offlineRoutes).offline, true);
assert.equal((await offlineApi.getRoutes("7")).length, 1); assert.equal(transportRequests, 1);
await assert.rejects(offlineApi.getVehiclePositions("7")); assert.equal(transportRequests, 2);
snapshotValues.set("uzhhorod-digital.transport-snapshots.v1", "broken");
await assert.rejects(savedTransport.persistTransportSnapshot("/api/transport/routes", [route]));
assert.equal(snapshotValues.get("uzhhorod-digital.transport-snapshots.v1"), "broken");
console.log("PASS: validated offline catalogue/search after reopening; visibly stale metadata; no live GPS snapshot; corrupt cache not overwritten");
const nativeCacheValues = new Map();
const nativeCacheDependencies = { "@react-native-async-storage/async-storage": { __esModule: true, default: { getItem: async key => nativeCacheValues.get(key) ?? null, setItem: async (key, value) => nativeCacheValues.set(key, value) } }, "react-native": { Platform: { OS: "ios" } } };
await load("../src/storage/transportSnapshots.ts", nativeCacheDependencies).persistTransportSnapshot("/api/transport/stops", Array.from({ length: 100 }, (_, i) => ({ ...stop, id: `stop-${i}` })));
assert.equal((await load("../src/storage/transportSnapshots.ts", nativeCacheDependencies).readTransportSnapshot("/api/transport/stops")).value.length, 100);
assert.ok([...nativeCacheValues.values()][0].length > 2048);
console.log("PASS: native public catalogue uses AsyncStorage, including payloads larger than a secret-store record");

function hooks() {
  let cursor = 0; const slots = [];
  return { start: () => { cursor = 0; }, react: {
    createElement: jsx, useEffect() {},
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { deps, value: fn() }; return slots[i].value; },
  } };
}
const h = hooks(); const mapProps = { map: { routeId: "route-1", variants: [], stops: [stop] }, region: { latitude: 48.62, longitude: 22.28, latitudeDelta: .05, longitudeDelta: .05 }, vehicles: [] };
const map = load("../src/components/RouteMap.web.tsx", { react: h.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": { StyleSheet: { create: x => x } }, "expo-asset": { Asset: { fromModule: () => ({ uri: "https://example.org/bus.png" }) } }, "../../assets/transport/uzhhorod-elektron-marker.png": 1, "../i18n/locale": { translate: v => v, getLanguage: () => "uk" }, "../ui/theme": { useAppTheme: () => false } });
h.start(); const frame = nodes(map.RouteMap(mapProps)).find(n => n.type === "iframe");
h.start(); const refreshed = nodes(map.RouteMap({ ...mapProps, map: { ...mapProps.map }, selectedStopId: stop.id, vehicles: [{ id: "bus-1", routeNumber: "7", latitude: 48.62, longitude: 22.28 }] })).find(n => n.type === "iframe");
assert.equal(frame.props.srcDoc, refreshed.props.srcDoc); assert.equal(frame.props.sandbox, "allow-scripts");
let fit = 0; const callbacks = {}; const parent = {};
const element = () => ({ style: {}, append() {}, appendChild() {}, classList: { add() {} }, setAttribute() {} });
const layer = () => ({ addTo() { return this; }, on() { return this; }, remove() {}, bindTooltip() { return this; }, bindPopup() { return this; }, getElement: element, setLatLng() {}, setIcon() {} });
const leaflet = { map: () => ({ setView() { return this; }, fitBounds() { fit++; }, on() { return this; }, invalidateSize() {}, removeLayer() {}, hasLayer: () => false }), tileLayer: layer, polyline: layer, circleMarker: layer, marker: layer, divIcon: x => x };
const scripts = [...frame.props.srcDoc.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean);
vm.runInNewContext(scripts.at(-1), { L: leaflet, parent, window: { addEventListener: (type, fn) => { callbacks[type] = fn; } }, document: { createElement: element, getElementById: () => null, body: element() }, setTimeout: fn => fn(), Map, console });
const initialFits = fit;
callbacks.message({ source: parent, data: { type: "uzhhorod-route-data", shapes: [], stops: [stop], vehicles: [], selectedStopId: stop.id } });
assert.equal(fit, initialFits);
console.log("PASS: same iframe document after GPS/selection updates; actual map message handler does not reset viewport; sandbox retained");

// Oversized but valid map cannot evict catalogues or replace the prior map.
snapshotValues.clear();
await savedTransport.persistTransportSnapshot("/api/transport/routes", [route]);
await savedTransport.persistTransportSnapshot("/api/transport/stops", [stop]);
const smallMap = transport.decodeRouteMap({ routeId: route.id, stops: [stop], variants: [{ id: "v1", name: "Direction", directionId: 0, shape: [{ latitude: 48.62, longitude: 22.28 }] }] });
await savedTransport.persistTransportSnapshot(`/api/transport/routes/${route.id}/map`, smallMap);
const largeMap = transport.decodeRouteMap({ ...smallMap, variants: [{ ...smallMap.variants[0], shape: Array.from({ length: 12000 }, () => ({ latitude: 48.62, longitude: 22.28 })) }] });
assert.ok(JSON.stringify(largeMap).length > savedTransport.SNAPSHOT_CHARACTER_BUDGET);
await savedTransport.persistTransportSnapshot(`/api/transport/routes/${route.id}/map`, largeMap);
assert.equal((await savedTransport.readTransportSnapshot("/api/transport/stops")).value.length, 1);
assert.equal((await savedTransport.readTransportSnapshot(`/api/transport/routes/${route.id}/map`)).value.variants[0].shape.length, 1);
for (let i = 0; i < 12; i++) await savedTransport.persistTransportSnapshot(`/api/transport/routes/optional-${i}/map`, smallMap);
assert.ok(await savedTransport.readTransportSnapshot("/api/transport/routes"));
assert.ok(await savedTransport.readTransportSnapshot("/api/transport/stops"));
console.log("PASS: valid oversized geometry leaves previous cache intact; entry eviction preserves routes/stops");

// Receipt storage: failed/corrupt reads never turn into destructive writes.
const ticketValues = new Map(); let ticketReadFailure = false, ticketWriteFailure = false;
const ticketSecure = { WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device", getItemAsync: async key => { if (ticketReadFailure) throw Error("locked"); return ticketValues.get(key) ?? null; }, setItemAsync: async (key, value) => { if (ticketWriteFailure) throw Error("full"); ticketValues.set(key, value); } };
const ticketStore = load("../src/storage/demoTickets.ts", { "expo-secure-store": ticketSecure, "react-native": { Platform: { OS: "ios" } }, "../payments/demoTransport": payment });
const receipt = payment.createDemoTicket("AO1234AA", 1, "4242", "number");
const ticketKey = "uzhhorod-digital.demo-tickets.v1";
assert.equal((await ticketStore.restoreDemoTickets()).length, 0);
await Promise.all([ticketStore.appendDemoTicket(receipt), ticketStore.appendDemoTicket(receipt)]);
assert.equal((await ticketStore.restoreDemoTickets()).length, 1);
ticketReadFailure = true; const original = ticketValues.get(ticketKey);
await assert.rejects(ticketStore.restoreDemoTickets()); await assert.rejects(ticketStore.persistDemoTickets([]));
assert.equal(ticketValues.get(ticketKey), original); ticketReadFailure = false;
ticketWriteFailure = true; await assert.rejects(ticketStore.appendDemoTicket({ ...receipt, id: "DEMO-FAILED" }));
assert.equal(ticketValues.get(ticketKey), original); ticketWriteFailure = false;
for (const invalid of ["{broken", "null", "{}", JSON.stringify([receipt, receipt]), JSON.stringify([{ ...receipt, amountKopiykas: 0 }])]) {
  ticketValues.set(ticketKey, invalid);
  await assert.rejects(ticketStore.restoreDemoTickets()); await assert.rejects(ticketStore.appendDemoTicket(receipt));
  assert.equal(ticketValues.get(ticketKey), invalid);
}
ticketValues.delete(ticketKey); await ticketStore.appendDemoTicket({ ...receipt, pan: "never-store", cvv: "never-store" });
assert.ok(!ticketValues.get(ticketKey).includes("never-store"));
console.log("PASS: tickets serialize writes, deduplicate receipts, reject malformed histories, preserve failed reads/writes and whitelist fields");

const cardStore = load("../src/storage/demoPaymentCard.ts", { "expo-secure-store": ticketSecure, "react-native": { Platform: { OS: "ios" } } });
const prefStore = load("../src/storage/preferences.ts", { "expo-secure-store": ticketSecure, "react-native": { Platform: { OS: "ios" } } });
ticketValues.set("uzhhorod-digital.demo-card.v1", "{broken");
ticketValues.set("uzhhorod-digital.preferences.v1", "{broken");
await assert.rejects(cardStore.restoreDemoCard()); await assert.rejects(prefStore.restorePreferences());
assert.equal(ticketValues.get("uzhhorod-digital.demo-card.v1"), "{broken");
assert.equal(ticketValues.get("uzhhorod-digital.preferences.v1"), "{broken");

// Run the actual App restore effect callbacks, not a reimplementation of their gates.
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const appAst = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const restoreEffects = [];
function inspectApp(node) {
  if (ts.isCallExpression(node) && node.expression.getText(appAst) === "useEffect" && node.arguments[0]) {
    const callback = node.arguments[0].getText(appAst);
    if (/restore(Preferences|DemoCard|DemoTickets)\(\)/.test(callback)) restoreEffects.push(callback);
  }
  ts.forEachChild(node, inspectApp);
}
inspectApp(appAst); assert.equal(restoreEffects.length, 3);
for (const callback of restoreEffects) {
  const enabled = [], errors = [];
  const sandbox = { preferencesReady: false, storageErrors: { preferences: false }, restorePreferences: () => Promise.reject(Error("read failed")), restoreDemoCard: () => Promise.reject(Error("read failed")), restoreDemoTickets: () => Promise.reject(Error("read failed")), preferencesRevision: { current: 0 }, demoCardRevision: { current: 0 } };
  for (const key of ["setPreferencesReady", "setDemoCardReady", "setDemoTicketsReady"]) sandbox[key] = value => enabled.push(value);
  sandbox.setStorageErrors = fn => errors.push(fn({}));
  sandbox.effect = undefined;
  vm.runInNewContext(ts.transpileModule(`globalThis.effect = ${callback};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  sandbox.effect(); await new Promise(setImmediate);
  assert.ok(!enabled.includes(true), "failed restore must not enable automatic writes"); assert.equal(errors.length, 1);
}
console.log("PASS: actual App startup gates stay closed after every failed preference/card/ticket restore");

// Native render retains circular itinerary but emits one geographic stop marker.
let nativeCursor = 0, nativeEffects = [], nativePending = []; const nativeSlots = [];
const nativeReact = {
  useRef(value) { return nativeSlots[nativeCursor++] ??= { current: value }; },
  useState(value) { const i = nativeCursor++; nativeSlots[i] ??= value; return [nativeSlots[i], next => { nativeSlots[i] = next; }]; },
  useMemo(fn) { nativeCursor++; return fn(); },
  useEffect(fn, deps) { const i = nativeCursor++; if (!nativeEffects[i] || deps.some((value, j) => value !== nativeEffects[i][j])) { nativePending.push(fn); nativeEffects[i] = deps; } },
};
const keyedJsx = (type, props, key) => ({ type, props, key });
const nativeMap = load("../src/components/RouteMap.native.tsx", {
  react: nativeReact, "react/jsx-runtime": { jsx: keyedJsx, jsxs: keyedJsx },
  "react-native": { Image: "Image", View: "View", StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
  "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
  "../i18n/ui": { Text: "Text" }, "../i18n/locale": { translate: v => v }, "../ui/theme": { useAppTheme: () => false },
  "../../assets/transport/uzhhorod-elektron-marker.png": 1,
});
let nativeFits = 0;
function renderNative(vehicles = []) {
  nativeCursor = 0;
  const tree = nativeMap.RouteMap({ ...mapProps, stops: [stop, stop], vehicles });
  const mapView = nodes(tree).find(n => n.type === "MapView");
  mapView.props.ref.current = { fitToCoordinates() { nativeFits++; } };
  nativePending.splice(0).forEach(fn => fn());
  return mapView;
}
const circular = renderNative();
assert.equal(nodes(circular).filter(n => n.type === "Marker").length, 1);
circular.props.onPanDrag(); const fitsBeforeGps = nativeFits;
const withBus = renderNative([{ id: stop.id, routeNumber: "7", latitude: 48.62, longitude: 22.28, headingDegrees: 90 }]);
const markers = nodes(withBus).filter(n => n.type === "Marker");
assert.equal(new Set(markers.map(n => n.key)).size, 2);
assert.equal(new Set(markers.map(n => n.props.identifier)).size, 2);
assert.equal(nativeFits, fitsBeforeGps);
assert.ok(nodes(withBus).some(n => n.type === "Image"));
assert.ok(nodes(withBus).some(n => n.props?.children === "↑"));
console.log("PASS: actual native map has unique circular stops and stop/bus identities, keeps artwork/arrows, does not refit after manual pan");

const { LatestRequest } = load("../src/utils/latestRequest.ts");
let transportListResolve;
const race = { exports: {}, query: "", searchMode: "routes", transportFromFavorites: false, listRequest: new LatestRequest(), detailRequest: new LatestRequest(), retryTransport: { current: null },
  getRoutes: () => new Promise(resolve => { transportListResolve = resolve; }), getLatestTransportImport: async () => null,
  getRoute: async () => route, getRouteMap: async () => smallMap, sortRoutesByNumber: value => value };
const raceState = { listLoading: false, routes: [route] };
for (const name of ["Error", "ListLoading", "ImportStatus", "Routes", "Stops", "Loading", "Schedule", "MapScreen", "RouteMapPreview", "SelectedStop", "SelectedRoute"]) race[`set${name}`] = value => { raceState[name[0].toLowerCase() + name.slice(1)] = value; };
const transportFunctions = [];
function findTransportFunctions(node) {
  if (ts.isFunctionDeclaration(node) && ["loadList", "openRoute"].includes(node.name?.text)) transportFunctions.push(node.getText(appAst));
  ts.forEachChild(node, findTransportFunctions);
}
findTransportFunctions(appAst);
vm.runInNewContext(ts.transpileModule(`${transportFunctions.join("\n")}\nexports.loadList = loadList; exports.openRoute = openRoute;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, race);
const oldList = race.exports.loadList(); assert.equal(raceState.listLoading, true);
await race.exports.openRoute(route); assert.equal(raceState.listLoading, false);
transportListResolve([]); await oldList;
assert.equal(raceState.listLoading, false); assert.equal(raceState.routes.length, 1);
console.log("PASS: actual transport actions cancel an old list refresh without leaving a spinner or applying a late empty list");

for (const platform of ["ios", "android", "web"]) {
  const fonts = load("../src/ui/fonts.ts", { "react-native": { Platform: { OS: platform } } });
  assert.ok(Object.values(fonts.APP_FONTS).every(value => value === fonts.APP_FONTS.regular && !value.includes("PublicSans")));
}
const fontFiles = [new URL("../App.tsx", import.meta.url)];
function collectFontFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) collectFontFiles(file); else if (entry.name.endsWith(".tsx")) fontFiles.push(file);
  }
}
collectFontFiles(new URL("../src/", import.meta.url));
let weighted = 0;
for (const file of fontFiles) {
  if (file.pathname.endsWith("/i18n/ui.tsx")) continue; // Base family only; nested Text must inherit its parent's weight.
  const ast = ts.createSourceFile(file.pathname, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function inspect(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const family = node.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === "fontFamily" && /^(APP_FONTS|FONTS)\.(regular|medium|semibold|bold)$/.test(p.initializer.getText(ast)));
      if (family) { assert.ok(node.properties.some(p => p.name?.getText(ast) === "fontWeight"), `Missing explicit weight: ${file.pathname}:${node.pos}`); weighted++; }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(ast);
}
assert.ok(weighted > 100);
assert.ok(!appSource.includes("useFonts"));
console.log(`PASS: platform typography has explicit weights in ${weighted} styles and no Latin-font startup gate`);

function variableInitializer(path, name) {
  const ast = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(result, name); return result;
}
let finishCardWrite, cardWrites = 0, displayedCard = null;
const cardCommitContext = { effect: undefined, demoCardRevision: { current: 0 }, persistDemoCard: () => new Promise(resolve => { finishCardWrite = resolve; }), updateDemoPaymentCard: card => { displayedCard = card; }, setStorageErrors() {} };
vm.runInNewContext(ts.transpileModule(`globalThis.effect = ${variableInitializer("../App.tsx", "setDemoPaymentCard")};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, cardCommitContext);
const cardWrite = cardCommitContext.effect({ label: "Example", last4: "4242" });
assert.equal(displayedCard, null); finishCardWrite(); await cardWrite;
assert.equal(displayedCard.last4, "4242");
cardCommitContext.persistDemoCard = async () => { throw Error("disk full"); };
await assert.rejects(cardCommitContext.effect(null)); assert.equal(displayedCard.last4, "4242");

const cardHandlerContext = { effect: undefined, locked: { current: false }, number: "4242 4242 4242 4242", expiry: "12/30", cvv: "123", label: "", validDemoCardFields: () => true,
  onSave: () => { cardWrites++; return new Promise(resolve => { finishCardWrite = resolve; }); }, setBusy() {}, setError() {}, setCvv(value) { this.clearedCvv = value; }, setNumber() {}, setExpiry() {} };
// Arrow callbacks use lexical this; use closures for the state setters.
let clearedCvv = "not-cleared", cardError = "";
cardHandlerContext.setCvv = value => { clearedCvv = value; }; cardHandlerContext.setError = value => { cardError = value; };
vm.runInNewContext(ts.transpileModule(`globalThis.effect = ${variableInitializer("../src/components/DemoCardScreen.tsx", "save")};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, cardHandlerContext);
const savingCard = cardHandlerContext.effect(); await cardHandlerContext.effect();
assert.equal(cardWrites, 1); assert.equal(clearedCvv, "not-cleared"); assert.equal(cardHandlerContext.locked.current, true);
finishCardWrite(); await savingCard; assert.equal(clearedCvv, ""); assert.equal(cardHandlerContext.locked.current, false);
cardHandlerContext.onSave = async () => { throw Error("disk full"); }; clearedCvv = "retained";
await cardHandlerContext.effect(); assert.equal(clearedCvv, "retained"); assert.ok(cardError.includes("Картку не збережено"));
console.log("PASS: actual App/card handlers wait for storage, preserve a card on failed removal, reject double saves and retain fields for retry");
