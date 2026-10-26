import { requestJson } from "./request";
import { decodeMiniatures } from "../miniatures/catalog";
import { decodeBuildings, decodeCurrency, decodeFunds, decodeNews, decodeWeather } from "./catalogues";
import { decodeEventCatalog, type EventCatalog } from "../events/catalog";
import { decodeOfficialNewsArticle, type OfficialNewsArticle } from "../news/article";
import { decodeSafetyMapPoints, type SafetyMapPoints } from "../maps/safety";
export type { SafetyMapPoint, SafetyMapPoints } from "../maps/safety";
export type { OfficialNewsArticle } from "../news/article";

export type AccessibleBuilding = {
  id: string;
  name: string;
  address: string;
  monitoredAt: string | null;
};

export type AccessibleBuildingList = {
  fetchedAt: string;
  stale: boolean;
  buildings: AccessibleBuilding[];
};

export type OpenDataDataset = {
  title: string;
  description: string;
  sourceUrl: string;
  updatedAt: string | null;
};

export type OpenDataDatasetList = {
  fetchedAt: string;
  stale: boolean;
  datasets: OpenDataDataset[];
};

export type OfficialNewsItem = {
  title: string;
  sourceUrl: string;
  publishedLabel: string | null;
};

export type OfficialNewsList = {
  fetchedAt: string;
  stale: boolean;
  items: OfficialNewsItem[];
};

export type CurrencyRate = {
  code: "USD" | "EUR" | "HUF" | "CZK";
  buy: number;
  sell: number;
  updatedAt: string;
  reference?: boolean;
};

export type CurrencyRates = {
  fetchedAt: string;
  stale: boolean;
  rates: CurrencyRate[];
};

export type WeatherHour = {
  time: string;
  temperatureC: number;
  feelsLikeC: number;
  condition: string;
  iconUrl: string;
  chanceOfRain: number;
  windKph: number;
};

export type WeatherDay = {
  date: string;
  minTemperatureC: number;
  maxTemperatureC: number;
  condition: string;
  iconUrl: string;
  chanceOfRain: number;
  sunrise: string;
  sunset: string;
  hours: WeatherHour[];
};

export type Weather = {
  fetchedAt: string;
  stale: boolean;
  current: {
    temperatureC: number;
    feelsLikeC: number;
    condition: string;
    iconUrl: string;
    windKph: number;
    humidity: number;
    airQuality: {
      index: number;
      pm25: number;
      pm10: number;
    } | null;
    observedAt: string;
  };
  days: WeatherDay[];
};

export type MiniSculpture = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
  author: string;
  installedAt: string | null;
  installedYear?: number;
  summary: string;
  sourceUrls?: string[];
};

export type MiniSculptureList = {
  sourceCheckedAt: string;
  verificationNotice: string;
  sculptures: MiniSculpture[];
};

export type AirAlertStatus = {
  state: "CLEAR" | "ACTIVE" | "UNAVAILABLE";
  title: string;
  detail: string;
  fetchedAt: string;
  stale: boolean;
};

export type AirAlertEvent = {
  state: "CLEAR" | "ACTIVE";
  title: string;
  detail: string;
  occurredAt: string;
};

export type AirAlertEvents = {
  events: AirAlertEvent[];
};

export type EditorialEvents = EventCatalog;

export type EditorialDefenderFund = {
  id: string;
  title: string;
  description: string;
  donationUrl: string;
  verifiedAt: string;
  verificationSource: string;
};

export type EditorialDefenderFunds = { items: EditorialDefenderFund[] };

async function request<T>(path: string, unavailableMessage: string): Promise<T> {
  return requestJson<T>(path, `${unavailableMessage}. Спробуйте ще раз.`);
}

export async function getAccessibleBuildings(query?: string): Promise<AccessibleBuildingList> {
  const normalizedQuery = query?.trim();
  const path = normalizedQuery
    ? `/api/city-services/accessibility/buildings?query=${encodeURIComponent(normalizedQuery)}`
    : "/api/city-services/accessibility/buildings";
  return decodeBuildings(await request(path, "Не вдалося завантажити реєстр"));
}

export async function getLatestOpenDataDatasets(): Promise<OpenDataDatasetList> {
  return request("/api/city-services/open-data/datasets", "Не вдалося завантажити оновлення даних");
}

export async function getOfficialNews(forceRefresh = false): Promise<OfficialNewsList> {
  const path = forceRefresh ? "/api/city-services/news?refresh=1" : "/api/city-services/news";
  return decodeNews(await request(path, "Не вдалося завантажити офіційні новини"));
}

export async function getOfficialNewsArticle(item: OfficialNewsItem): Promise<OfficialNewsArticle> {
  const params = new URLSearchParams({ url: item.sourceUrl });
  if (item.publishedLabel) {
    params.set("publishedLabel", item.publishedLabel);
  }
  const response = await request<unknown>(`/api/city-services/news/article?${params.toString()}`, "Не вдалося завантажити новину");
  return decodeOfficialNewsArticle(response, item);
}

export async function getCurrencyRates(): Promise<CurrencyRates> {
  return decodeCurrency(await request("/api/city-services/currency", "Не вдалося завантажити курси валют"));
}

export async function getWeather(): Promise<Weather> {
  return decodeWeather(await request("/api/city-services/weather", "Не вдалося завантажити погоду"));
}

export async function getMiniSculptures(): Promise<MiniSculptureList> {
  return decodeMiniatures(await request("/api/city-services/miniatures", "Не вдалося завантажити мініскульптури"));
}

export async function getAirAlertStatus(): Promise<AirAlertStatus> {
  return request("/api/city-services/alerts/status", "Не вдалося завантажити статус тривоги");
}

export async function getAirAlertEvents(): Promise<AirAlertEvents> {
  return request("/api/city-services/alerts/events", "Не вдалося завантажити історію тривог");
}

export async function getSafetyMapPoints(kind: "shelters" | "resilience"): Promise<SafetyMapPoints> {
  return decodeSafetyMapPoints(await request<unknown>(`/api/city-services/maps/${kind}`, "Не вдалося завантажити позначки мапи"));
}

export async function getEditorialEvents(): Promise<EditorialEvents> {
  return decodeEventCatalog(await request<unknown>("/api/editorial/events", "Не вдалося завантажити події"));
}

export async function getEditorialDefenderFunds(): Promise<EditorialDefenderFunds> {
  return decodeFunds(await request("/api/editorial/defender-funds", "Не вдалося завантажити перевірені збори"));
}
