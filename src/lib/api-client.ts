/**
 * Thin fetch wrapper for the Cloudflare Workers API.
 *
 * All requests go through here so that:
 *  - the base URL is configured in one place (via VITE_API_BASE_URL)
 *  - credentials (HttpOnly auth cookie) are always included consistently
 *  - error handling / JSON parsing is consistent across the app
 *
 * Public (non-admin) content reads currently fall back to local seed data
 * in `src/data/*` via the hooks in `src/hooks/useContent.ts` when
 * VITE_API_BASE_URL is not set, so the frontend runs standalone during
 * early development before the Worker + D1 backend is deployed.
 */

// Deliberately NO hardcoded fallback domain here. A placeholder fallback
// silently sends every request to a Worker that isn't yours, which is
// indistinguishable from "broken" -- login fails, images never load, and
// there's no error that points at the real cause. If VITE_API_BASE_URL
// isn't set, API_BASE_URL is '' and `hasLiveApi` below is false, so the
// app correctly falls back to local seed data instead of failing silently
// against the wrong backend.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  /** Full parsed JSON error body, when the response had one. Lets callers read structured fields beyond just `error` (e.g. checkout's 409 stock-conflict response includes `productId`/`availableStock` so the UI can react precisely, not just display text). */
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends RequestInit {
  /** Parse response as JSON (default true). */
  json?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json = true, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include', // send the HttpOnly auth cookie
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let body: unknown;
    try {
      body = await response.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // response had no JSON body; keep generic message
    }
    throw new ApiError(message, response.status, body);
  }

  if (!json || response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/** Whether a live backend URL is configured. */
export const hasLiveApi = API_BASE_URL.length > 0;

/**
 * The resolved API base URL. Exported so any code that needs to build a
 * raw fetch() call outside of `api.*` (e.g. file uploads using FormData,
 * which can't go through apiFetch's JSON-only body handling) uses the
 * exact same URL as everything else, instead of re-reading the env var
 * and risking a different (or missing) fallback.
 */
export { API_BASE_URL };
