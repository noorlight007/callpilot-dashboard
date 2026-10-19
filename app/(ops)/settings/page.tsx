"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge, ErrorNotice, Loading, PageHeader } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { pilot } from "@/lib/ops/paths";
import { safeUrl } from "@/lib/ops/adapters";
import { jobAdderFailure, jobAdderResult, jobAdderReturnTo } from "@/lib/ops/jobadder-auth";
import { newKey } from "@/lib/ops/api";
import { OwnerSettings } from "@/components/ops/owner-settings";

export default function SettingsPage() {
  return <Suspense fallback={<Loading />}><SettingsContent /></Suspense>;
}

function SettingsContent() {
  const { isOwner, me, tenant, call } = useOps();
  const params = useSearchParams();
  const [result, setResult] = useState(() => jobAdderResult(params));
  const [failureMessage] = useState(() => jobAdderFailure(params));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!result) return;
    // Remove the callback status flag while preserving existing page filters.
    const url = new URL(jobAdderReturnTo(window.location.href));
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [result]);
  const link = async (path: string) => {
    if (busy) return;
    setBusy(true); setError(null); setResult(null); setAuthorizationUrl(null);
    try {
      const response = await call<{ authorization_url: string }>(pilot(tenant!, path), {
        method: "POST", key: newKey(), body: { return_to: jobAdderReturnTo(window.location.href) },
      });
      const url = safeUrl(response.authorization_url);
      if (!url || new URL(url).protocol !== "https:") throw new Error("The server did not return a valid HTTPS authorization URL.");
      setAuthorizationUrl(url);
      // The registered backend callback stores credentials and returns this same tab here.
      window.location.assign(url);
    } catch (e) { if ((e as Error)?.name !== "AbortError") setError(e); setBusy(false); }
  };
  return <div className="space-y-8"><PageHeader title="Settings" description={isOwner ? "Platform users, provider connections and organisation configuration." : "Link your own JobAdder account. Organisation administration is available to the owner."} />
    <ErrorNotice error={error} />
    {result === "connected" && <p role="status" className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">JobAdder connected successfully. Your connection status has been refreshed.</p>}
    {result === "error" && <ErrorNotice error={new Error(failureMessage)} />}
    <section aria-label="Your JobAdder connection" className="space-y-3"><h2 className="font-semibold">JobAdder accounts</h2><p className="text-sm">Your personal connection: <Badge tone={me?.ats_connected ? "green" : "amber"}>{me?.ats_connected ? "connected" : "not connected"}</Badge>{me?.ats_user_id && <span className="ml-2 text-gray-500">ATS user #{me.ats_user_id}</span>}</p><p className="text-xs text-gray-500">Each staff member links their own account. The owner connects a separate integration account for background work. After authorization, you will return to this page and the connection status will refresh automatically.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !me} onClick={() => link("oauth/jobadder/start/")}>{busy ? "Opening JobAdder…" : me?.ats_connected ? "Reconnect my JobAdder" : "Connect my JobAdder"}</Button>{isOwner && <Button size="sm" variant="outline" disabled={busy} onClick={() => link("oauth/jobadder/system/start/")}>Connect background integration account</Button>}<Button size="sm" variant="ghost" onClick={() => window.location.reload()}>Refresh connection status</Button></div>
      {authorizationUrl && <a className="block text-sm underline" href={authorizationUrl}>Continue to the JobAdder authorization page</a>}
    </section>
    {isOwner && <OwnerSettings />}
  </div>;
}
