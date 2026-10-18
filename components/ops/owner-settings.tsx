"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice, Json, Loading } from "@/components/ops/common";
import { FieldsForm, useMutation } from "@/components/ops/forms";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { chan, ops, pilot } from "@/lib/ops/paths";
import { normalizeMailboxes } from "@/lib/ops/adapters";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section aria-label={title} className="space-y-2"><h2 className="font-semibold text-sm">{title}</h2>{children}</section>;
}

export function OwnerSettings() {
  return (
    <>
      <Members />
      <Connectors />
      <TenantSettings />
      <ChannelSettings />
      <Mailboxes />
      <Identities />
      <Templates />
      <Receipts />
      <AuditAndHealth />
      <McpStatus />
    </>
  );
}

function Members() {
  const { tenant, call } = useOps();
  const members = useOpsFetch(pilot(tenant!, "members/"));
  const m = useMutation(async (p: { id: number; role: string }) => { await call(pilot(tenant!, `members/${p.id}/`), { method: "PATCH", body: { role: p.role } }); members.reload(); });
  return (
    <Section title="Users & roles">
      <ErrorNotice error={members.error ?? m.error} />
      {members.loading && !members.data ? <Loading /> : listOf(members.data).length === 0 ? <Empty>No members.</Empty> : (
        <ul className="divide-y border rounded-lg">
          {listOf(members.data).map((x: any) => (
            <li key={x.id} className="p-3 text-sm flex items-center justify-between gap-2">
              <span>{x.email ?? x.name ?? `Member ${x.id}`}</span>
              <select aria-label={`Role for ${x.email ?? x.id}`} className="border rounded-md px-2 py-1 bg-transparent" value={x.role} onChange={(e) => m.submit({ id: x.id, role: e.target.value })}>
                <option value="super_user">Super user</option><option value="full_staff">Full staff</option><option value="standard_staff">Standard staff</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Connectors() {
  const { tenant, call } = useOps();
  const list = useOpsFetch(pilot(tenant!, "connectors/"));
  const [f, setF] = useState({ kind: "", product: "", base_url: "", credKey: "", secret: "" });
  const create = useMutation(async (b: any, key) => { const r = await call(pilot(tenant!, "connectors/"), { method: "POST", body: b, key }); list.reload(); return r; });
  return (
    <Section title="Connectors">
      <ErrorNotice error={list.error ?? create.error} />
      <ul className="divide-y border rounded-lg">
        {listOf(list.data).map((c: any) => (
          <li key={c.id} className="p-3 text-sm flex gap-2">{c.kind} · {c.product}
            {/* Credentials are write-only; only the configured flag is shown. */}
            <Badge tone={c.credentials_configured ? "green" : "amber"}>{c.credentials_configured ? "credentials configured" : "not configured"}</Badge>
            <Badge tone={c.active === false ? "gray" : "green"}>{c.active === false ? "inactive" : "active"}</Badge>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">JobAdder app credentials live in server environment variables; connect JobAdder accounts with the OAuth buttons above, not here.</p>
      <form className="grid gap-2 sm:grid-cols-3 items-end" onSubmit={async (e) => {
        e.preventDefault();
        const body: Record<string, unknown> = { kind: f.kind, product: f.product };
        if (f.base_url) body.base_url = f.base_url;
        if (f.credKey && f.secret) body.credentials = { [f.credKey]: f.secret };
        const r = await create.submit(body);
        if (r) setF({ kind: "", product: "", base_url: "", credKey: "", secret: "" }); // secret field clears after save
      }}>
        <div><Label htmlFor="ck">Kind</Label><Input id="ck" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} /></div>
        <div><Label htmlFor="cp">Product</Label><Input id="cp" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} /></div>
        <div><Label htmlFor="cb">Base URL (optional)</Label><Input id="cb" type="url" value={f.base_url} onChange={(e) => setF({ ...f, base_url: e.target.value })} /></div>
        <div><Label htmlFor="cck">Credential name</Label><Input id="cck" value={f.credKey} onChange={(e) => setF({ ...f, credKey: e.target.value })} /></div>
        <div><Label htmlFor="cs">Credential value (write-only)</Label><Input id="cs" type="password" autoComplete="new-password" value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value })} /></div>
        <Button type="submit" size="sm" disabled={!f.kind || !f.product || create.busy}>Add connector</Button>
      </form>
    </Section>
  );
}

function TenantSettings() {
  const { tenant, call } = useOps();
  const s = useOpsFetch<any>(pilot(tenant!, "settings/"));
  const [json, setJson] = useState<string | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const save = useMutation(async (b: any, key) => { await call(pilot(tenant!, "settings/"), { method: "PATCH", body: b, key }); setJson(null); s.reload(); });
  if (s.loading && !s.data) return <Loading />;
  const text = json ?? JSON.stringify(s.data?.settings ?? {}, null, 2);
  return (
    <Section title="Organisation settings">
      <ErrorNotice error={s.error ?? save.error} />
      <p className="text-sm">Plan: <strong>{s.data?.plan ?? "—"}</strong></p>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={!!s.data?.live_enabled} disabled={save.busy} onChange={(e) => save.submit({ live_enabled: e.target.checked })} />
        Live sending enabled
      </label>
      <p className="text-xs text-gray-500">Branding, timezone and labels are stored as free-form JSON; the backend does not validate these keys, so agree on the key names before relying on them.</p>
      <Label htmlFor="ts">Settings (JSON object)</Label>
      <Textarea id="ts" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setJson(e.target.value)} />
      {parseErr && <div role="alert" className="text-sm text-red-600">{parseErr}</div>}
      <Button size="sm" disabled={save.busy || json === null} onClick={() => {
        try { const v = JSON.parse(text); if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(); setParseErr(null); save.submit({ settings: v }); } catch { setParseErr("Settings must be a valid JSON object."); }
      }}>Save settings</Button>
    </Section>
  );
}

function ChannelSettings() {
  const { tenant, call } = useOps();
  const s = useOpsFetch(chan(tenant!, "settings/"));
  const [json, setJson] = useState<string | null>(null);
  const m = useMutation(async (b: any) => { await call(chan(tenant!, "settings/"), { method: "PUT", body: b }); setJson(null); s.reload(); });
  const [parseErr, setParseErr] = useState<string | null>(null);
  const text = json ?? JSON.stringify(s.data ?? {}, null, 2);
  return (
    <Section title="Company channel settings">
      <ErrorNotice error={s.error ?? m.error} />
      <p className="text-xs text-gray-500">Provider credentials are write-only and shown here only as <code>credentials_configured</code>. Enter new secrets to replace them; the field clears after saving.</p>
      <Label htmlFor="chs" className="sr-only">Channel settings JSON</Label>
      <Textarea id="chs" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setJson(e.target.value)} />
      {parseErr && <div role="alert" className="text-sm text-red-600">{parseErr}</div>}
      <Button size="sm" disabled={m.busy || json === null} onClick={() => { try { setParseErr(null); m.submit(JSON.parse(text)); } catch { setParseErr("Settings must be valid JSON."); } }}>Save channel settings</Button>
    </Section>
  );
}

function Mailboxes() {
  const { tenant, call } = useOps();
  const list = useOpsFetch(ops("mailboxes/"));
  const connectors = useOpsFetch(pilot(tenant!, "connectors/"));
  const boxes = normalizeMailboxes(list.data);
  const [f, setF] = useState({ address: "", connector: "", sync_mode: "native" });
  const create = useMutation(async (b: any, key) => { await call(ops("mailboxes/"), { method: "POST", body: b, key }); list.reload(); setF({ address: "", connector: "", sync_mode: "native" }); });
  const patch = useMutation(async (p: { id: string; body: any }, key) => { await call(ops(`mailboxes/${p.id}/`), { method: "PATCH", body: p.body, key }); list.reload(); });
  const sub = useMutation(async (id: string, key) => { await call(ops(`mailboxes/${id}/subscriptions/`), { method: "POST", key }); list.reload(); });
  return (
    <Section title="Mailboxes">
      <ErrorNotice error={list.error ?? create.error ?? patch.error ?? sub.error} />
      <ul className="divide-y border rounded-lg">
        {boxes.map((b) => (
          <li key={b.id} className="p-3 text-sm space-y-2">
            <div className="font-medium">{b.label} {b.sensitive && <Badge tone="amber">sensitive · owner only</Badge>}</div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Sensitive mailboxes are forced non-shared and never logged to the ATS by the backend. */}
              <label className="flex items-center gap-1"><input type="checkbox" checked={b.shared} disabled={b.sensitive || patch.busy} onChange={(e) => patch.submit({ id: b.id, body: { shared: e.target.checked } })} /> Shared with full staff</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={b.sensitive} disabled={patch.busy} onChange={(e) => patch.submit({ id: b.id, body: { sensitive: e.target.checked } })} /> Sensitive (Accounts/Payroll)</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={b.log_to_ats} disabled={b.sensitive || patch.busy} onChange={(e) => patch.submit({ id: b.id, body: { log_to_ats: e.target.checked } })} /> Log to ATS</label>
              <select aria-label={`Sync mode for ${b.label}`} className="border rounded px-1 py-0.5 bg-transparent text-xs" value={b.sync_mode} onChange={(e) => patch.submit({ id: b.id, body: { sync_mode: e.target.value } })}>
                <option value="native">Native</option><option value="graph">Microsoft Graph</option>
              </select>
              {b.sync_mode === "graph" && <Button size="sm" variant="outline" disabled={sub.busy} onClick={() => sub.submit(b.id)}>Create / renew subscription</Button>}
            </div>
          </li>
        ))}
      </ul>
      <form className="grid gap-2 sm:grid-cols-4 items-end" onSubmit={(e) => { e.preventDefault(); create.submit({ address: f.address, connector: Number(f.connector), sync_mode: f.sync_mode }); }}>
        <div><Label htmlFor="mba">New mailbox address</Label><Input id="mba" type="email" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label htmlFor="mbc">Connector</Label>
          <select id="mbc" className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={f.connector} onChange={(e) => setF({ ...f, connector: e.target.value })}>
            <option value="">Select…</option>
            {listOf(connectors.data).map((c: any) => <option key={c.id} value={c.id}>{c.kind} · {c.product}</option>)}
          </select></div>
        <div><Label htmlFor="mbs">Sync mode</Label>
          <select id="mbs" className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={f.sync_mode} onChange={(e) => setF({ ...f, sync_mode: e.target.value })}><option value="native">Native</option><option value="graph">Microsoft Graph</option></select></div>
        <Button type="submit" size="sm" disabled={!f.address || !f.connector || create.busy}>Add</Button>
      </form>
    </Section>
  );
}

function Identities() {
  const { tenant, call } = useOps();
  const list = useOpsFetch(pilot(tenant!, "identities/"));
  const m = useMutation(async (b: any, key: string) => { await call(pilot(tenant!, "identities/"), { method: "POST", body: b, key }); list.reload(); });
  const [f, setF] = useState({ actor_type: "client", ats_section: "contacts", ats_id: "", mobile_e164: "", email: "" });
  return (
    <Section title="Verified contact mappings">
      <ErrorNotice error={list.error ?? m.error} />
      <ul className="divide-y border rounded-lg text-sm">
        {listOf(list.data).map((i: any) => <li key={i.id} className="p-2">{i.actor_type} · {i.ats_section}/{i.ats_id} · {i.mobile_e164 ?? i.email} {i.verified && <Badge tone="green">verified</Badge>}</li>)}
      </ul>
      <form className="grid gap-2 sm:grid-cols-6 items-end" onSubmit={(e) => { e.preventDefault(); m.submit({ ...f, ats_id: Number(f.ats_id), mobile_e164: f.mobile_e164 || undefined, email: f.email || undefined, verified: true }); }}>
        <select aria-label="Actor type" className="border rounded-md px-2 py-2 text-sm bg-transparent" value={f.actor_type} onChange={(e) => setF({ ...f, actor_type: e.target.value })}><option value="client">Client</option><option value="supplier">Supplier</option><option value="candidate">Candidate</option></select>
        <Input aria-label="ATS section" placeholder="Section" value={f.ats_section} onChange={(e) => setF({ ...f, ats_section: e.target.value })} />
        <Input aria-label="ATS ID" placeholder="ATS ID" value={f.ats_id} onChange={(e) => setF({ ...f, ats_id: e.target.value.replace(/\D/g, "") })} />
        <Input aria-label="Mobile (E.164)" placeholder="+44…" value={f.mobile_e164} onChange={(e) => setF({ ...f, mobile_e164: e.target.value })} />
        <Input aria-label="Email" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Button type="submit" size="sm" disabled={!f.ats_id || (!f.mobile_e164 && !f.email) || m.busy}>Save verified mapping</Button>
      </form>
    </Section>
  );
}

function Templates() {
  const { tenant, call } = useOps();
  const t = useOpsFetch(chan(tenant!, "templates/"));
  const m = useMutation(async () => { await call(chan(tenant!, "templates/"), { method: "POST" }); t.reload(); });
  return (
    <Section title="Message templates">
      <ErrorNotice error={t.error ?? m.error} />
      <Button size="sm" variant="outline" onClick={() => m.submit(undefined as never)} disabled={m.busy}>Sync from provider</Button>
      <ul className="text-sm divide-y border rounded-lg">{listOf(t.data).map((x: any) => <li key={x.name + x.language} className="p-2 flex gap-2">{x.name} ({x.language}) <Badge tone={/approved/i.test(x.status) ? "green" : "amber"}>{x.status}</Badge></li>)}</ul>
    </Section>
  );
}

function Receipts() {
  const { tenant } = useOps();
  const r = useOpsFetch(chan(tenant!, "receipts/"), { pollMs: 60000 });
  return (
    <Section title="Unprocessed receipts">
      <ErrorNotice error={r.error} />
      {listOf(r.data).length === 0 ? <Empty>No unprocessed receipts.</Empty> : <Json value={r.data} />}
    </Section>
  );
}

function AuditAndHealth() {
  const { tenant } = useOps();
  const [actionId, setActionId] = useState("");
  const [applied, setApplied] = useState("");
  const audit = useOpsFetch(pilot(tenant!, "audit/"), { query: { action_id: applied || undefined } });
  const health = useOpsFetch(pilot(tenant!, "health/"), { pollMs: 60000 });
  return (
    <>
      <Section title="Health (queue, reconciliation, webhooks)">
        <ErrorNotice error={health.error} />
        {health.data && <Json value={health.data} />}
      </Section>
      <Section title="Audit snapshots">
        <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); setApplied(actionId); }}>
          <div><Label htmlFor="aid">Action ID</Label><Input id="aid" value={actionId} onChange={(e) => setActionId(e.target.value.replace(/\D/g, ""))} /></div>
          <Button type="submit" size="sm" variant="outline">Filter</Button>
        </form>
        <ErrorNotice error={audit.error} />
        {audit.loading && !audit.data ? <Loading /> : <Json value={audit.data} />}
      </Section>
    </>
  );
}

function McpStatus() {
  return (
    <Section title="ChatGPT / MCP">
      <p className="text-sm text-gray-600">MCP access is linked from inside ChatGPT using OAuth. No MCP token is shown or stored here. Add the CallPilot MCP server in ChatGPT&apos;s connector settings, then sign in when prompted.</p>
    </Section>
  );
}
