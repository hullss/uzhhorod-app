import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function load(path, mocks) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Promise, JSON, require: name => { assert.ok(name in mocks, name); return name === "react-native" ? { ...mocks[name], StyleSheet: { create: value => value, hairlineWidth: 0.5 } } : mocks[name]; } });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function hooks() {
  const slots = [], effects = [], pending = []; let cursor = 0;
  return { start() { cursor = 0; }, flush() { for (const { i, fn } of pending.splice(0)) { effects[i].cleanup?.(); effects[i].cleanup = fn(); } }, react: {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || deps.some((value, j) => value !== effects[i].deps[j])) { pending.push({ i, fn }); effects[i] = { deps, cleanup: effects[i]?.cleanup }; } },
  } };
}
const tokens = load("../src/ui/themeTokens.ts", {});
const civic = { civicTheme: tokens.themeTokens, civicStyles: dark => ({ screen: { backgroundColor: tokens.themeTokens(dark).bg }, card: { backgroundColor: tokens.themeTokens(dark).surface }, body: {}, muted: {}, title: {}, content: {}, row: {}, divider: {}, link: {}, iconButton: { minWidth: 44, minHeight: 48 } }), useHardwareBack() {}, useServiceSwipeBack: () => ({}), ServiceHeader: "Header", PrimaryButton: "Primary" };
const common = { "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": { View: "View", ScrollView: "ScrollView", ActivityIndicator: "Spinner" }, "@expo/vector-icons": { Ionicons: "Icon" }, "../i18n/ui": { Text: "Text", Pressable: "Button" }, "../ui/Screen": { ScreenSafeArea: "Screen", useScreenActive: () => true }, "./CivicServiceUI": civic };
const profileHooks = hooks(); let failAddress = false, failAppointments = false;
const overview = load("../src/components/ProfileOverviewScreen.tsx", { ...common, react: profileHooks.react, "../ui/fonts": { APP_FONTS: { semibold: "System" } }, "../power/model": { addressKey: item => item.key, addressLabel: item => item.label },
  "../storage/powerAddress": { restoreAddressBook: async () => { if (failAddress) throw Error(); return { defaultKey: "home", addresses: [{ key: "other", label: "Other place" }, { key: "home", label: "Ужгород, Оноківська, 5" }] }; } },
  "../storage/demoCivic": { restoreAppointments: async () => { if (failAppointments) throw Error(); return [{ upcoming: true, date: "2026-10-26", time: "11:00" }, { upcoming: false, date: "2026-10-01", time: "09:00" }]; } }, "../civic/demoCivic": { isUpcoming: item => item.upcoming, dateLabel: date => date } });
let props = { dark: true, name: "Вадим", email: "qa@example.test", card: { label: "Моя картка", last4: "4242" }, ticketCount: 3, favoriteCount: 2, footer: "tabs" };
const actions = [];
for (const key of ["Personal", "Settings", "Account", "Addresses", "Cards", "Tickets", "Appointments", "Favorites", "Power", "Polls", "HomeServices"]) props[`on${key}`] = () => actions.push(key);
function profile() { profileHooks.start(); const tree = overview.ProfileOverviewScreen(props); profileHooks.flush(); return tree; }
let tree = profile(); await new Promise(setImmediate); tree = profile();
assert.ok(nodes(tree).some(node => node.props?.children === "Ужгород, Оноківська, 5"));
assert.ok(nodes(tree).some(node => node.props?.children === "Моя картка · •••• 4242"));
for (const label of ["Особисті дані", "Налаштування", "Адреси", "Способи оплати", "Квитки", "Записи до ЦНАП", "Обране"]) {
  const row = nodes(tree).find(node => node.type === "Button" && node.props.accessibilityLabel === label);
  assert.ok(row, label); assert.ok(row.props.style?.minHeight >= 44 || row.props.style?.minWidth >= 44 || row.props.style?.minHeight === 48); row.props.onPress();
}
assert.deepEqual(actions, ["Personal", "Settings", "Addresses", "Cards", "Tickets", "Appointments", "Favorites"]);
assert.equal(nodes(tree).find(node => node.props?.accessibilityLabel === "Записи до ЦНАП").props.accessibilityValue.text, "1");
assert.ok(nodes(tree).some(node => node.props?.children === "2026-10-26 · 11:00"));
for (const label of ["Світло за адресою", "Мої сервіси", "Опитування"]) nodes(tree).find(node => node.type === "Button" && node.props.accessibilityLabel === label).props.onPress();
assert.deepEqual(actions.slice(-3), ["Power", "HomeServices", "Polls"]);
const profileStyles = overview.profileOverviewStyles(true);
assert.equal(profileStyles.group.borderWidth ?? 0, 0);
assert.equal(profileStyles.row.height, undefined);
assert.equal(profileStyles.name.numberOfLines, undefined);
assert.ok(profileStyles.name.fontSize > profileStyles.rowTitle.fontSize);
assert.equal(nodes(tree).find(node => node.props?.accessibilityLabel === "Квитки").props.accessibilityValue.text, "3");
assert.equal(nodes(tree).find(node => node.props?.accessibilityLabel === "Адреси").props.accessibilityHint, "Ужгород, Оноківська, 5");
assert.ok(!nodes(tree).some(node => node.props?.children === "Про застосунок" || node.props?.children === "Правила та приватність" || node.props?.name === "person-circle-outline"));
assert.ok(!nodes(tree).some(node => node.props?.accessibilityLabel === "Увійти"));
props = { ...props, email: undefined, name: "", card: null }; tree = profile();
assert.equal(nodes(tree).filter(node => node.props?.accessibilityLabel === "Увійти").length, 1);
assert.ok(!nodes(tree).some(node => node.props?.children === "Моя картка · •••• 4242"));
console.log("PASS: actual compact profile uses primary address, masked card and real upcoming count; all actions work, guest has one login and no avatar/information clutter");

