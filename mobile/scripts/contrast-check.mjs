import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const pairs = [
  ["Світла: основний текст", "#596574", "#ffffff"],
  ["Світла: metadata", "#66758a", "#ffffff"],
  ["Світла: заголовок", "#102d49", "#f6f7fb"],
  ["Світла: основна дія", "#123a63", "#ffffff"],
  ["Світла: попередження", "#624600", "#fff8e9"],
  ["Світла: помилка", "#991b1b", "#fff5f4"],
  ["Темна: основний текст", "#b8cbe0", "#102d49"],
  ["Темна: metadata", "#91a9bf", "#102d49"],
  ["Темна: заголовок у картці", "#f3f7fc", "#102d49"],
  ["Темна: основна дія", "#ffffff", "#174b75"],
  ["Темна: попередження", "#f4d47a", "#332b22"],
  ["Темна: помилка", "#ffb4ad", "#332b22"],
  ["Темна: маршрут", "#ffffff", "#174b75"],
  ["Темна: border контролу", "#7399b9", "#102d49"],
  ["Оплата світла: текст", "#0f1d2a", "#ffffff"],
  ["Оплата світла: підпис", "#5b6b7c", "#eef4ff"],
  ["Оплата світла: кнопка", "#ffffff", "#123a63"],
  ["Оплата темна: текст", "#f3f7fc", "#102d49"],
  ["Оплата темна: підпис", "#a9bed3", "#153a59"],
  ["Оплата темна: кнопка", "#ffffff", "#174b75"],
  ["Сканер: підказка", "#ffffff", "#071b2f"],
];

function luminance(hex) {
  const values = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const [r, g, b] = values.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

let failed = false;
for (const [label, foreground, background] of pairs) {
  const value = ratio(foreground, background);
  const passes = value >= 4.5;
  console.log(`${passes ? "PASS" : "FAIL"}  ${value.toFixed(2)}:1  ${label}`);
  failed ||= !passes;
}

if (failed) process.exitCode = 1;

// Read actual resolved styles, including the app's dark-theme transformation.
const app = ts.createSourceFile("App.tsx", readFileSync(new URL("../App.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name) {
  for (const statement of app.statements) {
    if (ts.isVariableStatement(statement)) for (const item of statement.declarationList.declarations) if (item.name.getText(app) === name) return `const ${item.getText(app)};`;
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement.getText(app);
  }
  throw Error(`Missing actual style definition: ${name}`);
}
const tokensCode = ts.transpileModule(readFileSync(new URL("../src/ui/themeTokens.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const tokens = { exports: {} }; vm.runInNewContext(tokensCode, tokens);
const context = { exports: {}, COLOR_TOKENS: tokens.exports.COLOR_TOKENS, FONTS: {}, PAGE_LAYOUT: {}, StyleSheet: { create: value => value, hairlineWidth: 1 } };
const actual = [declaration("LIGHT_COLORS"), declaration("DARK_COLORS"), "const COLORS = LIGHT_COLORS;", declaration("STYLE_DEFINITIONS"), declaration("themedStyleValue"), declaration("buildStyles"), "exports.light = buildStyles(false); exports.dark = buildStyles(true);"];
vm.runInNewContext(ts.transpileModule(actual.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const resolvedPairs = [["pageTitle", "screen"], ["settingsPageDescription", "screen"], ["routeName", "routeCard"], ["mapGpsStatusText", "mapGpsStatus"], ["routeDetailRouteNumber", "routeDetailRouteBadge"], ["routeDetailRouteLabel", "screen"]];
for (const mode of ["light", "dark"]) for (const [text, surface] of resolvedPairs) {
  const foreground = context.exports[mode][text]?.color; const background = context.exports[mode][surface]?.backgroundColor;
  assert.ok(/^#[0-9a-f]{6}$/i.test(foreground ?? "") && /^#[0-9a-f]{6}$/i.test(background ?? ""), `Missing resolved colours: ${text}/${surface}`);
  assert.ok(ratio(foreground, background) >= 4.5, `${mode}: ${text}/${surface}: ${ratio(foreground, background).toFixed(2)}:1`);
}
console.log("PASS: actual app styles in both themes: headers, descriptions, route names/numbers and text above map");

function actualFunction(path, name) {
  const ast = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, name); return declaration.getText(ast).replace(/^export /, "");
}
const serviceContext = { exports: {}, themeTokens: tokens.exports.themeTokens, APP_FONTS: {}, PAGE_LAYOUT: {}, StyleSheet: { create: value => value } };
const serviceCode = [actualFunction("../src/components/CivicServiceUI.tsx", "civicTheme"), actualFunction("../src/components/CivicServiceUI.tsx", "civicStyles"), actualFunction("../src/components/DemoTransportPaymentScreen.tsx", "makeStyles"), "exports.civic = civicStyles; exports.payment = makeStyles;"];
vm.runInNewContext(ts.transpileModule(serviceCode.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, serviceContext);
for (const dark of [false, true]) {
  const s = serviceContext.exports.civic(dark); const p = serviceContext.exports.payment(dark); const c = tokens.exports.themeTokens(dark);
  const actualPairs = [
    [s.headerTitle.color, s.header.backgroundColor], [s.body.color, c.bg], [s.body.color, c.surface],
    [s.muted.color, c.bg], [s.muted.color, c.surface], [s.muted.color, c.soft],
    [s.buttonText.color, s.button.backgroundColor], [s.buttonDisabledText.color, s.buttonDisabled.backgroundColor],
    [s.link.color, c.soft], [s.rowText.color, c.surface],
    [p.optionTitle.color, p.scanButton.backgroundColor], [p.optionHint.color, p.scanButton.backgroundColor],
    [p.helper.color, c.bg], [p.noteText.color, c.bg], [p.error.color, c.bg],
    [p.primaryText.color, p.primary.backgroundColor], [p.paymentFootnote.color, c.bg],
    [p.ticketWarningText.color, p.ticket.backgroundColor], [p.ticketTitle.color, p.ticket.backgroundColor],
    [c.muted, c.soft], // Disabled checkout while history is unavailable.
  ];
  for (const [foreground, background] of actualPairs) assert.ok(ratio(foreground, background) >= 4.5, `${dark ? "dark" : "light"} actual service contrast: ${foreground}/${background}`);
}
console.log("PASS: 40 actual civic/payment text/background pairs, including errors, secondary/disabled actions and receipt warnings");
