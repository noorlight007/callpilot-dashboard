"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice } from "@/components/ops/common";
import { useMutation } from "@/components/ops/forms";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";

const REVIEW = ["supplier_review", "identity_review", "classification_review", "ambiguous_review", "unmatched"];

export function MailOwnerTools({ outbox }: { outbox: any[] }) {
  const { call } = useOps();
  const [state, setState] = useState(REVIEW[0]);
  const queue = useOpsFetch(ops("email/search/"), { query: { q: "", state } });
  const reprocess = useMutation(async (id: string, key) => { await call(ops(`email/messages/${id}/reprocess/`), { method: "POST", key }); queue.reload(); });
  const [resolveFor, setResolveFor] = useState<any | null>(null);
  const [result, setResult] = useState("sent");
  const [evidence, setEvidence] = useState("");
  const resolve = useMutation(async (b: { id: string; result: string; evidence: string }, key) => { await call(ops(`email/outbox/${b.id}/resolve/`), { method: "POST", body: { result: b.result, evidence: b.evidence }, key }); setResolveFor(null); setEvidence(""); });
  const [addr, setAddr] = useState("");
  const [optOut, setOptOut] = useState(true);
  const [consentEv, setConsentEv] = useState("");
  const consent = useMutation(async (b: any, key) => { await call(ops("email/consent/"), { method: "POST", body: b, key }); setAddr(""); setConsentEv(""); });
  const [ids, setIds] = useState("");
  const receipts = useMutation(async (b: any, key) => { await call(ops("email/native-receipts/"), { method: "POST", body: b, key }); setIds(""); });
  const unknown = outbox.filter((o) => o.status === "unknown");

  return (
    <div className="space-y-8 mt-8">
      <section aria-label="Held mail review" className="space-y-2">
        <h2 className="font-semibold text-sm">Held mail (owner review)</h2>
        <p className="text-xs text-gray-500">Fix the identity mapping in Settings first, then reprocess. Reprocessing re-runs the backend privacy checks; it does not publish a message.</p>
        <div className="flex flex-wrap gap-1">{REVIEW.map((r) => <Button key={r} size="sm" variant={state === r ? "default" : "outline"} onClick={() => setState(r)}>{r.replace("_", " ")}</Button>)}</div>
        <ErrorNotice error={queue.error ?? reprocess.error} />
        {listOf(queue.data).length === 0 ? <Empty>Nothing in this queue.</Empty> : (
          <ul className="divide-y border rounded-lg">
            {listOf(queue.data).map((m: any) => (
              <li key={m.id} className="p-3 text-sm flex justify-between gap-2"><span className="truncate">{m.subject} — {m.from ?? m.sender}</span><Button size="sm" variant="outline" disabled={reprocess.busy} onClick={() => reprocess.submit(m.id)}>Reprocess</Button></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Uncertain sends" className="space-y-2">
        <h2 className="font-semibold text-sm">Uncertain sends</h2>
        <ErrorNotice error={resolve.error} />
        {unknown.length === 0 ? <Empty>No uncertain sends.</Empty> : unknown.map((o) => (
          <div key={o.id} className="border rounded-lg p-3 text-sm flex justify-between"><span>{o.to} — {o.subject} <Badge tone="amber">unknown</Badge></span><Button size="sm" variant="outline" onClick={() => setResolveFor(o)}>Reconcile</Button></div>
        ))}
        {resolveFor && (
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm">Check the source mailbox&apos;s Sent Items, then record the outcome. Choosing <strong>not sent</strong> permits the email to be delivered again.</p>
            <Label htmlFor="rr">Result</Label>
            <select id="rr" className="block border rounded-md px-2 py-2 text-sm bg-transparent" value={result} onChange={(e) => setResult(e.target.value)}><option value="sent">Sent</option><option value="not_sent">Not sent (allow resend)</option><option value="cancelled">Cancelled</option></select>
            <Label htmlFor="ev">Evidence</Label><Textarea id="ev" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
            <div className="flex gap-2"><Button size="sm" disabled={!evidence.trim() || resolve.busy} onClick={() => resolve.submit({ id: resolveFor.id, result, evidence })}>Record outcome</Button><Button size="sm" variant="outline" onClick={() => setResolveFor(null)}>Cancel</Button></div>
          </div>
        )}
      </section>

      <section aria-label="Email consent" className="space-y-2">
        <h2 className="font-semibold text-sm">Email opt-in / opt-out</h2>
        <ErrorNotice error={consent.error} />
        <Label htmlFor="ca2">Address</Label><Input id="ca2" type="email" value={addr} onChange={(e) => setAddr(e.target.value)} />
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} /> Opted out</label>
        <Label htmlFor="ce">Evidence</Label><Input id="ce" value={consentEv} onChange={(e) => setConsentEv(e.target.value)} />
        <Button size="sm" disabled={!addr || !consentEv || consent.busy} onClick={() => consent.submit({ address: addr, opted_out: optOut, evidence: consentEv })}>Record</Button>
      </section>

      <section aria-label="Native receipts" className="space-y-2">
        <h2 className="font-semibold text-sm">Import ATS-logged Internet-Message-IDs</h2>
        <ErrorNotice error={receipts.error} />
        <Label htmlFor="nr">One ID per line</Label><Textarea id="nr" rows={4} value={ids} onChange={(e) => setIds(e.target.value)} />
        <Button size="sm" disabled={!ids.trim() || receipts.busy} onClick={() => receipts.submit({ message_ids: ids.split("\n").map((s) => s.trim()).filter(Boolean) })}>Import</Button>
      </section>
    </div>
  );
}
