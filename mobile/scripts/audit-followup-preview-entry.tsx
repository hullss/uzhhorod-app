/** Isolated UI QA: reuse synthetic fixtures; never requests the user's real API. */
import "./polish-preview-entry";
import { citySeconds } from "../src/utils/cityTime";
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = options?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
  if (method === "GET" && address.includes("/api/")) {
    const url = new URL(address);
    if (url.pathname.endsWith("/alerts/status")) return Response.json({ fetchedAt: new Date().toISOString(), stale: false, state: "UNAVAILABLE", title: "Статус тривоги невідомий", detail: "Ізольований тест недоступного статусу." });
    if (url.pathname.endsWith("/departures")) {
      const seconds = url.pathname.includes("qa2") ? [6 * 3600 + 50 * 60, 7 * 3600] : [6 * 3600 + 50 * 60, citySeconds(new Date()) + 5 * 60, citySeconds(new Date()) + 15 * 60];
      return Response.json(seconds.map(departureTimeSeconds => ({ routeVariantId: "out", directionId: 0, destination: "Івана Котляревського", departureTimeSeconds,
        departureTime: `${Math.floor(departureTimeSeconds / 3600).toString().padStart(2, "0")}:${Math.floor(departureTimeSeconds % 3600 / 60).toString().padStart(2, "0")}:00` })));
    }
  }
  return fixtureFetch(input, options);
};
