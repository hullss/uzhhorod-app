import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function load(path, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(compile(readFileSync(new URL(path, import.meta.url), "utf8")), { exports, ...globals, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const data = new Map(); let failRead = false, failWrite = false;
const localStorage = { getItem(key) { if (failRead) throw Error("unreadable"); return data.get(key) ?? null; }, setItem(key, value) { if (failWrite) throw Error("full"); data.set(key, value); } };
const storageMocks = { "expo-secure-store": {}, "react-native": { Platform: { OS: "web" } } };
const reopen = () => load("../src/storage/homeServices.ts", storageMocks, { globalThis: { localStorage } });
const store = reopen();
assert.deepEqual(Array.from(await store.restoreHomeServices()), ["transport", "parking", "transport-payment"]);
await store.persistHomeServices(["cnap", "transport"]);
assert.deepEqual(Array.from(await reopen().restoreHomeServices()), ["cnap", "transport"]);
failWrite = true; await assert.rejects(store.persistHomeServices(["parking"])); failWrite = false;
assert.deepEqual(Array.from(await store.restoreHomeServices()), ["cnap", "transport"]);
await Promise.all([store.persistHomeServices(["parking"]), store.persistHomeServices([])]);
assert.deepEqual(Array.from(await store.restoreHomeServices()), []);
assert.throws(() => store.persistHomeServices(Array.from(store.HOME_SERVICE_IDS).slice(0, 7)));
assert.throws(() => store.decodeHomeServices(["parking", "parking"]));
assert.throws(() => store.decodeHomeServices([17]));
assert.deepEqual(Array.from(store.decodeHomeServices(["retired-service", "parking"])), ["parking"]);
const key = [...data.keys()][0]; data.set(key, "corrupt");
await assert.rejects(store.restoreHomeServices()); assert.equal(data.get(key), "corrupt");
failRead = true; await assert.rejects(store.restoreHomeServices()); failRead = false;
let nativeValue = null;
const native = load("../src/storage/homeServices.ts", { "react-native": { Platform: { OS: "ios" } }, "expo-secure-store": {
  getItemAsync: async () => nativeValue, setItemAsync: async (_key, value) => { nativeValue = value; },
} });
await native.persistHomeServices(["shelters", "parking"]);
assert.deepEqual(Array.from(await native.restoreHomeServices()), ["shelters", "parking"]);
console.log("PASS: home choices survive reopening on web/native; default three, intentional empty choice, six limit, stable order, queued writes and failed/corrupt reads/writes");

const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function hooks() {
  const slots = [], effects = [], pending = []; let cursor = 0;
  return { start() { cursor = 0; }, flush() { for (const fn of pending.splice(0)) fn(); }, react: {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || deps.some((value, j) => value !== effects[i][j])) { pending.push(fn); effects[i] = deps; } },
  } };
}
const h = hooks(); let hardwareBack; let backCount = 0; let saveCount = 0; let completeSave;
const screen = load("../src/components/HomeServicesSettingsScreen.tsx", {
  react: h.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": { ScrollView: "Scroll", View: "View" }, "@expo/vector-icons": { Ionicons: "Icon" },
  "../i18n/ui": { Text: "Text", Pressable: "Button" }, "../ui/Screen": { ScreenSafeArea: "Screen" }, "../storage/homeServices": store,
  "./CivicServiceUI": { civicStyles: () => ({}), civicTheme: () => ({}), PrimaryButton: "Primary", ServiceHeader: "Header", useHardwareBack: fn => { hardwareBack = fn; }, useServiceSwipeBack: () => ({}) },
});
const props = { dark: false, options: Array.from(store.HOME_SERVICE_IDS, id => ({ id, title: id, icon: "car-outline" })), selected: Array.from(store.DEFAULT_HOME_SERVICES), loadError: false,
  onRetry() {}, onBack() { backCount++; }, onSave: ids => { saveCount++; return new Promise((resolve, reject) => { completeSave = async success => { if (success) { await store.persistHomeServices(ids); resolve(); } else reject(Error("full")); }; }); } };
let tree;
function render() { h.start(); tree = screen.HomeServicesSettingsScreen(props); h.flush(); return tree; }
function choice(id) { return nodes(tree).find(node => node.props?.accessibilityRole === "checkbox" && node.props.accessibilityLabel === id); }
function saveButton() { return nodes(tree).find(node => node.type === "Primary" && node.props.title === "Зберегти"); }
render();
for (const id of ["power-outages", "cnap", "accessibility"]) { choice(id).props.onPress(); render(); }
assert.equal(choice("shelters").props.disabled, true);
choice("shelters").props.onPress(); render(); assert.equal(choice("shelters").props.accessibilityState.checked, false);
choice("parking").props.onPress(); render(); assert.equal(choice("shelters").props.disabled, false);
choice("shelters").props.onPress(); render();
saveButton().props.onPress(); render(); hardwareBack();
assert.equal(backCount, 0); assert.equal(choice("transport").props.disabled, true);
await completeSave(false); await new Promise(setImmediate); render();
assert.ok(nodes(tree).some(node => node.props?.accessibilityRole === "alert"));
assert.equal(choice("shelters").props.accessibilityState.checked, true);
const retrySave = saveButton().props.onPress; retrySave(); retrySave(); render(); assert.equal(saveCount, 2);
await completeSave(true); await new Promise(setImmediate);
assert.equal(backCount, 1);
assert.deepEqual(Array.from(await reopen().restoreHomeServices()), ["transport", "transport-payment", "power-outages", "cnap", "accessibility", "shelters"]);
console.log("PASS: actual settings enforce six, allow replacing selections, keep the draft on write failure, block back/double save while writing, and return only after durable save");

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const variables = ["CITY_SERVICES", "HOME_SERVICE_OPTIONS"].map(name => ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === name)).getText(ast)).join("\n");
const homeCode = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "HomeScreen").getText(ast);
const homeContext = { exports: {}, HOME_SERVICE_IDS: store.HOME_SERVICE_IDS, require: () => ({ jsx, jsxs: jsx }), ...h.react,
  useCallback: fn => fn, useEffect() {}, styles: {}, COLORS: {}, View: "View", Text: "Text", Pressable: "Button", ScrollView: "Scroll", SafeAreaView: "Screen", StatusBar: "Status", RefreshControl: "Refresh",
  CivicHeader: "CivicHeader", Ionicons: "Icon", WeatherPreview: "Weather", DefendersSupportBanner: "Banner", OfficialNewsPreview: "News", CurrencyWidget: "Currency", BottomNavigation: "Navigation", DashboardServiceCard: "Shortcut",
  formatDashboardDay: () => "", formatDashboardDate: () => "" };
