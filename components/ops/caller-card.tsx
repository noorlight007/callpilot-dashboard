"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, newKey } from "@/lib/ops/api";
import { chan, pilot } from "@/lib/ops/paths";
import { profileService } from "@/services/profile-service";
import type { ActionEnvelope, Me } from "@/lib/ops/types";
import { safeUrl } from "@/lib/ops/adapters";
import { contextLabel as label, liveCallForPhone } from "@/components/ops/channel-contracts";

export interface CallerCard {
  call_uid?: string;
  name?: string;
  phone?: string;
  type?: string;
  status?: unknown;
  owner?: unknown;
  last_contact?: string;
  open_jobs?: unknown[];
  ats_section?: string;
  ats_id?: number | string;
  ats_url?: string;
  conversation_uid?: string;
  needs_classification?: boolean;
  can_create?: string[];
}
type CallDetail = { card: CallerCard; transcript: string; transcript_restricted: boolean; reviewed: boolean };
type VoiceCall = { uid?: string; number?: string; status?: string; started_at?: string; caller_card?: CallerCard };
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const messageOf = (e: unknown) => e instanceof Error ? e.message : "Request failed";

/** Rings never wait for the ATS lookup: the card loads alongside the live call. */
export function CallerCardPanel({ phone, calls }: { phone?: string; calls: VoiceCall[] }) {
  const [session, setSession] = useState<{ tenant: number; me: Me } | null>(null);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const org = await profileService.getOrganization();
        const tenant = Number(org.data?.id);
        if (!Number.isInteger(tenant) || tenant <= 0) throw new Error("No active organisation found.");
        const me = await api<Me>(pilot(tenant, "me/"), tenant, { signal: controller.signal });
        if (!controller.signal.aborted) setSession({ tenant, me });
      } catch (error) { if (!controller.signal.aborted) setSessionError(messageOf(error)); }
    })();
    return () => controller.abort();
  }, []);
  if (!phone) return null;
  if (!session) return <p className="text-xs text-muted-foreground">{sessionError || "Loading caller context…"}</p>;
  return <LiveCallerCard key={`${session.tenant}:${digits(phone)}`} phone={phone} calls={calls} tenant={session.tenant} me={session.me} />;
}

