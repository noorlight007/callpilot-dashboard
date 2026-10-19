/** Keep provider callbacks and sign-in continuation on the page where the user began. */
const CALLBACK_KEYS = ["jobadder", "jobadder_error"];

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


const JOBADDER_FAILURE_MESSAGES: Record<string, string> = {
  "application_not_configured": "Configure PILOT_JOBADDER_CLIENT_ID, PILOT_JOBADDER_CLIENT_SECRET and the registered HTTPS callback in the Django environment.",
  "connector_missing": "Add a JobAdder ATS connector in Settings before connecting an account.",
  "connector_inactive": "Your JobAdder connector is inactive. Open Provider connectors → Configure, enable Active connector and save, then connect again.",
  "credential_storage": "The server cannot encrypt provider credentials. Check PILOT_ENCRYPTION_KEY and restart Django before connecting again.",
  "client_credentials_rejected": "JobAdder rejected the application client credentials. Check PILOT_JOBADDER_CLIENT_ID and PILOT_JOBADDER_CLIENT_SECRET in the Django environment.",
  "application_not_authorized": "JobAdder has not authorized this application for the requested connection. Check the application approval and permissions.",
  "authorization_code_rejected": "JobAdder rejected the authorization code. Check the exact registered callback URI, then start a new connection; callback codes cannot be reused.",
  "scope_rejected": "JobAdder rejected the requested OAuth scopes. Check PILOT_JOBADDER_SCOPES against the scopes granted to this application.",
  "access_denied": "JobAdder authorization was cancelled or denied. Start a new connection and approve access if intended.",
  "api_url_rejected": "JobAdder returned an API URL outside the approved configuration. Check the exact regional host in PILOT_JOBADDER_ALLOWED_HOSTS, including the sandbox host if used.",
  "account_binding_missing": "JobAdder did not return the required account and instance identifiers. Check the application grant with JobAdder.",
  "account_mismatch": "This JobAdder account does not match the account already bound to this tenant. Connect the correct account or ask the owner to review the tenant binding.",
  "owner_connection_required": "The tenant owner must connect the first JobAdder account before staff can link their personal accounts.",
  "offline_token_missing": "JobAdder did not return a refresh token. Ensure offline_access is granted, then start a new connection.",
  "provider_unavailable": "The JobAdder authorization service is temporarily unavailable. Start a new connection after the service recovers.",
  "provider_response_invalid": "JobAdder returned an unexpected authorization response. Check the provider service and application grant, then start a new connection.",
  "connection_failed": "JobAdder could not be connected. Review the connector diagnostic and server configuration, then start a new connection."
};

export function jobAdderFailure(params: Pick<URLSearchParams, "get">): string {
  const code = params.get("jobadder_error") ?? "";
  return Object.prototype.hasOwnProperty.call(JOBADDER_FAILURE_MESSAGES, code) ? JOBADDER_FAILURE_MESSAGES[code] : JOBADDER_FAILURE_MESSAGES.connection_failed;
}
