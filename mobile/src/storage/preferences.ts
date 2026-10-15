import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type NotificationPreferences = { alert: boolean; news: boolean; transport: boolean; silence: boolean };
export const DEFAULT_NOTIFICATIONS: NotificationPreferences = { alert: true, news: true, transport: false, silence: false };
export type ThemeMode = "system" | "light" | "dark";
type Preferences = { language: "uk" | "en"; notifications: NotificationPreferences; theme?: ThemeMode; displayName?: string };
const KEY = "uzhhorod-digital.preferences.v1";
let pendingWrite = Promise.resolve();

export async function restorePreferences(): Promise<Preferences | null> {
  await pendingWrite.catch(() => undefined);
  const json = Platform.OS === "web" ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  if (json === null || json === undefined) return null;
  const value = JSON.parse(json) as Partial<Preferences>;
  if (!value || (value.language !== "uk" && value.language !== "en")) throw Error("Invalid saved language");
  if (!value.notifications || Object.keys(DEFAULT_NOTIFICATIONS).some((key) => typeof value.notifications![key as keyof NotificationPreferences] !== "boolean")) throw Error("Invalid saved notifications");
  return { language: value.language, notifications: value.notifications,
    theme: value.theme === "light" || value.theme === "dark" ? value.theme : "system",
    displayName: typeof value.displayName === "string" ? value.displayName.trim().slice(0, 50) : "" };
}

export function persistPreferences(preferences: Preferences) {
  const json = JSON.stringify(preferences);
  const write = pendingWrite.catch(() => undefined).then(async () => {
    if (Platform.OS === "web") globalThis.localStorage.setItem(KEY, json);
    else await SecureStore.setItemAsync(KEY, json);
  });
  pendingWrite = write;
  return write;
}