function LiveCallerCard({ phone, calls, tenant, me }: { phone: string; calls: VoiceCall[]; tenant: number; me: Me }) {
  const [freshCalls, setFreshCalls] = useState<VoiceCall[] | null>(null);
  const [detail, setDetail] = useState<{ uid: string; data: CallDetail } | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<string | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [tabNotice, setTabNotice] = useState("");
  const tabRef = useRef<Window | null>(null);
  // Never attach an old completed call merely because it has the same phone.
  const call = liveCallForPhone(freshCalls ?? calls, phone);
  const uid = call?.uid;
  const card = { ...call?.caller_card, ...(detail?.uid === uid ? detail?.data.card : {}) };
  const context = detail?.uid === uid ? detail?.data : null;
  const atsUrl = safeUrl(card.ats_url);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (!document.hidden) {
        try {
          const result = await api<{ calls: VoiceCall[] }>("/voice/api/calls/", tenant, { signal: controller.signal });
          if (!controller.signal.aborted) { setFreshCalls(result.calls ?? []); setErr(""); }
        } catch (error) { if (!controller.signal.aborted) setErr(messageOf(error)); }
      }
      if (!controller.signal.aborted) timer = setTimeout(run, 2500);
    };
    void run();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [tenant, phone]);
  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    api<CallDetail>(chan(tenant, `calls/${uid}/`), tenant, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setDetail({ uid, data });
    }).catch((error) => { if (!controller.signal.aborted) setErr(messageOf(error)); });
    return () => controller.abort();
  }, [tenant, uid, tick, call?.caller_card]);
  useEffect(() => {
    if (!autoOpen || !atsUrl || !tabRef.current || tabRef.current.closed) return;
    tabRef.current.location.href = atsUrl;
  }, [autoOpen, atsUrl]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  const prepareTab = () => {
    if (!tabRef.current || tabRef.current.closed) {
      tabRef.current = window.open("about:blank", "callpilot_jobadder");
      if (tabRef.current) tabRef.current.opener = null;
    }
    if (!tabRef.current) { setTabNotice("Allow popups for this site, then prepare the caller tab again."); return; }
    setAutoOpen(true); setTabNotice("");
    if (atsUrl) tabRef.current.location.href = atsUrl;
  };
  const canCreate = (card.can_create ?? []).filter((section) => ["candidates", "contacts"].includes(section));
  return <div className="rounded-xl border border-border/70 bg-muted/35 p-3 space-y-2 text-xs" role="region" aria-label="Caller card">
    <div className="flex flex-wrap justify-between gap-2"><div className="font-semibold text-sm">{card.name || phone}</div>{atsUrl && <a href={atsUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">Open JobAdder</a>}</div>
    {!call?.caller_card && !card.name && <p className="text-muted-foreground">Waiting for this call&apos;s caller card…</p>}
    {err && <p role="alert" className="text-red-600 whitespace-pre-wrap">{err}</p>}
    <p className="text-muted-foreground">{[card.type, label(card.status), card.owner && `Owner: ${label(card.owner)}`, card.last_contact && `Last contact: ${new Date(card.last_contact).toLocaleString()}`].filter(Boolean).join(" · ")}</p>
    {!!card.open_jobs?.length && <ul className="list-disc pl-4">{card.open_jobs.map((job, i) => <li key={i}>{label(job)}</li>)}</ul>}
    {context?.transcript_restricted ? <p>Transcript restricted for this caller.</p> : context?.transcript && <details><summary className="cursor-pointer">Call transcript</summary><p className="whitespace-pre-wrap mt-2">{context.transcript}</p></details>}
    <div className="flex flex-wrap gap-2 items-center"><Button size="sm" variant="outline" onClick={prepareTab}>{autoOpen ? "Prepare caller tab again" : "Prepare a JobAdder caller tab"}</Button>{autoOpen && <button className="underline" onClick={() => setAutoOpen(false)}>Stop automatic reuse</button>}</div>
    <p className="text-muted-foreground">Preparing a tab opts in to reusing it for this caller. Browser popup settings apply.</p>{tabNotice && <p role="status">{tabNotice}</p>}
    {card.needs_classification && <p className="text-amber-700">This record already exists and needs owner classification. {card.conversation_uid && <a className="underline" href={`/inbox?conversation=${encodeURIComponent(card.conversation_uid)}`}>Review in Inbox</a>}</p>}
    {card.conversation_uid && !card.needs_classification && <a className="underline inline-block" href={`/inbox?conversation=${encodeURIComponent(card.conversation_uid)}`}>Open conversation and identity review</a>}
    {!card.ats_id && !card.needs_classification && !form && canCreate.length > 0 && uid && <div className="flex flex-wrap gap-2">{canCreate.map((section) => <Button key={section} size="sm" variant="outline" onClick={() => setForm(section)}>{section === "candidates" ? "Create candidate" : "Create client contact"}</Button>)}</div>}
    {form && uid && !card.ats_id && !card.needs_classification && <CreateForm key={`${uid}:${form}`} tenant={tenant} uid={uid} section={form} conv={card.conversation_uid} phone={phone} me={me} onMatched={reload} onClose={() => setForm(null)} />}
  </div>;
}

function CreateForm({ tenant, uid, section, conv, phone, me, onMatched, onClose }: { tenant: number; uid: string; section: string; conv?: string; phone: string; me: Me; onMatched: () => void; onClose: () => void }) {
  const [fields, setFields] = useState({ firstName: "", lastName: "", email: "", companyId: "" });
  const [action, setAction] = useState<ActionEnvelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [matched, setMatched] = useState(false);
  const intent = useRef({ signature: "", key: newKey() });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);
  const resolve = useCallback(async () => {
    if (!conv) { setErr("The caller has no conversation mapping yet. Refresh caller context before resolving."); return; }
    try {
      await api(chan(tenant, `conversations/${conv}/resolve/`), tenant, { method: "POST", signal: controller.current?.signal });
      setMatched(true); setErr(""); onMatched();
    } catch (error) { if (!controller.current?.signal.aborted) setErr(`Provider record created. Identity still needs matching: ${messageOf(error)}`); }
  }, [conv, tenant, onMatched]);
  const actionId = action?.id;
  useEffect(() => {
    if (actionId == null) return;
    const pollController = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 1000;
    const poll = async () => {
      if (!document.hidden) {
        try {
          const result = await api<ActionEnvelope>(pilot(tenant, `actions/${actionId}/`), tenant, { signal: pollController.signal });
          if (pollController.signal.aborted) return;
          setAction(result);
          if (result.status === "succeeded") { await resolve(); return; }
          if (["failed", "dead_letter", "awaiting_confirmation"].includes(result.status)) return;
        } catch (error) { if (!pollController.signal.aborted) setErr(messageOf(error)); }
      }
      delay = Math.min(delay * 1.5, 10000);
      if (!pollController.signal.aborted) timer = setTimeout(poll, delay);
    };
    void poll();
    return () => { pollController.abort(); clearTimeout(timer); };
  }, [actionId, tenant, resolve]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || action && action.status !== "failed") return;
    const data = { firstName: fields.firstName.trim(), lastName: fields.lastName.trim(), ...(fields.email.trim() ? { email: fields.email.trim() } : {}), ...(section === "contacts" && fields.companyId ? { companyId: Number(fields.companyId) } : {}) };
    const body = { section, data };
    const signature = JSON.stringify(body);
    if (intent.current.signature !== signature) intent.current = { signature, key: newKey() };
    setBusy(true); setErr("");
    try { setAction(await api<ActionEnvelope>(chan(tenant, `calls/${uid}/`), tenant, { method: "POST", key: intent.current.key, body, signal: controller.current?.signal })); }
    catch (error) { if (!controller.current?.signal.aborted) setErr(messageOf(error)); }
    finally { setBusy(false); }
  };
  const createdId = action?.after?.[section === "candidates" ? "candidateId" : "contactId"] ?? action?.after?.id;
  const pending = action && ["queued", "running"].includes(action.status);
  return <form className="space-y-2 border-t pt-2" onSubmit={submit}>
    <p>The backend binds the caller&apos;s phone.{me.role === "standard_staff" ? " The backend assigns your JobAdder ownership." : ""}</p>
    <Label htmlFor="caller-first">First name</Label><Input id="caller-first" required maxLength={50} value={fields.firstName} onChange={(e) => setFields({ ...fields, firstName: e.target.value })} />
    <Label htmlFor="caller-last">Last name</Label><Input id="caller-last" required maxLength={50} value={fields.lastName} onChange={(e) => setFields({ ...fields, lastName: e.target.value })} />
    <Label htmlFor="caller-email">Email (optional)</Label><Input id="caller-email" type="email" maxLength={100} value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} />
    {section === "contacts" && <><Label htmlFor="caller-company">Existing company ID (optional)</Label><Input id="caller-company" inputMode="numeric" value={fields.companyId} onChange={(e) => setFields({ ...fields, companyId: e.target.value.replace(/\D/g, "") })} /></>}
    {err && <p role="alert" className="text-red-600 whitespace-pre-wrap">{err}</p>}
    {action && <p role="status">Action #{action.id}: {action.status}{action.error ? ` — ${typeof action.error === "string" ? action.error : JSON.stringify(action.error)}` : ""}</p>}
    {action?.status === "succeeded" && createdId && <p>Created provider record: {section}/{String(createdId)}</p>}
    {action?.status === "succeeded" && section === "contacts" && createdId && !matched && me.role === "super_user" && <ClassifyCreatedContact tenant={tenant} id={String(createdId)} phone={phone} onDone={resolve} />}
    {action?.uncertain_outcome && <p>Outcome uncertain: owner reconciliation is required before another creation.</p>}
    {matched && <p role="status">Identity re-matched. Held notes will be reprocessed.</p>}
    {action?.status === "succeeded" && !matched && <Button type="button" size="sm" onClick={resolve}>Re-match identity</Button>}
    {action?.status === "succeeded" && section === "contacts" && <p>Existing contacts may require owner classification in Inbox before notes can be released.</p>}
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy || !!pending || !!action && (action.status !== "failed" || !!action.uncertain_outcome) || !fields.firstName.trim() || !fields.lastName.trim()}>{busy ? "Submitting…" : "Create"}</Button><Button type="button" size="sm" variant="outline" disabled={!!pending || action?.status === "succeeded" && !matched} onClick={onClose}>Close</Button></div>
  </form>;
}

function ClassifyCreatedContact({ tenant, id, phone, onDone }: { tenant: number; id: string; phone: string; onDone: () => Promise<void> }) {
  const [verified, setVerified] = useState(false);
  const [actor, setActor] = useState("client");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return <div className="border rounded p-2 space-y-2">
    <p>Owner review: classify the created contact before processing held correspondence.</p>
    <select aria-label="Created contact classification" className="border rounded px-2 py-1 bg-background" value={actor} onChange={(e) => setActor(e.target.value)}><option value="client">Client</option><option value="supplier">Supplier</option></select>
    <label className="flex gap-2"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> I verified that contacts/{id} and this classification belong to {phone}.</label>
    {err && <p role="alert" className="text-red-600">{err}</p>}
    <Button type="button" size="sm" disabled={!verified || busy} onClick={async () => {
      setBusy(true); setErr("");
      try { await api(pilot(tenant, "identities/"), tenant, { method: "POST", body: { actor_type: actor, ats_section: "contacts", ats_id: id, mobile_e164: phone, verified: true } }); await onDone(); }
      catch (error) { setErr(messageOf(error)); }
      finally { setBusy(false); }
    }}>{busy ? "Resolving…" : "Save classification & resolve"}</Button>
  </div>;
}
