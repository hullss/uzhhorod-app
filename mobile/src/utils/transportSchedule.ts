import type { TransportDeparture } from "../api/transport";
import { cityDate, citySeconds } from "./cityTime";

export function visibleScheduleDepartures(departures: TransportDeparture[], date: string, now: Date, showAll: boolean) {
  const upcomingOnly = date === cityDate(now) && !showAll;
  const seconds = citySeconds(now);
  return departures.filter(item => !upcomingOnly || item.departureTimeSeconds >= seconds)
    .sort((a, b) => a.departureTimeSeconds - b.departureTimeSeconds);
}
