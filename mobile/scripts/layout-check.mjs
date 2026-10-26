import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Check the real style definitions, not a second copy of the spacing values.
function readAst(path) {
  return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function initializer(ast, name) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, `Не знайдено ${name}`);
  return result.getText(ast);
}
function evaluate(expression, context = {}) {
  const { outputText } = ts.transpileModule(`globalThis.result = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const sandbox = { ...context };
  runInNewContext(outputText, sandbox);
  return sandbox.result;
}
const PAGE_LAYOUT = evaluate(initializer(readAst("../src/ui/layout.ts"), "PAGE_LAYOUT"));
const app = readAst("../App.tsx");
const placeholder = new Proxy({}, { get: () => "unused" });
const styles = evaluate(initializer(app, "STYLE_DEFINITIONS"), {
  PAGE_LAYOUT, COLORS: placeholder, FONTS: placeholder, StyleSheet: { create: (value) => value },
});

for (const name of ["screen", "transportScreen", "transportDetailScreen", "mapScreen", "cityMapScreen"]) {
  assert.equal(styles[name].paddingHorizontal ?? 0, 0, `${name}: відступ не повинен дублюватися на корені`);
}
console.log("PASS: корені екранів не додають другий боковий відступ");

// ScreenSafeArea adds a real native SafeAreaView inside its animated root.
// Root justifyContent cannot center grandchildren across that extra boundary.
assert.equal(styles.brandIntroBody.flex, 1);
assert.equal(styles.brandIntroBody.alignItems, "center");
assert.equal(styles.brandIntroBody.justifyContent, "center");
assert.equal(styles.brandIntroContent.marginTop ?? 0, 0);
assert.equal(styles.brandIntroContent.width, "100%");
assert.equal(styles.brandIntroTitle.textAlign, "center");
assert.equal(styles.brandIntroSubtitle.textAlign, "center");
assert.equal(styles.brandIntroFooter.left, styles.brandIntroFooter.right);
assert.equal(styles.brandIntroFooter.justifyContent, "center");
const intro = app.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "BrandIntro");
assert.ok(intro.getText(app).includes('<View style={styles.brandIntroBody}>'));
for (const name of ["LoadingScreen", "ErrorScreen"]) {
  const component = app.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(component.getText(app).includes('<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.centered}>'));
}
console.log("PASS: startup centers within the real safe area; loading/error scroll views fill the space below the fixed header");

for (const name of ["settingsContent", "cnapContent", "hubContent", "dashboardContent", "defendersContent", "weatherContent", "simpleTabContent", "serviceDetailsContent", "silenceContent", "paymentContent", "eventsContent", "parkingContent", "routeDetailsContent", "sourcesList"]) {
  assert.equal(styles[name].paddingHorizontal, PAGE_LAYOUT.gutter, name);
  assert.equal(styles[name].paddingTop, PAGE_LAYOUT.top, name);
  assert.equal(styles[name].paddingBottom, PAGE_LAYOUT.bottom, name);
}
console.log("PASS: 14 контейнерів сторінок мають однакові краї та верхній/нижній відступ");

const newsStyles = evaluate(initializer(readAst("../src/components/NewsArticleScreen.tsx"), "ui"), {
  PAGE_LAYOUT, APP_FONTS: placeholder, StyleSheet: { create: value => value },
});
assert.equal(newsStyles.content.paddingHorizontal, PAGE_LAYOUT.gutter);
assert.equal(newsStyles.content.paddingBottom, PAGE_LAYOUT.bottom);
assert.equal(newsStyles.content.paddingTop, PAGE_LAYOUT.section);
assert.equal(newsStyles.content.width, "100%");
for (const name of ["back", "link", "original"]) assert.ok(newsStyles[name].minHeight >= 44, name);
assert.ok(newsStyles.paragraph.fontSize >= 16 && newsStyles.paragraph.lineHeight >= 24);
for (const name of ["title", "paragraph", "metadata"]) assert.equal(newsStyles[name].height, undefined);
console.log("PASS: новий читач має спільні краї, читабельний текст, гнучкі висоти й 44+ touch-зони");

assert.equal(styles.bottomNavigation.marginHorizontal ?? 0, 0);
assert.ok(styles.tabButton.minHeight >= 44);
for (const name of ["profileRow", "settingsChoice", "pollOption", "cnapSelect", "cnapOption", "cnapSubmitButton", "accountActionButton", "accountDeleteButton", "accountMode", "paymentCardInput", "paymentSubmitButton"]) {
  assert.ok(styles[name].minHeight >= 44, name);
  assert.ok(styles[name].paddingVertical >= PAGE_LAYOUT.fieldGap, `${name}: місце для багаторядкового тексту`);
}
console.log("PASS: навігація не виходить за екран, у рядках і формах є внутрішній вертикальний простір");

for (const [grid, card] of [["serviceGrid", "serviceGridCard"], ["dashboardServicesGrid", "dashboardServiceCard"]]) {
  for (const width of [320, 360, 390, 430]) {
    const content = width - PAGE_LAYOUT.gutter * 2;
    const columns = styles[grid].flexDirection === "column" ? 1 : 2;
    const occupied = content * (parseFloat(styles[card].width) * columns + parseFloat(styles[grid].columnGap ?? "0") * (columns - 1)) / 100;
    assert.ok(Math.abs(occupied - content) < 0.01, `${grid}: картки та проміжки мають вміщатися при ${width}px`);
  }
}
console.log("PASS: картки сервісів розраховані для ширин 320/360/390/430 px");

// Fixed headers must own an explicit gutter; SafeAreaView padding is unreliable on iOS.
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(app) === "SafeAreaView") {
    for (const child of node.children) {
      const tag = ts.isJsxSelfClosingElement(child) ? child.tagName.getText(app) : "";
      assert.notEqual(tag, "CivicHeader", "Заголовок не можна залишати без контейнера відступів");
    }
  }
  ts.forEachChild(node, visit);
}
visit(app);
console.log("PASS: усі фірмові заголовки мають контейнер відступів");
console.log("Це регресійна перевірка стилів, не заміна тесту клавіатури та safe-area на фізичному телефоні.");
