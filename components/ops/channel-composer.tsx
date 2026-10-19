"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, ErrorNotice } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { useOpsFetch } from "@/lib/ops/hooks";
import { chan } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import type { Conversation, Message } from "@/lib/ops/types";
import { channelSendAllowed, templateParameters, templateSendComponents, withinWhatsAppWindow, type ChannelTemplate } from "@/components/ops/channel-contracts";

type Channel = "sms" | "whatsapp";
type Consent = { channel: Channel; opted_out: boolean; opted_in_at?: string | null; evidence?: string };
/** Composer for a selected conversation, voice reply, or explicit new recipient. */
export function ChannelComposer({ conversation, reviewRequired = false, onSent }: {
  conversation?: Conversation;
  reviewRequired?: boolean;
  onSent: (message?: Message) => void;
}) {
  const { tenant, me, isFull, call } = useOps();
  const [recipient, setRecipient] = useState("");
  const [chosenChannel, setChosenChannel] = useState<Channel>("sms");
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState("");
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateUid, setTemplateUid] = useState("");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [sent, setSent] = useState<Message | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const intent = useRef({ signature: "", key: newKey() });
  const isVoice = conversation?.channel === "voice";
  const channel = conversation && !isVoice ? conversation.channel as Channel : chosenChannel;
  const phone = conversation?.phone ?? recipient.trim();
  const validPhone = /^\+[1-9]\d{7,14}$/.test(phone);
  // A voice inbound event does not open a WhatsApp reply window. Inspect that
  // channel's own conversation instead; a bounded list may not include older ones.
  const targets = useOpsFetch<{ conversations: Conversation[] }>(tenant && validPhone && (!conversation || isVoice) ? chan(tenant, "conversations/") : null, {
    query: { channel }, pollMs: 15000,
  });
  const target = conversation && !isVoice ? conversation : targets.data?.conversations?.find((row) => row.phone === phone);
  const targetThread = useOpsFetch<{ messages: Message[] }>(tenant && target && target.uid !== conversation?.uid ? chan(tenant, `conversations/${target.uid}/`) : null, { pollMs: 4000 });
  const consent = useOpsFetch<{ consents: Consent[] }>(tenant && validPhone ? chan(tenant, "consent/") : null, { query: { phone }, pollMs: 15000 });
  const consentRow = consent.data?.consents?.find((row) => row.channel === channel);
  const withinWindow = withinWhatsAppWindow(target?.last_inbound_at, now);
  const templateRequired = channel === "whatsapp" && !withinWindow;
  const usingTemplate = channel === "whatsapp" && (templateRequired || useTemplate);
  const templates = useOpsFetch<{ templates: ChannelTemplate[] }>(tenant && channel === "whatsapp" ? chan(tenant, "templates/") : null);
  const approved = (templates.data?.templates ?? []).filter((row) => row.status === "APPROVED");
  const selectedTemplate = approved.find((row) => row.uid === templateUid);
  const { groups, unsupported } = templateParameters(selectedTemplate);
  const canSend = channelSendAllowed(me?.role, me?.membership_id, target?.assigned_to_id);
  const sourceNeedsTakeover = !!conversation && conversation.mode !== "human";
  const optedOut = consentRow?.opted_out === true;
  const needsOptIn = templateRequired && (!consentRow || consentRow.opted_out || !consentRow.opted_in_at);
  const unresolvedSend = reviewRequired || sent?.status === "review" || targetThread.data?.messages.some((message) => message.direction === "outbound" && message.status === "review");
  const missingParameters = groups.some((group) => group.slots.some((slot) => !parameters[`${selectedTemplate?.uid}:${group.key}:${slot}`]?.trim()));
  const blocked = !validPhone || !canSend || sourceNeedsTakeover || unresolvedSend || optedOut || needsOptIn || consent.loading || !!consent.error
    || !!target && target.uid !== conversation?.uid && (targetThread.loading || !!targetThread.error)
    || usingTemplate && (!selectedTemplate || unsupported || missingParameters) || !usingTemplate && !text.trim();

  const send = async () => {
    if (blocked || sending || !tenant) return;
    const components = usingTemplate ? templateSendComponents(selectedTemplate!, parameters) : [];
    const request = {
      ...(target ? { conversation_uid: target.uid } : { to: phone, channel }),
      text: usingTemplate ? "" : text.trim(),
      ...(jobId ? { job_id: jobId } : {}),
      ...(usingTemplate ? { template: { name: selectedTemplate!.name, language: { code: selectedTemplate!.language }, components } } : {}),
    };
    // Background discovery may turn `to` into a conversation UID after a timeout.
    // The recipient and content still describe the same intent and retain its key.
    const signature = JSON.stringify([phone, channel, request.text, jobId, usingTemplate ? request.template : null]);
    if (intent.current.signature !== signature) intent.current = { signature, key: newKey() };
    setSending(true);
    setErr(null);
    try {
      const message = await call<Message>(chan(tenant, "send/"), { method: "POST", key: intent.current.key, body: { ...request, idempotency_key: intent.current.key } });
      setSent(message);
      setText("");
      // A successful response ends this intent. A network error keeps its key.
      intent.current = { signature: "", key: newKey() };
      targets.reload();
      onSent(message);
    } catch (error) { setErr(error); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-3">
      <ErrorNotice error={err ?? consent.error ?? targets.error ?? targetThread.error ?? templates.error} />
      {sent && <p role="status" className="text-xs">Message status: <Badge>{sent.status ?? "queued"}</Badge>. Sent means provider acceptance; delivered requires a delivery update.</p>}
      {(!conversation || isVoice) && <div className="flex flex-wrap gap-2 items-center">
        {!conversation && <Input aria-label="Recipient phone in E.164 format" placeholder="+441234567890" value={recipient} onChange={(e) => { setRecipient(e.target.value); setSent(null); }} />}
        <Label htmlFor="reply-channel">{isVoice ? "Reply using" : "Channel"}</Label>
        <select id="reply-channel" className="border rounded px-2 py-1 bg-transparent text-sm" value={chosenChannel} onChange={(e) => { setChosenChannel(e.target.value as Channel); setSent(null); }}>
          <option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
        </select>
      </div>}
      {sourceNeedsTakeover && <p className="text-xs text-amber-700">Take over this conversation before replying.</p>}
      {!canSend && <p className="text-xs text-amber-700">Standard staff can send only in their assigned SMS or WhatsApp conversations. Open and claim the relevant channel conversation first.</p>}
      {unresolvedSend && <p role="alert" className="text-xs text-amber-700">An outbound message needs delivery investigation. Ask the owner to reconcile the provider outcome before another send.</p>}
      {validPhone && <ConsentEditor key={phone + channel} phone={phone} channel={channel} row={consentRow} canManage={!!me && (isFull || target?.assigned_to_id === me.membership_id)} onChanged={consent.reload} />}
      {optedOut && <p role="alert" className="text-xs text-red-600">This recipient has opted out of {channel.toUpperCase()}. Sending is stopped.</p>}
      {channel === "whatsapp" && <>
        <p className="text-xs text-muted-foreground">{withinWindow ? "Within the 24-hour WhatsApp reply window." : "Outside the verified WhatsApp reply window: an approved template and recorded opt-in are required."}</p>
        {!templateRequired && <label className="flex gap-2 text-xs"><input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} /> Use approved template</label>}
        {needsOptIn && <p className="text-xs text-amber-700">Record verified WhatsApp opt-in evidence before sending.</p>}
      </>}
      {usingTemplate ? <div className="space-y-2">
        <Label htmlFor="message-template">Approved template and language</Label>
        <select id="message-template" className="w-full border rounded px-2 py-2 bg-transparent text-sm" value={templateUid} onChange={(e) => setTemplateUid(e.target.value)}>
          <option value="">Select an approved template…</option>
          {approved.map((row) => <option key={row.uid} value={row.uid}>{row.name} ({row.language})</option>)}
        </select>
        {templates.data && approved.length === 0 && <p className="text-xs">No approved templates. The owner can sync templates in Settings.</p>}
        {selectedTemplate?.components?.filter((c) => typeof c.text === "string").map((c, i) => <p key={i} className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{c.text}</p>)}
        {unsupported && <p className="text-xs text-amber-700">This template needs media or parameters that this text composer does not support. Select a text template.</p>}
        {groups.flatMap((group) => group.slots.map((slot) => {
          const key = `${selectedTemplate!.uid}:${group.key}:${slot}`;
          return <div key={key}><Label htmlFor={key}>{group.type} {group.index != null ? `button ${Number(group.index) + 1} ` : ""}parameter {slot}</Label><Input id={key} value={parameters[key] ?? ""} onChange={(e) => setParameters({ ...parameters, [key]: e.target.value })} /></div>;
        }))}
      </div> : <div><Label htmlFor="message-composer">Message</Label><Textarea id="message-composer" rows={3} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" /></div>}
      <div className="flex items-end justify-between gap-2">
        <div><Label htmlFor="message-job">Job ID (optional)</Label><Input id="message-job" placeholder="Job ID" className="w-36" inputMode="numeric" value={jobId} onChange={(e) => setJobId(e.target.value.replace(/\D/g, ""))} /></div>
        <Button disabled={sending || blocked} onClick={send}>{sending ? "Queueing…" : "Send"}</Button>
      </div>
    </div>
  );
}

