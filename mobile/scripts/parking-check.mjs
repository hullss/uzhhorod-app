import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Math, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; }, ...globals });
  return exports;
}
const payment = load("../src/payments/demoTransport.ts");
const parking = load("../src/payments/parkingSession.ts", { "./demoTransport": payment });
assert.equal(parking.PARKING_ZONES.length, 4);
assert.equal(new Set(parking.PARKING_ZONES.map(zone => zone.id)).size, 4);
const now = new Date("2026-10-13T10:00:00Z");
for (const zone of parking.PARKING_ZONES) {
  assert.equal(zone.hourlyKopiykas, 2500);
  for (const section of zone.sections) {
    assert.ok(section.length >= 2);
    for (const point of [...section, zone.center]) {
      assert.ok(Number.isFinite(point.latitude) && point.latitude > 48.61 && point.latitude < 48.63);
      assert.ok(Number.isFinite(point.longitude) && point.longitude > 22.28 && point.longitude < 22.31);
    }
  }
  for (let hours = 1; hours <= 8; hours++) {
    const draft = { zoneId: zone.id, plate: "AO1234AA", hours, last4: "4242", requestId: `parking_${zone.id}_${hours}` };
    const sessions = parking.applyParkingPayment([], draft, now);
    assert.equal(sessions[0].charges[0].amountKopiykas, hours * 2500);
    assert.equal(Date.parse(sessions[0].endsAt) - now.getTime(), hours * 3600000);
    assert.equal(parking.decodeParkingSessions(JSON.parse(JSON.stringify(sessions)))[0].zoneId, zone.id);
  }
}
assert.equal(parking.quoteParking("example-b", 2).amountKopiykas, 4000);
assert.ok(!parking.PARKING_ZONES.some(zone => zone.id.startsWith("example")));
assert.throws(() => parking.quoteParking("unknown-zone", 1));
console.log("PASS: four georeferenced presentation locations, 25 UAH/hour, 1–8 hour totals, persistence and legacy rates retained");

