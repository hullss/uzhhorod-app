export type SafetyMapPoint = {
  id: string; name: string; address: string; latitude: number; longitude: number;
  description?: string; sourceUrl?: string; verifiedAt?: string;
};
export type SafetyMapPoints = { fetchedAt: string; stale: boolean; source?: "source" | "editorial"; points: SafetyMapPoint[] };
const optionalText = (value: unknown, limit: number) => typeof value === "string" && value.trim() && value.length <= limit ? value.trim() : undefined;
export function decodeSafetyMapPoints(value: unknown): SafetyMapPoints {
  const body = value as Partial<SafetyMapPoints> | null;
  if (!body || !Array.isArray(body.points) || body.points.length > 5000 || typeof body.fetchedAt !== "string" || !Number.isFinite(Date.parse(body.fetchedAt)) || typeof body.stale !== "boolean") throw new Error("Не вдалося прочитати позначки мапи.");
  const ids = new Set<string>();
  const points = body.points.map(raw => {
    if (!raw || typeof raw !== "object") throw new Error("Не вдалося прочитати позначки мапи.");
    const { id, name, address, latitude, longitude } = raw;
    if (!optionalText(id, 100) || ids.has(id) || !optionalText(name, 300) || !optionalText(address, 500)
      || typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < 48.56 || latitude > 48.70
      || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < 22.16 || longitude > 22.42) throw new Error("Не вдалося прочитати позначки мапи.");
    ids.add(id);
    const point: SafetyMapPoint = { id, name, address, latitude, longitude };
    point.description = optionalText(raw.description, 2000);
    const source = optionalText(raw.sourceUrl, 2000);
    try {
      const url = new URL(source ?? "");
      if (url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".")
        && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) point.sourceUrl = source;
    } catch { /* Optional untrusted links are not opened. */ }
    const verifiedAt = optionalText(raw.verifiedAt, 10);
    if (verifiedAt && /^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) && Number.isFinite(Date.parse(verifiedAt)) && new Date(verifiedAt).toISOString().slice(0, 10) === verifiedAt) point.verifiedAt = verifiedAt;
    return point;
  });
  return { fetchedAt: body.fetchedAt, stale: body.stale, source: body.source === "editorial" ? "editorial" : "source", points };
}