function ConsentEditor({ phone, channel, row, canManage, onChanged }: { phone: string; channel: Channel; row?: Consent; canManage: boolean; onChanged: () => void }) {
  const { tenant, call } = useOps();
  const [open, setOpen] = useState(false);
  const [optedOut, setOptedOut] = useState(true);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const intent = useRef({ signature: "", key: newKey() });
  const save = async () => {
    if (!tenant || !canManage || !evidence.trim() || busy) return;
    const body = { phone, channel, opted_out: optedOut, evidence: evidence.trim() };
    const signature = JSON.stringify(body);
    if (intent.current.signature !== signature) intent.current = { signature, key: newKey() };
    setBusy(true); setErr(null);
    try {
      await call(chan(tenant, "consent/"), { method: "POST", body, key: intent.current.key });
      intent.current = { signature: "", key: newKey() };
      setOpen(false); setEvidence(""); onChanged();
    } catch (error) { setErr(error); }
    finally { setBusy(false); }
  };
  return <div className="text-xs space-y-2">
    <div>{channel.toUpperCase()} consent: {row?.opted_out ? "opted out" : row?.opted_in_at ? `opted in ${new Date(row.opted_in_at).toLocaleString()}` : "no recorded opt-in"}. {canManage && <button className="underline" onClick={() => setOpen(!open)}>Record consent</button>}</div>
    {open && <div className="rounded border p-2 space-y-2">
      <label className="flex gap-2"><input type="checkbox" checked={optedOut} onChange={(e) => setOptedOut(e.target.checked)} /> Opted out (clear only with opt-in evidence)</label>
      <Label htmlFor="consent-evidence">Consent evidence</Label><Input id="consent-evidence" maxLength={255} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="How and when the recipient gave or withdrew consent" />
      <ErrorNotice error={err} /><Button size="sm" disabled={busy || !evidence.trim()} onClick={save}>{busy ? "Saving…" : "Save consent"}</Button>
    </div>}
  </div>;
}
