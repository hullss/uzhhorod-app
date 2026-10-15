import { ApiError, requestJson } from "./request";

export type AccountSession = {
  accessToken: string;
  preferences: {
    email: string;
    language: string;
    alert: boolean;
    news: boolean;
    transport: boolean;
    silence: boolean;
  };
  favorites: {
    routeIds: string[];
    stopIds: string[];
  };
};

const accountDataError = () => new ApiError("Сервіс повернув некоректні дані. Спробуйте оновити сторінку.");
function decodePreferences(value: unknown): AccountSession["preferences"] {
  if (!value || typeof value !== "object") throw accountDataError();
  const v = value as AccountSession["preferences"];
  if (typeof v.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) || !["uk", "en"].includes(v.language) || [v.alert, v.news, v.transport, v.silence].some(item => typeof item !== "boolean")) throw accountDataError();
  return { email: v.email, language: v.language, alert: v.alert, news: v.news, transport: v.transport, silence: v.silence };
}
function decodeFavorites(value: unknown): AccountSession["favorites"] {
  if (!value || typeof value !== "object") throw accountDataError();
  const v = value as AccountSession["favorites"];
  const ids = (items: unknown): string[] => {
    if (!Array.isArray(items) || items.length > 500 || items.some(id => typeof id !== "string" || !id.trim() || id.length > 100)) throw accountDataError();
    return [...new Set(items.map(id => id.trim()))];
  };
  return { routeIds: ids(v.routeIds), stopIds: ids(v.stopIds) };
}
export function decodeAccountSession(value: unknown): AccountSession {
  if (!value || typeof value !== "object") throw accountDataError();
  const v = value as AccountSession;
  if (typeof v.accessToken !== "string" || !v.accessToken.trim() || v.accessToken.length > 4096) throw accountDataError();
  return { accessToken: v.accessToken, preferences: decodePreferences(v.preferences), favorites: decodeFavorites(v.favorites) };
}

async function authenticate(path: "/register" | "/login", email: string, password: string): Promise<AccountSession> {
  return requestJson<AccountSession>(`/api/account${path}`, "Не вдалося виконати дію. Перевірте пошту та пароль.", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    statusMessage: (status) => status === 409
      ? "Ця електронна пошта вже зареєстрована. Увійдіть у свій акаунт."
      : status === 429
        ? "Забагато спроб. Спробуйте ще раз пізніше."
        : status === 404
          ? "Сервіс акаунтів тимчасово недоступний. Спробуйте пізніше."
          : status === 401
            ? "Пошта або пароль неправильні."
            : status >= 500
              ? "На сервері виникла помилка. Спробуйте пізніше."
              : "Не вдалося виконати дію. Перевірте пошту та пароль.",
  }).then(decodeAccountSession);
}

export function isExpiredAccountSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function registerAccount(email: string, password: string) {
  return authenticate("/register", email, password);
}

export function loginAccount(email: string, password: string) {
  return authenticate("/login", email, password);
}

export async function refreshAccountSession(accessToken: string): Promise<AccountSession> {
  const headers = { "Authorization": `Bearer ${accessToken}` };
  const [preferencesResult, favoritesResult] = await Promise.allSettled([
    requestJson<AccountSession["preferences"]>("/api/account/preferences", "Не вдалося оновити налаштування акаунта.", { headers }),
    requestJson<AccountSession["favorites"]>("/api/account/favorites", "Не вдалося оновити обране.", { headers }),
  ]);
  // Prefer an explicit 401 even if the other endpoint failed offline first.
  for (const result of [preferencesResult, favoritesResult]) {
    if (result.status === "rejected" && isExpiredAccountSession(result.reason)) throw result.reason;
  }
  if (preferencesResult.status === "rejected") throw preferencesResult.reason;
  if (favoritesResult.status === "rejected") throw favoritesResult.reason;
  return decodeAccountSession({ accessToken, preferences: preferencesResult.value, favorites: favoritesResult.value });
}

export async function recoverAccountSession(stored: AccountSession): Promise<AccountSession | null> {
  try { return await refreshAccountSession(stored.accessToken); }
  catch (error) {
    // Network failures, 404, 429 and 5xx do not revoke the saved credentials.
    if (isExpiredAccountSession(error)) return null;
    return stored;
  }
}

export async function logoutAccount(accessToken: string) {
  try { await requestJson<void>("/api/account/session", "Не вдалося вийти з акаунта. Спробуйте ще раз.", {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` },
  }); } catch (error) { if (!isExpiredAccountSession(error)) throw error; }
}

export async function deleteAccount(accessToken: string) {
  // A 401 does NOT prove that the account was deleted.
  await requestJson<void>("/api/account", "Не вдалося видалити акаунт. Спробуйте ще раз.", {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
}

export async function changeAccountPassword(accessToken: string, currentPassword: string, newPassword: string) {
  return requestJson<AccountSession>("/api/account/password", "Не вдалося змінити пароль.", {
    method: "PUT",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
    statusMessage: (status) => status === 401 ? "Поточний пароль неправильний або сесія завершилася. Увійдіть ще раз." : "Не вдалося змінити пароль.",
  }).then(decodeAccountSession);
}

export async function updateAccountFavorites(accessToken: string, routeIds: string[], stopIds: string[]) {
  return requestJson<AccountSession["favorites"]>("/api/account/favorites", "Не вдалося зберегти обране. Спробуйте ще раз.", {
    method: "PUT",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ routeIds, stopIds }),
  }).then(decodeFavorites);
}

export function updateAccountPreferences(accessToken: string, preferences: AccountSession["preferences"]) {
  return requestJson<AccountSession["preferences"]>("/api/account/preferences", "Не вдалося зберегти налаштування. Спробуйте ще раз.", {
    method: "PUT",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  }).then(decodePreferences);
}
