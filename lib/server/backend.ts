import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS = "cp_access";
const REFRESH = "cp_refresh";
const REMEMBER = "cp_remember";
const MARKER = "cp_session";
const SESSION_ID = "cp_session_id";
// Short-lived in-flight responses must not revive a signed-out session.
// Multi-instance deployments must replace this map with their shared session store.
const revoked = new Map<string, number>();
function retire(id: string | undefined) {
  const now = Date.now();
  for (const [key, until] of revoked) if (until <= now) revoked.delete(key);
  if (id) revoked.set(id, now + 7 * 86400_000);
}
class SessionRetired extends Error {
  constructor() { super("This request belongs to a previous sign-in. Reload the page."); }
}
class BackendUnavailable extends Error {
  constructor(public status = 503) { super("The authentication service is temporarily unavailable. Try again shortly."); }
}
const NO_STORE = { "Cache-Control": "private, no-store" };

export function upstreamBase(): string {
  const configured = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new Error("Set API_BASE_URL to the Django API origin before starting the dashboard.");
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("API_BASE_URL must be an HTTP(S) API origin or /api/v1 URL.");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  if (!url.pathname) url.pathname = "/api/v1";
  return url.toString().replace(/\/$/, "");
}

/** Cookie-authenticated writes are accepted only from this dashboard's origin. */
export function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: NO_STORE });
}

export async function clearSession() {
  const jar = await cookies();
  retire(jar.get(SESSION_ID)?.value);
  for (const name of [ACCESS, REFRESH, REMEMBER, MARKER, SESSION_ID, "cp_login_remember", "access", "refresh"]) jar.delete(name);
}

async function saveSession(data: { access: string; refresh?: string }, remember: boolean, existingId?: string) {
  const jar = await cookies();
  if (existingId && revoked.has(existingId)) return false;
  if (!existingId) retire(jar.get(SESSION_ID)?.value);
  const sessionId = existingId ?? randomUUID();
  const options = {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
    path: "/", ...(remember ? { maxAge: 7 * 86400 } : {}),
  };
  jar.set(SESSION_ID, sessionId, options);
  jar.set(ACCESS, data.access, options);
  if (data.refresh) jar.set(REFRESH, data.refresh, options);
  jar.set(REMEMBER, remember ? "1" : "0", options);
  // This flag preserves existing dashboard session checks without exposing a credential.
  jar.set(MARKER, "1", { ...options, httpOnly: false });
  jar.delete("access");
  jar.delete("refresh");
  return true;
}

type Tokens = { access: string; refresh?: string };
// Coalesce refreshes from concurrent inbox/queue/mail requests, including rotated tokens.
const refreshes = new Map<string, { promise: Promise<Tokens | null>; expires: number }>();
async function refreshSession(signal?: AbortSignal): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(REFRESH)?.value;
  const sessionId = jar.get(SESSION_ID)?.value;
  if (sessionId && revoked.has(sessionId)) throw new SessionRetired();
  if (!token || !sessionId) return null;
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
  const now = Date.now();
  for (const [key, entry] of refreshes) if (entry.expires < now) refreshes.delete(key);
  let entry = refreshes.get(token);
  if (!entry) {
    const promise = (async () => {
      const res = await fetch(`${upstreamBase()}/token/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: token }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 400 || res.status === 401) return null;
      if (!res.ok) throw new BackendUnavailable(res.status === 429 ? 429 : 503);
      const data = await res.json();
      if (typeof data.access !== "string") throw new BackendUnavailable();
      return data as Tokens;
    })();
    entry = { promise, expires: now + 30_000 };
    refreshes.set(token, entry);
  }
  let tokens: Tokens | null;
  try { tokens = await entry.promise; }
  catch (error) { refreshes.delete(token); throw error; }
  if (revoked.has(sessionId)) throw new SessionRetired();
  if (!tokens) { refreshes.delete(token); return null; }
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
  if (!await saveSession(tokens, jar.get(REMEMBER)?.value === "1", sessionId)) throw new SessionRetired();
  return tokens.access;
}

/** Authenticate against Django and set HttpOnly cookies; never return tokens to the browser. */
export async function signIn(request: Request, otp = false) {
  if (!sameOrigin(request)) return json({ detail: "Cross-origin request refused." }, 403);
  try {
    const body = await request.json();
    const jar = await cookies();
    const remember = otp ? jar.get("cp_login_remember")?.value === "1" : body.remember_me === true;
    const payload = otp ? { challenge_id: body.challenge_id, otp_code: body.otp_code } : {
      email: body.email, password: body.password, remember_me: remember,
    };
    const res = await fetch(`${upstreamBase()}/token${otp ? "/verify-otp" : ""}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      cache: "no-store", redirect: "manual", signal: request.signal,
    });
    const data = await res.json().catch(() => ({ detail: "Invalid authentication response." }));
    if (!res.ok) return json(data, res.status >= 400 ? res.status : 502);
    if (data.otp_required) {
      jar.set("cp_login_remember", remember ? "1" : "0", {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
      });
      return json({ otp_required: true, challenge_id: data.challenge_id });
    }
    if (typeof data.access !== "string" || typeof data.refresh !== "string") return json({ detail: "Invalid authentication response." }, 502);
    await saveSession(data, remember);
    jar.delete("cp_login_remember");
    return json({ authenticated: true });
  } catch {
    return json({ detail: "Unable to reach the authentication service. Check API_BASE_URL and try again." }, 502);
  }
}

