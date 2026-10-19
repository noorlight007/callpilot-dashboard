"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, ConfirmYesDialog, Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { useMutation } from "@/components/ops/forms";
import { Require } from "@/components/ops/shell";
import { campaignExpired, parseCampaignRecipients } from "@/components/ops/operations-contracts";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";
import { AutomationEditor } from "@/components/ops/automation-editor";

const MAX_RECIPIENTS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AutomationsPage() {
  const { epoch, isOwner } = useOps();
  return <Require full>{isOwner ? <OwnerWorkspace key={epoch} /> : <StaffWorkspace key={epoch} />}</Require>;
}

function StaffWorkspace() {
  // Full staff may propose campaigns; definition and run APIs are owner-only.
  return <div className="space-y-6"><PageHeader title="Campaigns" description="Propose a campaign using an enabled automation shared by your owner." /><Campaigns /></div>;
}

function OwnerWorkspace() {
  const { call } = useOps();
  const definitions = useOpsFetch(ops("automations/"));
  const runs = useOpsFetch(ops("automations/runs/"), { pollMs: 30000 });
  const [editor, setEditor] = useState<{ definition?: any } | null>(null);
  const starters = useMutation(async (_payload: Record<string, never>, key) => { const result = await call(ops("automations/starters/"), { method: "POST", key }); definitions.reload(); return result; });
  const pause = useMutation(async (id: string, key) => { const result = await call(ops(`automations/${id}/`), { method: "PATCH", body: { enabled: false }, key }); definitions.reload(); runs.reload(); return result; });
  return <div className="space-y-8">
    <PageHeader title="Automations" description="Configure disabled starters, review send settings, then enable deliberately.">
      <Button size="sm" onClick={() => setEditor({})}>New automation</Button>
      <Button size="sm" variant="outline" disabled={starters.busy} onClick={() => starters.submit({})}>Install disabled starters</Button>
    </PageHeader>
    <ErrorNotice error={starters.error ?? pause.error} />
    {editor && <AutomationEditor key={editor.definition?.id ?? "new"} initial={editor.definition} onSaved={definitions.reload} onClose={() => setEditor(null)} />}
    <section aria-label="Definitions" className="space-y-2">
      <h2 className="font-semibold text-sm">Definitions</h2>
      <ErrorNotice error={definitions.error} />
      {definitions.loading && !definitions.data ? <Loading /> : listOf(definitions.data).length === 0 ? <Empty>No automations. Install disabled starters or create one.</Empty> : <ul className="divide-y border rounded-lg">{listOf(definitions.data).map((definition) => <li key={definition.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div><span className="font-medium">{definition.name}</span> <Badge tone={definition.enabled ? "green" : "gray"}>{definition.enabled ? "enabled" : "paused"}</Badge><p className="text-xs text-gray-500 mt-1">Trigger: {definition.trigger} · {definition.steps?.length ?? 0} steps</p><p className="text-xs text-gray-500 break-all">Automation ID for permitted campaign users: {definition.id}</p></div>
        <span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditor({ definition })}>{definition.enabled ? "Edit" : "Configure / enable"}</Button>{definition.enabled && <Button size="sm" variant="outline" disabled={pause.busy} onClick={() => pause.submit(definition.id)}>Pause</Button>}</span>
      </li>)}</ul>}
    </section>
    <section aria-label="Runs" className="space-y-2">
      <h2 className="font-semibold text-sm">Runs (latest 100)</h2>
      <ErrorNotice error={runs.error} />
      {runs.loading && !runs.data ? <Loading /> : listOf(runs.data).length === 0 ? <Empty>No runs.</Empty> : <ul className="divide-y border rounded-lg">{listOf(runs.data).map((run) => <li key={run.id} className="p-3 space-y-1 text-sm"><div><Badge>{run.status}</Badge> {run.recipient} · step {run.step_index + 1} · due {run.due_at}</div>{run.stop_reason && <p>Stopped: {run.stop_reason}</p>}{run.last_error && <p className="text-red-700">{run.last_error}</p>}{run.payload?._alert && <p role="status" className="text-amber-700">Alert: {run.payload._alert}</p>}</li>)}</ul>}
    </section>
    <Campaigns definitions={listOf(definitions.data)} />
  </div>;
}

