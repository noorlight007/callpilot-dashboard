"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, statusTone } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { chan, pilot } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import { ActionPanel } from "@/components/ops/action-panel";
import { messageNeedsReview, normalizeConversation } from "@/lib/ops/adapters";
import type { Conversation, Message } from "@/lib/ops/types";

const QUEUES = ["mine", "unassigned", "all"] as const;
const CHANNELS = ["", "sms", "whatsapp", "voice"] as const;

export default function InboxPage() {
  const { tenant } = useOps();
  const [queue, setQueue] = useState<(typeof QUEUES)[number]>("mine");
  const [channel, setChannel] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useOpsFetch(tenant ? chan(tenant, "conversations/") : null, {
    query: { queue: queue === "all" ? undefined : queue, channel: channel || undefined },
    pollMs: 15000,
  });
  const alerts = useOpsFetch(tenant ? chan(tenant, "alerts/") : null, { pollMs: 30000 });
  const [alertErr, setAlertErr] = useState<unknown>(null);
  const { call } = useOps();

  const convs = listOf(list.data) as Conversation[];
  const open = listOf(alerts.data).filter((a: any) => !a.resolved);

  return (
    <div>
      <PageHeader title="Inbox" description="SMS, WhatsApp and voice conversations." />
      {open.length > 0 && (
        <div role="region" aria-label="Alerts" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2">
          <ErrorNotice error={alertErr} />
          {open.slice(0, 5).map((a: any) => (
            <div key={a.uid} className="flex items-center justify-between gap-2">
              <span>{a.message ?? a.kind ?? "Alert"}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    setAlertErr(null);
                    await call(chan(tenant!, "alerts/"), { method: "POST", body: { uid: a.uid }, key: newKey() });
                    alerts.reload();
                  } catch (e) {
                    setAlertErr(e);
                  }
                }}
              >
                Mark reviewed
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section aria-label="Conversations">
          <div role="tablist" aria-label="Queue" className="flex gap-1 mb-2">
            {QUEUES.map((q) => (
              <Button key={q} role="tab" aria-selected={queue === q} size="sm" variant={queue === q ? "default" : "outline"} onClick={() => setQueue(q)}>
                {q[0].toUpperCase() + q.slice(1)}
              </Button>
            ))}
          </div>
          <Label htmlFor="channel-filter" className="sr-only">Channel</Label>
          <select id="channel-filter" className="w-full mb-3 border rounded-md px-2 py-1.5 text-sm bg-transparent" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{c ? c.toUpperCase() : "All channels"}</option>
            ))}
          </select>
          <ErrorNotice error={list.error} />
          {list.loading && !list.data ? <Loading /> : convs.length === 0 ? <Empty>No conversations.</Empty> : (
            <ul className="space-y-1">
              {convs.map((c) => (
                <li key={c.uid}>
                  <button onClick={() => setSelected(c.uid)} aria-current={selected === c.uid} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selected === c.uid ? "border-gray-900 dark:border-gray-100" : "hover:bg-gray-50 dark:hover:bg-gray-900"}`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-medium truncate">{c.contact?.name ?? c.phone ?? c.uid.slice(0, 8)}</span>
                      <Badge>{c.channel}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>{c.mode === "human" ? "Human" : "AI"}</span>
                      <span>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ""}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Conversation">
          {selected ? <Thread key={selected} uid={selected} onChanged={list.reload} /> : <Empty>Select a conversation.</Empty>}
        </section>
      </div>
    </div>
  );
}

function Thread({ uid, onChanged }: { uid: string; onChanged: () => void }) {
  const { tenant, call } = useOps();
  const raw = useOpsFetch<any>(chan(tenant!, `conversations/${uid}/`), { pollMs: 4000 });
  const conv = { ...raw, data: normalizeConversation(raw.data) as Conversation | null };
  const [err, setErr] = useState<unknown>(null);
  const [text, setText] = useState("");
  const [sendChannel, setSendChannel] = useState<"sms" | "whatsapp">("sms");
  const [useTemplate, setUseTemplate] = useState(false);
  const [template, setTemplate] = useState("");
  const [jobId, setJobId] = useState("");
  const [sending, setSending] = useState(false);
  // One key per send intent; reused if the user retries after a timeout.
  const keyRef = useRef(newKey());
  const sigRef = useRef("");
  const templates = useOpsFetch(useTemplate ? chan(tenant!, "templates/") : null);
  const c = conv.data;
  const msgs: Message[] = c?.messages ?? [];
  const isVoice = c?.channel === "voice";
  const channelForSend = isVoice ? sendChannel : (c?.channel as "sms" | "whatsapp") ?? "sms";

  const act = async (fn: () => Promise<any>) => {
    try {
      setErr(null);
      await fn();
      conv.reload();
      onChanged();
    } catch (e) {
      setErr(e);
    }
  };

  const send = async () => {
    setSending(true);
    setErr(null);
    try {
      const tpl = templates.data && listOf(templates.data).find((t: any) => t.name === template);
      // A changed request is a new intent: new key. A plain retry keeps the key.
      const sig = JSON.stringify([text, channelForSend, template, jobId, useTemplate]);
      if (sig !== sigRef.current) { keyRef.current = newKey(); sigRef.current = sig; }
      const body: any = { text, idempotency_key: keyRef.current, channel: channelForSend };
      if (!isVoice) body.conversation_uid = uid;
      else body.to = c?.phone;
      if (jobId) body.job_id = Number(jobId);
      if (useTemplate && tpl) body.template = { name: tpl.name, language: { code: tpl.language ?? "en_GB" }, components: [] };
      await call(chan(tenant!, "send/"), { method: "POST", body, key: keyRef.current });
      keyRef.current = newKey(); // success: next message is a new intent
      sigRef.current = "";
      setText("");
      conv.reload();
    } catch (e) {
      setErr(e); // keep key so a manual retry stays idempotent
    } finally {
      setSending(false);
    }
  };

  if (conv.loading && !c) return <Loading />;
  if (!c) return <ErrorNotice error={conv.error} />;
  const card = c.caller_card ?? c.contact;

  return (
    <div className="border rounded-lg flex flex-col h-[70vh]">
      <header className="p-3 border-b flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{card?.name ?? c.phone}</div>
          <div className="text-xs text-gray-500">{c.phone} · {card?.type ?? "unclassified"} {card?.status ? `· ${card.status}` : ""}</div>
        </div>
        <div className="flex gap-2">
          {c.ats_url && <a className="underline text-sm" href={c.ats_url} target="_blank" rel="noopener noreferrer">Open JobAdder</a>}
          {c.assigned_to_id == null && <Button size="sm" onClick={() => act(() => call(chan(tenant!, `conversations/${uid}/claim/`), { method: "POST", key: newKey() }))}>Claim</Button>}
          <Button size="sm" variant="outline" onClick={() => act(() => call(chan(tenant!, `conversations/${uid}/`), { method: "PATCH", body: { mode: c.mode === "human" ? "ai" : "human" } }))}>
            {c.mode === "human" ? "Resume AI" : "Take over"}
          </Button>
        </div>
      </header>
      {c.needs_classification && <ClassifyPanel conv={c} onDone={conv.reload} />}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" aria-live="polite">
        {c.transcript_restricted && <p className="text-xs text-gray-500">Transcript restricted for this caller.</p>}
        {msgs.length === 0 ? <Empty>No messages.</Empty> : msgs.map((m) => (
          <div key={m.uid} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === "outbound" ? "ml-auto bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800"}`}>
            {/* text only — provider content is untrusted */}
            <div className="whitespace-pre-wrap break-words">{m.body}</div>
            <div className="text-[10px] opacity-70 mt-1 flex gap-2">
              <span>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</span>
              <span>{m.direction}</span>
              {m.status && <Badge tone={statusTone(m.status)}>{m.status}</Badge>}
              {messageNeedsReview(m) && <Badge tone="amber">needs review</Badge>}
              {m.visibility === "pending" && <Badge tone="amber">pending</Badge>}
            </div>
            {messageNeedsReview(m) && <ReviewAction uid={m.uid} />}
          </div>
        ))}
      </div>
      <div className="border-t p-3 space-y-2">
        <ErrorNotice error={err} />
        {c.mode !== "human" && <p className="text-xs text-amber-700">AI is handling this conversation. Take over to reply.</p>}
        <div className="flex flex-wrap gap-2 items-center">
          {isVoice && (
            <select aria-label="Reply channel" className="border rounded-md px-2 py-1 text-sm bg-transparent" value={sendChannel} onChange={(e) => setSendChannel(e.target.value as any)}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          )}
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} /> Use template</label>
          {useTemplate && (
            <select aria-label="Template" className="border rounded-md px-2 py-1 text-sm bg-transparent" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">Select approved template…</option>
              {listOf(templates.data).filter((t: any) => !t.status || /approved/i.test(t.status)).map((t: any) => <option key={t.name + t.language} value={t.name}>{t.name} ({t.language})</option>)}
            </select>
          )}
          <Input aria-label="Job ID (optional)" placeholder="Job ID" className="w-28" value={jobId} onChange={(e) => setJobId(e.target.value.replace(/\D/g, ""))} />
        </div>
        <Label htmlFor="composer" className="sr-only">Message</Label>
        <Textarea id="composer" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" />
        <div className="flex justify-between items-center">
          <ConsentLine phone={c.phone} />
          <Button disabled={sending || !text.trim() || (useTemplate && !template)} onClick={send}>{sending ? "Sending…" : "Send"}</Button>
        </div>
      </div>
    </div>
  );
}

