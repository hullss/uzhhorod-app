/** Isolated QA only: synthetic read-only API, separate loopback storage origin. */
import { registerRootComponent } from "expo";
import { VERIFIED_EVENTS } from "../src/events/verifiedEvents";
import App from "../App";
import { citySeconds, cityDate } from "../src/utils/cityTime";
const originalFetch = globalThis.fetch;
const stops = [
  { id: "qa1", name: "Площа Поштова (1)", latitude: 48.6241, longitude: 22.2951 },
  { id: "qa2", name: "Вулиця Михайла Грушевського — довга назва зупинки (2)", latitude: 48.609, longitude: 22.285 },
];
const routes = [7, 9].map(n => ({ id: `qa${n}`, routeNumber: `${n}`, name: "вул. Михайла Грушевського — вул. Івана Котляревського", active: true }));
globalThis.fetch = async (input, options) => {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!address.includes("/api/")) return originalFetch(input, options);
  const url = new URL(address); const path = url.pathname;
  const method = options?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
  if (method !== "GET") return new Response("QA: writes disabled", { status: 405 });
  const now = new Date().toISOString();
  let result: unknown = { fetchedAt: now, stale: false, items: [] };
  if (path === "/api/transport/routes") result = routes;
  else if (path === "/api/transport/stops") result = stops;
  else if (path.endsWith("/imports/latest")) result = { available: true, completedAt: now, importedRouteCount: 2, importedStopCount: 2, importedRouteStopCount: 4, importedRouteVariantCount: 2 };
  else if (/\/stops\/[^/]+\/routes$/.test(path)) result = routes;
  else if (path.endsWith("/departures")) result = [2, 5, 8, 12, 16].map((minutes) => { const seconds = citySeconds(new Date()) + minutes * 60; return { routeVariantId: "out", directionId: 0, destination: "Івана Котляревського", departureTimeSeconds: seconds, departureTime: `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:00` }; });
  else if (path.endsWith("/map")) result = { routeId: "qa7", variants: [{ id: "out", directionId: 0, name: "Івана Котляревського", shape: stops.map(({ latitude, longitude }) => ({ latitude, longitude })) }], stops };
  else if (/\/transport\/routes\/[^/]+$/.test(path)) result = { ...routes[0], variants: [{ id: "out", directionId: 0, name: "Івана Котляревського", stops }] };
  else if (path.includes("/transport/vehicles")) result = { available: true, stale: false, fetchedAt: now, vehicles: [] };
  else if (path.endsWith("/weather")) result = { fetchedAt: now, stale: false, current: { temperatureC: 19, feelsLikeC: 18, condition: "Сонячно", iconUrl: "", windKph: 4, humidity: 60, airQuality: { index: 1, pm25: 5, pm10: 8 }, observedAt: now }, days: [] };
  else if (path.endsWith("/currency")) result = { fetchedAt: now, stale: false, rates: ["USD", "EUR", "HUF", "CZK"].map((code, i) => ({ code, buy: [40, 44, .11, 1.7][i], sell: [41, 45, .12, 1.8][i], updatedAt: now })) };
  else if (path.endsWith("/news")) result = { fetchedAt: now, stale: false, items: ["Зустріч містян: як зробити міські сервіси зручнішими", "Нові можливості для громадського транспорту", "Осінні події в Ужгороді"].map((title, i) => ({ title, sourceUrl: `https://rada-uzhgorod.gov.ua/qa-${i}`, publishedLabel: "жовтня 09, 2026" })) };
  else if (path.endsWith("/alerts/status")) result = { fetchedAt: now, stale: false, state: "CLEAR", title: "Повітряної тривоги немає", detail: "Ізольований тест, не справжній статус" };
  else if (path.endsWith("/alerts/events")) result = { events: [] };
  else if (path.endsWith("/power/cities")) result = [{ id: 769, name: "Ужгород" }];
  else if (path.endsWith("/power/streets")) result = [{ id: 1, name: "Оноківська" }, { id: 2, name: "Дуже довга українська назва вулиці" }];
  else if (path.includes("/power/")) result = { checkedAt: now, sourceUpdatedAt: now, stale: false, addressKnown: true, uncertain: false, queues: ["4.1"], outages: [] };
  else if (path.includes("/maps/")) result = { fetchedAt: now, stale: false, points: [], rejected: 0 };
  else if (path.endsWith("/events")) result = { items: VERIFIED_EVENTS, rejected: 0 };
  else if (path.endsWith("/miniatures")) result = { sourceCheckedAt: cityDate(), verificationNotice: "QA", sculptures: [] };
  else if (path.includes("/accessibility/")) result = { fetchedAt: now, stale: false, buildings: [] };
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
};
registerRootComponent(App);
