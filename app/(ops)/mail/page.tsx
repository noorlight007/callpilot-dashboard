"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, statusTone } from "@/components/ops/common";
import { useMutation } from "@/components/ops/forms";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";
import { MailOwnerTools } from "@/components/ops/mail-owner";

const MAX_FILES = 10;
const MAX_TOTAL = 2 * 1024 * 1024;
type Attachment = { name: string; content_base64: string; content_type: string; size: number };

export default function MailPage() {
  const { epoch } = useOps();
  return <MailWorkspace key={epoch} />;
}

function MailWorkspace() {
  const { call, isOwner, isFull } = useOps();
  const boxes = useOpsFetch(ops("mailboxes/"));
  const mailboxes = listOf(boxes.data).filter((m) => m.active !== false && (isOwner || (!m.sensitive && (isFull || !m.shared))));
  const [selected, setSelected] = useState("");
  const mailbox = mailboxes.some((m) => m.id === selected) ? selected : "";
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const search = useOpsFetch(mailbox ? ops("email/search/") : null, { query: { q: applied, mailbox_id: mailbox } });
  const outbox = useOpsFetch(ops("email/outbox/"), { pollMs: 20000 });
  const [form, setForm] = useState({ to: "", subject: "", body: "" });
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const [sent, setSent] = useState<string | null>(null);
  const send = useMutation(async (payload: Record<string, unknown>, key) => {
    const response = await call(ops("email/send/"), { method: "POST", key, body: { ...payload, idempotency_key: key } });
    setSent(response.status ?? "queued"); setForm({ to: "", subject: "", body: "" }); setFiles([]); outbox.reload();
    return response;
  });
  const total = files.reduce((n, f) => n + f.size, 0);
  const addFiles = async (list: FileList | null) => {
    if (!list || readingRef.current) return;
    const additions = Array.from(list);
    if (files.length + additions.length > MAX_FILES || total + additions.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) {
      setFileError(new Error("Limit: 10 attachments and 2 MB combined decoded content.")); return;
    }
    readingRef.current = true; setReading(true); setFileError(null);
    try {
      const next = await Promise.all(additions.map(async (f) => {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { name: f.name, content_base64: btoa(bin), content_type: f.type || "application/octet-stream", size: f.size };
      }));
      setFiles((previous) => [...previous, ...next]); setSent(null);
    } catch (e) { setFileError(e); }
    finally { readingRef.current = false; setReading(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Mail" description="Search permitted email history and track queued delivery." />
      <ErrorNotice error={boxes.error} />
      {boxes.loading && !boxes.data ? <Loading label="Loading permitted mailboxes…" /> : mailboxes.length === 0 ? <Empty>No active mailboxes are available to your account.</Empty> : <>
        <Label htmlFor="mb">Mailbox</Label>
        <select id="mb" className="block border rounded-md px-2 py-2 text-sm bg-transparent" disabled={send.busy || reading} value={mailbox} onChange={(e) => { setSelected(e.target.value); setSent(null); }}>
          <option value="">Select a mailbox…</option>
          {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.address}{m.shared ? " (shared)" : ""}{m.sensitive ? " (owner only)" : ""}</option>)}
        </select>
      </>}
      {mailbox && <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Search">
          <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setApplied(q); }}>
            <Label htmlFor="mq" className="sr-only">Search mail</Label>
            <Input id="mq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mail…" />
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <ErrorNotice error={search.error} />
          {search.loading && !search.data ? <Loading /> : listOf(search.data).length === 0 ? <Empty>No messages in this bounded history.</Empty> : <ul className="divide-y border rounded-lg">
            {listOf(search.data).map((m) => <li key={m.id} className="px-3 py-2 text-sm">
              <details><summary className="cursor-pointer font-medium">{m.subject || "(No subject)"} <Badge>{m.sync_status}</Badge></summary>
                <p className="text-xs text-gray-500 my-2">From {m.sender} · To {(m.recipients ?? []).join(", ")} · {m.received_at}</p>
                <p className="whitespace-pre-wrap break-words">{m.body || "No cached body."}</p>
              </details>
            </li>)}
          </ul>}
        </section>
        <form aria-label="Compose" className="space-y-2" onSubmit={(e) => { e.preventDefault(); setSent(null); if (!mailbox || reading || send.busy) return; void send.submit({ ...form, mailbox_id: mailbox, attachments: files.map((f) => ({ name: f.name, content_base64: f.content_base64, content_type: f.content_type })) }); }}>
          <h2 className="font-semibold text-sm">Send email</h2>
          <fieldset disabled={send.busy} className="space-y-2">
            <Label htmlFor="to">To (one address)</Label><Input id="to" type="email" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <Label htmlFor="subj">Subject</Label><Input id="subj" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <Label htmlFor="body">Body</Label><Textarea id="body" required rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <Label htmlFor="att">Attachments: maximum 10 files, 2 MB combined decoded content ({Math.ceil(total / 1024)} KB used)</Label>
            <Input id="att" type="file" multiple disabled={reading} onChange={(e) => { void addFiles(e.target.files); e.currentTarget.value = ""; }} />
            {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex justify-between items-center text-xs"><span>{file.name} ({Math.ceil(file.size / 1024)} KB)</span><Button type="button" variant="outline" size="sm" onClick={() => setFiles(files.filter((_, i) => index !== i))}>Remove</Button></div>)}
          </fieldset>
          <ErrorNotice error={fileError ?? send.error} />
          {sent && <p role="status" className="text-sm text-green-700">Request status: {sent}. Follow delivery status below.</p>}
          <Button type="submit" disabled={!form.to || !form.subject.trim() || !form.body.trim() || send.busy || reading}>{send.busy ? "Queueing…" : "Queue email"}</Button>
        </form>
      </div>}
      <section aria-label="Delivery status" className="space-y-2 pt-4">
        <h2 className="font-semibold text-sm">Delivery status (latest 100)</h2>
        <p className="text-xs text-gray-500">Unknown means provider acceptance is uncertain. Investigate Sent Items before sending again.</p>
        <ErrorNotice error={outbox.error} />
        {outbox.loading && !outbox.data ? <Loading /> : listOf(outbox.data).length === 0 ? <Empty>Nothing sent yet.</Empty> : <ul className="divide-y border rounded-lg">
          {listOf(outbox.data).map((o) => <li key={o.id} className="px-3 py-2 text-sm"><div className="flex gap-2 items-center"><Badge tone={statusTone(o.status)}>{o.status}</Badge><span>{o.recipient} — {o.subject}</span></div><p className="text-xs text-gray-500 mt-1">Attempts: {o.attempts} {o.sent_at && `· accepted ${o.sent_at}`}</p>{o.last_error && <p className="text-xs text-red-700">{o.last_error}</p>}</li>)}
        </ul>}
      </section>
      {isOwner && <MailOwnerTools outbox={listOf(outbox.data)} onOutboxChanged={outbox.reload} />}
    </div>
  );
}
