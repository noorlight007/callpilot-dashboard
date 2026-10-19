"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { Require } from "@/components/ops/shell";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { useOps } from "@/lib/ops/session";
import { ops } from "@/lib/ops/paths";

const REPORTS = [
  ["daily_brief", "Daily brief"], ["consultant_activity", "Consultant activity"],
  ["pipeline", "Pipeline"], ["starters", "Starters"],
  ["dormant_clients", "Dormant clients"], ["expiring_documents", "Document expiry"],
] as const;

export default function ReportsPage() {
  const { epoch } = useOps();
  return <Require owner><ReportsWorkspace key={epoch} /></Require>;
}

function ReportsWorkspace() {
  const [name, setName] = useState<string>(REPORTS[0][0]);
  const [days, setDays] = useState("90");
  const [cutoff, setCutoff] = useState("");
  const isSnapshot = name === "dormant_clients" || name === "expiring_documents";
  const query = isSnapshot ? cutoff ? { [name === "dormant_clients" ? "inactive_since" : "expires_before"]: cutoff } : { days: String(Math.max(1, Math.min(3650, Number(days) || 1))) } : {};
  const report = useOpsFetch(ops(`reports/${name}/`), { query });
  const data = report.data?.data;
  const briefs = useOpsFetch(name === "daily_brief" ? ops("daily-briefs/") : null);
  const outbox = useOpsFetch(name === "daily_brief" ? ops("email/outbox/") : null);
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Source ATS rows and operational snapshots with their coverage metadata." />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Report selection">
        {REPORTS.map(([key, label]) => <Button key={key} aria-pressed={name === key} size="sm" variant={name === key ? "default" : "outline"} onClick={() => { setName(key); setCutoff(""); setDays(key === "expiring_documents" ? "30" : "90"); }}>{label}</Button>)}
      </div>
      {isSnapshot && <div className="grid sm:grid-cols-2 gap-3"><div><Label htmlFor="report-days">Days {name === "dormant_clients" ? "inactive" : "until expiry"}</Label><Input id="report-days" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} disabled={!!cutoff} /></div><div><Label htmlFor="report-cutoff">Override cutoff date</Label><Input id="report-cutoff" type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} /></div></div>}
      <ErrorNotice error={report.error} />
      {report.data && <p className="text-xs text-gray-500">Source: {report.data.source} · filters: {JSON.stringify(report.data.filters)}</p>}
      {data && !Array.isArray(data) && (data.coverage || data.generated_at || data.configuration_required) && <div className="text-sm border border-amber-200 rounded-lg p-3 space-y-1" role="status">
        {data.coverage && <p>Coverage: {data.coverage}</p>}
        {data.complete === false && <p>Incomplete snapshot: these records do not establish complete ATS totals.</p>}
        {data.configuration_required && <p>{data.configuration_required}</p>}
        {data.inspected !== undefined && <p>Inspected {data.inspected} · stale {data.stale_records} · missing date {data.missing_date} · limit {data.limit}</p>}
        {data.oldest_sync && <p>Oldest synchronization: {data.oldest_sync}</p>}
        {data.generated_at && <p>Generated: {data.generated_at}</p>}
      </div>}
      {report.loading && !report.data ? <Loading /> : report.data && <Json value={data} />}
      {name === "daily_brief" && <section aria-label="Stored briefs" className="pt-4 space-y-2">
        <h2 className="font-semibold text-sm">Stored daily snapshots (latest 30)</h2>
        <ErrorNotice error={briefs.error ?? outbox.error} />
        {briefs.loading && !briefs.data ? <Loading /> : listOf(briefs.data).length === 0 ? <Empty>No stored daily briefs.</Empty> : <ul className="divide-y border rounded-lg text-sm">{listOf(briefs.data).map((brief) => {
          const email = listOf(outbox.data).find((item) => item.id === brief.outbox_id);
          return <li key={brief.id} className="p-3 space-y-2"><div>{brief.date} <Badge tone={email?.status === "sent" ? "green" : "gray"}>{email?.status ?? (brief.outbox_id ? "delivery status outside available history" : "stored; no email queued")}</Badge></div>{brief.outbox_id && <p className="text-xs text-gray-500">Outbox {brief.outbox_id}</p>}<details><summary className="cursor-pointer">View stored snapshot</summary><Json value={brief.data} /></details></li>;
        })}</ul>}
      </section>}
    </div>
  );
}
