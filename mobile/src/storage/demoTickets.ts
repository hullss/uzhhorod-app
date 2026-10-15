import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { normalizeVehiclePlate, type DemoTicket } from "../payments/demoTransport";

const KEY = "uzhhorod-digital.demo-tickets.v1";
export const MAX_DEMO_TICKETS = 8;

// Serialize writes so a slow older write cannot overwrite a newer payment or a cleared history.
let pendingWrite = Promise.resolve();

export function decodeDemoTickets(items: unknown): DemoTicket[] {
  if (!Array.isArray(items) || items.length > MAX_DEMO_TICKETS) throw Error("Invalid ticket history");
  const ids = new Set<string>();
  return items.map((value): DemoTicket => {
    if (!value || typeof value !== "object") throw Error("Invalid saved ticket");
    const item = value as Partial<DemoTicket>;
    const valid = typeof item.id === "string" && item.id.startsWith("DEMO-") && !ids.has(item.id)
      && typeof item.plate === "string" && normalizeVehiclePlate(item.plate) !== null
      && Number.isInteger(item.quantity) && item.quantity! >= 1 && item.quantity! <= 5
      && Number.isSafeInteger(item.amountKopiykas) && item.amountKopiykas! > 0
      && typeof item.paidAt === "string" && Number.isFinite(Date.parse(item.paidAt))
      && typeof item.cardLast4 === "string" && /^\d{4}$/.test(item.cardLast4)
      && (item.source === "qr" || item.source === "number");
    if (!valid) throw Error("Invalid or duplicate saved ticket");
    ids.add(item.id!);
    // Whitelist; payment secrets never belong to a receipt.
    return { id: item.id!, plate: normalizeVehiclePlate(item.plate!)!, quantity: item.quantity!, amountKopiykas: item.amountKopiykas!, paidAt: item.paidAt!, cardLast4: item.cardLast4!, source: item.source! };
  });
}

async function read(): Promise<DemoTicket[]> {
  const serialized = Platform.OS === "web" ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return serialized === null || serialized === undefined ? [] : decodeDemoTickets(JSON.parse(serialized));
}
export async function restoreDemoTickets(): Promise<DemoTicket[]> {
  await pendingWrite.catch(() => undefined);
  return read();
}

export function persistDemoTickets(tickets: DemoTicket[]) {
  const serialized = JSON.stringify(decodeDemoTickets(tickets.slice(0, MAX_DEMO_TICKETS)));
  const write = pendingWrite.catch(() => undefined).then(async () => {
    await read(); // Read failure is not an empty history; never overwrite it.
    if (Platform.OS === "web") globalThis.localStorage.setItem(KEY, serialized);
    else await SecureStore.setItemAsync(KEY, serialized, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });
  pendingWrite = write;
  return write;
}

export function appendDemoTicket(ticket: DemoTicket): Promise<DemoTicket[]> {
  const safe = decodeDemoTickets([ticket])[0];
  const task = pendingWrite.catch(() => undefined).then(async () => {
    const before = await read();
    const after = [safe, ...before.filter(item => item.id !== safe.id)].slice(0, MAX_DEMO_TICKETS);
    const serialized = JSON.stringify(after);
    if (Platform.OS === "web") globalThis.localStorage.setItem(KEY, serialized);
    else await SecureStore.setItemAsync(KEY, serialized, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return after;
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  return task;
}
