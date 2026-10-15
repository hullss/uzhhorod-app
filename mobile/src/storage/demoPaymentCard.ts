import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type DemoPaymentCard = { label: string; last4: string };
const KEY = "uzhhorod-digital.demo-card.v1";
let pendingWrite = Promise.resolve();
export function decodeDemoCard(value: unknown): DemoPaymentCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Partial<DemoPaymentCard>;
  if (typeof card.last4 !== "string" || !/^\d{4}$/.test(card.last4)
      || typeof card.label !== "string" || !card.label.trim() || card.label.length > 40) return null;
  // Whitelist fields: never persist a PAN, expiry, CVV or an account token.
  return { label: card.label.trim(), last4: card.last4 };
}
export async function restoreDemoCard(): Promise<DemoPaymentCard | null> {
  await pendingWrite.catch(() => undefined);
  const raw = Platform.OS === "web" ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  if (raw === null || raw === undefined) return null;
  const card = decodeDemoCard(JSON.parse(raw));
  if (!card) throw Error("Invalid saved demo card");
  return card;
}
export function persistDemoCard(card: DemoPaymentCard | null) {
  const safe = decodeDemoCard(card);
  if (card !== null && !safe) return Promise.reject(Error("Invalid demo card"));
  const write = pendingWrite.catch(() => undefined).then(async () => {
    if (Platform.OS === "web") {
      if (safe) globalThis.localStorage.setItem(KEY, JSON.stringify(safe));
      else globalThis.localStorage.removeItem(KEY);
    } else if (safe) await SecureStore.setItemAsync(KEY, JSON.stringify(safe), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
  });
  pendingWrite = write;
  return write;
}
