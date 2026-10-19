"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice, Loading, PageHeader, statusTone } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { ChannelComposer } from "@/components/ops/channel-composer";
import { useOps } from "@/lib/ops/session";
import { useOpsFetch } from "@/lib/ops/hooks";
import { chan, pilot } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import { normalizeConversation, safeUrl } from "@/lib/ops/adapters";
import { contextLabel as valueLabel } from "@/components/ops/channel-contracts";
import type { ActionEnvelope, Conversation, Message } from "@/lib/ops/types";

const QUEUES = ["mine", "unassigned", "all"] as const;
const CHANNELS = ["", "sms", "whatsapp", "voice"] as const;
type ChannelAlert = { uid: string; conversation__uid?: string; kind: string; detail?: { reason?: string }; created_at?: string };
const nameOf = (c: Conversation) => c.record?.name || [c.record?.firstName, c.record?.lastName].filter(Boolean).join(" ") || c.phone || c.uid;

export default function InboxPage() {
  return <Suspense fallback={<Loading />}><InboxContent /></Suspense>;
}

function InboxContent() {
  const { tenant, call, isFull } = useOps();
  const params = useSearchParams();
  const [queue, setQueue] = useState<(typeof QUEUES)[number]>("mine");
  const [channel, setChannel] = useState("");
  const [selected, setSelected] = useState<string | null>(() => {
    const uid = params.get("conversation");
    return uid && /^[a-f\d-]{36}$/i.test(uid) ? uid : null;
  });
  const [composing, setComposing] = useState(false);
  const [alertErr, setAlertErr] = useState<unknown>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const list = useOpsFetch<{ conversations: Conversation[] }>(tenant ? chan(tenant, "conversations/") : null, { query: { queue: queue === "all" ? undefined : queue, channel: channel || undefined }, pollMs: 15000 });
  const alerts = useOpsFetch<{ alerts: ChannelAlert[] }>(tenant ? chan(tenant, "alerts/") : null, { pollMs: 30000 });
  const convs = list.data?.conversations ?? [];
  const open = alerts.data?.alerts ?? [];
  const select = (uid: string) => { setSelected(uid); setComposing(false); };
  return <div>
    <PageHeader title="Inbox" description="SMS, WhatsApp and voice conversations." />
    <ErrorNotice error={alerts.error} />
    {open.length > 0 && <div role="region" aria-label="Alerts" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2">
      <ErrorNotice error={alertErr} />
      {open.slice(0, 10).map((alert) => <div key={alert.uid} className="flex flex-wrap items-center justify-between gap-2">
        <button className="text-left underline" disabled={!alert.conversation__uid} onClick={() => alert.conversation__uid && select(alert.conversation__uid)}>{alert.kind}: {alert.detail?.reason ?? "Conversation needs review"}</button>
        <Button size="sm" variant="outline" disabled={reviewing === alert.uid} onClick={async () => {
          if (!tenant) return;
          setReviewing(alert.uid); setAlertErr(null);
          try { await call(chan(tenant, "alerts/"), { method: "POST", body: { uid: alert.uid } }); alerts.reload(); }
          catch (error) { setAlertErr(error); }
          finally { setReviewing(null); }
        }}>Mark reviewed</Button>
      </div>)}
      {open.length > 10 && <p className="text-xs">{open.length - 10} more alerts remain in this snapshot.</p>}
    </div>}
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section aria-label="Conversations">
        {isFull && <Button className="mb-3 w-full" variant="outline" onClick={() => { setComposing(true); setSelected(null); }}>New message</Button>}
        <div role="tablist" aria-label="Queue" className="flex gap-1 mb-2">{QUEUES.map((q) => <Button key={q} role="tab" aria-selected={queue === q} size="sm" variant={queue === q ? "default" : "outline"} onClick={() => setQueue(q)}>{q[0].toUpperCase() + q.slice(1)}</Button>)}</div>
        <Label htmlFor="channel-filter" className="sr-only">Channel</Label>
        <select id="channel-filter" className="w-full mb-3 border rounded px-2 py-2 text-sm bg-transparent" value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c} value={c}>{c ? c.toUpperCase() : "All channels"}</option>)}</select>
        <ErrorNotice error={list.error} />
        {list.loading && !list.data ? <Loading /> : convs.length === 0 ? <Empty>No conversations.</Empty> : <ul className="space-y-1">{convs.map((c) => <li key={c.uid}>
          <button onClick={() => select(c.uid)} aria-current={selected === c.uid} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selected === c.uid ? "border-foreground" : "hover:bg-muted"}`}>
            <div className="flex justify-between gap-2"><span className="font-medium truncate">{nameOf(c)}</span><Badge>{c.channel}</Badge></div>
            <div className="text-xs text-muted-foreground flex justify-between gap-2"><span>{c.mode === "human" ? "Human" : "AI"} · {c.assigned_to_id == null ? "Unassigned" : `Staff #${c.assigned_to_id}`}</span><span>{c.updated_at ? new Date(c.updated_at).toLocaleString() : ""}</span></div>
          </button>
        </li>)}</ul>}
        <p className="text-xs text-muted-foreground mt-3">Latest 200 conversations. This is a bounded snapshot.</p>
      </section>
      <section aria-label="Conversation">
        {composing && isFull ? <div key={`new:${tenant}`} className="border rounded-lg p-4"><h2 className="font-medium mb-3">New message</h2><ChannelComposer onSent={list.reload} /></div>
          : selected ? <Thread key={`${tenant}:${selected}`} uid={selected} onChanged={list.reload} /> : <Empty>Select a conversation.</Empty>}
      </section>
    </div>
  </div>;
}

