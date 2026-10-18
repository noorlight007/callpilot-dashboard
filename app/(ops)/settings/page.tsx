"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, ErrorNotice, PageHeader } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { pilot } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import { OwnerSettings } from "@/components/ops/owner-settings";

export default function SettingsPage() {
  const { isOwner, me, tenant, call } = useOps();
  const [err, setErr] = useState<unknown>(null);
  const link = async (path: string) => {
    try {
      setErr(null);
      const r: any = await call(pilot(tenant!, path), { method: "POST", key: newKey() });
      const url = r.authorization_url ?? r.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { setErr(e); }
  };
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" />
      <ErrorNotice error={err} />
      <section aria-label="JobAdder">
        <h2 className="font-semibold text-sm mb-2">JobAdder</h2>
        <p className="text-sm mb-2">Your link: <Badge tone={me?.ats_connected ? "green" : "amber"}>{me?.ats_connected ? "connected" : "not connected"}</Badge></p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => link("oauth/jobadder/start/")}>{me?.ats_connected ? "Reconnect my JobAdder" : "Connect my JobAdder"}</Button>
          {isOwner && <Button size="sm" variant="outline" onClick={() => link("oauth/jobadder/system/start/")}>Connect system account</Button>}
        </div>
      </section>
      {isOwner && <OwnerSettings />}
    </div>
  );
}
