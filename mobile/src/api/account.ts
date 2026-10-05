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

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8080";

async function authenticate(path: "/register" | "/login", email: string, password: string): Promise<AccountSession> {
  const response = await fetch(`${apiUrl}/api/account${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const message = response.status === 409
      ? "Ця електронна пошта вже зареєстрована. Увійдіть у свій акаунт."
      : response.status === 429
        ? "Забагато спроб. Спробуйте ще раз через 15 хвилин."
        : response.status === 404
          ? "Сервіс акаунтів ще не оновлено на сервері. Спробуйте пізніше."
          : response.status === 401
            ? "Пошта або пароль неправильні."
            : response.status >= 500
              ? "На сервері виникла помилка. Спробуйте пізніше."
              : "Не вдалося виконати дію. Перевірте пошту та пароль.";
    throw new Error(message);
  }
  return response.json() as Promise<AccountSession>;
}

export function registerAccount(email: string, password: string) {
  return authenticate("/register", email, password);
}

export function loginAccount(email: string, password: string) {
  return authenticate("/login", email, password);
}

export async function refreshAccountSession(accessToken: string): Promise<AccountSession> {
  const headers = { "Authorization": `Bearer ${accessToken}` };
  const [preferencesResponse, favoritesResponse] = await Promise.all([
    fetch(`${apiUrl}/api/account/preferences`, { headers }),
    fetch(`${apiUrl}/api/account/favorites`, { headers }),
  ]);
  if (!preferencesResponse.ok || !favoritesResponse.ok) {
    throw new Error("Сесія більше не дійсна.");
  }
  return {
    accessToken,
    preferences: await preferencesResponse.json() as AccountSession["preferences"],
    favorites: await favoritesResponse.json() as AccountSession["favorites"],
  };
}

export async function logoutAccount(accessToken: string) {
  const response = await fetch(`${apiUrl}/api/account/session`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 401) {
    throw new Error("Не вдалося вийти з акаунта. Спробуйте ще раз.");
  }
}

export async function deleteAccount(accessToken: string) {
  const response = await fetch(`${apiUrl}/api/account`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 401) {
    throw new Error("Не вдалося видалити акаунт. Спробуйте ще раз.");
  }
}

export async function changeAccountPassword(accessToken: string, currentPassword: string, newPassword: string) {
  const response = await fetch(`${apiUrl}/api/account/password`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Поточний пароль неправильний." : "Не вдалося змінити пароль.");
  }
  return response.json() as Promise<AccountSession>;
}

export async function updateAccountFavorites(accessToken: string, routeIds: string[], stopIds: string[]) {
  const response = await fetch(`${apiUrl}/api/account/favorites`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ routeIds, stopIds }),
  });
  if (!response.ok) {
    throw new Error("Не вдалося зберегти обране. Спробуйте ще раз.");
  }
  return response.json() as Promise<AccountSession["favorites"]>;
}
