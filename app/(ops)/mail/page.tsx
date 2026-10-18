"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, statusTone } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import { normalizeMailboxes } from "@/lib/ops/adapters";
import { MailOwnerTools } from "@/components/ops/mail-owner";

const MAX_FILES = 10;
const MAX_TOTAL = 2 * 1024 * 1024;

export default function MailPage() {
  const { call, isOwner } = useOps();
  const boxes = useOpsFetch(ops("mailboxes/"));
  const mailboxes = normalizeMailboxes(boxes.data);
  const [mailbox, setMailbox] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const search = useOpsFetch(mailbox ? ops("email/search/") : null, { query: { q: applied, mailbox_id: mailbox } });
  const outbox = useOpsFetch(ops("email/outbox/"), { pollMs: 20000 });
  const [form, setForm] = useState({ to: "", subject: "", body: "" });
  const [files, setFiles] = useState<{ name: string; content_base64: string; content_type: string; size: number }[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const key = useRef(newKey());
  const total = files.reduce((n, f) => n + f.size, 0);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      next.push({ name: f.name, content_base64: btoa(bin), content_type: f.type || "application/octet-stream", size: f.size });
    }
    if (next.length > MAX_FILES || next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return setErr(new Error("Limit: 10 attachments and 2 MB combined."));
    setErr(null); setFiles(next);
  };
  const send = async () => {
    try {
      setErr(null); setSent(false);
      await call(ops("email/send/"), { method: "POST", key: key.current, body: { ...form, mailbox_id: mailbox, idempotency_key: key.current, attachments: files.map((f) => ({ name: f.name, content_base64: f.content_base64, content_type: f.content_type })) } });
      key.current = newKey(); setSent(true); setForm({ to: "", subject: "", body: "" }); setFiles([]); outbox.reload();
    } catch (e) { setErr(e); }
  };
  return (
    <div>
      <PageHeader title="Mail" description="Search and send from mailboxes you can access." />
      <ErrorNotice error={boxes.error} />
      <Label htmlFor="mb">Mailbox</Label>
      <select id="mb" className="block border rounded-md px-2 py-1.5 text-sm bg-transparent mb-4" value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
        <option value="">Select a mailbox…</option>
        {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      {mailbox && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Search">
            <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setApplied(q); }}>
              <Label htmlFor="mq" className="sr-only">Search mail</Label>
              <Input id="mq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mail…" />
              <Button type="submit" variant="outline">Search</Button>
            </form>
            <ErrorNotice error={search.error} />
            {search.loading && !search.data ? <Loading /> : listOf(search.data).length === 0 ? <Empty>No messages.</Empty> : (
              <ul className="divide-y border rounded-lg">
                {listOf(search.data).map((m: any) => (
                  <li key={m.id} className="px-3 py-2 text-sm"><div className="font-medium">{m.subject}</div><div className="text-xs text-gray-500">{m.from ?? m.sender} · {m.received_at ?? m.created_at}</div></li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Compose" className="space-y-2">
            <h2 className="font-semibold text-sm">Send email</h2>
            <Label htmlFor="to">To</Label><Input id="to" type="email" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <Label htmlFor="subj">Subject</Label><Input id="subj" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <Label htmlFor="body">Body</Label><Textarea id="body" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <Label htmlFor="att">Attachments (max 10, 2 MB combined — {(total / 1024).toFixed(0)} KB used)</Label>
            <Input id="att" type="file" multiple onChange={(e) => addFiles(e.target.files)} />
            <ErrorNotice error={err} />
            {sent && <p role="status" className="text-sm text-green-700">Queued.</p>}
            <Button onClick={send} disabled={!form.to || !form.subject}>Send</Button>
          </section>
        </div>
      )}
      <h2 className="font-semibold text-sm mt-8 mb-2">Delivery status</h2>
      <ErrorNotice error={outbox.error} />
      {listOf(outbox.data).length === 0 ? <Empty>Nothing sent yet.</Empty> : (
        <ul className="divide-y border rounded-lg">
          {listOf(outbox.data).map((o: any) => (
            <li key={o.id} className="px-3 py-2 text-sm flex gap-2 items-center"><Badge tone={statusTone(o.status)}>{o.status}</Badge><span className="truncate">{o.to} — {o.subject}</span></li>
          ))}
        </ul>
      )}
      {isOwner && <MailOwnerTools outbox={listOf(outbox.data)} />}
    </div>
  );
}
