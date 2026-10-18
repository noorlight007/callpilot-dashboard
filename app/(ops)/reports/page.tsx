"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { Require } from "@/components/ops/shell";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";

const REPORTS = [
  ["daily-brief", "Daily brief"],
  ["activity", "Consultant activity"],
  ["pipeline", "Pipeline"],
  ["dormant-clients", "Dormant clients"],
  ["expiry", "Document expiry"],
] as const;

export default function ReportsPage() {
  return <Require owner><Inner /></Require>;
}

function Inner() {
  const [name, setName] = useState<string>(REPORTS[0][0]);
  const r = useOpsFetch(ops(`reports/${name}/`));
  const d = r.data;
  const briefs = useOpsFetch(name === "daily-brief" ? ops("daily-briefs/") : null);
  return (
    <div>
      <PageHeader title="Reports" />
      <div className="flex flex-wrap gap-1 mb-4" role="tablist">
        {REPORTS.map(([k, l]) => <Button key={k} role="tab" aria-selected={name === k} size="sm" variant={name === k ? "default" : "outline"} onClick={() => setName(k)}>{l}</Button>)}
      </div>
      <ErrorNotice error={r.error} />
      {(d?.coverage || d?.stale || d?.generated_at) && (
        <p className="text-xs text-amber-700 mb-2">Coverage: {JSON.stringify(d.coverage ?? null)} {d.stale ? "· data may be stale" : ""} {d.generated_at ? `· generated ${d.generated_at}` : ""}</p>
      )}
      {r.loading && !d ? <Loading /> : <Json value={d} />}
      {name === "daily-brief" && (
        <section aria-label="Stored briefs" className="mt-6 space-y-2">
          <h2 className="font-semibold text-sm">Stored daily snapshots</h2>
          <ErrorNotice error={briefs.error} />
          <ul className="divide-y border rounded-lg text-sm">
            {listOf(briefs.data).map((b: any) => <li key={b.id} className="p-2 flex gap-2">{b.date ?? b.created_at} <Badge tone={b.delivered ? "green" : "amber"}>{b.delivery_state ?? b.status ?? "pending"}</Badge></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
