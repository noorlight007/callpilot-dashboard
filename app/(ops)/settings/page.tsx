"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, ErrorNotice, PageHeader } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { pilot } from "@/lib/ops/paths";
import { safeUrl } from "@/lib/ops/adapters";
import { newKey } from "@/lib/ops/api";
import { OwnerSettings } from "@/components/ops/owner-settings";

export default function SettingsPage() {
  const { isOwner, me, tenant, call } = useOps();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const link = async (path: string) => {
    // Open synchronously from the click so browsers can allow the OAuth window.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setBusy(true); setError(null); setAuthorizationUrl(null);
    try {
      const response = await call<any>(pilot(tenant!, path), { method: "POST", key: newKey() });
      const url = safeUrl(response.authorization_url);
      if (!url || new URL(url).protocol !== "https:") throw new Error("The server did not return a valid HTTPS authorization URL.");
      if (popup && !popup.closed) popup.location.replace(url);
      setAuthorizationUrl(url);
    } catch (e) { popup?.close(); if ((e as Error)?.name !== "AbortError") setError(e); }
    finally { setBusy(false); }
  };
  return <div className="space-y-8"><PageHeader title="Settings" description={isOwner ? "Platform users, provider connections and organisation configuration." : "Link your own JobAdder account. Organisation administration is available to the owner."} />
    <ErrorNotice error={error} />
    <section aria-label="Your JobAdder connection" className="space-y-3"><h2 className="font-semibold">JobAdder accounts</h2><p className="text-sm">Your personal connection: <Badge tone={me?.ats_connected ? "green" : "amber"}>{me?.ats_connected ? "connected" : "not connected"}</Badge>{me?.ats_user_id && <span className="ml-2 text-gray-500">ATS user #{me.ats_user_id}</span>}</p><p className="text-xs text-gray-500">Each staff member links their own account. The owner connects a separate integration account for background work. After authorization, return here and refresh the connection status.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !me} onClick={() => link("oauth/jobadder/start/")}>{me?.ats_connected ? "Reconnect my JobAdder" : "Connect my JobAdder"}</Button>{isOwner && <Button size="sm" variant="outline" disabled={busy} onClick={() => link("oauth/jobadder/system/start/")}>Connect background integration account</Button>}<Button size="sm" variant="ghost" onClick={() => window.location.reload()}>Refresh connection status</Button></div>
      {authorizationUrl && <a className="block text-sm underline" href={authorizationUrl} target="_blank" rel="noopener noreferrer">Open the JobAdder authorization page</a>}
    </section>
    {isOwner && <OwnerSettings />}
  </div>;
}
