"use client";

import { useState } from "react";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, statusTone } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { pilot } from "@/lib/ops/paths";

export default function ActivityPage() {
  const { tenant, isOwner } = useOps();
  const actions = useOpsFetch(pilot(tenant!, "actions/"), { pollMs: 10000 });
  const [open, setOpen] = useState<number | null>(null);
  const rows = listOf(actions.data);
  return (
    <div>
      <PageHeader title="Activity" description={isOwner ? "All actions across the organisation." : "Your queued, completed and failed actions."} />
      <ErrorNotice error={actions.error} />
      {actions.loading && !actions.data ? <Loading /> : rows.length === 0 ? <Empty>No actions yet.</Empty> : (
        <ul className="divide-y border rounded-lg">
          {rows.map((a: any) => (
            <li key={a.id} className="p-3 text-sm">
              <button className="w-full text-left flex items-center gap-2" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                <span className="font-medium">#{a.id}</span>
                <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                {a.uncertain_outcome && <Badge tone="amber">uncertain</Badge>}
                <span className="text-gray-500 truncate">{a.section} {a.operation} {a.target}</span>
              </button>
              {open === a.id && <div className="mt-2"><ActionPanel id={a.id} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
