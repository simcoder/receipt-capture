export class ApiTransportError extends Error {
  constructor() {
    super("api unavailable");
    this.name = "ApiTransportError";
  }
}

export type ApiResult = {
  ok: boolean;
  status: number;
  payload: unknown;
};

export async function apiRequest(input: {
  apiUrl: string;
  idToken: string | null;
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<ApiResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    ...(input.idToken ? { authorization: `Bearer ${input.idToken}` } : {}),
    ...(input.body !== undefined ? { "content-type": "application/json" } : {}),
  };
  let response: Response;
  try {
    response = await fetchImpl(`${input.apiUrl.replace(/\/$/, "")}${input.path}`, {
      method: input.method,
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
  } catch {
    throw new ApiTransportError();
  }
  const payload: unknown = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  if ("error" in payload && typeof payload.error === "string") return payload.error;
  if ("message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}
