import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { applyParkingPayment, decodeParkingSessions, type ParkingDraft, type ParkingSession } from "../payments/parkingSession";
const KEY = "uzhhorod-digital.parking.v1";
let pending = Promise.resolve();
async function read(): Promise<ParkingSession[]> {
  const raw = Platform.OS === "web" ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return raw ? decodeParkingSessions(JSON.parse(raw)) : [];
}
export async function restoreParkingSessions() { await pending.catch(() => undefined); return read(); }
export function payForParking(draft: ParkingDraft, extendId?: string): Promise<ParkingSession[]> {
  const task = pending.catch(() => undefined).then(async () => {
    const before = await read(); // Never overwrite corrupt history.
    const after = applyParkingPayment(before, draft, new Date(), extendId);
    if (before !== after) {
      const raw = JSON.stringify(after);
      if (Platform.OS === "web") globalThis.localStorage.setItem(KEY, raw);
      else await SecureStore.setItemAsync(KEY, raw, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    }
    return after;
  });
  pending = task.then(() => undefined, () => undefined);
  return task;
}
