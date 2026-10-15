import { normalizeVehiclePlate } from "./demoTransport";
export const DEMO_PARKING_HOURLY_KOPIYKAS = 2500; // Presentation amount, not a live city tariff.
export type ParkingReceipt = { id: string; plate: string; hours: number; last4: string; amountKopiykas: number; startedAt: string; endsAt: string };
export function createParkingReceipt(plate: string, hours: number, last4: string, now = new Date()): ParkingReceipt {
  const normalized = normalizeVehiclePlate(plate);
  if (!normalized || !Number.isInteger(hours) || hours < 1 || hours > 8 || !/^\d{4}$/.test(last4)) throw new Error("Перевірте номер авто й тривалість паркування.");
  return { id: `PARK-TEST-${now.getTime().toString(36).toUpperCase()}`, plate: normalized, hours, last4, amountKopiykas: hours * DEMO_PARKING_HOURLY_KOPIYKAS, startedAt: now.toISOString(), endsAt: new Date(now.getTime() + hours * 3_600_000).toISOString() };
}
