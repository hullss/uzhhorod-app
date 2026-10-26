import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; }, Intl, Date, URL, Set, JSON, ...globals });
  return exports;
}
const catalogue = load("../src/i18n/catalogue.ts");
const locale = load("../src/i18n/locale.ts", { "./catalogue": catalogue });
let notifications = 0;
const unsubscribe = locale.subscribeLanguage(() => notifications++);
locale.setLanguage("en");
assert.equal(locale.getLocale(), "en-GB"); assert.equal(notifications, 1);
locale.setLanguage("en"); assert.equal(notifications, 1);
for (const [uk, en] of [["Профіль", "Profile"], ["Спосіб оплати", "Payment method"], ["Події міста", "City events"], ["Назад: До профілю", "Back: Back to profile"], ["Оплатити 69,00 ₴", "Pay 69,00 ₴"], ["3 маршрутів · 2 зупинок", "3 routes · 2 stops"]]) assert.equal(locale.translate(uk), en);
assert.equal(locale.translate("Унікальна назва виставки в Ужгороді"), "Унікальна назва виставки в Ужгороді");
assert.equal(locale.translate("  Профіль "), "  Profile ");
const called = [];
const jsx = (type, props) => ({ type, props });
const ui = load("../src/i18n/ui.tsx", {
  "../ui/fonts": { APP_FONTS: { regular: "System" } },
  "./locale": locale, react: { forwardRef: fn => fn, useSyncExternalStore: (_subscribe, get) => get() },
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "react-native": { Text: "Text", Pressable: "Pressable", TextInput: "TextInput", Alert: { alert: (...args) => called.push(args) } },
});
assert.equal(ui.Text({ children: ["Пасажирів: ", 3] }).props.children, "Passengers: 3");
assert.equal(ui.Text({ children: ["Час уточнюється", " · ", "Концерти"] }).props.children, "Time to be confirmed · Concerts");
assert.equal(ui.Text({ children: "Профіль", translate: false }).props.children, "Профіль");
assert.equal(ui.TextInput({ placeholder: "Введіть пароль ще раз", value: "Профіль", accessibilityLabel: "Пароль" }).props.value, "Профіль");
assert.equal(ui.TextInput({ placeholder: "Введіть пароль ще раз" }).props.placeholder, "Enter your password again");
assert.equal(ui.Pressable({ accessibilityLabel: "Проголосувати" }).props.accessibilityLabel, "Vote");
assert.equal(ui.Pressable({ accessibilityRole: "radio", accessibilityState: { checked: false } }).props["aria-checked"], false);
assert.equal(ui.Pressable({ accessibilityRole: "checkbox", accessibilityState: { checked: true, disabled: true } }).props["aria-checked"], true);
assert.equal(ui.Pressable({ accessibilityState: { selected: true } }).props["aria-selected"], true);
assert.equal(ui.Pressable({ disabled: true }).props["aria-disabled"], true);
assert.equal(ui.Pressable({ "aria-checked": false, accessibilityState: { checked: true } }).props["aria-checked"], false);
ui.Alert.alert("Видалити акаунт?", "Спробуйте ще раз.", [{ text: "Скасувати", onPress() {} }]);
assert.equal(called[0][0], "Delete account?"); assert.equal(called[0][2][0].text, "Cancel");
assert.equal(typeof called[0][2][0].onPress, "function");
console.log("PASS: English labels, accessibility, placeholders, alerts, templates and mixed text; source content/input values untouched");

const dates = load("../src/news/article.ts", { "../i18n/locale": locale });
assert.equal(dates.newsDateLabel("жовтня 08, 2026"), "8 October 2026");
const events = load("../src/events/catalog.ts", { "../i18n/locale": locale, "../utils/cityTime": { cityDate: () => "2026-10-09" } });
assert.equal(events.eventDateLabel("2026-10-17"), "17 October 2026");
locale.setLanguage("uk"); unsubscribe();
assert.equal(locale.translate("Профіль"), "Профіль");
assert.equal(dates.newsDateLabel("жовтня 08, 2026"), "8 жовтня 2026");
console.log("PASS: switching back restores Ukrainian; dates follow language without changing city timezone");