function Thread({ uid, onChanged }: { uid: string; onChanged: () => void }) {
  const { tenant, me, isFull, isOwner, call } = useOps();
  const raw = useOpsFetch(tenant ? chan(tenant, `conversations/${uid}/`) : null, { pollMs: 4000 });
  const c = normalizeConversation(raw.data) as Conversation | null;
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [resolveNotice, setResolveNotice] = useState("");
  const act = async (operation: "claim" | "ai" | "human" | "resolve") => {
    if (!tenant || busy) return;
    setBusy(true); setErr(null); setResolveNotice("");
    try {
      await call(chan(tenant, `conversations/${uid}/${operation === "claim" ? "claim/" : operation === "resolve" ? "resolve/" : ""}`), operation === "claim" || operation === "resolve" ? { method: "POST" } : { method: "PATCH", body: { mode: operation } });
      if (operation === "resolve") setResolveNotice("Identity re-matched. Held items will be processed with the backend's privacy checks.");
      raw.reload(); onChanged();
    } catch (error) { setErr(error); }
    finally { setBusy(false); }
  };
  if (raw.loading && !c) return <Loading />;
  if (!c) return <ErrorNotice error={raw.error} />;
  const record = c.record ?? {};
  const card = c.caller_card ?? record;
  const messages: Message[] = c.messages ?? [];
  const canControl = isFull || c.assigned_to_id == null || c.assigned_to_id === me?.membership_id;
  const atsUrl = safeUrl(card.ats_url ?? c.ats_url);
  return <div className="border rounded-lg flex flex-col min-h-[70vh]">
    <header className="p-3 border-b space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="font-medium">{nameOf(c)}</div><div className="text-xs text-muted-foreground">{c.phone} · {valueLabel(card.type ?? card.actor_type) || "Unclassified"} {valueLabel(card.status) && `· ${valueLabel(card.status)}`}</div></div>
        <div className="flex flex-wrap gap-2">
          {atsUrl && <a className="underline text-sm" href={atsUrl} target="_blank" rel="noopener noreferrer">Open JobAdder</a>}
          {c.assigned_to_id == null && <Button size="sm" disabled={busy} onClick={() => act("claim")}>Claim</Button>}
          {canControl && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(c.mode === "human" ? "ai" : "human")}>{c.mode === "human" ? "Resume AI" : "Take over"}</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("resolve")}>Re-match identity</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{c.assigned_to_id == null ? "Unassigned" : `Assigned to membership #${c.assigned_to_id}`} {card.owner && `· ATS owner: ${valueLabel(card.owner)}`} {c.job_id && `· Job #${c.job_id}`}</p>
      {Array.isArray(card.open_jobs ?? card.jobs) && (card.open_jobs ?? card.jobs).length > 0 && <p className="text-xs">Open jobs: {(card.open_jobs ?? card.jobs).map(valueLabel).filter(Boolean).join(", ")}</p>}
      <ErrorNotice error={err ?? raw.error} />{resolveNotice && <p role="status" className="text-xs">{resolveNotice}</p>}
    </header>
    {(!c.identity_id || c.needs_classification || record.classification_required) && <IdentityReview key={`${c.uid}:${record.section}:${record.id}`} conversation={c} onDone={() => { raw.reload(); onChanged(); }} />}
    <div className="flex-1 max-h-[55vh] overflow-y-auto p-3 space-y-3" aria-live="polite">
      <p className="text-xs text-muted-foreground">Latest 100 visible messages. {isOwner ? "Pending and owner-only content is private." : "Pending and private content is restricted to the owner."}</p>
      {c.transcript_restricted && <p className="text-xs text-muted-foreground">Transcript restricted for this caller.</p>}
      {c.channel === "voice" && <p className="text-xs text-muted-foreground">Voice context is shown here. Live caller cards and permitted transcripts are available in the softphone; choose SMS or WhatsApp to reply.</p>}
      {messages.length === 0 ? <Empty>No visible messages.</Empty> : messages.map((message) => <div key={message.uid} className={`max-w-[90%] rounded-lg border px-3 py-2 text-sm ${message.direction === "outbound" ? "ml-auto bg-muted" : "bg-background"}`}>
        <div className="whitespace-pre-wrap break-words">{message.body || (message.template?.name ? `Template: ${message.template.name}` : "No text content")}</div>
        {Array.isArray(message.media) && message.media.length > 0 && <ul className="text-xs mt-2 space-y-1">{message.media.map((media: unknown, index: number) => <li key={index}>Attachment: {valueLabel(media) || `Item ${index + 1}`} (review in the provider)</li>)}</ul>}
        <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-2"><span>{message.created_at ? new Date(message.created_at).toLocaleString() : ""}</span><span>{message.direction}</span>{message.status && <Badge tone={statusTone(message.status)}>{message.status}</Badge>}{message.visibility && message.visibility !== "staff" && <Badge tone="amber">{message.visibility === "owner" ? "Owner only" : "Pending classification"}</Badge>}</div>
        {message.error && <p className="text-xs text-red-600 whitespace-pre-wrap">{valueLabel(message.error)}</p>}
        {message.status === "review" && <div className="text-xs mt-2 space-y-2">
          <p className="text-amber-700">{message.direction === "outbound" ? "Delivery needs investigation. Do not blindly resend." : message.result?.review_reason ?? "Human review required."}</p>
          {message.result?.finance_private ? <p>{isOwner ? <a className="underline" href="/finance">Review private invoice in Finance</a> : "Owner review required."}</p>
            : message.direction === "inbound" && (isOwner || message.visibility === "staff") && <ReviewAction message={message} defaultTarget={record.section && record.id ? `${record.section}/${record.id}` : ""} />}
        </div>}
      </div>)}
    </div>
    <div className="border-t p-3"><ChannelComposer conversation={c} reviewRequired={messages.some((message) => message.direction === "outbound" && message.status === "review")} onSent={() => { raw.reload(); onChanged(); }} /></div>
  </div>;
}

