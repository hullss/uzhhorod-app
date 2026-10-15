import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function moduleUrl(path, replacements = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  for (const [specifier, url] of Object.entries(replacements)) outputText = outputText.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}

const requestUrl = moduleUrl("../src/api/request.ts");
const { ApiError, requestJson } = await import(requestUrl);
const { recoverAccountSession, isExpiredAccountSession, registerAccount, deleteAccount, logoutAccount, updateAccountPreferences } = await import(moduleUrl("../src/api/account.ts", { "./request": requestUrl }));
const { LatestRequest } = await import(moduleUrl("../src/utils/latestRequest.ts"));
const { isFreshSnapshot } = await import(moduleUrl("../src/utils/freshness.ts"));
const { cityClock, cityDate, citySeconds } = await import(moduleUrl("../src/utils/cityTime.ts"));
const originalFetch = globalThis.fetch;
const session = { accessToken: "test-token", preferences: { email: "test@example.com", language: "uk", alert: true, news: true, transport: false, silence: false }, favorites: { routeIds: ["r1"], stopIds: [] } };
let checks = 0;
async function check(name, callback) { await callback(); checks++; console.log(`PASS: ${name}`); }

try {
  await check("успішна відповідь і порожній DELETE", async () => {
    globalThis.fetch = async () => new Response('{"ok":true}');
    assert.deepEqual(await requestJson("/test", "error"), { ok: true });
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await requestJson("/test", "error"), undefined);
  });
  await check("мережева помилка без технічних підписів", async () => {
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(requestJson("/test", "error"), (error) => error instanceof ApiError && error.status === null && !error.message.includes("EXPO_PUBLIC_API_URL"));
  });
  await check("тайм-аут, включно з завислим тілом відповіді", async () => {
    let signal;
    globalThis.fetch = async (_url, init) => {
      signal = init.signal;
      return { ok: true, status: 200, headers: new Headers(), text: () => new Promise(() => {}) };
    };
    await assert.rejects(requestJson("/test", "error", { timeoutMs: 10 }), ApiError);
    assert.ok(signal.aborted);
  });
  await check("пошкоджена відповідь сервера", async () => {
    globalThis.fetch = async () => new Response("<html>unavailable</html>");
    await assert.rejects(requestJson("/test", "error"), /некоректні дані/);
  });
  await check("вхід зберігається без мережі та при 404/429/500", async () => {
    globalThis.fetch = async () => { throw new TypeError("offline"); };
    assert.equal(await recoverAccountSession(session), session);
    for (const status of [404, 429, 500]) {
      globalThis.fetch = async () => new Response(null, { status });
      assert.equal(await recoverAccountSession(session), session);
    }
  });
  await check("лише підтверджений 401 скидає сесію", async () => {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal(await recoverAccountSession(session), null);
    globalThis.fetch = async (url) => {
      if (url.endsWith("/favorites")) return new Response(null, { status: 401 });
      throw new TypeError("offline");
    };
    assert.equal(await recoverAccountSession(session), null);
    assert.equal(isExpiredAccountSession(new ApiError("error", 503)), false);
  });
  await check("успішне відновлення акаунта", async () => {
    globalThis.fetch = async (url) => new Response(JSON.stringify(url.endsWith("/preferences") ? session.preferences : session.favorites));
    assert.deepEqual(await recoverAccountSession(session), session);
  });
  await check("пошкоджена відповідь акаунта не замінює сесію", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ broken: true }));
    assert.equal(await recoverAccountSession(session), session);
    await assert.rejects(registerAccount("test@example.com", "valid-password"), /некоректні дані/);
  });
  await check("зрозумілий конфлікт email та нормалізація пошти", async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(JSON.parse(init.body).email, "test@example.com");
      return new Response(null, { status: 409 });
    };
    await assert.rejects(registerAccount(" Test@Example.COM ", "valid-password"), /вже зареєстрована/);
  });
  await check("401 не видається за успішне видалення акаунта", async () => {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(deleteAccount("test-token"), (error) => error.status === 401);
    await logoutAccount("test-token");
  });
  await check("категорії сповіщень надсилаються до акаунта", async () => {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.method, "PUT");
      assert.equal(init.headers.Authorization, "Bearer test-token");
      assert.equal(JSON.parse(init.body).alert, false);
      return new Response(JSON.stringify({ ...session.preferences, alert: false }));
    };
    assert.equal((await updateAccountPreferences("test-token", { ...session.preferences, alert: false })).alert, false);
  });
  await check("запізніла відповідь не підміняє новіший запит", async () => {
    const requests = new LatestRequest();
    const older = requests.begin(); const newer = requests.begin();
    assert.equal(requests.isCurrent(older), false);
    assert.equal(requests.isCurrent(newer), true);
    requests.invalidate();
    assert.equal(requests.isCurrent(newer), false);
  });
  await check("застаріла тривога/GPS не вважаються поточними", async () => {
    const now = Date.parse("2026-10-08T10:00:00Z");
    const snapshot = { fetchedAt: "2026-10-08T09:59:30Z", stale: false };
    assert.equal(isFreshSnapshot(snapshot, now), true);
    assert.equal(isFreshSnapshot({ ...snapshot, stale: true }, now), false);
    assert.equal(isFreshSnapshot({ ...snapshot, fetchedAt: "invalid" }, now), false);
    assert.equal(isFreshSnapshot(snapshot, now + 90_000), false);
    assert.equal(isFreshSnapshot({ ...snapshot, fetchedAt: "2026-10-08T11:00:00Z" }, now), false);
    assert.equal(isFreshSnapshot(null, now), false);
  });
} finally { globalThis.fetch = originalFetch; }

