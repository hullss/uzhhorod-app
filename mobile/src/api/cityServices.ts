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

export type OfficialNewsArticle = {
  title: string;
  sourceUrl: string;
  publishedLabel: string | null;
  preview: string;
};

export type CurrencyRate = {
  code: "USD" | "EUR" | "HUF" | "CZK";
  buy: number;
  sell: number;
  updatedAt: string;
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
  installedAt: string;
  summary: string;
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

export type SafetyMapPoint = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type SafetyMapPoints = {
  fetchedAt: string;
  stale: boolean;
  points: SafetyMapPoint[];
};

export type EditorialEvent = {
  id: string;
  title: string;
  dateLabel: string;
  day: number;
  time?: string;
  venue: string;
  category: string;
  sourceUrl: string;
};

export type EditorialEvents = { items: EditorialEvent[] };

export type EditorialDefenderFund = {
  id: string;
  title: string;
  description: string;
  donationUrl: string;
  verifiedAt: string;
  verificationSource: string;
};

export type EditorialDefenderFunds = { items: EditorialDefenderFund[] };

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8080";
const requestTimeoutMs = 8_000;

async function request<T>(path: string, unavailableMessage: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiUrl}${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${unavailableMessage}: HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${unavailableMessage}: сервер не відповів за 8 секунд.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`${unavailableMessage}: перевірте бекенд і EXPO_PUBLIC_API_URL.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAccessibleBuildings(query?: string): Promise<AccessibleBuildingList> {
  const normalizedQuery = query?.trim();
  const path = normalizedQuery
    ? `/api/city-services/accessibility/buildings?query=${encodeURIComponent(normalizedQuery)}`
    : "/api/city-services/accessibility/buildings";
  return request(path, "Не вдалося завантажити реєстр");
}

export async function getLatestOpenDataDatasets(): Promise<OpenDataDatasetList> {
  return request("/api/city-services/open-data/datasets", "Не вдалося завантажити оновлення даних");
}

export async function getOfficialNews(forceRefresh = false): Promise<OfficialNewsList> {
  const path = forceRefresh ? "/api/city-services/news?refresh=1" : "/api/city-services/news";
  return request(path, "Не вдалося завантажити офіційні новини");
}

export async function getOfficialNewsArticle(item: OfficialNewsItem): Promise<OfficialNewsArticle> {
  const params = new URLSearchParams({ url: item.sourceUrl });
  if (item.publishedLabel) {
    params.set("publishedLabel", item.publishedLabel);
  }
  return request(`/api/city-services/news/article?${params.toString()}`, "Не вдалося завантажити короткий перегляд новини");
}

export async function getCurrencyRates(): Promise<CurrencyRates> {
  return request("/api/city-services/currency", "Не вдалося завантажити курси валют");
}

export async function getWeather(): Promise<Weather> {
  return request("/api/city-services/weather", "Не вдалося завантажити погоду");
}

export async function getMiniSculptures(): Promise<MiniSculptureList> {
  return request("/api/city-services/miniatures", "Не вдалося завантажити мініскульптури");
}

export async function getAirAlertStatus(): Promise<AirAlertStatus> {
  return request("/api/city-services/alerts/status", "Не вдалося завантажити статус тривоги");
}

export async function getAirAlertEvents(): Promise<AirAlertEvents> {
  return request("/api/city-services/alerts/events", "Не вдалося завантажити історію тривог");
}

export async function getSafetyMapPoints(kind: "shelters" | "resilience"): Promise<SafetyMapPoints> {
  return request(`/api/city-services/maps/${kind}`, "Не вдалося завантажити позначки мапи");
}

export async function getEditorialEvents(): Promise<EditorialEvents> {
  return request("/api/editorial/events", "Не вдалося завантажити події");
}

export async function getEditorialDefenderFunds(): Promise<EditorialDefenderFunds> {
  return request("/api/editorial/defender-funds", "Не вдалося завантажити перевірені збори");
}
