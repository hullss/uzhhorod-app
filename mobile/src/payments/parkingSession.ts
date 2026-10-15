import { normalizeVehiclePlate } from "./demoTransport";
export type ParkingCoordinate = { latitude: number; longitude: number };
export type ParkingZone = {
  id: string; name: string; address: string; hourlyKopiykas: number;
  center: ParkingCoordinate; sections: ParkingCoordinate[][];
};
const point = (latitude: number, longitude: number): ParkingCoordinate => ({ latitude, longitude });
/** Presentation locations supplied by the user, NOT an operator's payment-zone registry.
 * Street coordinates: OpenStreetMap contributors (ODbL), checked 2026-10-13.
 * Sections are schematic road highlights, not surveyed parking boundaries.
 * 25 UAH/hour is the presentation tariff supplied by the user, not a live quote.
 */
export const PARKING_ZONES: readonly ParkingZone[] = [
  { id: "uzh-zhupanatska", name: "Площа Жупанатська", address: "пл. Жупанатська", hourlyKopiykas: 2500,
    center: point(48.62436, 22.29694), sections: [[point(48.6240797, 22.2971696), point(48.6241877, 22.2971535), point(48.6242404, 22.2971215), point(48.6243603, 22.2969408), point(48.6244913, 22.2968705)]] },
  { id: "uzh-fedyntsia", name: "Вулиця Олександра Фединця", address: "вул. Олександра Фединця · центральна ділянка", hourlyKopiykas: 2500,
    center: point(48.62470, 22.29728), sections: [[point(48.6249301, 22.2975338), point(48.6248895, 22.2974611), point(48.6247929, 22.2973269), point(48.6247217, 22.2972742), point(48.6246157, 22.297226), point(48.6245367, 22.2972168), point(48.6244594, 22.2972236), point(48.6243798, 22.2972545), point(48.6242956, 22.2973228), point(48.624128, 22.2973967), point(48.624068, 22.297401)]] },
  { id: "uzh-koriatovycha", name: "Площа Корятовича — Духновича", address: "пл. Корятовича / вул. Олександра Духновича", hourlyKopiykas: 2500,
    center: point(48.62447, 22.29978), sections: [
      [point(48.6241286, 22.2981403), point(48.6243137, 22.2986993), point(48.6243979, 22.2989573), point(48.6246151, 22.2996486), point(48.6248275, 22.3004943)],
      [point(48.6246151, 22.2996486), point(48.6243238, 22.2999098), point(48.6242733, 22.299962), point(48.6241012, 22.3001343)],
      [point(48.6243238, 22.2999098), point(48.6243882, 22.3000152), point(48.624694, 22.3006187), point(48.6248275, 22.3004943)],
    ] },
  { id: "uzh-chendeia", name: "Вулиця Івана Чендея", address: "вул. Івана Чендея · біля драмтеатру", hourlyKopiykas: 2500,
    center: point(48.62074, 22.29235), sections: [[point(48.6205399, 22.2932532), point(48.620622, 22.292893), point(48.6206964, 22.2925668), point(48.6209556, 22.2913828)]] },
];
// Keep old IDs/rates readable: never silently move an existing paid example to a new zone.
const LEGACY_ZONES = [
  { id: "example-a", name: "Майданчик A (попередній макет)", hourlyKopiykas: 2500 },
  { id: "example-b", name: "Майданчик B (попередній макет)", hourlyKopiykas: 2000 },
];
export const findParkingZone = (id: string) => PARKING_ZONES.find(zone => zone.id === id) ?? LEGACY_ZONES.find(zone => zone.id === id);
export type ParkingCharge = { requestId: string; hours: number; amountKopiykas: number; last4: string; paidAt: string };
export type ParkingSession = { id: string; zoneId: string; plate: string; startedAt: string; endsAt: string; charges: ParkingCharge[] };
export type ParkingDraft = { zoneId: string; plate: string; hours: number; last4: string; requestId: string };
const HOUR = 3_600_000;
export function quoteParking(zoneId: string, hours: number) {
  const zone = findParkingZone(zoneId);
  if (!zone || !Number.isInteger(hours) || hours < 1 || hours > 8) throw new Error("Перевірте майданчик і тривалість паркування.");
  return { zone, amountKopiykas: zone.hourlyKopiykas * hours };
}
export function applyParkingPayment(items: ParkingSession[], draft: ParkingDraft, now = new Date(), extendId?: string): ParkingSession[] {
  const plate = normalizeVehiclePlate(draft.plate);
  const { amountKopiykas } = quoteParking(draft.zoneId, draft.hours);
  if (!plate || !/^\d{4}$/.test(draft.last4) || !/^[a-zA-Z0-9_-]{8,100}$/.test(draft.requestId) || !Number.isFinite(now.getTime())) throw new Error("Перевірте номер авто та спосіб оплати.");
  if (items.some(item => item.charges.some(charge => charge.requestId === draft.requestId))) return items;
  const charge = { requestId: draft.requestId, hours: draft.hours, amountKopiykas, last4: draft.last4, paidAt: now.toISOString() };
  if (extendId) {
    const current = items.find(item => item.id === extendId);
    if (!current || current.zoneId !== draft.zoneId || current.plate !== plate || Date.parse(current.endsAt) <= now.getTime() || current.charges.length >= 20) throw new Error("Цю сесію вже не можна продовжити. Почніть нове паркування.");
    return items.map(item => item.id === extendId ? { ...item, endsAt: new Date(Date.parse(item.endsAt) + draft.hours * HOUR).toISOString(), charges: [...item.charges, charge] } : item);
  }
  if (items.some(item => item.plate === plate && Date.parse(item.endsAt) > now.getTime())) throw new Error("Для цього авто вже є активне паркування.");
  const active = items.filter(item => Date.parse(item.endsAt) > now.getTime());
  if (active.length >= 50) throw new Error("Забагато активних паркувань. Дочекайтеся завершення поточної сесії.");
  const history = items.filter(item => Date.parse(item.endsAt) <= now.getTime()).slice(0, 49 - active.length);
  return [{ id: `PARK-TEST-${draft.requestId}`, zoneId: draft.zoneId, plate, startedAt: now.toISOString(), endsAt: new Date(now.getTime() + draft.hours * HOUR).toISOString(), charges: [charge] }, ...active, ...history];
}
export function decodeParkingSessions(value: unknown): ParkingSession[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error("Не вдалося прочитати історію паркування.");
  const ids = new Set<string>(); const requests = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.startsWith("PARK-TEST-") || ids.has(item.id) || typeof item.plate !== "string" || normalizeVehiclePlate(item.plate) !== item.plate || !findParkingZone(item.zoneId) || typeof item.startedAt !== "string" || !Number.isFinite(Date.parse(item.startedAt)) || typeof item.endsAt !== "string" || !Number.isFinite(Date.parse(item.endsAt)) || Date.parse(item.endsAt) <= Date.parse(item.startedAt) || !Array.isArray(item.charges) || !item.charges.length || item.charges.length > 20) throw new Error("Не вдалося прочитати історію паркування.");
    ids.add(item.id);
    const charges: ParkingCharge[] = item.charges.map((charge: ParkingCharge) => {
      if (!charge || typeof charge.requestId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(charge.requestId) || requests.has(charge.requestId) || typeof charge.last4 !== "string" || !/^\d{4}$/.test(charge.last4) || typeof charge.paidAt !== "string" || !Number.isFinite(Date.parse(charge.paidAt)) || quoteParking(item.zoneId, charge.hours).amountKopiykas !== charge.amountKopiykas) throw new Error("Не вдалося прочитати історію паркування.");
      requests.add(charge.requestId);
      return { requestId: charge.requestId, hours: charge.hours, amountKopiykas: charge.amountKopiykas, last4: charge.last4, paidAt: charge.paidAt };
    });
    if (Date.parse(item.endsAt) - Date.parse(item.startedAt) !== charges.reduce((total, charge) => total + charge.hours * HOUR, 0)) throw new Error("Не вдалося прочитати історію паркування.");
    return { id: item.id, zoneId: item.zoneId, plate: item.plate, startedAt: item.startedAt, endsAt: item.endsAt, charges };
  });
}