vm.createContext(homeContext); vm.runInContext(compile(`${variables}\n${homeCode}`), homeContext);
const opened = []; const homeProps = { visible: false, homeServiceIds: Array.from(store.DEFAULT_HOME_SERVICES), homeServicesError: false, onConfigureServices() {}, onOpenTransport: () => opened.push("transport"), onOpenService: id => opened.push(id) };
function home(ids) { h.start(); return nodes(homeContext.HomeScreen({ ...homeProps, homeServiceIds: ids })).filter(node => node.type === "Shortcut"); }
let cards = home(homeProps.homeServiceIds);
assert.deepEqual(cards.map(card => card.props.title), ["Громадський транспорт", "Паркування", "Оплата проїзду"]);
cards.forEach(card => card.props.onPress()); assert.deepEqual(opened, ["transport", "parking", "transport-payment"]);
cards = home(Array.from(store.HOME_SERVICE_IDS).slice(0, 6)); assert.equal(cards.length, 6);
cards = home(Array.from(store.HOME_SERVICE_IDS).slice(0, 5)); assert.equal(cards.length, 5);
// The shared card component keeps odd and even selections in the same grid.
const homeNodes = nodes(homeContext.HomeScreen({ ...homeProps }));
assert.ok(homeNodes.findIndex(node => node.type === "Weather") < homeNodes.findIndex(node => node.type === "Banner"));
assert.ok(homeNodes.findIndex(node => node.type === "Banner") < homeNodes.findIndex(node => node.type === "Shortcut"));
assert.ok(homeNodes.findIndex(node => node.type === "Currency") < homeNodes.findIndex(node => node.type === "News"));
assert.equal(home([]).length, 0); assert.equal(home(null).length, 0);
const { navigationPath } = load("../src/ui/navigation.ts", {});
assert.deepEqual(Array.from(navigationPath({ section: "hub", activeTab: "profile", profilePanel: "home-services", profileReturn: "settings" }), frame => frame.key), ["profile", "profile:settings", "profile:home-services"]);
console.log("PASS: actual home shows only saved choices in order, routes all three defaults correctly, adapts 3/5/6 cards, and settings retains its navigation parent");
