import { BASE_URL } from "@/lib/baseUrl";
import { authService, cookieUtils } from "@/services/auth-service";

export class ApiError extends Error {
  status: number;
  detail: any;
  constructor(status: number, detail: any) {
    super(apiErrorMessage(status, detail));
    this.status = status;
    this.detail = detail;
  }
  get mfaRequired() {
    return this.status === 403 && /mfa|otp|multi.?factor/i.test(JSON.stringify(this.detail ?? ""));
  }
}

export function apiErrorMessage(status: number, detail: any): string {
  if (detail == null) return `Request failed (${status})`;
  if (typeof detail === "string") return detail;
  if (typeof detail.detail === "string") return detail.detail;
  if (typeof detail === "object") {
    const parts = Object.entries(detail).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : v}`
    );
    if (parts.length) return parts.join("\n");
  }
  return `Request failed (${status})`;
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  key?: string;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = cookieUtils.get("refresh");
      if (!refresh) return null;
      const res = await authService.refreshToken(refresh);
      if (!res.ok) return null;
      const data = await res.json();
      cookieUtils.set("access", data.access, 7);
      if (data.refresh) cookieUtils.set("refresh", data.refresh, 7);
      return data.access as string;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export function buildQuery(query?: ApiOptions["query"]) {
  if (!query) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/** Call a tenant-scoped API. `path` is relative to `/api/v1` and keeps its trailing slash. */
export async function api<T = any>(path: string, tenant: number | null, options: ApiOptions = {}): Promise<T> {
  const doFetch = async (token: string | null) =>
    fetch(`${BASE_URL}${path}${buildQuery(options.query)}`, {
      method: options.method ?? "GET",
      signal: options.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenant != null ? { "X-Tenant-ID": String(tenant) } : {}),
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });

  let response = await doFetch(cookieUtils.get("access"));
  if (response.status === 401) {
    const fresh = await refreshAccess();
    if (!fresh) {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, { detail: "Session expired" });
    }
    response = await doFetch(fresh);
  }
  const value = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, value);
  return value as T;
}

/** One idempotency key per user intent; reuse it for retries of the same request. */
export const newKey = () => crypto.randomUUID();

export const enc = encodeURIComponent;