export async function sessionStatus(request: Request, forceRefresh = false) {
  if (!sameOrigin(request)) return json({ detail: "Cross-origin request refused." }, 403);
  try {
    const jar = await cookies();
    const id = jar.get(SESSION_ID)?.value;
    if (id && revoked.has(id)) throw new SessionRetired();
    if (!id) { await clearSession(); return json({ authenticated: false }, 401); }
    let access = forceRefresh ? await refreshSession(request.signal) : jar.get(ACCESS)?.value;
    if (access && !forceRefresh) {
      const res = await fetch(`${upstreamBase()}/token/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: access }),
        cache: "no-store", redirect: "manual",
      });
      if (!res.ok) access = await refreshSession(request.signal) ?? undefined;
    } else if (!access && !forceRefresh) access = await refreshSession(request.signal) ?? undefined;
    if (!access) { await clearSession(); return json({ authenticated: false }, 401); }
    return json({ authenticated: true });
  } catch (error) { return json({ detail: error instanceof BackendUnavailable || error instanceof SessionRetired ? error.message : "Unable to check your session. Try again." }, error instanceof BackendUnavailable ? error.status : error instanceof SessionRetired ? 409 : 502); }
}

/** Fixed-upstream authenticated proxy. Forward only the caller's tenant and idempotency context. */
export async function proxyBackend(request: Request, path: string): Promise<NextResponse> {
  if (!sameOrigin(request)) return json({ detail: "Cross-origin request refused." }, 403);
  if (!path.startsWith("/") || path.includes("..") || /[\\?#]/.test(path) || /^\/token(?:\/|$)/.test(path)) {
    return json({ detail: "Invalid API path." }, 400);
  }
  try {
    const jar = await cookies();
    const publicPath = /^\/auth\/organizations\/(forget_password|reset_password|verify\/[a-zA-Z0-9_-]+)$/.test(path);
    const id = jar.get(SESSION_ID)?.value;
    if (!publicPath && id && revoked.has(id)) throw new SessionRetired();
    if (!publicPath && !id) return json({ detail: "Session expired. Sign in again." }, 401);
    let access = publicPath ? undefined : jar.get(ACCESS)?.value;
    if (!access && !publicPath) access = await refreshSession(request.signal) ?? undefined;
    if (!access && !publicPath) return json({ detail: "Session expired. Sign in again." }, 401);
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 32 * 1024 * 1024) return json({ detail: "Request exceeds the 32 MiB upload limit." }, 413);
    const headers = new Headers(access ? { Authorization: `Bearer ${access}` } : undefined);
    for (const name of ["content-type", "x-tenant-id", "idempotency-key", "accept"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const send = () => fetch(`${upstreamBase()}${path}${new URL(request.url).search}`, {
      method: request.method, headers, body, cache: "no-store", redirect: "manual", signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
    let res = await send();
    if (res.status === 401 && !publicPath) {
      access = await refreshSession(request.signal) ?? undefined;
      if (!access) { await clearSession(); return json({ detail: "Session expired. Sign in again." }, 401); }
      headers.set("Authorization", `Bearer ${access}`);
      res = await send();
    }
    if (res.status >= 300 && res.status < 400) return json({ detail: "Unexpected API redirect. Verify the API URL and route's trailing slash." }, 502);
    const outgoing = new Headers(NO_STORE);
    for (const name of ["content-type", "content-disposition"]) {
      const value = res.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    return new NextResponse(res.body, { status: res.status, headers: outgoing });
  } catch (error) {
    if (request.signal.aborted) return json({ detail: "Request cancelled." }, 499);
    return json({ detail: error instanceof BackendUnavailable || error instanceof SessionRetired ? error.message : "Unable to reach the API. Check the server API_BASE_URL and connection before retrying." }, error instanceof BackendUnavailable ? error.status : error instanceof SessionRetired ? 409 : 502);
  }
}
