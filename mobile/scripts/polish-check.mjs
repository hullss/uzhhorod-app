import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function load(path, mocks = {}, extras = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Promise, Map, Set, console, require(name) { assert.ok(name in mocks, name); return mocks[name]; }, ...extras });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const react = { useMemo: fn => fn(), useEffect() {}, useLayoutEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] };
const native = { useWindowDimensions: () => ({ width: 390 }), StyleSheet: { create: x => x }, PanResponder: { create: x => ({ panHandlers: x }) }, Animated: {
  Value: class { value = 0; setValue(v) { this.value = v; } stopAnimation() {} },
  spring: (v, config) => ({ start() { v.setValue(config.toValue); } }),
  timing: (v, config) => ({ start(cb) { v.setValue(config.toValue); cb?.({ finished: true }); } }),
} };
const screen = load("../src/ui/Screen.tsx", { react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": native, "react-native-safe-area-context": { SafeAreaView: "SafeArea" }, "./ScreenActivity": { useScreenActive: () => true } });
let backs = 0; const gesture = screen.useAnimatedBack(() => backs++);
const g = (dx, dy = 0, x0 = 5, vx = .1) => ({ dx, dy, x0, vx, numberActiveTouches: 1 });
assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, g(40, 5)), true);
assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, g(40, 5, 70)), false);
assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, g(40, 60)), false);
gesture.onPanResponderMove(null, g(60)); assert.equal(gesture.swipeProgress.value, 60);
gesture.onPanResponderRelease(null, g(60)); assert.equal(backs, 0); assert.equal(gesture.swipeProgress.value, 0);
gesture.onPanResponderRelease(null, g(140)); assert.equal(backs, 1);
const disabled = screen.useAnimatedBack(() => backs++, false);
assert.equal(disabled.onMoveShouldSetPanResponderCapture(null, g(150)), false);
disabled.onPanResponderRelease(null, g(150)); assert.equal(backs, 1);
assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, { ...g(140), numberActiveTouches: 2 }), false);
gesture.onPanResponderGrant(); gesture.onPanResponderMove(null, { ...g(140), numberActiveTouches: 2 });
assert.equal(gesture.swipeProgress.value, 0);
gesture.onPanResponderRelease(null, { ...g(140), numberActiveTouches: 0 }); assert.equal(backs, 1);
const mapLock = { current: false }; const guarded = screen.useAnimatedBack(() => backs++, true, mapLock);
assert.equal(guarded.onMoveShouldSetPanResponderCapture(null, g(140)), true);
mapLock.current = true; // Before React rerenders.
assert.equal(guarded.onMoveShouldSetPanResponderCapture(null, g(140)), false);
guarded.onPanResponderMove(null, g(140)); assert.equal(guarded.swipeProgress.value, 0);
guarded.onPanResponderRelease(null, g(140)); assert.equal(backs, 1);
mapLock.current = false; guarded.onPanResponderRelease(null, { ...g(140), numberActiveTouches: 0 }); assert.equal(backs, 2);
console.log("PASS: actual back gesture follows finger, rejects scrolling/non-edge swipes, cancels short gestures and respects hidden checkout");
console.log("PASS: pinch cannot start/finish a back swipe; map touch blocks page motion before React rerender and unlocks afterward");
const tokens = load("../src/ui/themeTokens.ts");
const civicNative = { ...native, ...Object.fromEntries(["Modal", "SafeAreaView", "ScrollView", "View"].map(name => [name, name])) };
const civic = load("../src/components/CivicServiceUI.tsx", { react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": civicNative, "react-native-safe-area-context": { SafeAreaView: "SafeArea" }, "../ui/Screen": screen, "../ui/themeTokens": tokens, "../i18n/ui": { Pressable: "Pressable", Text: "Text" }, "@expo/vector-icons": { Ionicons: "Icon" }, "../ui/fonts": { APP_FONTS: {} }, "../ui/layout": { PAGE_LAYOUT: {} } });
const nodes = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)];
let closes = 0;
const makeSheet = (dismissible = true) => civic.ServiceSheet({ dark: true, visible: true, dismissible, onClose: () => closes++, children: "Example content" });
const sheetTree = makeSheet();
const sheetDrag = nodes(sheetTree).find(n => n.props?.onPanResponderRelease).props;
sheetDrag.onPanResponderRelease(null, { dy: 30, vy: .1 }); assert.equal(closes, 0);
sheetDrag.onPanResponderRelease(null, { dy: 90, vy: .1 }); assert.equal(closes, 1);
nodes(makeSheet()).filter(n => n.props?.accessibilityLabel === "Закрити панель").at(-1).props.onPress(); assert.equal(closes, 2);
makeSheet().props.onRequestClose(); assert.equal(closes, 3);
makeSheet(false).props.onRequestClose(); assert.equal(closes, 3);
sheetTree.props.onRequestClose(); assert.equal(closes, 3); // Duplicate close ignored.
console.log("PASS: actual sheet handles short drag, drag dismissal, explicit X and Android back through animated close");