function IdentityReview({ conversation, onDone }: { conversation: Conversation; onDone: () => void }) {
  const { tenant, call, isOwner } = useOps();
  const record = conversation.record ?? {};
  const matched = !!record.classification_required && !!record.section && !!record.id;
  const [section, setSection] = useState(record.section ?? "contacts");
  const [recordId, setRecordId] = useState(String(record.id ?? ""));
  const [actor, setActor] = useState(record.section === "candidates" ? "candidate" : "client");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const intent = useRef({ signature: "", key: newKey() });
  const save = async () => {
    if (!tenant || !verified || busy) return;
    const body = { actor_type: actor, ats_section: section, ats_id: recordId, mobile_e164: conversation.phone, verified: true };
    const signature = JSON.stringify(body);
    if (intent.current.signature !== signature) intent.current = { signature, key: newKey() };
    setBusy(true); setErr(null);
    try {
      await call(pilot(tenant, "identities/"), { method: "POST", body, key: intent.current.key });
      await call(chan(tenant, `conversations/${conversation.uid}/resolve/`), { method: "POST" }); onDone();
    } catch (error) { setErr(error); }
    finally { setBusy(false); }
  };
  return <div className="p-3 border-b bg-amber-50 dark:bg-amber-950/20 text-sm space-y-2">
    <p>{matched ? `Existing ${record.section}/${record.id} requires client or supplier classification. Review this record rather than creating a duplicate.` : record.ambiguous ? "Multiple records match this phone. The owner must verify the correct identity." : "No verified identity is linked. Re-match once the record is searchable or ask the owner to verify an existing record."}</p>
    {isOwner && <details><summary className="cursor-pointer">Verify identity and classify</summary><div className="space-y-2 mt-2">
      <p className="text-xs">Check the provider record and caller&apos;s phone before mapping. This can release held correspondence for processing.</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Record section" className="border rounded px-2 py-1 bg-background" disabled={matched} value={section} onChange={(e) => { setSection(e.target.value); setActor(e.target.value === "candidates" ? "candidate" : e.target.value === "suppliers" ? "supplier" : "client"); }}>{["candidates", "contacts", "companies", "suppliers"].map((s) => <option key={s}>{s}</option>)}</select>
        <Input aria-label="Exact existing record ID" className="w-40" inputMode="numeric" disabled={matched} value={recordId} onChange={(e) => setRecordId(e.target.value.replace(/\D/g, ""))} placeholder="Existing record ID" />
        <select aria-label="Actor classification" className="border rounded px-2 py-1 bg-background" value={actor} onChange={(e) => setActor(e.target.value)}>{(section === "candidates" ? ["candidate"] : section === "suppliers" ? ["supplier"] : ["client", "supplier"]).map((a) => <option key={a}>{a}</option>)}</select>
      </div>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> I verified that this record and classification belong to {conversation.phone}.</label>
      <ErrorNotice error={err} /><Button size="sm" disabled={busy || !verified || !/^\d+$/.test(recordId)} onClick={save}>{busy ? "Resolving…" : "Save verified mapping & resolve"}</Button>
    </div></details>}
  </div>;
}