// Exercise the actual MapLibre component's hooks, not a duplicate of its logic.
const slots = [], effects = [], queued = [];
let cursor = 0, language = "uk";
const react = {
  createElement: (type, props, children) => ({ type, props: { ...props, children } }),
  useRef(value) { return slots[cursor++] ??= { current: value }; },
  useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; },
  useEffect(fn, deps) { const i = cursor++; if (!effects[i] || !deps.every((dep, index) => dep === effects[i].deps[index])) { effects[i] = { deps, fn }; queued.push(i); } },
};
const buttons = [], selected = [], sources = new Map(), layers = [], handlers = new Map(), styles = [];
const pointerHandlers = new Map(), windowHandlers = new Map(), interactionStates = [];
let creations = 0, flies = 0, removed = false, worker;
const map = { isStyleLoaded: () => true, getSource: id => sources.get(id), addSource(id, source) { sources.set(id, { ...source, setData(value) { this.data = value; } }); }, addLayer(layer) { layers.push(layer); }, setPaintProperty() {}, flyTo() { flies++; }, addControl() {}, scrollZoom: { disable() {} }, dragRotate: { disable() {} }, touchZoomRotate: { disableRotation() {} }, on(name, ...args) { handlers.set(name, args.at(-1)); }, setStyle(value) { styles.push(value); }, resize() {}, remove() { removed = true; } };
const sdk = {
  Map: function(options) { creations++; assert.equal(options.zoom, 17); assert.equal(options.style, 'https://tiles.openfreemap.org/styles/positron'); return map; },
  Marker: function() { return { setLngLat() { return this; }, addTo() { return this; }, remove() {} }; },
  NavigationControl: function() {}, AttributionControl: function() {}, setWorkerUrl(value) { worker = value; },
};
const document = { createElement() { const button = { style: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(_name, handler) { this.click = handler; } }; buttons.push(button); return button; } };
const { ParkingMap } = load("../src/components/ParkingMap.web.tsx", {
  react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, "react-native": { View: "View" },
  "../i18n/ui": { Text: "Text", useLanguage: () => [language] }, "../i18n/locale": { translate: text => text },
  "maplibre-gl": sdk, "maplibre-gl/dist/maplibre-gl.css": {},
}, { document, window: { addEventListener: (name, fn) => windowHandlers.set(name, fn), removeEventListener: name => windowHandlers.delete(name) } });
const props = { dark: false, zones: parking.PARKING_ZONES, selectedId: parking.PARKING_ZONES[0].id, onSelect: id => selected.push(id), onInteractionChange: value => interactionStates.push(value) };
function render(next = props) { cursor = 0; ParkingMap(next); slots[0].current ??= { querySelector: () => null, addEventListener: (name, fn) => pointerHandlers.set(name, fn), removeEventListener: name => pointerHandlers.delete(name) }; for (const i of queued.splice(0)) effects[i].cleanup = effects[i].fn(); }
render(); assert.equal(worker, "/vendor/maplibre-gl-worker.mjs");
assert.equal(buttons.length, 4); assert.equal(creations, 1); assert.equal(layers.length, 2); assert.equal(sources.get('parking-sections').data.features.length, 6);
buttons[1].click({ stopPropagation() {} }); assert.equal(selected[0], parking.PARKING_ZONES[1].id);
render(); assert.equal(flies, 0);
const second = { ...props, selectedId: parking.PARKING_ZONES[1].id };
render(second); assert.equal(flies, 1); assert.equal(buttons[1].attributes["aria-pressed"], "true");
render(second); assert.equal(flies, 1); assert.equal(creations, 1);
render({ ...second, dark: true }); assert.equal(styles.at(-1), "https://tiles.openfreemap.org/styles/dark"); assert.equal(flies, 1);
handlers.get('click')({ features: [{ properties: { id: props.selectedId } }] }); assert.equal(selected.at(-1), props.selectedId);
const before = selected.length; handlers.get('click')({ features: [{ properties: { id: "unknown" } }] }); assert.equal(selected.length, before);
handlers.get('error')(); assert.equal(slots[3], true); handlers.get('style.load')(); assert.equal(slots[3], false);
pointerHandlers.get('pointerdown')({ pointerId: 1 }); pointerHandlers.get('pointerdown')({ pointerId: 2 });
windowHandlers.get('pointerup')({ pointerId: 1 }); assert.equal(interactionStates.at(-1), true);
windowHandlers.get('pointercancel')({ pointerId: 2 }); assert.equal(interactionStates.at(-1), false);
pointerHandlers.get('pointerdown')({ pointerId: 3 }); windowHandlers.get('blur')(); assert.equal(interactionStates.at(-1), false);
for (const effect of effects) effect?.cleanup?.(); assert.equal(removed, true);
assert.equal(pointerHandlers.size, 0); assert.equal(windowHandlers.size, 0); assert.equal(interactionStates.at(-1), false);
console.log("PASS: actual web map creates four price buttons and six sections, synchronizes selection/theme, retains viewport, reports errors and releases resources");
const nativeEffects = [], nativeInteraction = [];
const nativeReact = { Fragment: 'Fragment', useRef: value => ({ current: value }), useEffect: fn => nativeEffects.push(fn) };
const nativeMap = load('../src/components/ParkingMap.native.tsx', { react: nativeReact, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, 'react-native': { View: 'View' }, 'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' }, '../i18n/ui': { Text: 'Text' }, '../i18n/locale': { translate: text => text } });
const nativeProps = nativeMap.ParkingMap({ ...props, onInteractionChange: value => nativeInteraction.push(value) }).props;
nativeProps.onTouchStart(); nativeProps.onRegionChangeComplete(); assert.equal(nativeInteraction.at(-1), true);
nativeProps.onTouchEnd({ nativeEvent: { touches: [{}] } }); assert.equal(nativeInteraction.at(-1), true);
nativeProps.onTouchEnd({ nativeEvent: { touches: [] } }); assert.equal(nativeInteraction.at(-1), false);
nativeProps.onRegionChange(); assert.equal(nativeInteraction.at(-1), true); nativeProps.onRegionChangeComplete(); assert.equal(nativeInteraction.at(-1), false);
nativeProps.onTouchStart(); nativeProps.onTouchCancel(); assert.equal(nativeInteraction.at(-1), false);
for (const effect of nativeEffects) effect()?.(); assert.equal(nativeInteraction.at(-1), false);
console.log('PASS: native/web map lock lasts through multi-touch, release/cancel/unmount restores page scrolling');
