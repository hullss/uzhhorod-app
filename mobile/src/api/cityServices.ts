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
