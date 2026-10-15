import { uniqueById } from "../utils/records";
import type { TransportRoute, TransportStop, TransportRouteDetails, TransportRouteMap, TransportVehiclePositions, TransportDeparture } from "./transport";
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const fail = () => new Error("Сервіс повернув некоректні дані. Спробуйте оновити сторінку.");
function list(v: unknown): any[] { if (!Array.isArray(v) || v.length > 20_000) throw fail(); return v; }
function point(v: unknown) { if (!obj(v) || !Number.isFinite(v.latitude) || Math.abs(v.latitude) > 90 || !Number.isFinite(v.longitude) || Math.abs(v.longitude) > 180) throw fail(); }
function identity(v: unknown) { if (!obj(v) || !text(v.id) || !text(v.name)) throw fail(); }
export function decodeRoutes(v: unknown): TransportRoute[] {
  return uniqueById(list(v).map(item => { identity(item); if (!text(item.routeNumber) || typeof item.active !== "boolean") throw fail(); return { id: item.id.trim(), routeNumber: item.routeNumber.trim(), name: item.name.trim(), active: item.active }; }));
}
export function decodeStops(v: unknown, deduplicate = true): TransportStop[] {
  const stops = list(v).map(item => { identity(item); point(item); return { id: item.id.trim(), name: item.name.trim(), latitude: item.latitude, longitude: item.longitude }; });
  return deduplicate ? uniqueById(stops) : stops; // Repeated stops in a circular route are legitimate.
}
export function decodeRoute(v: unknown): TransportRouteDetails {
  if (!obj(v)) throw fail(); const route = decodeRoutes([v])[0];
  const variants = uniqueById(list(v.variants).map(item => { identity(item); if (item.directionId !== null && !Number.isInteger(item.directionId)) throw fail(); return { id: item.id.trim(), name: item.name.trim(), directionId: item.directionId, stops: decodeStops(item.stops, false) }; }));
  return { ...route, variants };
}
export function decodeRouteMap(v: unknown): TransportRouteMap {
  if (!obj(v) || !text(v.routeId)) throw fail();
  const variants = uniqueById(list(v.variants).map(item => { identity(item); if (item.directionId !== null && !Number.isInteger(item.directionId)) throw fail(); const shape = list(item.shape).map(p => { point(p); return { latitude: p.latitude, longitude: p.longitude }; }); return { id: item.id.trim(), name: item.name.trim(), directionId: item.directionId, shape }; }));
  return { routeId: v.routeId.trim(), variants, stops: decodeStops(v.stops) };
}
export function decodeVehicles(v: unknown): TransportVehiclePositions {
  if (!obj(v) || typeof v.available !== "boolean" || typeof v.stale !== "boolean" || typeof v.fetchedAt !== "string" || !Number.isFinite(Date.parse(v.fetchedAt))) throw fail();
  const vehicles = uniqueById(list(v.vehicles).map(item => {
    point(item); if (!text(item.id) || !text(item.routeNumber) || !(item.measuredAt === null || typeof item.measuredAt === "string" && Number.isFinite(Date.parse(item.measuredAt))) || !(item.headingDegrees === null || Number.isFinite(item.headingDegrees) && item.headingDegrees >= 0 && item.headingDegrees < 360) || !(item.speedKph === null || Number.isFinite(item.speedKph) && item.speedKph >= 0)) throw fail();
    return { id: item.id.trim(), routeNumber: item.routeNumber.trim(), latitude: item.latitude, longitude: item.longitude, speedKph: item.speedKph, headingDegrees: item.headingDegrees, measuredAt: item.measuredAt };
  }));
  return { available: v.available, stale: v.stale, fetchedAt: v.fetchedAt, vehicles };
}
export function decodeDepartures(v: unknown): TransportDeparture[] {
  return list(v).map(item => {
    if (!obj(item) || !text(item.routeVariantId) || typeof item.destination !== "string" || !/^\d{2,3}:\d{2}(:\d{2})?$/.test(item.departureTime) || !Number.isInteger(item.departureTimeSeconds) || item.departureTimeSeconds < 0 || item.departureTimeSeconds >= 7 * 86400 || !(item.directionId === null || Number.isInteger(item.directionId))) throw fail();
    return { routeVariantId: item.routeVariantId.trim(), directionId: item.directionId, destination: item.destination, departureTime: item.departureTime, departureTimeSeconds: item.departureTimeSeconds };
  });
}
