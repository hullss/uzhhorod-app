import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function load(path, mocks) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Map, Set, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const { navigationPath } = load("../src/ui/navigation.ts", {});
const base = { section: "hub", activeTab: "services", profilePanel: null, profileReturn: null, weatherOpen: false,
  paymentMethodsInCheckout: false, mapOpen: false, scheduleOpen: false, searchMode: "routes", showDataSources: false, loading: false, error: false };
const path = patch => navigationPath({ ...base, ...patch });
const keys = patch => Array.from(path(patch), frame => frame.key);
assert.deepEqual(keys({}), ["services"]);
for (const serviceId of ["parking", "transport-payment", "cnap", "polls", "events", "shelters", "waste", "power-outages", "accessibility", "miniatures", "donations"]) {
  assert.deepEqual(keys({ serviceId }), ["services", `service:${serviceId}`]);
}
assert.deepEqual(keys({ activeTab: "home", serviceId: "transport-payment" }), ["home", "service:transport-payment"]);
assert.deepEqual(keys({ activeTab: "profile", serviceId: "transport-payment", paymentMethodsInCheckout: true }), ["profile", "service:transport-payment", "checkout-card"]);
assert.deepEqual(keys({ activeTab: "profile", profilePanel: "notifications", profileReturn: "settings" }), ["profile", "profile:settings", "profile:notifications"]);
assert.deepEqual(keys({ activeTab: "profile", profilePanel: "settings" }), ["profile", "profile:settings"]);
assert.deepEqual(keys({ activeTab: "profile", profilePanel: "account", profileReturn: "settings" }), ["profile", "profile:settings", "profile:account"]);
assert.deepEqual(keys({ activeTab: "profile", profilePanel: "account", profileReturn: "favorites" }), ["profile", "profile:favorites", "profile:account"]);
assert.deepEqual(keys({ section: "transport", transportFromFavorites: true, routeId: "7", mapOpen: true }), ["profile", "profile:favorites", "route:7", "route-map:7"]);
assert.deepEqual(keys({ section: "transport", transportFromFavorites: true, stopId: "45", routeId: "7" }), ["profile", "profile:favorites", "stop:45", "route:7"]);
assert.deepEqual(keys({ section: "transport", transportFromFavorites: true, loading: true }), ["profile", "profile:favorites", "loading"]);
assert.deepEqual(keys({ activeTab: "feed", articleId: "article-one" }), ["feed", "article:article-one"]);
assert.deepEqual(keys({ activeTab: "home", weatherOpen: true }), ["home", "weather"]);
assert.deepEqual(keys({ section: "transport", routeId: "7", mapOpen: true }), ["services", "transport", "route:7", "route-map:7"]);
assert.deepEqual(keys({ section: "transport", searchMode: "stops", routeId: "7", scheduleOpen: true }), ["services", "transport", "transport-stops", "route:7", "schedule:7"]);
assert.deepEqual(keys({ section: "transport", searchMode: "stops", stopId: "45" }), ["services", "transport", "transport-stops", "stop:45"]);
assert.deepEqual(keys({ section: "transport", routeId: "7", loading: true }), ["services", "transport", "route:7", "loading"]);
assert.deepEqual(keys({ section: "transport", routeId: "7", error: true }), ["services", "transport", "route:7", "error"]);
console.log("PASS: actual navigation ancestry for every service, checkout/card, profile/settings, news/weather, routes/stops/map/schedule and failures");