console.log(`Готово: ${checks} груп перевірок стабільності.`);

const stored = new Map();
globalThis.__stabilityStore = {
  getItemAsync: async (key) => stored.get(key) ?? null,
  setItemAsync: async (key, value) => { stored.set(key, value); },
  deleteItemAsync: async (key) => { stored.delete(key); },
};
const secureStoreUrl = `data:text/javascript,${encodeURIComponent("export const WHEN_UNLOCKED_THIS_DEVICE_ONLY='device-only'; export const getItemAsync=(...args)=>globalThis.__stabilityStore.getItemAsync(...args); export const setItemAsync=(...args)=>globalThis.__stabilityStore.setItemAsync(...args); export const deleteItemAsync=(...args)=>globalThis.__stabilityStore.deleteItemAsync(...args);")}`;
const nativeUrl = `data:text/javascript,${encodeURIComponent("export const Platform={OS:'ios'};")}`;
const { restoreSecureSession, persistSecureSession, clearSecureSession } = await import(moduleUrl("../src/storage/secureSession.ts", { "expo-secure-store": secureStoreUrl }));
const { restorePreferences, persistPreferences } = await import(moduleUrl("../src/storage/preferences.ts", { "expo-secure-store": secureStoreUrl, "react-native": nativeUrl }));
try {
  await check("збереження сесії та відхилення пошкодженого сховища", async () => {
    await persistSecureSession(session);
    assert.deepEqual(await restoreSecureSession(), session);
    const key = [...stored.keys()].find((key) => key.includes("account-session"));
    stored.set(key, '{"accessToken":"test","preferences":{"email":"test@example.com"},"favorites":{}}');
    assert.equal(await restoreSecureSession(), null);
    stored.set(key, "not json");
    assert.equal(await restoreSecureSession(), null);
    await clearSecureSession();
    assert.equal(await restoreSecureSession(), null);
  });
  await check("повільне збереження не відновлює сесію після виходу", async () => {
    let release;
    const normalWrite = globalThis.__stabilityStore.setItemAsync;
    globalThis.__stabilityStore.setItemAsync = async (...args) => {
      await new Promise((resolve) => { release = resolve; });
      return normalWrite(...args);
    };
    const write = persistSecureSession(session);
    const clear = clearSecureSession();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof release, "function");
    release();
    await Promise.all([write, clear]);
    globalThis.__stabilityStore.setItemAsync = normalWrite;
    assert.equal(await restoreSecureSession(), null);
  });
  await check("категорії сповіщень відновлюються після перезапуску", async () => {
    const preferences = { language: "uk", theme: "system", displayName: "", notifications: { alert: false, news: true, transport: true, silence: false } };
    await persistPreferences(preferences);
    assert.deepEqual(await restorePreferences(), preferences);
    const key = [...stored.keys()].find((key) => key.includes("preferences.v1"));
    stored.set(key, JSON.stringify({ language: "uk", notifications: { alert: "false" } }));
    await assert.rejects(restorePreferences());
  });
} finally { delete globalThis.__stabilityStore; }

await check("міська дата й розклад не залежать від часового поясу телефона", async () => {
  assert.equal(cityDate(new Date("2026-10-08T21:30:00Z")), "2026-10-09");
  assert.deepEqual(cityClock(new Date("2026-10-08T10:05:30Z")), { hours: 13, minutes: 5, seconds: 30 });
  assert.equal(citySeconds(new Date("2026-10-08T10:05:30Z")), 13 * 3600 + 5 * 60 + 30);
  assert.equal(cityClock(new Date("2026-01-08T10:00:00Z")).hours, 12);
  assert.equal(cityClock(new Date("2026-10-08T21:00:00Z")).hours, 0);
});
console.log(`Усього: ${checks} груп перевірок, включно зі сховищем і часовим поясом.`);
const freshnessUrl = moduleUrl("../src/utils/freshness.ts");
const { transportLiveState } = await import(moduleUrl("../src/utils/transportLive.ts", { "./freshness": freshnessUrl }));
const liveNow = Date.parse("2026-10-13T12:00:00Z");
const liveBase = { available: true, stale: false, fetchedAt: "2026-10-13T12:00:00Z", vehicles: [{ id: "bus-1" }] };
assert.equal(transportLiveState(null, liveNow), "loading");
assert.equal(transportLiveState(liveBase, liveNow), "live");
assert.equal(transportLiveState({ ...liveBase, vehicles: [] }, liveNow), "empty");
assert.equal(transportLiveState({ ...liveBase, available: false }, liveNow), "unavailable");
assert.equal(transportLiveState({ ...liveBase, stale: true }, liveNow), "stale");
assert.equal(transportLiveState({ ...liveBase, fetchedAt: "bad" }, liveNow), "stale");
assert.equal(transportLiveState(liveBase, liveNow + 60_001), "stale");
assert.equal(transportLiveState(liveBase, liveNow - 30_001), "stale");
console.log("PASS: bus snapshot state requires a fresh response and vehicles, not an inferred GPS measurement time; loading/empty/unavailable/stale are separate");
