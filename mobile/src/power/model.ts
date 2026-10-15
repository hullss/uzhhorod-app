export type PowerPlace = { id: number; name: string };
import { recordKey, uniqueById } from "../utils/records";
export type PowerAddress = { city: PowerPlace; street: PowerPlace; building: string };
export type PowerEvent = { id: string; kind: "planned" | "scheduled" | "emergency"; reason: string; startsAt: string | null; expectedRestoration: string | null; planned: boolean };
export type PowerStatus = { checkedAt: string; sourceUpdatedAt: string | null; stale: boolean; addressKnown: boolean; uncertain: boolean; queues: string[]; outages: PowerEvent[]; sourceUrl: string };
export const POWER_SOURCE = "https://zakarpat.energy/customers/break-in-electricity-supply/realtime-outage/";
export function decodePlaces(value: unknown): PowerPlace[] {
  if (!Array.isArray(value) || value.some(v => !v || !Number.isInteger(v.id) || v.id <= 0 || typeof v.name !== "string" || !v.name.trim())) throw new Error("Сервіс повернув некоректні адреси.");
  const places = new Map<number, PowerPlace>();
  for (const v of value) {
    const name = v.name.trim();
    if (places.has(v.id) && places.get(v.id)!.name !== name) throw new Error("Сервіс повернув суперечливі адреси.");
    places.set(v.id, { id: v.id, name });
  }
  return [...places.values()];
}
export function decodeAddress(value: unknown): PowerAddress | null {
  try {
    const v = value as PowerAddress;
    // Town and street IDs belong to different catalogues and can legitimately overlap.
    const city = decodePlaces([v.city])[0]; const street = decodePlaces([v.street])[0];
    if (typeof v.building !== "string" || !/^\d{1,5}[\p{L}]?(?:[/-]\d{1,5}[\p{L}]?)?$/u.test(v.building.trim())) return null;
    return { city, street, building: v.building.trim().toUpperCase() };
  } catch { return null; }
}
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
export function decodeStatus(value: unknown): PowerStatus {
  const v = value as PowerStatus;
  if (!v || !date(v.checkedAt) || !(v.sourceUpdatedAt === null || date(v.sourceUpdatedAt))
      || typeof v.stale !== "boolean" || typeof v.addressKnown !== "boolean" || typeof v.uncertain !== "boolean"
      || !Array.isArray(v.queues) || v.queues.some(q => typeof q !== "string")
      || !Array.isArray(v.outages) || v.outages.some(e => !e || typeof e.id !== "string" || typeof e.reason !== "string"
        || !["planned", "scheduled", "emergency"].includes(e.kind) || typeof e.planned !== "boolean"
        || !(e.startsAt === null || date(e.startsAt)) || !(e.expectedRestoration === null || date(e.expectedRestoration)))) throw new Error("Сервіс повернув некоректні дані про відключення.");
  const outages = uniqueById(v.outages.map(e => ({ ...e, id: e.id.trim() || recordKey("outage", [e.kind, e.reason, e.startsAt, e.expectedRestoration]) })));
  return { ...v, outages, sourceUrl: POWER_SOURCE }; // Do not trust arbitrary upstream URLs.
}
export const addressKey = (a: PowerAddress) => `${a.city.id}:${a.street.id}:${a.building.toUpperCase()}`;
export const addressLabel = (a: PowerAddress) => `${a.city.name}, ${a.street.name}, ${a.building}`;

// These are source records, not a physical measurement of power at the house.
export function outagePeriod(event: PowerEvent, now = Date.now()): "current" | "future" | "ended" | "unknown" {
  const start = event.startsAt === null ? NaN : Date.parse(event.startsAt);
  const end = event.expectedRestoration === null ? NaN : Date.parse(event.expectedRestoration);
  if ((event.startsAt !== null && !Number.isFinite(start))
      || (event.expectedRestoration !== null && !Number.isFinite(end))
      || (Number.isFinite(start) && Number.isFinite(end) && end <= start)) return "unknown";
  if (Number.isFinite(end) && end <= now) return "ended";
  if (!Number.isFinite(start)) return "unknown";
  return start > now ? "future" : "current";
}
export function powerStatusMessage(status: PowerStatus, now = Date.now()): string {
  if (status.stale) return "Актуальність даних оператора не підтверджено. Поточний стан невідомий.";
  if (!status.addressKnown) return "Будинок не знайдено в адресних даних оператора.";
  if (status.uncertain) return "Дані потребують уточнення на сайті оператора.";
  const periods = status.outages.map(event => outagePeriod(event, now));
  if (periods.includes("current")) return "За даними оператора зараз триває відключення за цією адресою.";
  if (periods.includes("unknown")) return "Час відключення не уточнено. Перевірте інформацію на сайті оператора.";
  if (periods.includes("future")) return "Поточних відключень не зазначено. Є заплановані відключення.";
  if (periods.length) return "Зазначений час відключень минув. Відновлення світла не підтверджено.";
  return "За даними оператора відключень не знайдено.";
}
