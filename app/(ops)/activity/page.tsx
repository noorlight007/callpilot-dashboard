"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, statusTone } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { pilot } from "@/lib/ops/paths";

export default function ActivityPage() {
  const { tenant, isOwner } = useOps();
  const actions = useOpsFetch(pilot(tenant!, "actions/"), { pollMs: 10000 });
  const [open, setOpen] = useState<number | null>(null); const [status, setStatus] = useState("all"); const [includeReads, setIncludeReads] = useState(false);
  const rows = listOf(actions.data).filter((action) => (includeReads || !["list", "get", "read", "search"].includes(action.operation)) && (status === "all" || action.status === status));
  return <div><PageHeader title="Activity" description={isOwner ? "Latest 100 actions across the organisation, including queued, completed and failed work." : "Your latest 100 actions, including queued, completed and failed work."}><Button size="sm" variant="outline" onClick={actions.reload}>Refresh actions</Button></PageHeader>
    <div className="flex flex-wrap gap-4 items-end mb-4"><div><Label htmlFor="action-status">Action status</Label><select id="action-status" className="block border rounded p-2 text-sm bg-transparent" value={status} onChange={(event) => setStatus(event.target.value)}>{["all", "awaiting_confirmation", "queued", "running", "succeeded", "failed", "dead_letter"].map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></div><label className="flex gap-2 items-center text-sm pb-2"><input type="checkbox" checked={includeReads} onChange={(event) => setIncludeReads(event.target.checked)} />Include read actions</label></div>
    <ErrorNotice error={actions.error} />
    {actions.loading && !actions.data ? <Loading /> : rows.length === 0 ? <Empty>No matching actions in the latest snapshot.</Empty> : <ul className="divide-y border rounded-lg">{rows.map((action) => <li key={action.id} className="p-3 text-sm"><button type="button" className="w-full text-left flex flex-wrap items-center gap-2" aria-expanded={open === action.id} aria-controls={`action-${action.id}`} onClick={() => setOpen(open === action.id ? null : action.id)}><span className="font-medium">#{action.id}</span><Badge tone={statusTone(action.status)}>{action.status.replaceAll("_", " ")}</Badge>{action.uncertain_outcome && <Badge tone="amber">owner reconciliation required</Badge>}<span className="text-gray-500 truncate">{action.section} · {action.operation} · {action.target || "new record"}</span>{action.created_at && <span className="text-gray-500 text-xs">{new Date(action.created_at).toLocaleString()}</span>}</button>{open === action.id && <div id={`action-${action.id}`} className="mt-3"><ActionPanel key={action.id} id={action.id} onSettled={actions.reload} /></div>}</li>)}</ul>}
  </div>;
}
