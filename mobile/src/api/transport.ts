import { requestJson } from "./request";
import { decodeDepartures, decodeRoute, decodeRouteMap, decodeRoutes, decodeStops, decodeVehicles } from "./transportValidation";
import { persistTransportSnapshot, readTransportSnapshot, snapshotPath } from "../storage/transportSnapshots";

export type TransportRoute = {
  id: string;
  routeNumber: string;
  name: string;
  active: boolean;
};

export type TransportStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type TransportRouteVariant = {
  id: string;
  directionId: number | null;
  name: string;
  stops: TransportStop[];
};

export type TransportRouteDetails = TransportRoute & {
  variants: TransportRouteVariant[];
};

export type TransportDeparture = {
  routeVariantId: string;
  directionId: number | null;
  destination: string;
  departureTime: string;
  departureTimeSeconds: number;
};

export type TransportMapPoint = {
  latitude: number;
  longitude: number;
};

export type TransportRouteMapVariant = {
  id: string;
  directionId: number | null;
  name: string;
  shape: TransportMapPoint[];
};

export type TransportRouteMap = {
  routeId: string;
  variants: TransportRouteMapVariant[];
  stops: TransportStop[];
};

export type TransportVehiclePosition = {
  id: string;
  routeNumber: string;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  headingDegrees: number | null;
  measuredAt: string | null;
};

export type TransportVehiclePositions = {
  available: boolean;
  stale: boolean;
  fetchedAt: string;
  vehicles: TransportVehiclePosition[];
};

export type TransportImportStatus = {
  available: boolean;
  completedAt: string | null;
  importedRouteCount: number | null;
  importedStopCount: number | null;
  importedRouteStopCount: number | null;
  importedRouteVariantCount: number | null;
};

async function request<T>(path: string): Promise<T> {
  return requestJson<T>(path, "Не вдалося завантажити транспортні дані. Спробуйте ще раз.");
}
// Reuse catalogues across screens; never cache live GPS positions here.
const snapshots = new Map<string, { value: unknown; until: number }>();
const inFlight = new Map<string, Promise<unknown>>();
const snapshotInfo = new WeakMap<object, { savedAt: string; offline: boolean }>();
export function getTransportSnapshotInfo(value: unknown): { savedAt: string; offline: boolean } | undefined {
  return value && typeof value === "object" ? snapshotInfo.get(value) ?? (Array.isArray(value) ? value.map(item => getTransportSnapshotInfo(item)).find(info => info?.offline) : undefined) : undefined;
}
function markSnapshot(value: unknown, savedAt: string, offline: boolean) {
  if (value && typeof value === "object") { snapshotInfo.set(value, { savedAt, offline }); if (Array.isArray(value)) value.forEach(item => markSnapshot(item, savedAt, offline)); }
}
function cached<T>(path: string, ttl = 5 * 60_000, decode: (value: unknown) => T = value => value as T): Promise<T> {
  const entry = snapshots.get(path);
  if (entry && entry.until > Date.now()) return Promise.resolve(entry.value as T);
  const pending = inFlight.get(path); if (pending) return pending as Promise<T>;
  const next = request<unknown>(path).then(decode).then(value => {
    if (snapshots.size >= 256) snapshots.delete(snapshots.keys().next().value!);
    snapshots.set(path, { value, until: Date.now() + ttl });
    markSnapshot(value, new Date().toISOString(), false);
    void persistTransportSnapshot(path, value).catch(() => undefined);
    return value;
  }).catch(async error => {
    if (!snapshotPath(path) || error?.status === 401 || error?.status === 403 || error?.status === 404) throw error;
    try {
      const stored = await readTransportSnapshot(path);
      if (stored) { const value = decode(stored.value); markSnapshot(value, stored.savedAt, true); snapshots.set(path, { value, until: Date.now() + 15_000 }); return value; }
    } catch { /* An unreadable snapshot never turns into an empty/fresh catalogue. */ }
    throw error;
  }).finally(() => inFlight.delete(path));
  inFlight.set(path, next); return next;
}

export function getRoutes(query?: string): Promise<TransportRoute[]> {
  const normalizedQuery = query?.trim();
  return cached("/api/transport/routes", undefined, decodeRoutes).then(items => normalizedQuery
    ? items.filter(item => `${item.routeNumber} ${item.name}`.toLocaleLowerCase("uk").includes(normalizedQuery.toLocaleLowerCase("uk"))) : items);
}

export function getStops(query?: string): Promise<TransportStop[]> {
  const normalizedQuery = query?.trim();
  return cached("/api/transport/stops", undefined, decodeStops).then(items => normalizedQuery
    ? items.filter(item => item.name.toLocaleLowerCase("uk").includes(normalizedQuery.toLocaleLowerCase("uk"))) : items);
}

export function getStopRoutes(stopId: string): Promise<TransportRoute[]> {
  return cached(`/api/transport/stops/${encodeURIComponent(stopId)}/routes`, undefined, decodeRoutes);
}

export function getRoute(routeId: string): Promise<TransportRouteDetails> {
  return cached(`/api/transport/routes/${encodeURIComponent(routeId)}`, undefined, decodeRoute);
}

export function getDepartures(routeId: string, stopId: string, date: string): Promise<TransportDeparture[]> {
  return cached(
    `/api/transport/routes/${encodeURIComponent(routeId)}/stops/${encodeURIComponent(stopId)}/departures?date=${encodeURIComponent(date)}`,
    60_000,
    decodeDepartures,
  );
}

export function getRouteMap(routeId: string): Promise<TransportRouteMap> {
  return cached(`/api/transport/routes/${encodeURIComponent(routeId)}/map`, undefined, decodeRouteMap);
}

export function getVehiclePositions(routeNumber?: string): Promise<TransportVehiclePositions> {
  const query = routeNumber?.trim();
  const path = query
    ? `/api/transport/vehicles?routeNumber=${encodeURIComponent(query)}`
    : "/api/transport/vehicles";
  return request(path).then(decodeVehicles);
}

export function getLatestTransportImport(): Promise<TransportImportStatus> {
  return cached("/api/transport/imports/latest");
}
