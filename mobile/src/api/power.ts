import { requestJson } from "./request";
import { decodePlaces, decodeStatus, type PowerAddress } from "../power/model";
const message = "Не вдалося перевірити дані обленерго. Спробуйте ще раз або відкрийте сайт оператора.";
export async function getPowerCities() { return decodePlaces(await requestJson("/api/city-services/power/cities", message, { timeoutMs: 30_000 })); }
export async function getPowerStreets(cityId: number) { return decodePlaces(await requestJson(`/api/city-services/power/streets?cityId=${cityId}`, message, { timeoutMs: 30_000 })); }
export async function getPowerStatus(a: PowerAddress) {
  return decodeStatus(await requestJson(`/api/city-services/power/status?cityId=${a.city.id}&streetId=${a.street.id}&building=${encodeURIComponent(a.building)}`, message, { timeoutMs: 40_000 }));
}
