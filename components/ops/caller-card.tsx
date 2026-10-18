"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, newKey } from "@/lib/ops/api";
import { chan } from "@/lib/ops/paths";
import { profileService } from "@/services/profile-service";
import { ActionStatus } from "@/lib/ops/types";
import { conversationUidOf, safeUrl } from "@/lib/ops/adapters";

export interface CallerCard {
  name?: string;
  phone?: string;
  type?: string;
  status?: string;
  owner?: string;
  last_contact?: string;
  open_jobs?: any[];
  ats_section?: string;
  ats_id?: number | string;
  ats_url?: string;
  conversation_uid?: string;
  needs_classification?: boolean;
  can_create?: string[];
}

const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

/**
 * Caller pop for the softphone: shows the backend's caller_card for the call
 * matching `phone`, an explicit "Open JobAdder" link, and creation for unknown callers.
 */
export function CallerCardPanel({ phone, calls }: { phone?: string; calls: any[] }) {
  const [tenant, setTenant] = useState<number | null>(null);
  const [form, setForm] = useState<{ section: string } | null>(null);
  const [autoOpen, setAutoOpen] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("callpilot_auto_open") === "1"; } catch { return false; }
  });
  const [detail, setDetail] = useState<any>(null);
  const tabRef = useRef<Window | null>(null);
  const call = calls.find((c) => phone && c.caller_card && digits(c.number) === digits(phone));
  // The list carries `caller_card`; the call-detail endpoint returns the card itself.
  const card: CallerCard & { conversation_uid?: string } = { ...call?.caller_card, ...detail };
  const uid: string | undefined = call?.uid ?? (call?.id != null ? String(call.id) : undefined);

  useEffect(() => {
    profileService.getOrganization().then((r) => setTenant(Number(r.data?.id))).catch(() => {});
  }, []);
  // Opt-in: the user pre-opens a tab with a click (a user gesture), and we then reuse that tab per call.
  useEffect(() => {
    if (!autoOpen || !call?.caller_card?.ats_url || !tabRef.current || tabRef.current.closed) return;
    const u = safeUrl(call.caller_card.ats_url);
    if (u) tabRef.current.location.href = u;
  }, [autoOpen, call?.caller_card?.ats_url]);
  useEffect(() => {
    if (tenant == null || !uid) return;
    api(chan(tenant, `calls/${uid}/`), tenant).then(setDetail).catch(() => {});
  }, [tenant, uid]);
  if (!call?.caller_card) return null;

  const canCreate = card.can_create ?? [];
  const label: Record<string, string> = { candidates: "Create candidate", contacts: "Create client contact" };
  return (
    <div className="rounded-xl border border-border/70 bg-muted/35 p-3 space-y-2 text-xs" role="region" aria-label="Caller card">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm">{card.name || card.phone || "Unknown caller"}</div>
        {/* Visible link; opened by the user's own click so browsers don't block it. */}
        {safeUrl(card.ats_url) && (
          <a href={safeUrl(card.ats_url)} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            Open JobAdder
          </a>
        )}
      </div>
      <div className="text-muted-foreground">
        {[card.type, card.status, card.owner && `Owner: ${card.owner}`, card.last_contact && `Last contact: ${new Date(card.last_contact).toLocaleDateString()}`].filter(Boolean).join(" · ")}
      </div>
      {card.open_jobs && card.open_jobs.length > 0 && (
        <ul className="list-disc pl-4">
          {card.open_jobs.map((j: any, i: number) => (
            <li key={i}>{typeof j === "string" ? j : j.title ?? j.jobTitle ?? JSON.stringify(j)}</li>
          ))}
        </ul>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={autoOpen} onChange={(e) => {
          const on = e.target.checked; setAutoOpen(on);
          try { localStorage.setItem("callpilot_auto_open", on ? "1" : "0"); } catch {}
          // window.open here runs inside the click handler, so it isn't blocked.
          if (on && !tabRef.current) tabRef.current = window.open("about:blank", "callpilot_jobadder", "noopener=no");
        }} />
        Reuse one JobAdder tab for incoming callers
      </label>
      {card.needs_classification && canCreate.length === 0 && (
        <p className="text-amber-700">This record already exists and needs owner classification in Inbox — it will not be created again.</p>
      )}
      {!card.ats_id && canCreate.length > 0 && tenant != null && uid && (
        <div className="flex gap-2">
          {canCreate.map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => setForm({ section: s })}>
              {label[s] ?? `Create ${s}`}
            </Button>
          ))}
        </div>
      )}
      {form && tenant != null && uid && <CreateForm conv={conversationUidOf(card)} tenant={tenant} uid={uid} section={form.section} onClose={() => setForm(null)} />}
    </div>
  );
}

function CreateForm({ tenant, uid, section, conv, onClose }: { conv?: string; tenant: number; uid: string; section: string; onClose: () => void }) {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "" });
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionStatus | "submitting" | null>(null);
  const key = useRef(newKey());
  const last = useRef(JSON.stringify(f));

  const submit = async () => {
    const snapshot = JSON.stringify(f);
    if (snapshot !== last.current) { key.current = newKey(); last.current = snapshot; }
    setErr(null);
    setStatus("submitting");
    try {
      // The backend binds the caller's phone; we only send provider fields.
      const r: any = await api(chan(tenant, `calls/${uid}/`), tenant, { method: "POST", key: key.current, body: { section, data: Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== "")) } });
      let delay = 1000;
      for (let i = 0; i < 12; i++) {
        const a: any = await api(`/pilot/tenants/${tenant}/actions/${r.id}/`, tenant);
        setStatus(a.status);
        if (a.status === "succeeded") {
          // Re-match the caller so the new provider record releases held notes; it may not be searchable yet.
          if (conv) await api(chan(tenant, `conversations/${conv}/resolve/`), tenant, { method: "POST", key: newKey() }).catch(() => {});
          return;
        }
        if (a.status === "failed" || a.status === "dead_letter") { setErr(typeof a.error === "string" ? a.error : JSON.stringify(a.error)); return; }
        await new Promise((res) => setTimeout(res, delay));
        delay = Math.min(delay * 1.5, 6000);
      }
    } catch (e) {
      setStatus(null);
      setErr(e instanceof ApiError ? e.message : "Request failed");
    }
  };
  return (
    <div className="space-y-2 border-t pt-2">
      <Label htmlFor="cc-first">First name</Label><Input id="cc-first" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
      <Label htmlFor="cc-last">Last name</Label><Input id="cc-last" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
      <Label htmlFor="cc-email">Email</Label><Input id="cc-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      {err && <div role="alert" className="text-red-600 whitespace-pre-wrap">{err}</div>}
      {status && <div role="status">Status: {status}</div>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={status === "submitting" || !f.firstName}>Create</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
