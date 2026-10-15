import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
type Snapshot = { path: string; savedAt: string; value: unknown };
const KEY = "uzhhorod-digital.transport-snapshots.v1";
export const SNAPSHOT_CHARACTER_BUDGET = 250_000;
const isCatalogue = (path: string) => path === "/api/transport/routes" || path === "/api/transport/stops";
let pending = Promise.resolve();
export function snapshotPath(path: string): boolean {
  return /^\/api\/transport\/(routes|stops)$/.test(path) || /^\/api\/transport\/routes\/[a-zA-Z0-9-]+(\/map)?$/.test(path);
}
async function read(): Promise<Snapshot[]> {
  const raw = Platform.OS === "web" ? globalThis.localStorage.getItem(KEY) : await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 8 || value.some(item => !item || !snapshotPath(item.path) || typeof item.savedAt !== "string" || !Number.isFinite(Date.parse(item.savedAt)))) throw Error("Invalid transport snapshot store");
  return value;
}
export async function readTransportSnapshot(path: string) {
  if (!snapshotPath(path)) return null;
  await pending.catch(() => undefined);
  return (await read()).find(item => item.path === path) ?? null;
}
export function persistTransportSnapshot(path: string, value: unknown) {
  if (!snapshotPath(path)) return Promise.resolve();
  const next = { path, savedAt: new Date().toISOString(), value };
  const task = pending.catch(() => undefined).then(async () => {
    // Reject before touching existing entries, including the previous version of this path.
    if (JSON.stringify([next]).length > SNAPSHOT_CHARACTER_BUDGET) return;
    let items = [next, ...(await read()).filter(item => item.path !== path)];
    while (items.length > 8 || JSON.stringify(items).length > SNAPSHOT_CHARACTER_BUDGET) {
      // Keep routes/stops in preference to optional detail/map snapshots.
      let removable = -1;
      for (let index = items.length - 1; index >= 0; index--) {
        if (items[index] !== next && !isCatalogue(items[index].path)) { removable = index; break; }
      }
      if (removable >= 0) items.splice(removable, 1);
      else if (!isCatalogue(path)) return; // No room without losing the core catalogue.
      else items.pop();
    }
    const raw = JSON.stringify(items);
    if (Platform.OS === "web") globalThis.localStorage.setItem(KEY, raw);
    else await AsyncStorage.setItem(KEY, raw); // Public catalogue only; credentials stay in SecureStore.
  });
  pending = task.then(() => undefined, () => undefined);
  return task;
}
