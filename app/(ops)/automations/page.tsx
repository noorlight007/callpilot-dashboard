"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, ConfirmYesDialog, Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { Require } from "@/components/ops/shell";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import { AutomationEditor } from "@/components/ops/automation-editor";

export default function AutomationsPage() {
  return <Require full><Inner /></Require>;
}

const MAX_RECIPIENTS = 1000;

function Inner() {
  const { call, isOwner } = useOps();
  const defs = useOpsFetch(ops("automations/"));
  const runs = useOpsFetch(ops("automations/runs/"), { pollMs: 30000 });
  const campaigns = useOpsFetch(ops("campaigns/"));
  const [err, setErr] = useState<unknown>(null);
  const [editor, setEditor] = useState<{ def?: any } | null>(null);
  const run = async (fn: () => Promise<any>, after: () => void) => { try { setErr(null); await fn(); after(); } catch (e) { setErr(e); } };

  return (
    <div className="space-y-8">
      <PageHeader title="Automations">
        {isOwner && <>
        <Button size="sm" onClick={() => setEditor({})}>New automation</Button>
        <Button size="sm" variant="outline" onClick={() => run(() => call(ops("automations/starters/"), { method: "POST", key: newKey() }), defs.reload)}>Install starters (disabled)</Button>
        </>}
      </PageHeader>
      <ErrorNotice error={err ?? defs.error} />
      {editor && <AutomationEditor key={editor.def?.id ?? "new"} initial={editor.def} onSaved={defs.reload} onClose={() => setEditor(null)} />}
      <section aria-label="Definitions">
        {defs.loading && !defs.data ? <Loading /> : listOf(defs.data).length === 0 ? <Empty>No automations.</Empty> : (
          <ul className="divide-y border rounded-lg">
            {listOf(defs.data).map((d: any) => (
              <li key={d.id} className="p-3 text-sm flex items-center justify-between gap-2">
                <div><span className="font-medium">{d.name}</span> <Badge tone={d.enabled ? "green" : "gray"}>{d.enabled ? "enabled" : "paused"}</Badge></div>
                {isOwner && <span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditor({ def: d })}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => run(() => call(ops(`automations/${d.id}/`), { method: "PATCH", body: { enabled: !d.enabled } }), defs.reload)}>{d.enabled ? "Pause" : "Enable"}</Button></span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Runs">
        <h2 className="font-semibold text-sm mb-2">Runs</h2>
        <ErrorNotice error={runs.error} />
        {listOf(runs.data).length === 0 ? <Empty>No runs.</Empty> : (
          <ul className="divide-y border rounded-lg">
            {listOf(runs.data).map((r: any) => <li key={r.id} className="p-3 text-xs">{r.status} · step {r.step ?? "—"} · due {r.due_at ?? "—"} {r.stop_reason ? `· stopped: ${r.stop_reason}` : ""} {r.error ? `· ${r.error}` : ""}</li>)}
          </ul>
        )}
      </section>
      <Campaigns defs={listOf(defs.data)} campaigns={campaigns} />
    </div>
  );
}

function Campaigns({ defs, campaigns }: { defs: any[]; campaigns: { data: any; reload: () => void } }) {
  const { call, can } = useOps();
  const canBulk = can("can_bulk_send");
  const [name, setName] = useState("");
  const [automation, setAutomation] = useState("");
  const [raw, setRaw] = useState("phone,email,name\n");
  const [err, setErr] = useState<unknown>(null);
  const [review, setReview] = useState<any | null>(null);
  const key = useRef(newKey());

  const parse = () => {
    const seen = new Set<string>();
    return raw.split("\n").slice(1).map((l) => l.split(",").map((s) => s.trim())).filter((c) => c[0] || c[1]).map(([phone, email, nm]) => ({ phone, email, name: nm }))
      .filter((r) => { const k = `${r.phone}|${r.email}`; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const recipients = parse();
  const create = async () => {
    try {
      setErr(null);
      if (recipients.length > MAX_RECIPIENTS) throw new Error(`A campaign can contain at most ${MAX_RECIPIENTS} recipients.`);
      const c = await call(ops("campaigns/"), { method: "POST", key: key.current, body: { name, automation_id: automation, recipients, idempotency_key: key.current } });
      key.current = newKey(); setReview(c); campaigns.reload();
    } catch (e) { setErr(e); }
  };
  return (
    <section aria-label="Campaigns" className="space-y-3">
      <h2 className="font-semibold text-sm">Campaigns</h2>
      {!canBulk && <p role="status" className="text-sm text-amber-700">Your role can&apos;t create bulk sends. Ask an owner.</p>}
      <p className="text-xs text-gray-500">Creating a campaign only proposes it. Nothing is sent until you type YES on the review screen.</p>
      <Label htmlFor="cn">Name</Label><Input id="cn" value={name} onChange={(e) => setName(e.target.value)} />
      <Label htmlFor="ca">Automation</Label>
      <select id="ca" className="block border rounded-md px-2 py-2 text-sm bg-transparent" value={automation} onChange={(e) => setAutomation(e.target.value)}><option value="">Select…</option>{defs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      <Label htmlFor="cr">Recipients (CSV: phone,email,name) — {recipients.length} after de-duplication</Label>
      <Textarea id="cr" rows={5} className="font-mono text-xs" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <ErrorNotice error={err} />
      <Button onClick={create} disabled={!canBulk || !name || !automation || recipients.length === 0}>Create proposal</Button>
      {review && <CampaignReview c={review} onClose={() => setReview(null)} onDone={campaigns.reload} />}
      <h3 className="font-semibold text-sm pt-4">Existing</h3>
      {listOf(campaigns.data).length === 0 ? <Empty>No campaigns.</Empty> : (
        <ul className="divide-y border rounded-lg">
          {listOf(campaigns.data).map((c: any) => (
            <li key={c.id} className="p-3 text-sm flex justify-between"><span>{c.name} <Badge tone={c.status === "awaiting_confirmation" ? "amber" : "gray"}>{c.status}</Badge></span>
              {c.status === "awaiting_confirmation" && <Button size="sm" variant="outline" onClick={() => setReview(c)}>Review</Button>}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CampaignReview({ c, onClose, onDone }: { c: any; onClose: () => void; onDone: () => void }) {
  const { call } = useOps();
  const recipients: any[] = c.recipients ?? [];
  return (
    <ConfirmYesDialog open onClose={onClose} title={`Confirm campaign "${c.name}"`} confirmLabel="Send campaign" onConfirm={async () => { await call(ops(`campaigns/${c.id}/confirm/`), { method: "POST", body: { answer: "YES" }, key: `campaign-confirm-${c.id}` }); onDone(); }}>
      {c.expires_at && <p>Expires {new Date(c.expires_at).toLocaleString()}</p>}
      <p><strong>{recipients.length}</strong> recipients:</p>
      <ul className="max-h-40 overflow-auto text-xs border rounded p-2">{recipients.map((r, i) => <li key={i}>{r.name} {r.phone} {r.email}</li>)}</ul>
      <p>Approved steps &amp; content (frozen snapshot):</p>
      <Json value={c.steps} />
      <p className="text-xs text-gray-500">Stop conditions (including opt-out) apply as configured on the automation; the backend does not return a frozen copy of them.</p>
    </ConfirmYesDialog>
  );
}
