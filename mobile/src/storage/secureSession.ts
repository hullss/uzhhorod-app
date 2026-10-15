import * as SecureStore from "expo-secure-store";
import type { AccountSession } from "../api/account";

const ACCOUNT_SESSION_KEY = "uzhhorod-digital.account-session.v1";
let pendingWrite = Promise.resolve();

export async function restoreSecureSession(): Promise<AccountSession | null> {
  try {
    const serialized = await SecureStore.getItemAsync(ACCOUNT_SESSION_KEY);
    if (!serialized) return null;
    const session = JSON.parse(serialized) as Partial<AccountSession>;
    if (typeof session.accessToken !== "string" || !session.accessToken || typeof session.preferences?.email !== "string" || !session.preferences.email) return null;
    if (!session.favorites || !Array.isArray(session.favorites.routeIds) || !Array.isArray(session.favorites.stopIds)) return null;
    if ([...session.favorites.routeIds, ...session.favorites.stopIds].some((id) => typeof id !== "string")) return null;
    if ((["alert", "news", "transport", "silence"] as const).some((key) => typeof session.preferences![key] !== "boolean")) return null;
    return session as AccountSession;
  } catch {
    return null;
  }
}

export function persistSecureSession(session: AccountSession) {
  const serialized = JSON.stringify(session);
  const write = pendingWrite.catch(() => undefined).then(() => SecureStore.setItemAsync(ACCOUNT_SESSION_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }));
  pendingWrite = write;
  return write;
}

export function clearSecureSession() {
  const write = pendingWrite.catch(() => undefined).then(() => SecureStore.deleteItemAsync(ACCOUNT_SESSION_KEY));
  pendingWrite = write;
  return write;
}