const brokenHooks = hooks(); failAddress = true; failAppointments = true;
// Remount the actual component so a failed read cannot masquerade as an empty book.
const broken = load("../src/components/ProfileOverviewScreen.tsx", { ...common, react: brokenHooks.react, "../ui/fonts": { APP_FONTS: {} }, "../power/model": { addressKey: () => "", addressLabel: () => "" }, "../storage/powerAddress": { restoreAddressBook: async () => { throw Error(); } }, "../storage/demoCivic": { restoreAppointments: async () => { throw Error(); } }, "../civic/demoCivic": { isUpcoming: () => false } });
brokenHooks.start(); broken.ProfileOverviewScreen(props); brokenHooks.flush(); await new Promise(setImmediate);
brokenHooks.start(); tree = broken.ProfileOverviewScreen(props);
assert.ok(nodes(tree).some(node => node.props?.children === "Не вдалося прочитати адреси"));
assert.ok(nodes(tree).some(node => node.props?.children === "Не вдалося прочитати записи"));

const favHooks = hooks(); let calls = 0;
const routes = [{ id: "7", routeNumber: "7", name: "Маршрут до центру" }, { id: "9", routeNumber: "9", name: "Інший маршрут" }];
const stops = [{ id: "45", name: "Площа Поштова" }];
const favorites = load("../src/components/FavoritesScreen.tsx", { ...common, react: favHooks.react, "../api/transport": { getRoutes: async () => { calls++; return routes; }, getStops: async () => { calls++; return stops; } } });
let favProps = { dark: false, signedIn: false, routeIds: ["7"], stopIds: ["45"], onBack() {}, onSignIn() {}, onRoute: route => actions.push(route.id), onStop: stop => actions.push(stop.id) };
function favorite() { favHooks.start(); const result = favorites.FavoritesScreen(favProps); favHooks.flush(); return result; }
favorite(); assert.equal(calls, 0, "guest does not fetch account favourites");
favProps = { ...favProps, signedIn: true }; favorite(); await new Promise(setImmediate); tree = favorite();
assert.equal(calls, 2);
assert.ok(!nodes(tree).some(node => node.props?.children === "Інший маршрут"));
nodes(tree).find(node => node.props?.accessibilityLabel === "Маршрут до центру").props.onPress();
nodes(tree).find(node => node.props?.accessibilityLabel === "Площа Поштова").props.onPress();
assert.deepEqual(actions.slice(-2), ["7", "45"]);
favProps = { ...favProps, routeIds: ["7", "missing"] }; favorite(); await new Promise(setImmediate); tree = favorite();
assert.ok(nodes(tree).some(node => node.props?.children === "Частина обраного поки недоступна. Збережені записи не видалено."));
assert.deepEqual(favProps.routeIds, ["7", "missing"]);
console.log("PASS: favourites load only saved IDs, open the selected route/stop, report missing entries without deleting them, and handle storage errors explicitly");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
assert.ok(!app.includes("headerAvatar") && !app.includes('accessibilityLabel="Відкрити профіль"'));
assert.ok(!app.includes("function ProfileScreen("));
assert.ok(app.includes('onAppointments={() => openCityService("cnap")}'));
console.log("PASS: no profile circles remain in the shared header; obsolete profile removed and appointment shortcut is connected");

const ast = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let backSource;
function findBack(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "goBack") backSource = node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node, findBack);
}
findBack(ast); assert.ok(backSource);
function appBack(patch) {
  const changes = {};
  const context = { exports: {}, section: "transport", activeTab: "profile", profilePanel: "favorites", profileReturn: null, transportFromFavorites: true,
    loading: false, error: null, selectedRoute: null, selectedStop: null, mapScreen: null, schedule: null, showDataSources: false, weatherOpen: false,
    selectedNewsArticle: null, selectedService: null, paymentMethodsInCheckout: false, routes: [], stops: [],
    listRequest: { invalidate() {} }, detailRequest: { invalidate() {} }, ...patch };
  for (const name of new Set(backSource.match(/\bset[A-Z]\w+/g))) context[name] = value => { changes[name] = value; };
  vm.runInNewContext(ts.transpileModule(`exports.back = ${backSource};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.equal(context.exports.back(), true); return changes;
}
assert.equal(appBack({ selectedRoute: routes[0] }).setSection, "hub");
assert.equal(appBack({ selectedStop: { stop: stops[0] } }).setSection, "hub");
assert.equal(appBack({ error: "offline" }).setSection, "hub");
assert.equal(appBack({ loading: true }).setSection, "hub");
const mapBack = appBack({ selectedRoute: routes[0], mapScreen: {} });
assert.equal(mapBack.setMapScreen, null); assert.equal(mapBack.setSection, undefined);
const stopRouteBack = appBack({ selectedRoute: routes[0], selectedStop: { stop: stops[0] } });
assert.equal(stopRouteBack.setSelectedRoute, null); assert.equal(stopRouteBack.setSection, undefined);
assert.equal(appBack({ section: "hub", profilePanel: "account", profileReturn: "settings" }).setProfilePanel, "settings");
console.log("PASS: actual App back handlers return favourite routes/stops/errors to favourites, retain the stop behind its route, and return account management to settings");
