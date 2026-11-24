import { ApiError } from "./api";

export type AdminPayload = {
  ok: boolean;
  msg?: string;
  code?: string;
  [key: string]: unknown;
};

export async function requestAdmin<T extends AdminPayload>(
  accessToken: string,
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown>; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method || "GET";
  let response: Response;
  try {
    response = await fetch(`/api/admin/${path}`, {
      method,
      credentials: "include",
      signal: options.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new ApiError("Administrator service is temporarily unavailable.", 0);
  }
  const payload = await response.json().catch(() => null) as AdminPayload | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Administrator request failed.", response.status, payload?.code);
  }
  return payload as T;
}
