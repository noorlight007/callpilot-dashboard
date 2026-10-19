/** Keep provider callbacks and sign-in continuation on the page where the user began. */
const CALLBACK_KEYS = ["jobadder"];

export function jobAdderReturnTo(currentUrl: string): string {
  const url = new URL(currentUrl);
  for (const key of CALLBACK_KEYS) url.searchParams.delete(key);
  return url.toString();
}

export type JobAdderResult = "connected" | "error" | null;
export function jobAdderResult(params: Pick<URLSearchParams, "get">): JobAdderResult {
  const status = params.get("jobadder");
  return status === "connected" || status === "error" ? status : null;
}

/** Never turn a `next` parameter into an external/open redirect after sign-in. */
export function signInReturnPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin || /^\/(?:api|login)(?:\/|$)/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