function ConsentLine({ phone }: { phone?: string }) {
  const { tenant, call } = useOps();
  const [open, setOpen] = useState(false);
  const [ch, setCh] = useState("sms");
  const [out, setOut] = useState(true);
  const [ev, setEv] = useState("");
  const [cerr, setCerr] = useState<unknown>(null);
  const ckey = useRef(newKey());
  const consent = useOpsFetch(phone ? chan(tenant!, "consent/") : null, { query: { phone } });
  const rows = listOf(consent.data?.results ?? consent.data) as any[];
  const outs = rows.filter((r) => r.opted_out).map((r) => r.channel);
  if (!phone || consent.loading) return <span />;
  return (
    <span className="text-xs text-gray-500">
      {outs.length ? `Opted out: ${outs.join(", ")}` : "No opt-outs recorded"}{" "}
      <button className="underline" onClick={() => setOpen(!open)}>Record consent</button>
      {open && (
        <span className="block mt-1 space-y-1 text-gray-900 dark:text-gray-100">
          <select aria-label="Channel" value={ch} onChange={(e) => setCh(e.target.value)} className="border rounded px-1 bg-transparent"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select>{" "}
          <label><input type="checkbox" checked={out} onChange={(e) => setOut(e.target.checked)} /> Opted out</label>
          <Input aria-label="Evidence" placeholder="Evidence (required)" value={ev} onChange={(e) => setEv(e.target.value)} />
          <ErrorNotice error={cerr} />
          <Button size="sm" disabled={!ev.trim()} onClick={async () => {
            try { setCerr(null); await call(chan(tenant!, "consent/"), { method: "POST", key: ckey.current, body: { phone, channel: ch, opted_out: out, evidence: ev } }); ckey.current = newKey(); setEv(""); setOpen(false); consent.reload(); } catch (e) { setCerr(e); }
          }}>Save</Button>
        </span>
      )}
    </span>
  );
}

