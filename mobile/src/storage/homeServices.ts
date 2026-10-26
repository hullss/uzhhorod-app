import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const HOME_SERVICE_IDS = ["transport", "parking", "transport-payment", "power-outages", "cnap", "accessibility", "shelters", "polls", "waste", "miniatures", "donations", "events"] as const;
export type HomeServiceId = typeof HOME_SERVICE_IDS[number];
export const MAX_HOME_SERVICES = 6;
export const DEFAULT_HOME_SERVICES: HomeServiceId[] = ["transport", "parking", "transport-payment"];
const KEY = "uzhhorod-digital.home-services.v1";
let pendingWrite = Promise.resolve();

export function decodeHomeServices(value: unknown): HomeServiceId[] {
  if (!Array.isArray(value) || value.length > MAX_HOME_SERVICES || value.some(id => typeof id !== "string")
      || new Set(value).size !== value.length) throw new Error("Invalid home services");
  // Retired shortcuts may be dropped without resetting the user's other choices.
  return value.filter((id): id is HomeServiceId => HOME_SERVICE_IDS.includes(id as HomeServiceId));
}

export async function restoreHomeServices(): Promise<HomeServiceId[]> {
  await pendingWrite.catch(() => undefined);
  const json = Platform.OS === "web" ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return json == null ? [...DEFAULT_HOME_SERVICES] : decodeHomeServices(JSON.parse(json));
}

export function persistHomeServices(ids: HomeServiceId[]) {
  const json = JSON.stringify(decodeHomeServices(ids));
  const write = pendingWrite.catch(() => undefined).then(async () => {
    if (Platform.OS === "web") globalThis.localStorage.setItem(KEY, json);
    else await SecureStore.setItemAsync(KEY, json);
  });
  pendingWrite = write;
  return write;
}
