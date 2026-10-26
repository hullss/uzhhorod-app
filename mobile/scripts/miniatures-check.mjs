import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function load(path, mocks = {}) {
  const exports = {};
  vm.runInNewContext(compile(readFileSync(new URL(path, import.meta.url), 'utf8')), { exports, URL, Date, Set,
    require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const records = load('../src/utils/records.ts');
const catalogues = load('../src/api/catalogues.ts', { '../utils/records': records });
const model = load('../src/miniatures/catalog.ts', { '../api/catalogues': catalogues });
const source = JSON.parse(readFileSync(new URL('../../backend/src/main/resources/mini-sculptures.json', import.meta.url)));
const catalog = model.decodeMiniatures(source);
assert.equal(catalog.sculptures.length, 83);
const yearOnly = catalog.sculptures.find(point => point.id === 'andrii-novak');
assert.equal(yearOnly.installedAt, null); assert.equal(yearOnly.installedYear, 2026);
const old = { ...catalog.sculptures.find(point => point.id === 'mikolaychyk') };
delete old.installedYear; delete old.sourceUrls;
const legacy = model.decodeMiniatures({ ...source, sculptures: [old] }).sculptures[0];
assert.equal(legacy.installedYear, 2010); assert.equal(legacy.sourceUrls.length, 0);
for (const patch of [{ latitude: 22.3 }, { longitude: 48.6 }, { latitude: NaN }, { installedAt: '2026-02-30' },
  { installedYear: 2011 }, { sourceUrls: ['javascript:alert(1)'] }, { address: '' }]) {
  assert.throws(() => model.decodeMiniatures({ ...source, sculptures: [{ ...old, installedYear: 2010, ...patch }] }));
}
assert.throws(() => model.decodeMiniatures({ ...source, sculptures: [old, old] }));
const before = JSON.stringify(catalog.sculptures);
assert.equal(model.searchMiniatures(catalog.sculptures, '  НОВАК ').length, 1);
assert.equal(model.searchMiniatures(catalog.sculptures, 'Малий Уж')[0].id, 'malyi-uzh');
assert.equal(model.searchMiniatures(catalog.sculptures, 'Малий Уж').length, 1);
assert.equal(model.searchMiniatures(catalog.sculptures, 'Колодко відновлення').length, 4);
assert.equal(model.searchMiniatures(catalog.sculptures, 'неіснуюча локація').length, 0);
assert.equal(model.searchMiniatures(catalog.sculptures, '   '), catalog.sculptures);
assert.equal(JSON.stringify(catalog.sculptures), before);
console.log('PASS: expanded catalogue and legacy response decode safely; swapped coordinates, duplicate IDs, invalid dates/years/links fail; search normalizes and preserves data');

const app = ts.createSourceFile('App.tsx', readFileSync(new URL('../App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const card = app.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'MiniatureCard');
const jsx = (type, props) => ({ type, props });
const context = { exports: {}, URL, View: 'View', Text: 'Text', Pressable: 'Button', Ionicons: 'Icon', styles: {}, COLORS: {},
  openOfficialLink: url => { context.opened = url; }, require: () => ({ jsx, jsxs: jsx }) };
vm.createContext(context); vm.runInContext(compile(card.getText(app)), context);
const tree = context.MiniatureCard({ sculpture: yearOnly, index: 1 });
const nodes = item => !item || typeof item !== 'object' ? [] : Array.isArray(item) ? item.flatMap(nodes) : [item, ...nodes(item.props?.children)];
const buttons = nodes(tree).filter(node => node.type === 'Button');
assert.equal(buttons.length, 1 + yearOnly.sourceUrls.length);
buttons[0].props.onPress(); assert.ok(context.opened.includes(`${yearOnly.latitude},${yearOnly.longitude}`));
buttons[1].props.onPress(); assert.equal(context.opened, yearOnly.sourceUrls[0]);
assert.equal(nodes(tree).filter(node => node.props?.children === yearOnly.summary).length, 1);
console.log('PASS: actual miniature card accepts year-only metadata and opens its own coordinates and cited source');
