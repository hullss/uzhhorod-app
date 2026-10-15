import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => { if (name === "../i18n/locale") return { getLocale: () => "uk-UA", translate: value => value }; assert.ok(name in dependencies, name); return dependencies[name]; }, URL, Error, Intl, Date });
  return exports;
}
const news = load("../src/news/article.ts");
const { decodeOfficialNewsArticle, safeNewsUrl, newsDateLabel } = news;
assert.equal(newsDateLabel("жовтня 08, 2026"), "8 жовтня 2026");
const item = { title: "Новина", sourceUrl: "https://rada-uzhgorod.gov.ua/post/test", publishedLabel: "жовтня 08, 2026" };
const full = { ...item, preview: "Короткий опис", fullTextAvailable: true, blocks: [
  { type: "paragraph", text: "Повний текст. ".repeat(100) }, { type: "heading", text: "Подробиці" }, { type: "listItem", text: "• Останній пункт" },
], links: [{ title: "Документ", url: "https://rada-uzhgorod.gov.ua/media/file.pdf" }], imageUrl: "https://rada-uzhgorod.gov.ua/media/photo.jpg" };
assert.equal(decodeOfficialNewsArticle(full, item).blocks[0].text, full.blocks[0].text);
assert.equal(decodeOfficialNewsArticle(full, item).fullTextAvailable, true);
console.log("PASS: повний текст понад 720 символів, заголовки й списки не обрізаються");

for (const value of [{ preview: "Старий сервер" }, { ...full, blocks: [] }, { ...full, blocks: [{ type: "html", text: "unexpected" }] }, { ...full, fullTextAvailable: false }]) {
  assert.equal(decodeOfficialNewsArticle(value, item).fullTextAvailable, false);
  assert.equal(decodeOfficialNewsArticle(value, item).blocks.length, 0);
}
assert.throws(() => decodeOfficialNewsArticle(null, item));
assert.equal(decodeOfficialNewsArticle({ preview: "Опубліковано: жовтня 08, 2026\n\nОб&rsquo;єднання &ndash; &#x423;жгород" }, item).preview, "Об’єднання – Ужгород");
console.log("PASS: старий сервер, порожня й пошкоджена стаття не видаються за повний матеріал");

for (const url of ["javascript:alert(1)", "file:///private", "https://user:password@example.com", "/relative"]) assert.equal(safeNewsUrl(url), null);
assert.equal(decodeOfficialNewsArticle({ ...full, imageUrl: "https://tracking.example/image.jpg" }, item).imageUrl, null);
assert.equal(decodeOfficialNewsArticle({ ...full, sourceUrl: "https://other.example" }, item).sourceUrl, item.sourceUrl);
assert.equal(decodeOfficialNewsArticle({ ...full, links: [...full.links, ...full.links, { title: "unsafe", url: "javascript:alert(1)" }] }, item).links.length, 1);
console.log("PASS: небезпечні URL відсіюються, джерело не підміняється, посилання не дублюються");

const { LatestRequest } = load("../src/utils/latestRequest.ts");
const slots = [], effects = [], pending = [], jobs = [];
let cursor = 0, dirty = false, tree;
const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; dirty = true; }]; },
  useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  useEffect(callback, deps) { const i = cursor++; if (!equal(effects[i]?.deps, deps)) { pending.push({ i, callback }); effects[i] = { deps, cleanup: effects[i]?.cleanup }; } },
};
const jsx = (type, props) => ({ type, props });
const native = Object.fromEntries(["ActivityIndicator", "Image", "Pressable", "SafeAreaView", "ScrollView", "Text", "View"].map(name => [name, name]));
native.StyleSheet = { create: value => value };
native.Image = Object.assign(function Image() {}, { getSize(_url, success) { success(1600, 1000); } });
const { NewsArticleScreen } = load("../src/components/NewsArticleScreen.tsx", {
  react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" }, "react-native": native,
  "../i18n/ui": native,
  "../ui/Screen": { ScreenSafeArea: "SafeAreaView" },
  "expo-status-bar": { StatusBar: "StatusBar" }, "@expo/vector-icons": { Ionicons: "Icon" },
  "../api/cityServices": { getOfficialNewsArticle: item => new Promise((resolve, reject) => jobs.push({ item, resolve, reject })) },
  "../utils/latestRequest": { LatestRequest }, "../news/article": news, "../ui/fonts": { APP_FONTS: {} }, "../ui/layout": { PAGE_LAYOUT: {} },
  "./CivicServiceUI": { civicStyles: () => ({}), civicTheme: () => ({}), ServiceHeader: "ServiceHeader", useServiceSwipeBack: () => ({}) },
});
const openedLinks = [];
let props = { item, dark: false, backLabel: "До стрічки", onBack() {}, async onOpenLink(url) { openedLinks.push(url); } };
function render() {
  for (let pass = 0; pass < 12; pass++) {
    dirty = false; cursor = 0; tree = NewsArticleScreen(props);
    for (const { i, callback } of pending.splice(0)) { effects[i].cleanup?.(); effects[i].cleanup = callback(); }
    if (!dirty) return tree;
  }
  throw new Error("Render did not settle");
}
const text = node => node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node)
  : Array.isArray(node) ? node.map(text).join(" ") : text(node.props?.children);
const nodes = node => !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const settle = async () => { await new Promise(setImmediate); render(); };
render(); props = { ...props, item: { ...item, sourceUrl: "https://rada-uzhgorod.gov.ua/post/second", title: "Друга новина" } }; render();
jobs[0].resolve(decodeOfficialNewsArticle({ ...full, title: "Застаріла відповідь" }, item)); await settle();
assert.ok(!text(tree).includes("Застаріла відповідь"));
jobs[1].resolve(decodeOfficialNewsArticle(full, props.item)); await settle();
assert.ok(text(tree).includes(full.blocks[0].text)); assert.ok(!text(tree).includes("Коротко"));
assert.equal(nodes(tree).filter(node => node.props?.accessibilityRole === "link").length, 2);
nodes(tree).filter(node => node.props?.accessibilityRole === "link").forEach(node => node.props.onPress());
assert.deepEqual(openedLinks, [full.links[0].url, props.item.sourceUrl]);
console.log("PASS: читач ігнорує застарілий запит та показує весь текст і дієві посилання");

props = { ...props, item }; render(); jobs[2].resolve(decodeOfficialNewsArticle({ preview: "Лише опис" }, item)); await settle();
assert.ok(text(tree).includes("Коротко")); assert.ok(text(tree).includes("Не вдалося отримати повний текст"));
console.log("PASS: короткий огляд явно позначений у реальному компоненті читача");

props = { ...props, item: { ...item, sourceUrl: "https://rada-uzhgorod.gov.ua/post/error" } }; render(); jobs[3].reject(new Error("Спробуйте ще раз пізніше")); await settle();
assert.ok(text(tree).includes("Спробуйте ще раз пізніше"));
nodes(tree).find(node => node.type === "Pressable" && text(node).includes("Спробувати ще раз")).props.onPress(); render();
jobs[4].resolve(decodeOfficialNewsArticle(full, props.item)); await settle();
assert.ok(text(tree).includes(full.blocks[0].text)); assert.ok(!text(tree).includes("Спробуйте ще раз пізніше"));
console.log("PASS: повторне завантаження після помилки повертає статтю");

props = { ...props, item }; render(); effects.forEach(effect => effect?.cleanup?.());
dirty = false; jobs[5].resolve(decodeOfficialNewsArticle(full, item)); await new Promise(setImmediate);
assert.equal(dirty, false);
console.log("PASS: завершений запит не змінює стан після виходу зі статті");
