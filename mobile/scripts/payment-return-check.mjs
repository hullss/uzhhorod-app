// Exercise the actual checkout component's hooks and handlers without a camera,
// device, bank, or real card data. Browser QA separately covers App navigation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; }, Date, Intl, Math, ...globals });
  return exports;
}
const payments = load("../src/payments/demoTransport.ts", {});
const layout = load("../src/ui/layout.ts", {});
const jsx = (type, props) => ({ type, props });
const flatten = node => !node ? [] : Array.isArray(node) ? node.flatMap(flatten)
  : typeof node === "object" ? [node, ...flatten(node.props?.children)] : [];
const text = node => node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node)
  : Array.isArray(node) ? node.map(text).join(" ") : text(node.props?.children);

function checkout() {
  const slots = [], effects = [], pending = [], timers = new Map(), backHandlers = new Set();
  let cursor = 0, dirty = false, tree, props, timerId = 0, manageCount = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { const next = typeof value === "function" ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(factory, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() }; return slots[index].value; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(effects[index]?.deps, deps)) { pending.push({ index, callback }); effects[index] = { deps, cleanup: effects[index]?.cleanup }; }
    },
  };
  const native = Object.fromEntries(["ActivityIndicator", "Pressable", "SafeAreaView", "ScrollView", "Text", "TextInput", "View"].map(name => [name, name]));
  native.StyleSheet = { create: value => value };
  native.Alert = { alert() {} };
  native.BackHandler = { addEventListener(name, callback) { backHandlers.add(callback); return { remove: () => backHandlers.delete(callback) }; } };
  const { DemoTransportPaymentScreen } = load("../src/components/DemoTransportPaymentScreen.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" }, "react-native": native,
    "../i18n/ui": native, "../i18n/locale": { getLocale: () => "uk-UA" },
    "@expo/vector-icons": { Ionicons: "Icon" }, "expo-status-bar": { StatusBar: "StatusBar" },
    "./PaymentQrScanner": { PaymentQrScanner: "Scanner" }, "../payments/demoTransport": payments,
    "./CivicServiceUI": { ServiceHeader: "ServiceHeader" }, "../ui/themeTokens": load("../src/ui/themeTokens.ts", {}),
    "./StorageRecoveryNotice": { StorageRecoveryNotice: "StorageRecoveryNotice" },
    "../utils/cityTime": { CITY_TIME_ZONE: "Europe/Kyiv" }, "../ui/layout": layout,
    "../ui/fonts": { APP_FONTS: { regular: "regular", medium: "medium", semibold: "semibold", bold: "bold" } },
    "../ui/Screen": { ScreenSafeArea: "SafeAreaView", useAnimatedBack: () => ({}), useScreenActive: () => true },
    "../ui/ScreenStack": { LocalScreenStack: "LocalScreenStack" },
  }, { setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) });
  const created = [];
  props = { card: null, tickets: [], isDarkTheme: false, onBack() {}, onManagePaymentMethods: () => manageCount++, onTicketCreated: ticket => created.push(ticket), onClearTickets() {} };
  function render(next = {}) {
    props = { ...props, ...next };
    let attempts = 0;
    do {
      dirty = false; cursor = 0; tree = DemoTransportPaymentScreen(props);
      for (const { index, callback } of pending.splice(0)) { effects[index].cleanup?.(); effects[index].cleanup = callback(); }
      assert.ok(++attempts < 20, "Checkout render loop");
    } while (dirty);
    return tree;
  }
  function find(type, predicate) {
    const matches = flatten(tree).filter(node => node.type === type && predicate(node));
    assert.equal(matches.length, 1, `Expected one ${type}`); return matches[0];
  }
  const byLabel = label => find("Pressable", node => node.props.accessibilityLabel === label);
  const byText = value => find("Pressable", node => text(node).replace(/\s+/g, " ").trim() === value);
  const click = node => { node.props.onPress(); render(); };
  render();
  return { render, find, byLabel, byText, click, created, backHandlers, timers,
    text: () => text(tree), manageCount: () => manageCount,
    async flushPayment() { for (const [id, callback] of [...timers]) { timers.delete(id); await callback(); } render(); } };
}

