import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["ServiceGridCard", "DashboardServiceCard"]);
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
const jsx = (type, props) => ({ type, props });
const resolve = tree => typeof tree?.type === "function" ? resolve(tree.type(tree.props)) : tree;
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const code = ts.transpileModule(declarations.map(node => node.getText(ast)).join("\n"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = { exports: {}, Pressable: "Button", Text: "Text", View: "View", Ionicons: "Icon", styles: {}, COLORS: {},
  require: name => { assert.equal(name, "react/jsx-runtime"); return { jsx, jsxs: jsx }; } };
vm.createContext(context); vm.runInContext(code, context);
for (const name of names) {
  let pressed = 0;
  const props = { icon: "car-outline", title: "Паркування", onPress: () => pressed++ };
  const normal = resolve(context[name](props)), test = resolve(context[name]({ ...props, testScenario: true }));
  assert.equal(nodes(normal).filter(node => node.props?.children === "Тестовий сценарій").length, 0);
  assert.equal(nodes(test).filter(node => node.props?.children === "Тестовий сценарій").length, 1);
  test.props.onPress(); assert.equal(pressed, 1);
}
const serviceDeclaration = ast.statements.find(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "CITY_SERVICES"));
const serviceCode = ts.transpileModule(serviceDeclaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const services = vm.runInNewContext(`${serviceCode}\nCITY_SERVICES;`);
assert.deepEqual(Array.from(services.filter(service => service.testScenario), service => service.id).sort(), ["cnap", "parking", "polls", "transport-payment"]);
assert.ok(source.includes("testScenario={service.testScenario}"));
assert.ok(source.includes("Позиції з DozoR")); assert.ok(!source.includes("Наживо ·"));
assert.ok(source.includes("Останні новини"));
const parking = readFileSync(new URL("../src/components/ParkingDemoScreen.tsx", import.meta.url), "utf8");
assert.ok(!parking.includes("наданими скрінами"));
console.log("PASS: actual home/catalogue cards mark only test operations once, keep actions, and never label fetched positions as measured live GPS");
