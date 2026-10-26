import type { MiniSculpture, MiniSculptureList } from "../api/cityServices";
import { publicHttps } from "../api/catalogues";

const text = (value: unknown, limit: number): value is string => typeof value === "string" && !!value.trim() && value.length <= limit;
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function decodeMiniatures(value: unknown): MiniSculptureList {
  const fail = () => new Error("Не вдалося прочитати каталог мініскульптур. Спробуйте оновити його.");
  if (!value || typeof value !== "object") throw fail();
  const data = value as Record<string, unknown>;
  if (typeof data.sourceCheckedAt !== "string" || !Number.isFinite(Date.parse(data.sourceCheckedAt))
      || !text(data.verificationNotice, 2000) || !Array.isArray(data.sculptures) || data.sculptures.length > 500) throw fail();
  const ids = new Set<string>();
  const sculptures: MiniSculpture[] = data.sculptures.map(candidate => {
    if (!candidate || typeof candidate !== "object") throw fail();
    const point = candidate as Record<string, unknown>;
    if (!text(point.id, 100) || ids.has(point.id) || !text(point.title, 300) || !text(point.address, 500)
        || !text(point.author, 500) || !text(point.summary, 1000)
        || typeof point.latitude !== "number" || !Number.isFinite(point.latitude) || point.latitude < 48.56 || point.latitude > 48.70
        || typeof point.longitude !== "number" || !Number.isFinite(point.longitude) || point.longitude < 22.16 || point.longitude > 22.42
        || (point.installedAt != null && !validDate(point.installedAt))) throw fail();
    const installedYear = point.installedYear ?? (validDate(point.installedAt) ? Number(point.installedAt.slice(0, 4)) : null);
    if (typeof installedYear !== "number" || !Number.isInteger(installedYear) || installedYear < 2010 || installedYear > 2100
        || (validDate(point.installedAt) && installedYear !== Number(point.installedAt.slice(0, 4)))) throw fail();
    const sources = point.sourceUrls ?? [];
    if (!Array.isArray(sources) || sources.length > 10 || !sources.every(publicHttps)) throw fail();
    ids.add(point.id);
    return { id: point.id, title: point.title, address: point.address, author: point.author, summary: point.summary,
      latitude: point.latitude, longitude: point.longitude, installedAt: validDate(point.installedAt) ? point.installedAt : null,
      installedYear, sourceUrls: [...new Set(sources as string[])] };
  });
  return { sourceCheckedAt: data.sourceCheckedAt, verificationNotice: data.verificationNotice, sculptures };
}

export function searchMiniatures(items: MiniSculpture[], query: string): MiniSculpture[] {
  const words = query.trim().toLocaleLowerCase("uk").split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter(point => {
    const haystack = `${point.title} ${point.address} ${point.author}`.toLocaleLowerCase("uk");
    return words.every(word => haystack.includes(word));
  });
}