function ReviewAction({ message, defaultTarget }: { message: Message; defaultTarget: string }) {
  const { tenant, call } = useOps();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(defaultTarget);
  const [text, setText] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(message.result?.review_action ?? null);
  const [settled, setSettled] = useState<ActionEnvelope | null>(null);
  const intent = useRef({ signature: "", key: newKey() });
  if (actionId != null) return <div className="space-y-2"><ActionPanel id={actionId} onSettled={setSettled} />{settled?.status === "failed" && !settled.uncertain_outcome && <Button size="sm" variant="outline" onClick={() => {
    setTarget(settled.target ?? target); setText(settled.request?.text ?? text); setReviewed(false); setActionId(null); setSettled(null); setOpen(true); intent.current = { signature: "", key: newKey() };
  }}>Edit a new reviewed proposal</Button>}</div>;
  if (!open) return <button className="underline text-xs" onClick={() => setOpen(true)}>Review & file an ATS note…</button>;
  const submit = async () => {
    if (!tenant || busy || !reviewed) return;
    const body = { section: "notes", operation: "create", target: target.trim(), data: { text: text.trim() } };
    const signature = JSON.stringify(body);
    if (intent.current.signature !== signature) intent.current = { signature, key: newKey() };
    setBusy(true); setErr(null);
    try { const action = await call<{ id: number }>(chan(tenant, `messages/${message.uid}/review/`), { method: "POST", body, key: intent.current.key }); setActionId(action.id); }
    catch (error) { setErr(error); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 rounded border bg-background p-2">
    <Label htmlFor={`review-target-${message.uid}`}>Verified ATS destination</Label><Input id={`review-target-${message.uid}`} placeholder="candidates/123" value={target} onChange={(e) => setTarget(e.target.value)} />
    <Label htmlFor={`review-note-${message.uid}`}>Reviewed note text</Label><Textarea id={`review-note-${message.uid}`} value={text} onChange={(e) => setText(e.target.value)} />
    <label className="flex gap-2"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> I reviewed the content and verified it is appropriate for this ATS destination.</label>
    <ErrorNotice error={err} /><div className="flex gap-2"><Button size="sm" disabled={busy || !reviewed || !/^(candidates|contacts|companies|jobs|applications|placements|suppliers)\/\d+$/.test(target.trim()) || !text.trim()} onClick={submit}>{busy ? "Submitting…" : "Submit reviewed note"}</Button><Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button></div>
  </div>;
}