// Guard all static UI copy, including errors. Month names are source-date parser tokens, not labels.
const months = new Set(["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]);
const files = ["../App.tsx", ...readdirSync(new URL("../src/components/", import.meta.url)).filter(f => f.endsWith("tsx")).map(f => `../src/components/${f}`), "../src/civic/demoCivic.ts", "../src/api/account.ts", "../src/api/request.ts", "../src/events/catalog.ts", "../src/power/model.ts"];
const missing = new Set(); let checked = 0;
for (const path of files) {
  const ast = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) {
      const key = n.text.trim();
      if (/[а-яіїєґ]/iu.test(key) && !key.includes("<html") && !key.includes("<!doctype") && !months.has(key)) {
        checked++; if (!catalogue.EN[key]) missing.add(key);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
}
assert.deepEqual([...missing], [], `Untranslated interface copy: ${[...missing].join("\n")}`);
console.log(`PASS: catalogue covers ${checked} static UI occurrences`);

const stored = new Map();
const secure = { WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device", getItemAsync: async key => stored.get(key) ?? null, setItemAsync: async (key, value) => { stored.set(key, value); }, deleteItemAsync: async key => { stored.delete(key); } };
const storage = load("../src/storage/demoPaymentCard.ts", { "expo-secure-store": secure, "react-native": { Platform: { OS: "ios" } } });
assert.equal(storage.decodeDemoCard({ label: "Test", last4: "42" }), null);
assert.equal(storage.decodeDemoCard({ label: "x".repeat(41), last4: "4242" }), null);
const card = { label: "Test", last4: "1111", pan: "never-store", cvv: "never-store" };
await storage.persistDemoCard(card);
assert.equal(JSON.stringify(await storage.restoreDemoCard()), '{"label":"Test","last4":"1111"}');
assert.ok(![...stored.values()].join().includes("never-store"));
let release;
secure.setItemAsync = async (key, value) => { await new Promise(resolve => { release = resolve; }); stored.set(key, value); };
const save = storage.persistDemoCard({ label: "Slow", last4: "2222" }); const clear = storage.persistDemoCard(null);
await new Promise(setImmediate); release(); await Promise.all([save, clear]);
assert.equal(await storage.restoreDemoCard(), null);
const prefs = load("../src/storage/preferences.ts", { "expo-secure-store": secure, "react-native": { Platform: { OS: "web" } } }, { globalThis: { localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) } } });
await prefs.persistPreferences({ language: "en", notifications: { alert: true, news: false, transport: true, silence: false } });
assert.equal((await prefs.restorePreferences()).language, "en");
console.log("PASS: English persists; card whitelists label/last4; slow writes cannot resurrect a removed card");

const model = await import(`data:text/javascript,${encodeURIComponent(readFileSync(new URL("../../backend/src/main/resources/static/admin/model.js", import.meta.url), "utf8"))}`);
assert.deepEqual([...model.CATEGORIES], [...events.EVENT_CATEGORIES]);
const serverValidator = readFileSync(new URL("../../backend/src/main/java/ua/uzhhorod/digital/editorial/EventDocumentValidator.java", import.meta.url), "utf8");
for (const category of model.CATEGORIES) assert.ok(serverValidator.includes(`"${category}"`));
const fields = { title: "Test workshop", date: "2026-10-17", verifiedAt: "2026-10-09", category: "Майстер-класи", venue: "Test venue", description: "Test description", sourceUrl: "https://example.org/event" };
const edited = model.eventFromFields(fields, { id: "kept-id", customField: "preserve", posterUrl: "https://example.org/old.jpg" }, "unused-id");
assert.equal(edited.id, "kept-id"); assert.equal(edited.customField, "preserve"); assert.equal(edited.posterUrl, undefined);
assert.equal(events.decodeEventCatalog({ items: [edited] }).items.length, 1);
for (const invalid of [{ date: "2026-02-30" }, { time: "25:00" }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://192.168.1.1/event" }, { category: "unknown" }]) assert.throws(() => model.eventFromFields({ ...fields, ...invalid }, null, "id"));
assert.throws(() => model.validateDocument({ items: [edited, edited] }));
assert.equal(model.validateDocument({ items: [] }).items.length, 0);
console.log("PASS: editor/mobile/server categories match; form preserves IDs/unknown fields; invalid dates, URLs and duplicates rejected");
