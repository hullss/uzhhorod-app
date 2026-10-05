// `expo-secure-store` is installed as part of the release setup (see RELEASE.md).
// This declaration keeps source type-checking possible in an offline demo checkout.
declare module "expo-secure-store" {
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY: string;
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string, options?: { keychainAccessible?: string }): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}
