import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { addressKey, decodeAddress, type PowerAddress } from "../power/model";
const KEY = "uzhhorod-digital.power-address.v1";
let pending = Promise.resolve();
export type AddressBook = { addresses: PowerAddress[]; defaultKey: string | null };
export function decodeAddressBook(value: unknown): AddressBook {
  const legacy = decodeAddress(value);
  if (legacy) return { addresses: [legacy], defaultKey: addressKey(legacy) };
  const raw = value as Partial<AddressBook>;
  if (!raw || !Array.isArray(raw.addresses) || raw.addresses.length > 10) throw new Error("Invalid address book");
  const addresses = raw.addresses.map(decodeAddress);
  if (addresses.some(a => !a) || new Set(addresses.map(a => addressKey(a!))).size !== addresses.length) throw new Error("Invalid addresses");
  const safe = addresses as PowerAddress[];
  return { addresses: safe, defaultKey: typeof raw.defaultKey === "string" && safe.some(a => addressKey(a) === raw.defaultKey) ? raw.defaultKey : safe[0] ? addressKey(safe[0]) : null };
}
export async function restoreAddressBook(): Promise<AddressBook> {
  const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return raw ? decodeAddressBook(JSON.parse(raw)) : { addresses: [], defaultKey: null };
}
export async function restorePowerAddress(): Promise<PowerAddress | null> {
  const book = await restoreAddressBook();
  return book.addresses.find(a => addressKey(a) === book.defaultKey) ?? null;
}
async function writeBook(safe: AddressBook) {
    if (Platform.OS === "web") {
      if (safe.addresses.length) globalThis.localStorage?.setItem(KEY, JSON.stringify(safe));
      else globalThis.localStorage?.removeItem(KEY);
    } else if (safe.addresses.length) await SecureStore.setItemAsync(KEY, JSON.stringify(safe), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
}
export function persistAddressBook(book: AddressBook) {
  const safe = decodeAddressBook(book);
  const write = pending.catch(() => undefined).then(() => writeBook(safe));
  pending = write; return write;
}
export function persistPowerAddress(address: PowerAddress | null) {
  const safe = decodeAddress(address);
  const write = pending.catch(() => undefined).then(async () => {
    const book = await restoreAddressBook();
    const addresses = safe ? [...book.addresses.filter(a => addressKey(a) !== addressKey(safe)), safe] : book.addresses.filter(a => addressKey(a) !== book.defaultKey);
    if (addresses.length > 10) throw new Error("Address limit reached");
    await writeBook({ addresses, defaultKey: safe ? addressKey(safe) : addresses[0] ? addressKey(addresses[0]) : null });
  });
  pending = write;
  return write;
}
