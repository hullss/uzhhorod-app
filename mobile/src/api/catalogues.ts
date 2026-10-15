import { recordKey, uniqueById } from "../utils/records";
import type { AccessibleBuildingList, CurrencyRates, OfficialNewsList, Weather, EditorialDefenderFunds } from "./cityServices";
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const date = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
const failure = () => new Error("Сервіс повернув некоректні дані. Спробуйте оновити сторінку.");
export function publicHttps(v: unknown): v is string {
  if (!text(v)) return false;
  try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname); } catch { return false; }
}
function snapshot(v: unknown): asserts v is Record<string, any> {
  if (!object(v) || !date(v.fetchedAt) || typeof v.stale !== "boolean") throw failure();
}
export function decodeNews(value: unknown): OfficialNewsList {
  snapshot(value);
  if (!Array.isArray(value.items) || value.items.length > 1000) throw failure();
  const urls = new Set<string>();
  const items = value.items.map((item: unknown) => {
    if (!object(item) || !text(item.title) || !publicHttps(item.sourceUrl) || !(item.publishedLabel === null || typeof item.publishedLabel === "string")) throw failure();
    return { title: item.title.trim(), sourceUrl: new URL(item.sourceUrl).href, publishedLabel: item.publishedLabel };
  }).filter((item: { sourceUrl: string }) => { if (urls.has(item.sourceUrl)) return false; urls.add(item.sourceUrl); return true; });
  return { fetchedAt: value.fetchedAt, stale: value.stale, items };
}
export function decodeBuildings(value: unknown): AccessibleBuildingList {
  snapshot(value);
  if (!Array.isArray(value.buildings) || value.buildings.length > 5000) throw failure();
  const buildings = value.buildings.map((item: unknown) => {
    if (!object(item) || !text(item.name) || typeof item.address !== "string" || !(item.monitoredAt === null || date(item.monitoredAt))) throw failure();
    const name = item.name.trim(); const address = item.address.trim();
    // CKAN sources can omit buildingId. Content identity is safe for this read-only list.
    return { id: text(item.id) ? item.id.trim() : recordKey("building", [name, address, item.monitoredAt]), name, address, monitoredAt: item.monitoredAt };
  });
  return { fetchedAt: value.fetchedAt, stale: value.stale, buildings: uniqueById(buildings) };
}
export function decodeCurrency(value: unknown): CurrencyRates {
  snapshot(value);
  if (!Array.isArray(value.rates) || value.rates.length > 10) throw failure();
  const codes = new Set<string>();
  const rates = value.rates.map((item: unknown) => {
    if (!object(item) || !["USD", "EUR", "HUF", "CZK"].includes(item.code) || !Number.isFinite(item.buy) || item.buy <= 0 || !Number.isFinite(item.sell) || item.sell <= 0 || !date(item.updatedAt) || codes.has(item.code)) throw failure();
    codes.add(item.code); return { code: item.code as CurrencyRates["rates"][number]["code"], buy: item.buy, sell: item.sell, updatedAt: item.updatedAt, reference: item.reference === true };
  });
  return { fetchedAt: value.fetchedAt, stale: value.stale, rates };
}
export function decodeWeather(value: unknown): Weather {
  snapshot(value);
  if (!object(value.current) || !Array.isArray(value.days) || value.days.length > 14) throw failure();
  const current = value.current;
  for (const key of ["temperatureC", "feelsLikeC", "windKph", "humidity"]) if (!Number.isFinite(current[key])) throw failure();
  if (!text(current.condition) || typeof current.iconUrl !== "string" || !date(current.observedAt)) throw failure();
  if (current.airQuality !== null && (!object(current.airQuality) || !Number.isInteger(current.airQuality.index) || current.airQuality.index < 1 || current.airQuality.index > 6 || !Number.isFinite(current.airQuality.pm25) || !Number.isFinite(current.airQuality.pm10))) throw failure();
  const days = new Set<string>();
  for (const day of value.days) {
    if (!object(day) || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !date(day.date) || days.has(day.date) || !Array.isArray(day.hours) || day.hours.length > 30) throw failure();
    days.add(day.date); const hours = new Set<string>();
    for (const key of ["minTemperatureC", "maxTemperatureC", "chanceOfRain"]) if (!Number.isFinite(day[key])) throw failure();
    for (const key of ["condition", "iconUrl", "sunrise", "sunset"]) if (typeof day[key] !== "string") throw failure();
    for (const hour of day.hours) {
      if (!object(hour) || !date(hour.time) || hours.has(hour.time) || !text(hour.condition) || typeof hour.iconUrl !== "string") throw failure();
      hours.add(hour.time);
      for (const key of ["temperatureC", "feelsLikeC", "chanceOfRain", "windKph"]) if (!Number.isFinite(hour[key])) throw failure();
    }
  }
  return value as Weather;
}
export function decodeFunds(value: unknown): EditorialDefenderFunds {
  if (!object(value) || !Array.isArray(value.items) || value.items.length > 100) throw failure();
  const items = value.items.map((item: unknown) => {
    if (!object(item) || !text(item.id) || !text(item.title) || !text(item.description) || !publicHttps(item.donationUrl) || !date(item.verifiedAt) || !text(item.verificationSource)) throw failure();
    return { id: item.id.trim(), title: item.title.trim(), description: item.description.trim(), donationUrl: item.donationUrl, verifiedAt: item.verifiedAt, verificationSource: item.verificationSource.trim() };
  });
  return { items: uniqueById(items) };
}
