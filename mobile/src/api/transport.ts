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

export type TransportImportStatus = {
  available: boolean;
  completedAt: string | null;
  importedRouteCount: number | null;
  importedStopCount: number | null;
  importedRouteStopCount: number | null;
  importedRouteVariantCount: number | null;
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8080";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити дані: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getRoutes(query?: string): Promise<TransportRoute[]> {
  const normalizedQuery = query?.trim();
  const path = normalizedQuery
    ? `/api/transport/routes?query=${encodeURIComponent(normalizedQuery)}`
    : "/api/transport/routes";
  return request(path);
}

export function getStops(query?: string): Promise<TransportStop[]> {
  const normalizedQuery = query?.trim();
  const path = normalizedQuery
    ? `/api/transport/stops?query=${encodeURIComponent(normalizedQuery)}`
    : "/api/transport/stops";
  return request(path);
}

export function getStopRoutes(stopId: string): Promise<TransportRoute[]> {
  return request(`/api/transport/stops/${stopId}/routes`);
}

export function getRoute(routeId: string): Promise<TransportRouteDetails> {
  return request(`/api/transport/routes/${routeId}`);
}

export function getDepartures(routeId: string, stopId: string, date: string): Promise<TransportDeparture[]> {
  return request(
    `/api/transport/routes/${routeId}/stops/${stopId}/departures?date=${encodeURIComponent(date)}`,
  );
}

export function getRouteMap(routeId: string): Promise<TransportRouteMap> {
  return request(`/api/transport/routes/${routeId}/map`);
}

export function getLatestTransportImport(): Promise<TransportImportStatus> {
  return request("/api/transport/imports/latest");
}
