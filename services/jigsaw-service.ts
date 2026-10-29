import { BASE_URL } from '@/lib/baseUrl';
import { authService, cookieUtils } from '@/services/auth-service';

export class JigsawApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
let refreshInFlight: Promise<boolean> | null = null;
async function refreshAccess() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = cookieUtils.get('refresh');
      if (!refresh) return false;
      const response = await authService.refreshToken(refresh);
      if (!response.ok) return false;
      const data = await response.json();
      cookieUtils.set('access', data.access, 7);
      if (data.refresh) cookieUtils.set('refresh', data.refresh, 7);
      return true;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  const access = cookieUtils.get('access');
  if (access) headers.set('Authorization', `Bearer ${access}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${BASE_URL.replace(/\/$/, '')}${path}`, { ...options, headers, cache: 'no-store' });
  if (response.status === 401 && retry && await refreshAccess()) return apiRequest<T>(path, options, false);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || data.error || data.message;
    const message = typeof detail === 'string' ? detail : Object.keys(data).length ? JSON.stringify(data) : `Request failed (${response.status}).`;
    throw new JigsawApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  if (response.headers.get('content-type')?.includes('json')) return response.json();
  return response.blob() as Promise<T>;
}
export function jigsaw<T>(path: string, method = 'GET', data?: unknown) {
  return apiRequest<T>(`/jigsaw/${path}`, { method, ...(data === undefined ? {} : { body: data instanceof FormData ? data : JSON.stringify(data) }) });
}
export function results<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = value as { results?: T[] } | null;
  return data?.results || [];
}
export type JsonRecord = Record<string, any>;
export interface Contact { uid: string; name: string; kind: string; phone: string; email: string; status: string; favourite: boolean; ats_id: string; ats_url: string; skills: string[]; metadata: JsonRecord; }
export interface Message { uid: string; contact: string | null; to_number: string; body: string; channel: string; direction: string; status: string; template: string; attachments?: JsonRecord[]; created_at: string; }
export interface Alert { uid: string; title: string; body: string; kind: string; read: boolean; action: string; payload: JsonRecord; resolved_at?: string | null; created_at: string; }
export interface Device { uid: string; name: string; platform: string; last_seen_at: string; revoked_at: string | null; }
export interface Command { uid: string; name: string; phrases: string[]; action: string; status_name: string; enabled: boolean; confidence_threshold: number; }
export interface Layer { number: number; key: string; name: string; status: string; enabled: boolean; }
export interface Overview { organization: { uid: string; name: string }; mode: string; observation_started_at: string; layers: Layer[]; metrics: Record<string, number>; recent_events: JsonRecord[]; capabilities: JsonRecord; }
export interface AgencySettings { mode: string; observation_started_at: string; settings: JsonRecord; }