const manual = checkout();
manual.find("TextInput", node => node.props.accessibilityLabel === "Державний номер автобуса").props.onChangeText("AO9876AA");
manual.render(); manual.click(manual.byText("Продовжити"));
manual.click(manual.byLabel("Збільшити кількість пасажирів")); manual.click(manual.byLabel("Збільшити кількість пасажирів"));
manual.click(manual.byText("Додати макет картки у профілі"));
assert.equal(manual.manageCount(), 1);
manual.render({ active: false });
assert.equal(manual.backHandlers.size, 0, "Hidden checkout must not intercept Android back");
manual.render({ active: true }); // Cancel card addition.
assert.ok(manual.text().includes("AO 9876 AA"));
assert.ok(manual.text().includes(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS * 3)}`));
assert.equal(manual.created.length, 0); assert.equal(manual.timers.size, 0);
manual.click(manual.byText("Додати макет картки у профілі"));
manual.render({ active: false });
manual.render({ card: { label: "QA-макет", last4: "1111" }, active: true });
const savedRadio = manual.find("Pressable", node => node.props.accessibilityRole === "radio" && text(node).includes("QA-макет"));
assert.equal(savedRadio.props.accessibilityState.checked, true);
assert.equal(savedRadio.props["aria-checked"], true);
assert.ok(manual.text().includes("AO 9876 AA"));
manual.click(manual.byText(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS * 3)}`)); await manual.flushPayment();
assert.equal(manual.created.length, 1);
assert.equal(manual.created[0].quantity, 3); assert.equal(manual.created[0].plate, "AO 9876 AA");
assert.equal(manual.created[0].cardLast4, "1111"); assert.equal(manual.created[0].source, "number");
console.log("PASS: actual checkout keeps plate/3 passengers after cancellation and card addition; hidden back handler disabled; new card selected; correct ticket");

const qr = checkout();
qr.click(qr.byText("Сканувати QR Наведіть камеру на код у салоні"));
qr.find("Scanner", () => true).props.onScan("https://example.com/test"); qr.render();
qr.click(qr.byLabel("Збільшити кількість пасажирів"));
qr.click(qr.byText("Додати макет картки у профілі")); qr.render({ active: false });
qr.render({ card: { label: "QA-макет", last4: "2222" }, active: true });
assert.ok(qr.text().includes("QR зчитано. Для демо обрано тестовий автобус."));
qr.click(qr.byText("Керувати карткою")); qr.render({ active: false });
qr.render({ card: null }); // Card removed while checkout is hidden.
qr.render({ active: true });
assert.equal(qr.find("Pressable", node => node.props.accessibilityRole === "radio").props.accessibilityState.checked, true);
qr.click(qr.byText(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS * 2)}`)); await qr.flushPayment();
assert.equal(qr.created[0].source, "qr"); assert.equal(qr.created[0].quantity, 2); assert.equal(qr.created[0].cardLast4, "4242");
console.log("PASS: QR origin/example flag preserved; removed card falls back to test 4242 without resetting checkout");

const cancelled = checkout();
cancelled.find("TextInput", node => node.props.accessibilityLabel === "Державний номер автобуса").props.onChangeText("AO1234AA"); cancelled.render();
cancelled.click(cancelled.byText("Продовжити"));
cancelled.click(cancelled.byText(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS)}`));
cancelled.find("ServiceHeader", () => true).props.onBack(); cancelled.render(); await cancelled.flushPayment();
assert.equal(cancelled.created.length, 1);
console.log("PASS: back cannot interrupt the receipt write and pretend payment was cancelled");

const restoring = checkout();
restoring.render({ historyReady: false, historyError: true });
assert.equal(restoring.find("StorageRecoveryNotice", () => true).type, "StorageRecoveryNotice");
restoring.find("TextInput", () => true).props.onChangeText("AO1234AA"); restoring.render();
restoring.click(restoring.byText("Продовжити"));
const blocked = restoring.byText(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS)}`);
assert.equal(blocked.props.disabled, true); blocked.props.onPress(); restoring.render();
assert.equal(restoring.timers.size, 0);

const writeFailure = checkout();
writeFailure.render({ onTicketCreated: async () => { throw Error("disk full"); } });
writeFailure.find("TextInput", () => true).props.onChangeText("AO1234AA"); writeFailure.render();
writeFailure.click(writeFailure.byText("Продовжити"));
writeFailure.click(writeFailure.byText(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS)}`));
await writeFailure.flushPayment();
assert.ok(writeFailure.text().includes("Не вдалося зберегти квиток"));
assert.ok(!writeFailure.text().includes("Тестова оплата успішна"));

const durable = checkout(); let completeWrite;
durable.render({ onTicketCreated: () => new Promise(resolve => { completeWrite = resolve; }) });
durable.find("TextInput", () => true).props.onChangeText("AO1234AA"); durable.render();
durable.click(durable.byText("Продовжити"));
durable.click(durable.byText(`Оплатити ${payments.formatDemoMoney(payments.DEMO_FARE_KOPIYKAS)}`));
const writing = durable.flushPayment(); durable.render();
assert.ok(durable.text().includes("Обробляємо тестову оплату"));
assert.ok(!durable.text().includes("Тестова оплата успішна"));
completeWrite(); await writing;
assert.ok(durable.text().includes("Тестова оплата успішна"));
console.log("PASS: actual checkout blocks unreadable history, reports write failure and waits for durable receipt before success");
