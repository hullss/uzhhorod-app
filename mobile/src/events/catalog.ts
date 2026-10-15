import { getLocale } from "../i18n/locale";
import { cityDate } from "../utils/cityTime";

export const EVENT_CATEGORIES = ["Концерти", "Театр", "Виставки", "Лекції та зустрічі", "Майстер-класи", "Спорт", "Для дітей", "Фестивалі", "Інше"] as const;
export type CityEvent = {
  id: string; title: string; date: string; time?: string;
  category: typeof EVENT_CATEGORIES[number]; venue: string; address?: string;
  description: string; sourceUrl: string; posterUrl?: string;
  organizer?: string; verifiedAt: string;
};
export type EventCatalog = { items: CityEvent[]; rejected: number };
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeEventUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".")
      && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
  } catch { return false; }
}
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function decodeEventCatalog(value: unknown): EventCatalog {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) {
    throw new Error("Не вдалося прочитати афішу. Спробуйте оновити її.");
  }
  const raw = (value as { items: unknown[] }).items;
  if (raw.length > 500) throw new Error("Афіша завелика для завантаження.");
  const items: CityEvent[] = []; const ids = new Set<string>();
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const e = candidate as CityEvent;
    if (!text(e.id, 100) || ids.has(e.id.trim()) || !text(e.title, 300) || !validDate(e.date)
      || !validDate(e.verifiedAt) || !text(e.venue, 300) || !text(e.description, 6000)
      || !EVENT_CATEGORIES.includes(e.category) || !safeEventUrl(e.sourceUrl)
      || (e.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time))) continue;
    ids.add(e.id.trim());
    items.push({ id: e.id.trim(), title: e.title.trim(), date: e.date, time: e.time,
      category: e.category, venue: e.venue.trim(), description: e.description.trim(),
      sourceUrl: e.sourceUrl, verifiedAt: e.verifiedAt,
      address: text(e.address, 500) ? e.address!.trim() : undefined,
      organizer: text(e.organizer, 300) ? e.organizer!.trim() : undefined,
      posterUrl: safeEventUrl(e.posterUrl) ? e.posterUrl : undefined });
  }
  return { items, rejected: raw.length - items.length };
}
// End times are not supplied for every event: archive on the next Kyiv calendar day,
// rather than falsely declaring an event finished at its start time.
export function isArchived(event: CityEvent, now = new Date()) { return event.date < cityDate(now); }
export function selectEvents(items: CityEvent[], archive: boolean, category: string, now = new Date()) {
  return items.filter(e => isArchived(e, now) === archive && (category === "Усі" || e.category === category))
    .sort((a, b) => {
      const order = `${a.date}T${a.time ?? "00:00"}`.localeCompare(`${b.date}T${b.time ?? "00:00"}`);
      return (archive ? -order : order) || a.title.localeCompare(b.title, "uk");
    });
}
export function availableEventCategories(items: CityEvent[], archive: boolean, now = new Date()): string[] {
  const present = new Set(items.filter(e => isArchived(e, now) === archive).map(e => e.category));
  return ["Усі", ...EVENT_CATEGORIES.filter(category => present.has(category))];
}
export function eventDateLabel(date: string) {
  return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`)).replace(/\sр\.$/u, "");
}