let calls = 0, resolve; let fail = false; let now = 1000;
const clock = class extends Date { static now() { return now; } };
const transportRecords = load("../src/utils/records.ts");
const validation = load("../src/api/transportValidation.ts", { "../utils/records": transportRecords });
const transport = load("../src/api/transport.ts", { "./transportValidation": validation, "../storage/transportSnapshots": { persistTransportSnapshot: async () => {}, readTransportSnapshot: async () => null, snapshotPath: () => false }, "./request": { requestJson: path => { calls++; if (fail) return Promise.reject(Error("offline")); return new Promise(r => { resolve = () => r(path.includes("/vehicles") ? { available: true, stale: false, fetchedAt: new Date().toISOString(), vehicles: [] } : [{ id: path, name: "Stop", latitude: 48.62, longitude: 22.28, routeNumber: "7", active: true }]); }); } } }, { Date: clock });
const first = transport.getStops(); const second = transport.getStops(); assert.equal(calls, 1); resolve(); await Promise.all([first, second]);
await transport.getStops(); assert.equal(calls, 1);
now += 301_000; const afterTtl = transport.getStops(); assert.equal(calls, 2); resolve(); await afterTtl;
fail = true; await assert.rejects(transport.getRoutes()); await assert.rejects(transport.getRoutes()); assert.equal(calls, 4);
fail = false; const recovered = transport.getRoutes(); resolve(); await recovered;
const live1 = transport.getVehiclePositions(); resolve(); await live1;
const live2 = transport.getVehiclePositions(); resolve(); await live2; assert.equal(calls, 7);
console.log("PASS: transport deduplicates catalogue requests, expires cache, retries failures and never caches live buses");

const records = load("../src/utils/records.ts");
const model = load("../src/power/model.ts", { "../utils/records": records }); const raw = new Map();
const storage = load("../src/storage/powerAddress.ts", { "../power/model": model, "react-native": { Platform: { OS: "web" } }, "expo-secure-store": {} }, { globalThis: { localStorage: { getItem: key => raw.get(key), setItem: (key, value) => raw.set(key, value), removeItem: key => raw.delete(key) } } });
const a = { city: { id: 769, name: "Ужгород" }, street: { id: 1, name: "Оноківська" }, building: "1", extra: "never-save" };
const b = { ...a, building: "2" };
raw.set("uzhhorod-digital.power-address.v1", JSON.stringify(a));
assert.equal((await storage.restoreAddressBook()).addresses.length, 1);
await Promise.all([storage.persistPowerAddress(a), storage.persistPowerAddress(b)]);
assert.equal((await storage.restoreAddressBook()).addresses.length, 2);
assert.equal((await storage.restorePowerAddress()).building, "2");
await storage.persistPowerAddress(null); assert.equal((await storage.restorePowerAddress()).building, "1");
assert.ok(![...raw.values()].join().includes("never-save"));
assert.throws(() => storage.decodeAddressBook({ addresses: [a, a] }));
raw.set("uzhhorod-digital.power-address.v1", "broken"); await assert.rejects(storage.persistPowerAddress(b));
assert.equal(raw.get("uzhhorod-digital.power-address.v1"), "broken");
console.log("PASS: legacy address migrates safely, several addresses/default work, corrupt data is not overwritten, extra fields are excluded");

