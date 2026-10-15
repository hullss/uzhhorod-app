import type { TransportVehiclePositions } from "../api/transport";
import { isFreshSnapshot } from "./freshness";
export type TransportLiveState = "loading" | "unavailable" | "stale" | "empty" | "live";
export function transportLiveState(positions: TransportVehiclePositions | null, now = Date.now()): TransportLiveState {
  if (!positions) return "loading";
  if (!positions.available) return "unavailable";
  if (!isFreshSnapshot(positions, now, 60_000)) return "stale";
  return positions.vehicles.length ? "live" : "empty";
}
