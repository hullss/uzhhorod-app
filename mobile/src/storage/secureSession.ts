import * as SecureStore from "expo-secure-store";
import type { AccountSession } from "../api/account";

const ACCOUNT_SESSION_KEY = "uzhhorod-digital.account-session.v1";

export async function restoreSecureSession(): Promise<AccountSession | null> {
  try {
    const serialized = await SecureStore.getItemAsync(ACCOUNT_SESSION_KEY);
    if (!serialized) return null;
    const session = JSON.parse(serialized) as Partial<AccountSession>;
    if (!session.accessToken || !session.preferences?.email || !session.favorites) return null;
    return session as AccountSession;
  } catch {
    return null;
  }
}

export async function persistSecureSession(session: AccountSession) {
  await SecureStore.setItemAsync(ACCOUNT_SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSecureSession() {
  await SecureStore.deleteItemAsync(ACCOUNT_SESSION_KEY);
}
