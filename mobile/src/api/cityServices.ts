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
  code: "USD" | "EUR" | "HUF" | "PLN";
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

export async function getOfficialNews(): Promise<OfficialNewsList> {
  return request("/api/city-services/news", "Не вдалося завантажити офіційні новини");
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