function ClassifyPanel({ conv, onDone }: { conv: Conversation; onDone: () => void }) {
  const { tenant, call, isOwner } = useOps();
  const [err, setErr] = useState<unknown>(null);
  const [actor, setActor] = useState<"client" | "supplier">("client");
  const m = conv.contact ?? {};
  const resolve = async () => {
    try {
      setErr(null);
      if (isOwner && m.ats_section && m.ats_id) {
        await call(pilot(tenant!, "identities/"), {
          method: "POST",
          key: newKey(),
          body: { actor_type: actor, ats_section: m.ats_section, ats_id: m.ats_id, mobile_e164: conv.phone, verified: true },
        });
      }
      await call(chan(tenant!, `conversations/${conv.uid}/resolve/`), { method: "POST", key: newKey() });
      onDone();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="p-3 border-b bg-amber-50 dark:bg-amber-950/20 text-sm space-y-2">
      <div>{isOwner ? "Classify this matched contact before correspondence is processed." : "Awaiting owner classification."}</div>
      <ErrorNotice error={err} />
      {isOwner && (
        <div className="flex gap-2 items-center">
          <select aria-label="Classification" className="border rounded-md px-2 py-1 bg-transparent" value={actor} onChange={(e) => setActor(e.target.value as any)}>
            <option value="client">Client</option>
            <option value="supplier">Supplier</option>
          </select>
          <Button size="sm" onClick={resolve}>Classify &amp; resolve</Button>
        </div>
      )}
      {/* An existing record is never re-created: can_create is empty here. */}
    </div>
  );
}

/** Human-reviewed ATS action for a flagged message. Nothing is written until the user submits. */
function ReviewAction({ uid }: { uid: string }) {
  const { tenant, call } = useOps();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ section: "notes", operation: "create", target: "", text: "" });
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const key = useRef(newKey());
  if (!open) return <button className="underline text-xs mt-1" onClick={() => setOpen(true)}>Review &amp; file to ATS…</button>;
  return (
    <div className="mt-2 space-y-1 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 border rounded p-2">
      <Input aria-label="Section" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} />
      <Input aria-label="Target (e.g. candidates/123)" placeholder="candidates/123" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
      <Textarea aria-label="Note text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <ErrorNotice error={err} />
      <Button size="sm" disabled={!f.target || !f.text} onClick={async () => {
        try { setErr(null); const r: any = await call(chan(tenant!, `messages/${uid}/review/`), { method: "POST", key: key.current, body: { section: f.section, operation: f.operation, target: f.target, data: { text: f.text } } }); setActionId(r.id); } catch (e) { setErr(e); }
      }}>Submit action</Button>
      {actionId != null && <ActionPanel id={actionId} />}
    </div>
  );
}
