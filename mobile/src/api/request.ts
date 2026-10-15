const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8080";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number | null = null) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  statusMessage?: (status: number) => string;
};

// Keep the timeout active through body parsing, not just until response headers arrive.
// No retries for writes: a timed-out request may already have reached the server.
export async function requestJson<T>(path: string, message: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8_000, statusMessage, ...init } = options;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError("Сервер не відповідає. Перевірте інтернет і спробуйте ще раз."));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${apiUrl}${path}`, { ...init, signal: controller.signal });
        if (!response.ok) throw new ApiError(statusMessage?.(response.status) ?? message, response.status);
        if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
        const body = await response.text();
        return body ? JSON.parse(body) as T : undefined as T;
      })(),
      timedOut,
    ]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError) throw new ApiError("Сервер повернув некоректні дані. Спробуйте ще раз.");
    throw new ApiError("Не вдалося з’єднатися із сервером. Перевірте інтернет і спробуйте ще раз.");
  } finally {
    clearTimeout(timer);
  }
}