const jsx = (type, props) => ({ type, props });
function hooks() {
  const slots = [], effects = [], cleanups = []; let cursor = 0;
  return { start() { cursor = 0; }, flush() { for (const effect of effects.splice(0)) { const cleanup = effect(); if (typeof cleanup === "function") cleanups.push(cleanup); } }, unmount() { for (const cleanup of cleanups.splice(0)) cleanup(); }, react: {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!deps || !slots[i] || deps.some((value, j) => value !== slots[i][j])) { slots[i] = deps; effects.push(fn); } },
    useLayoutEffect(fn, deps) { const i = cursor++; if (!deps || !slots[i] || deps.some((value, j) => value !== slots[i][j])) { slots[i] = deps; effects.push(fn); } },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, j) => value !== slots[i].deps[j])) slots[i] = { deps, value: fn() }; return slots[i].value; },
  } };
}
let focused = true;
const activity = { ScreenActivity: { Provider: "Activity" }, useScreenActive: () => focused };
const h = hooks();
const stack = load("../src/ui/ScreenStack.tsx", { react: h.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": { View: "View", Platform: { OS: "web" }, StyleSheet: { create: value => value, absoluteFill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 } } }, "./ScreenActivity": activity });
function render(patch, retainRoots = true) {
  h.start(); const tree = stack.ScreenStack({ frames: path(patch), retainRoots, render: frame => frame.key, backgroundColor: "#071b2f" }); h.flush(); return tree;
}
const layers = tree => tree.props.children.map(layer => layer.type(layer.props));
render({ activeTab: "home" }); render({});
let tree = render({ serviceId: "transport-payment" });
assert.equal(layers(tree).length, 3); // Home retained; services is the real back destination.
const service = layers(tree).find(layer => layer.props.children.props.children === "services");
const checkout = layers(tree).find(layer => layer.props.children.props.children === "service:transport-payment");
assert.equal(service.props.value, false); assert.equal(checkout.props.value, true);
assert.equal(service.props.children.props.pointerEvents, "none");
assert.equal(service.props.children.props.importantForAccessibility, "no-hide-descendants");
assert.equal(service.props.children.props.inert, true, "hidden web controls are also excluded from keyboard tabbing");
assert.equal(checkout.props.children.props.inert, false);
assert.equal(service.props.children.props.style[1].display, "flex");
assert.equal(checkout.props.children.props.style[1].display, "flex");
assert.equal(checkout.props.children.props.style[1].backgroundColor, undefined, "no opaque wrapper hiding the previous page");
tree = render({});
assert.equal(layers(tree).length, 2); assert.equal(layers(tree).at(-1).props.children.props.children, "services");
assert.ok(!layers(tree).some(layer => layer.props.children.props.children === "service:transport-payment"));
focused = false;
tree = render({ serviceId: "parking" });
assert.ok(layers(tree).every(layer => layer.props.value === false && layer.props.children.props.pointerEvents === "none"));
focused = true;
console.log("PASS: actual layered views keep roots/ancestors, reveal the preceding screen, hide it from input/VoiceOver, pop descendants and respect parent focus");

const local = hooks();
const localStack = load("../src/ui/ScreenStack.tsx", { react: local.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": { View: "View", StyleSheet: { create: value => value } }, "./ScreenActivity": activity });
const choose = { scroll: 240, plate: "AO 1234 AA" }, review = { passengers: 3 };
local.start(); localStack.LocalScreenStack({ path: ["choose"], children: choose, backgroundColor: "#071b2f" });
local.start(); let steps = localStack.LocalScreenStack({ path: ["choose", "review"], children: review, backgroundColor: "#071b2f" });
assert.equal(steps.props.render({ key: "choose" }), choose);
assert.equal(steps.props.render({ key: "review" }), review);
assert.equal(steps.props.backgroundColor, "transparent", "first local step must reveal the enclosing navigator");
local.start(); steps = localStack.LocalScreenStack({ path: ["choose"], children: choose, backgroundColor: "#071b2f" });
assert.equal(steps.props.frames.length, 1); assert.equal(steps.props.render({ key: "review" }), undefined);
console.log("PASS: actual local step cache retains prior content/scroll identity and removes popped steps without masking the enclosing screen");

const sh = hooks();
const native = { Animated: { View: "AnimatedView", Value: class { value = 0; setValue(value) { this.value = value; } stopAnimation() {} }, spring: (value, config) => ({ start() { value.setValue(config.toValue); } }), timing: (value, config) => ({ start(cb) { value.setValue(config.toValue); cb?.({ finished: true }); } }) }, PanResponder: { create: handlers => ({ panHandlers: handlers }) }, useWindowDimensions: () => ({ width: 390 }), StyleSheet: { create: value => value } };
const screen = load("../src/ui/Screen.tsx", { react: sh.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": native, "react-native-safe-area-context": { SafeAreaView: "SafeArea" }, "./ScreenActivity": activity });
let backs = 0;
sh.start(); let swipe = screen.useAnimatedBack(() => backs++); sh.flush();
swipe.onPanResponderMove(null, { dx: 80, numberActiveTouches: 1 });
assert.equal(swipe.swipeProgress.value, 80);
swipe.onPanResponderRelease(null, { dx: 260, vx: .1, numberActiveTouches: 0 });
assert.equal(backs, 1);
assert.equal(swipe.swipeProgress.value, 390, "outgoing page stays offscreen while React has not committed the navigation yet");
assert.equal(swipe.onMoveShouldSetPanResponderCapture(null, { dx: 180, dy: 0, x0: 0, numberActiveTouches: 1 }), false, "cannot commit the same swipe twice");
sh.start(); swipe = screen.useAnimatedBack(() => backs++); sh.flush();
assert.equal(swipe.swipeProgress.value, 0, "retained form hook resets in layout phase of the committed previous step");
assert.equal(swipe.onMoveShouldSetPanResponderCapture(null, { dx: 180, dy: 0, x0: 0, numberActiveTouches: 1 }), true);
console.log("PASS: successful swipe holds the outgoing screen offscreen until the React commit; local steps reset before paint, with no zero-position flash");
focused = false; sh.start(); swipe = screen.useAnimatedBack(() => backs++); sh.flush();
assert.equal(swipe.swipeProgress.value, 0);
assert.equal(swipe.onMoveShouldSetPanResponderCapture(null, { dx: 180, dy: 0, x0: 0, numberActiveTouches: 1 }), false);
const previous = screen.ScreenSafeArea({ swipeProgress: swipe.swipeProgress, style: { backgroundColor: "white" } });
assert.equal(previous.props.style.at(-1), false, "underlying page never inherits the foreground translation");
focused = true;
assert.ok(screen.ScreenSafeArea({ swipeProgress: swipe.swipeProgress }).props.style.at(-1).transform);
console.log("PASS: real swipe resets when hidden and cannot move the retained background screen");

const delayedHooks = hooks(); let pendingFinish, finishDuration, delayedBacks = 0;
const delayedNative = { ...native, Animated: { ...native.Animated, timing: (_value, config) => ({ start(callback) { pendingFinish = callback; finishDuration = config.duration; } }) } };
const delayedScreen = load("../src/ui/Screen.tsx", { react: delayedHooks.react, "react/jsx-runtime": { jsx, jsxs: jsx }, "react-native": delayedNative, "react-native-safe-area-context": { SafeAreaView: "SafeArea" }, "./ScreenActivity": activity });
delayedHooks.start(); let delayedSwipe = delayedScreen.useAnimatedBack(() => delayedBacks++); delayedHooks.flush();
delayedSwipe.onPanResponderRelease(null, { dx: 370, vx: .1, numberActiveTouches: 0 });
assert.equal(finishDuration, 70, "almost-complete swipe should not wait a fixed 160 ms for the last pixels");
focused = false;
delayedHooks.start(); delayedSwipe = delayedScreen.useAnimatedBack(() => delayedBacks++); delayedHooks.flush();
pendingFinish({ finished: true });
assert.equal(delayedBacks, 0, "late native completion must not navigate after focus was lost");
assert.equal(delayedSwipe.swipeProgress.value, 0);
focused = true;
delayedHooks.start(); delayedSwipe = delayedScreen.useAnimatedBack(() => delayedBacks++); delayedHooks.flush();
delayedSwipe.onPanResponderRelease(null, { dx: 120, vx: .1, numberActiveTouches: 0 });
delayedHooks.unmount(); pendingFinish({ finished: true });
assert.equal(delayedBacks, 0, "late completion after unmount cannot pop a second page");
console.log("PASS: completion duration follows remaining distance; late callbacks after cancellation/unmount cannot navigate");