const commonMocks = { react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": {}, "@expo/vector-icons": {}, "../i18n/ui": {}, "../ui/Screen": {}, "./CivicServiceUI": {} };
const { validDemoCardFields } = load("../src/components/DemoCardScreen.tsx", commonMocks);
assert.equal(validDemoCardFields("4242 4242 4242 4242", "12/99", "123"), true);
for (const fields of [["4000 0000 0000 0000", "12/99", "123"], ["4242424242424242", "13/99", "123"], ["4242424242424242", "12/00", "123"], ["4242424242424242", "12/99", "12"]]) assert.equal(validDemoCardFields(...fields), false);
const transportPayment = load("../src/payments/demoTransport.ts");
const parking = load("../src/payments/demoParking.ts", { "./demoTransport": transportPayment });
const receipt = parking.createParkingReceipt("AO 1234 AA", 3, "4242", new Date("2026-10-09T10:00:00Z"));
assert.equal(receipt.amountKopiykas, 7500); assert.equal(receipt.endsAt, "2026-10-09T13:00:00.000Z");
for (const hours of [0, 9, 1.5]) assert.throws(() => parking.createParkingReceipt("AO1234AA", hours, "4242"));
console.log("PASS: only synthetic demo PAN accepted, expiry/CVV validated, parking totals and expiry exact; invalid input rejected");

const { upcomingStopArrivals } = load("../src/components/TransportStopsScreen.tsx", { ...commonMocks, "../api/transport": {}, "../utils/cityTime": {}, "./OfficialLayerMap": {}, "./TransportCacheNotice": {} });
const arrivals = [200, 80, 140, 130, 110, 170, 150, 120].map(seconds => ({ seconds, route: { routeNumber: "7" } }));
assert.equal(JSON.stringify(upcomingStopArrivals(arrivals, 100).map(a => a.seconds)), "[110,120,130,140,150]");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
assert.ok(app.includes('<ScreenStack frames={frames}')); assert.ok(app.includes('retainRoots')); assert.ok(app.includes("bottomNavigation"));
const sheet = readFileSync(new URL("../src/components/CivicServiceUI.tsx", import.meta.url), "utf8");
assert.ok(sheet.includes('onPanResponderRelease')); assert.ok(sheet.includes('name="close"')); assert.ok(sheet.includes('flexGrow: 0'));
console.log("PASS: next 5 scheduled arrivals sorted, home kept mounted, bottom safe-area separated; sheets have bounded scrolling, drag and explicit close");
const webMap = load("../src/components/RouteMap.web.tsx", {
  react: { ...react, createElement: jsx }, "react-native": { StyleSheet: native.StyleSheet },
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "expo-asset": { Asset: { fromModule: () => ({ uri: "http://localhost/bus.png" }) } },
  "../../assets/transport/uzhhorod-elektron-marker.png": 1,
  "../i18n/locale": { translate: v => v, getLanguage: () => "uk" },
  "../ui/theme": { useAppTheme: () => false },
});
const webTree = webMap.RouteMap({ map: { stops: [], variants: [] }, region: { latitude: 48.62, longitude: 22.28, latitudeDelta: .05, longitudeDelta: .05 } });
const frameHtml = nodes(webTree).find(n => n.type === "iframe").props.srcDoc;
assert.ok(frameHtml.includes("http://localhost/bus.png")); assert.ok(frameHtml.includes("bus-direction")); assert.ok(frameHtml.includes("tileerror"));
assert.ok(!readFileSync(new URL("../src/components/RouteMap.web.tsx", import.meta.url), "utf8").includes("Image.resolveAssetSource"));
console.log("PASS: web route map renders without the removed native Image API, preserving bus images/arrows and graceful tile failure");