function Campaigns({ definitions }: { definitions?: any[] }) {
  const { call, isFull } = useOps();
  const campaigns = useOpsFetch(ops("campaigns/"), { pollMs: 20000 });
  const [name, setName] = useState("");
  const [automation, setAutomation] = useState("");
  const [raw, setRaw] = useState("phone,email,name\n");
  const [review, setReview] = useState<any | null>(null);
  const [consent, setConsent] = useState(false);
  let recipients: ReturnType<typeof parseCampaignRecipients> = [], parseError: unknown = null;
  try { recipients = parseCampaignRecipients(raw); } catch (error) { parseError = error; }
  const create = useMutation(async (payload: { name: string; automation_id: string; recipients: typeof recipients }, key) => {
    if (payload.recipients.length < 1 || payload.recipients.length > MAX_RECIPIENTS) throw new Error(`Use 1 to ${MAX_RECIPIENTS} deduplicated recipients.`);
    const campaign = await call(ops("campaigns/"), { method: "POST", key, body: { ...payload, idempotency_key: key } });
    setReview(campaign); campaigns.reload(); return campaign;
  });
  return <section aria-label="Campaigns" className="space-y-3">
    <h2 className="font-semibold text-sm">Campaign proposals</h2>
    <p className="text-xs text-gray-500">Your own proposals appear below. Creating one freezes the deduplicated recipients and content for 15 minutes. Sending requires your separate literal YES confirmation.</p>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (parseError || !consent || create.busy) return; void create.submit({ name: name.trim(), automation_id: automation, recipients }); }}>
      <fieldset disabled={create.busy} className="space-y-2">
        <Label htmlFor="campaign-name">Name</Label><Input id="campaign-name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Label htmlFor="campaign-automation">Enabled automation</Label>
        {definitions ? <select id="campaign-automation" className="block w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={automation} onChange={(e) => setAutomation(e.target.value)}><option value="">Select enabled automation…</option>{definitions.filter((definition) => definition.enabled).map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select> : <><Input id="campaign-automation" placeholder="Automation UUID supplied by your owner" required value={automation} onChange={(e) => setAutomation(e.target.value.trim())} /><p className="text-xs text-gray-500">Definition management is owner-only. The server validates this automation belongs to the tenant and is enabled; review its frozen content before confirming.</p></>}
        <Label htmlFor="campaign-recipients">Recipients (CSV: phone,email,name) — {recipients.length} after deduplication, maximum {MAX_RECIPIENTS}</Label>
        <Textarea id="campaign-recipients" rows={6} className="font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} />
        <p className="text-xs text-gray-500">Use E.164 phone numbers. Quote names containing commas. Duplicate phone numbers, or emails where phone is empty, keep their first row.</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I have checked consent for the selected recipients and channels.</label>
      </fieldset>
      <ErrorNotice error={parseError ?? create.error} />
      {recipients.length > MAX_RECIPIENTS && <p role="alert" className="text-sm text-red-700">Reduce the list to {MAX_RECIPIENTS} recipients.</p>}
      <Button type="submit" disabled={!isFull || !name.trim() || !UUID.test(automation) || !consent || !!parseError || recipients.length === 0 || recipients.length > MAX_RECIPIENTS || create.busy}>{create.busy ? "Creating proposal…" : "Create proposal"}</Button>
    </form>
    {review && <CampaignReview key={review.id} campaign={review} onClose={() => setReview(null)} onDone={campaigns.reload} />}
    <h3 className="font-semibold text-sm pt-4">Your existing proposals (latest 100)</h3>
    <ErrorNotice error={campaigns.error} />
    {campaigns.loading && !campaigns.data ? <Loading /> : listOf(campaigns.data).length === 0 ? <Empty>No campaigns.</Empty> : <ul className="divide-y border rounded-lg">{listOf(campaigns.data).map((campaign) => {
      const status = campaign.status === "awaiting_confirmation" && campaignExpired(campaign.expires_at) ? "expired" : campaign.status;
      return <li key={campaign.id} className="p-3 text-sm flex flex-wrap items-center justify-between gap-3"><div>{campaign.name} <Badge tone={status === "awaiting_confirmation" ? "amber" : "gray"}>{status}</Badge><p className="text-xs text-gray-500">{campaign.recipients?.length} recipients · expires {campaign.expires_at}</p></div><Button size="sm" variant="outline" onClick={() => setReview(campaign)}>{status === "awaiting_confirmation" ? "Review proposal" : "View snapshot"}</Button></li>;
    })}</ul>}
  </section>;
}

function CampaignSnapshot({ campaign }: { campaign: any }) {
  const recipients: any[] = campaign.recipients ?? [];
  return <div className="space-y-2">
    <p>Expires {new Date(campaign.expires_at).toLocaleString()} · automation {campaign.automation_id}</p>
    <p><strong>{recipients.length}</strong> deduplicated recipients (complete list):</p>
    <Json value={recipients} />
    <p>Exact frozen steps and content:</p><Json value={campaign.steps} />
    <p className="text-xs text-gray-500">Subsequent definition edits cannot change these steps. Stop conditions are frozen by the server with the proposal, including mandatory opt-out; this API does not expose that snapshot.</p>
  </div>;
}

function CampaignReview({ campaign, onClose, onDone }: { campaign: any; onClose: () => void; onDone: () => void }) {
  const { call, isFull } = useOps();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = campaignExpired(campaign.expires_at, now);
  if (expired || campaign.status !== "awaiting_confirmation" || !isFull) return <div className="border rounded-lg p-4 space-y-3" role="region" aria-label="Campaign snapshot"><h3 className="font-semibold">{campaign.name}</h3><p role="status">{expired && campaign.status === "awaiting_confirmation" ? "This proposal has expired. Create a new explicit proposal to send." : `Campaign status: ${campaign.status}`}</p><CampaignSnapshot campaign={campaign} /><Button variant="outline" onClick={onClose}>Close snapshot</Button></div>;
  return <ConfirmYesDialog open onClose={onClose} title={`Confirm campaign "${campaign.name}"`} confirmLabel="Confirm campaign" onConfirm={async () => {
    if (campaignExpired(campaign.expires_at)) throw new Error("This proposal expired. Create a new explicit proposal.");
    // Both create and GET return only the signed-in requester's campaigns.
    const result = await call(ops(`campaigns/${campaign.id}/confirm/`), { method: "POST", body: { answer: "YES" } });
    onDone();
    if (result.status === "expired" || result.status === "cancelled") throw new Error(`The server marked this campaign ${result.status}. Nothing was confirmed.`);
  }}><CampaignSnapshot campaign={campaign} /></ConfirmYesDialog>;
}
