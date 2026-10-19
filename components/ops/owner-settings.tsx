"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Empty, ErrorNotice, Json, Loading } from "@/components/ops/common";
import { FieldsForm, useMutation, type FieldDef } from "@/components/ops/forms";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { chan, ops, pilot } from "@/lib/ops/paths";

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section aria-label={title} className="space-y-3 border-t pt-5"><h2 className="font-semibold">{title}</h2>{children}</section>; }
function objectFrom(text: string): Record<string, any> { const value = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid JSON object."); return value; }
const ROLES = ["super_user", "full_staff", "standard_staff"];

export function OwnerSettings() {
  const { isOwner } = useOps();
  if (!isOwner) return null;
  return <><Members /><Connectors /><TenantSettings /><ChannelSettings /><Mailboxes /><Identities /><Templates /><Receipts /><AuditAndHealth /><McpStatus /></>;
}

const MEMBER_FIELDS: FieldDef[] = [{ name: "role", label: "Platform role", options: ROLES, required: true }, { name: "mobile_e164", label: "Staff mobile (E.164)", type: "tel" }, { name: "ats_user_id", label: "Verified JobAdder user ID" }, { name: "active", label: "Active membership", type: "boolean" }, { name: "mcp_subject", label: "Owner MCP identity subject (from your identity provider)" }];
function Members() {
  const { tenant, call, me } = useOps(); const members = useOpsFetch(pilot(tenant!, "members/"));
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const save = useMutation(async (payload: { id?: number; body: any }, key) => {
    if (payload.body.mobile_e164 && !/^\+[1-9][0-9]{7,14}$/.test(payload.body.mobile_e164)) throw new Error("Staff mobile must use E.164 format.");
    const value = await call<any>(pilot(tenant!, payload.id ? `members/${payload.id}/` : "members/"), { method: payload.id ? "PATCH" : "POST", body: payload.body, key });
    members.reload(); setEditing(null); if (value.id === me?.membership_id) window.location.reload(); return value;
  });
  return <Section title="Users and platform roles"><p className="text-xs text-gray-500">Members reference existing account user IDs. Link the verified JobAdder user ID before standard staff write records. At least one active super user must remain.</p><ErrorNotice error={members.error ?? save.error} />
    {members.loading && !members.data ? <Loading /> : listOf(members.data).length ? <ul className="divide-y border rounded-lg">{listOf(members.data).map((member) => <li key={member.id} className="p-3 space-y-2"><div className="flex flex-wrap items-center gap-2 text-sm"><strong>User #{member.user}</strong><span className="text-gray-500">Membership #{member.id}</span><Badge>{member.role}</Badge><Badge tone={member.active ? "green" : "gray"}>{member.active ? "active" : "inactive"}</Badge><Button size="sm" variant="outline" onClick={() => setEditing(editing === member.id ? null : member.id)}>Edit member</Button></div>{editing === member.id && <FieldsForm key={member.id} fields={MEMBER_FIELDS} initial={member} submitLabel="Save member" busy={save.busy} onSubmit={(body) => save.submit({ id: member.id, body })} />}</li>)}</ul> : <Empty>No platform members.</Empty>}
    <Button size="sm" variant="outline" onClick={() => setEditing(editing === "new" ? null : "new")}>{editing === "new" ? "Close new member" : "Add existing user"}</Button>
    {editing === "new" && <FieldsForm fields={[{ name: "user", label: "Existing account user ID", type: "number", required: true }, ...MEMBER_FIELDS]} initial={{ role: "standard_staff", active: true }} submitLabel="Add member" busy={save.busy} onSubmit={(body) => save.submit({ body })} />}
  </Section>;
}

function Connectors() {
  const { tenant } = useOps(); const connectors = useOpsFetch(pilot(tenant!, "connectors/")); const [editing, setEditing] = useState<number | "new" | null>(null);
  return <Section title="Provider connectors"><ErrorNotice error={connectors.error} />
    {connectors.loading && !connectors.data ? <Loading /> : listOf(connectors.data).length ? <ul className="divide-y border rounded-lg">{listOf(connectors.data).map((connector) => <li key={connector.id} className="p-3 text-sm space-y-2"><div className="flex flex-wrap items-center gap-2"><strong>{connector.kind} · {connector.product}</strong><span>#{connector.id}</span><Badge tone={connector.credentials_configured ? "green" : "amber"}>{connector.credentials_configured ? "credentials configured" : "credentials not configured"}</Badge><Badge tone={connector.active ? "green" : "gray"}>{connector.active ? "active" : "inactive"}</Badge><Button size="sm" variant="outline" onClick={() => setEditing(editing === connector.id ? null : connector.id)}>Configure</Button></div>{connector.last_error && <p role="alert" className="text-red-700">{connector.last_error}</p>}{editing === connector.id && <ConnectorForm key={connector.id} connector={connector} onSaved={() => { connectors.reload(); setEditing(null); }} />}</li>)}</ul> : <Empty>No connectors configured.</Empty>}
    <Button size="sm" variant="outline" onClick={() => setEditing(editing === "new" ? null : "new")}>{editing === "new" ? "Close connector form" : "Add connector"}</Button>{editing === "new" && <ConnectorForm onSaved={() => { connectors.reload(); setEditing(null); }} />}
  </Section>;
}

function ConnectorForm({ connector, onSaved }: { connector?: any; onSaved: () => void }) {
  const { tenant, call } = useOps(); const prefix = useId();
  const [value, setValue] = useState({ kind: connector?.kind ?? "ats", product: connector?.product ?? "jobadder", base_url: connector?.base_url ?? "", active: connector?.active ?? false });
  const [config, setConfig] = useState(JSON.stringify(connector?.config ?? { writes_enabled: false }, null, 2));
  const [credentials, setCredentials] = useState([{ name: "", value: "" }]);
  const save = useMutation(async (body: any, key) => { const result = await call(pilot(tenant!, "connectors/"), { method: "POST", body, key }); setCredentials([{ name: "", value: "" }]); onSaved(); return result; });
  const [parseError, setParseError] = useState<unknown>(null);
  return <form className="space-y-3 p-3 border rounded-lg" onSubmit={(event) => {
    event.preventDefault(); setParseError(null);
    try {
      const parsed = objectFrom(config);
      if (Object.keys(parsed).some((key) => /token|secret|password|api_key|private_key/i.test(key))) throw new Error("Put secrets in write-only credentials, never in public config.");
      if (credentials.some((entry) => (!!entry.name !== !!entry.value))) throw new Error("Provide both a credential name and its new value.");
      const entered = credentials.filter((entry) => entry.name && entry.value);
      if (new Set(entered.map((entry) => entry.name)).size !== entered.length) throw new Error("Credential names must be unique.");
      save.submit({ ...value, config: parsed, ...(entered.length ? { credentials: Object.fromEntries(entered.map((entry) => [entry.name, entry.value])) } : {}) });
    } catch (error) { setParseError(error); }
  }}>
    <p className="text-xs text-gray-500">JobAdder application credentials stay in server environment variables. Personal and background accounts connect through the OAuth buttons. Saving new credentials replaces the provider&apos;s stored credential object; supply every required value. Leave inputs empty to preserve it.</p>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor={`${prefix}-kind`}>Connector kind</Label><select id={`${prefix}-kind`} className="w-full border rounded p-2 bg-transparent text-sm" disabled={!!connector} value={value.kind} onChange={(e) => setValue({ ...value, kind: e.target.value, product: e.target.value === "ats" ? "jobadder" : e.target.value === "messaging" ? "telnyx" : e.target.value === "email" ? "microsoft365" : "" })}>{["ats", "messaging", "email", "accounts", "timesheets"].map((kind) => <option key={kind}>{kind}</option>)}</select></div>
      <div><Label htmlFor={`${prefix}-product`}>Product</Label><Input id={`${prefix}-product`} required value={value.product} disabled={!!connector} onChange={(e) => setValue({ ...value, product: e.target.value })} /></div><div><Label htmlFor={`${prefix}-url`}>Approved base URL (optional)</Label><Input id={`${prefix}-url`} type="url" value={value.base_url} onChange={(e) => setValue({ ...value, base_url: e.target.value })} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.active} onChange={(e) => setValue({ ...value, active: e.target.checked })} />Active connector</label></div>
    <Label htmlFor={`${prefix}-config`}>Public provider config (JSON object)</Label><Textarea id={`${prefix}-config`} rows={6} className="font-mono text-xs" value={config} onChange={(e) => setConfig(e.target.value)} />
    <p className="text-xs text-gray-500">For JobAdder, configure writes_enabled, confirmed archive status IDs and any approved system fallback. For Microsoft 365, configure directory_id. Finance resource catalogs and provider URLs must be verified for the account.</p>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">New write-only credentials</legend>{credentials.map((entry, index) => <div className="grid gap-2 sm:grid-cols-2" key={index}><Input aria-label={`Credential ${index + 1} name`} placeholder="Credential name" value={entry.name} onChange={(e) => setCredentials(credentials.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /><Input aria-label={`Credential ${index + 1} new value`} type="password" autoComplete="new-password" placeholder="New credential value" value={entry.value} onChange={(e) => setCredentials(credentials.map((row, i) => i === index ? { ...row, value: e.target.value } : row))} /></div>)}<Button size="sm" type="button" variant="outline" onClick={() => setCredentials([...credentials, { name: "", value: "" }])}>Add credential field</Button></fieldset>
    <ErrorNotice error={parseError ?? save.error} /><Button size="sm" disabled={save.busy}>Save connector</Button>
  </form>;
}

function TenantSettings() {
  const { tenant, call } = useOps(); const settings = useOpsFetch(pilot(tenant!, "settings/"));
  const [draft, setDraft] = useState<string | null>(null); const [error, setError] = useState<unknown>(null);
  const save = useMutation(async (body: any, key) => { const result = await call(pilot(tenant!, "settings/"), { method: "PATCH", body, key }); setDraft(null); settings.reload(); return result; });
  return <Section title="Organisation settings"><ErrorNotice error={settings.error ?? error ?? save.error} />{settings.loading && !settings.data ? <Loading /> : <>
    <p className="text-sm">Plan: <strong>{settings.data?.plan ?? "Unavailable"}</strong></p><label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!settings.data?.live_enabled} disabled={save.busy || !settings.data} onChange={(e) => save.submit({ live_enabled: e.target.checked })} />Enable this tenant&apos;s external delivery gate</label>
    <p className="text-xs text-gray-500">Global writes and connector writes must also be enabled. This gate does not verify provider setup. Keep branding, timezone and labels here under your configured keys. The screening_followup_via_platform flag switches screening notifications to the configured platform automation.</p>
    <Label htmlFor="tenant-settings-json">Tenant settings (JSON object)</Label><Textarea id="tenant-settings-json" className="font-mono text-xs" rows={8} value={draft ?? JSON.stringify(settings.data?.settings ?? {}, null, 2)} onChange={(e) => setDraft(e.target.value)} /><Button size="sm" disabled={draft === null || save.busy || !settings.data} onClick={() => { try { setError(null); save.submit({ settings: objectFrom(draft!) }); } catch (e) { setError(e); } }}>Save tenant settings</Button>
  </>}</Section>;
}

function ChannelSettings() {
  const { tenant } = useOps(); const settings = useOpsFetch(chan(tenant!, "settings/")); const connectors = useOpsFetch(pilot(tenant!, "connectors/"));
  return <Section title="Company SMS and WhatsApp channel"><ErrorNotice error={settings.error ?? connectors.error} />{settings.loading && !settings.data ? <Loading /> : <ChannelForm key={JSON.stringify(settings.data)} initial={settings.data ?? {}} connectors={listOf(connectors.data).filter((connector) => connector.kind === "messaging" && connector.product === "telnyx")} onSaved={settings.reload} />}</Section>;
}
function ChannelForm({ initial, connectors, onSaved }: { initial: any; connectors: any[]; onSaved: () => void }) {
  const { tenant, call } = useOps(); const [config, setConfig] = useState(JSON.stringify(initial.config ?? {}, null, 2));
  const fields: FieldDef[] = [{ name: "number", label: "Company number (E.164)", type: "tel", required: true }, { name: "connector", label: "Telnyx connector ID", type: "number", required: true, options: connectors.map((connector) => connector.id) }, { name: "public_key", label: "Telnyx Ed25519 webhook public key (base64)", required: true }, { name: "messaging_profile_id", label: "Messaging profile ID", required: true }, { name: "sms_enabled", label: "SMS enabled", type: "boolean" }, { name: "whatsapp_enabled", label: "WhatsApp enabled", type: "boolean" }, { name: "active", label: "Channel active", type: "boolean" }];
  const save = useMutation(async (changed: any, key) => {
    const body = { ...initial, ...changed, config: objectFrom(config) };
    if (!/^\+[1-9][0-9]{7,14}$/.test(body.number)) throw new Error("Use an E.164 company number.");
    const result = await call(chan(tenant!, "settings/"), { method: "PUT", body, key }); onSaved(); return result;
  });
  return <div className="space-y-3"><p className="text-xs text-gray-500">Select a tenant Telnyx messaging connector. The public key verifies webhooks and is public; provider API credentials belong in the connector&apos;s write-only fields.</p><ErrorNotice error={save.error} />
    <Label htmlFor="channel-config">Channel config (JSON object)</Label><Textarea id="channel-config" rows={5} className="font-mono text-xs" value={config} onChange={(e) => setConfig(e.target.value)} /><p className="text-xs text-gray-500">Use approved media_hosts. Enable call_transcription_enabled only after configuring the service and caller notice. Optional mobile_caller_cards needs an approved caller_card_template.</p>
    <FieldsForm fields={fields} initial={{ sms_enabled: false, whatsapp_enabled: false, active: false, ...initial }} submitLabel="Save channel settings" busy={save.busy} onSubmit={save.submit} />
    {initial.number && <Button size="sm" variant="outline" disabled={save.busy || config === JSON.stringify(initial.config ?? {}, null, 2)} onClick={() => save.submit({})}>Save channel config</Button>}
  </div>;
}

function Mailboxes() {
  const { tenant } = useOps(); const boxes = useOpsFetch(ops("mailboxes/")); const connectors = useOpsFetch(pilot(tenant!, "connectors/")); const members = useOpsFetch(pilot(tenant!, "members/"));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const emailConnectors = listOf(connectors.data).filter((connector) => connector.kind === "email");
  return <Section title="Mailboxes and logging"><ErrorNotice error={boxes.error ?? connectors.error ?? members.error} /><p className="text-xs text-gray-500">Staff personal mailboxes need an owner account. Shared mailboxes are restricted to full staff and the owner. Accounts/Payroll always stay owner-only with ATS logging disabled. Native ATS logging should stay disabled in CallPilot to avoid duplicates.</p>
    {boxes.loading && !boxes.data ? <Loading /> : listOf(boxes.data).length ? <ul className="divide-y border rounded-lg">{listOf(boxes.data).map((box) => <li key={box.id} className="p-3 space-y-2"><div className="flex flex-wrap gap-2 items-center text-sm"><strong>{box.address}</strong>{box.sensitive && <Badge tone="amber">sensitive · owner only</Badge>}<Badge>{box.sync_mode}</Badge><Badge tone={box.active ? "green" : "gray"}>{box.active ? "active" : "inactive"}</Badge><Button size="sm" variant="outline" onClick={() => setEditing(editing === box.id ? null : box.id)}>Configure mailbox</Button></div>{box.sync_error && <p className="text-sm text-red-700" role="alert">{box.sync_error}</p>}{box.last_synced_at && <p className="text-xs text-gray-500">Last synced {new Date(box.last_synced_at).toLocaleString()}</p>}{editing === box.id && <MailboxForm key={box.id} box={box} connectors={emailConnectors} members={listOf(members.data)} onSaved={() => { boxes.reload(); setEditing(null); }} />}</li>)}</ul> : <Empty>No mailboxes.</Empty>}
    <Button size="sm" variant="outline" onClick={() => setEditing(editing === "new" ? null : "new")}>{editing === "new" ? "Close mailbox form" : "Add mailbox"}</Button>{editing === "new" && <MailboxForm connectors={emailConnectors} members={listOf(members.data)} onSaved={() => { boxes.reload(); setEditing(null); }} />}
  </Section>;
}
function MailboxForm({ box, connectors, members, onSaved }: { box?: any; connectors: any[]; members: any[]; onSaved: () => void }) {
  const { call } = useOps();
  const fields: FieldDef[] = [{ name: "address", label: "Mailbox address", type: "email", required: true }, { name: "connector", label: "Email connector ID", type: "number", options: connectors.map((connector) => connector.id), required: true }, { name: "graph_user_id", label: "Microsoft Graph user ID (optional)" }, { name: "owner", label: "Owner account user ID", type: "number", options: members.filter((member) => member.active).map((member) => member.user) }, { name: "sync_mode", label: "Logging mode", options: ["native", "graph"] }, { name: "shared", label: "Shared with full staff", type: "boolean" }, { name: "sensitive", label: "Sensitive (owner-only)", type: "boolean" }, { name: "log_to_ats", label: "CallPilot logs to ATS", type: "boolean" }, { name: "active", label: "Active", type: "boolean" }, { name: "internal_domains", label: "Internal domains (JSON string array)", type: "json", schema: { type: "array", items: { type: "string" } } }];
  const save = useMutation(async (changed: any, key) => {
    const body = { ...changed };
    const sensitive = changed.sensitive ?? box?.sensitive ?? /accounts|payroll/i.test(changed.address ?? box?.address ?? "");
    if (sensitive) { body.shared = false; body.log_to_ats = false; }
    if ((changed.sync_mode ?? box?.sync_mode ?? "native") === "native") body.log_to_ats = false;
    const result = await call(ops(box ? `mailboxes/${box.id}/` : "mailboxes/"), { method: box ? "PATCH" : "POST", body, key }); onSaved(); return result;
  });
  const subscription = useMutation(async (_: void, key) => call(ops(`mailboxes/${box.id}/subscriptions/`), { method: "POST", key }));
  return <div className="space-y-3 border rounded p-3"><FieldsForm fields={fields} initial={box ?? { sync_mode: "native", shared: false, sensitive: false, log_to_ats: false, active: true }} busy={save.busy} submitLabel={box ? "Save mailbox" : "Create mailbox"} onSubmit={save.submit} /><ErrorNotice error={save.error ?? subscription.error} />{box?.sync_mode === "graph" && <Button size="sm" variant="outline" disabled={subscription.busy} onClick={() => subscription.submit()}>Create / renew Graph subscription</Button>}{subscription.result && <p role="status" className="text-sm">Subscription request completed.</p>}</div>;
}

function Identities() {
  const { tenant, call } = useOps(); const identities = useOpsFetch(pilot(tenant!, "identities/")); const [editing, setEditing] = useState<any>(null);
  const [formVersion, setFormVersion] = useState(0);
  const fields: FieldDef[] = [{ name: "actor_type", label: "Correspondent classification", options: ["candidate", "client", "supplier"], required: true }, { name: "ats_section", label: "Record section", options: ["candidates", "contacts", "companies", "suppliers"], required: true }, { name: "ats_id", label: "Exact record ID", type: "number", required: true }, { name: "display_name", label: "Display name" }, { name: "mobile_e164", label: "Verified phone (E.164)", type: "tel" }, { name: "email", label: "Verified email", type: "email" }];
  const save = useMutation(async (changed: any, key) => {
    const body = { ...(editing ?? { actor_type: "client", ats_section: "contacts" }), ...changed, verified: true };
    if (!body.mobile_e164 && !body.email) throw new Error("Provide at least one verified phone or email.");
    if (body.mobile_e164 && !/^\+[1-9][0-9]{7,14}$/.test(body.mobile_e164)) throw new Error("Use E.164 phone format.");
    if ((body.actor_type === "candidate") !== (body.ats_section === "candidates") || (body.ats_section === "suppliers" && body.actor_type !== "supplier")) throw new Error("Candidate classification requires a candidate record; local supplier records require supplier classification.");
    const allowed = Object.fromEntries(fields.map((field) => [field.name, body[field.name]]));
    const result = await call(pilot(tenant!, "identities/"), { method: "POST", body: { ...allowed, verified: true }, key }); identities.reload(); setEditing(null); setFormVersion((version) => version + 1); return result;
  });
  return <Section title="Verified contact and supplier mappings"><p className="text-xs text-gray-500">Select an exact existing record and verify its contact details. Contacts/companies must be classified as client or supplier before correspondence is processed. After saving, use Resolve in the conversation or Reprocess in Mail to apply the mapping.</p><ErrorNotice error={identities.error ?? save.error} />
    {identities.loading && !identities.data ? <Loading /> : listOf(identities.data).length ? <ul className="divide-y border rounded-lg text-sm max-h-80 overflow-auto">{listOf(identities.data).map((identity) => <li key={identity.id} className="p-2 flex flex-wrap gap-2 items-center"><span>{identity.display_name || identity.actor_type} · {identity.ats_section}/{identity.ats_id} · {identity.mobile_e164 || identity.email}</span><Badge tone={identity.verified ? "green" : "amber"}>{identity.verified ? "verified" : "unverified"}</Badge><Button size="sm" variant="outline" onClick={() => { setEditing(identity); setFormVersion((version) => version + 1); }}>Review mapping</Button></li>)}</ul> : <Empty>No verified mappings.</Empty>}
    {editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setFormVersion((version) => version + 1); }}>Create a new mapping instead</Button>}
    <FieldsForm key={formVersion} fields={fields} initial={editing ?? { actor_type: "client", ats_section: "contacts" }} submitLabel="Save verified mapping" busy={save.busy} onSubmit={save.submit} />
  </Section>;
}

function Templates() {
  const { tenant, call } = useOps(); const templates = useOpsFetch(chan(tenant!, "templates/")); const sync = useMutation(async (_: void, key) => { const result = await call(chan(tenant!, "templates/"), { method: "POST", key }); templates.reload(); return result; });
  return <Section title="Message templates"><ErrorNotice error={templates.error ?? sync.error} /><Button size="sm" variant="outline" onClick={() => sync.submit()} disabled={sync.busy}>Sync provider templates</Button>{templates.loading && !templates.data ? <Loading /> : listOf(templates.data).length ? <ul className="text-sm divide-y border rounded-lg">{listOf(templates.data).map((template) => <li key={`${template.name}-${typeof template.language === "string" ? template.language : template.language?.code}`} className="p-2 flex gap-2">{template.name} ({typeof template.language === "string" ? template.language : template.language?.code})<Badge tone={/^approved$/i.test(template.status) ? "green" : "amber"}>{template.status}</Badge></li>)}</ul> : <Empty>No provider templates.</Empty>}</Section>;
}
function Receipts() {
  const { tenant } = useOps(); const receipts = useOpsFetch(chan(tenant!, "receipts/"), { pollMs: 60000 });
  return <Section title="Unprocessed message and call receipts"><ErrorNotice error={receipts.error} />{receipts.loading && !receipts.data ? <Loading /> : listOf(receipts.data?.receipts).length ? <Json value={receipts.data.receipts} /> : <Empty>No unprocessed receipts.</Empty>}</Section>;
}
function AuditAndHealth() {
  const { tenant } = useOps(); const [actionId, setActionId] = useState(""); const [applied, setApplied] = useState(""); const [section, setSection] = useState(""); const [appliedSection, setAppliedSection] = useState("");
  const audit = useOpsFetch(pilot(tenant!, "audit/"), { query: { action_id: applied || undefined, section: appliedSection || undefined } }); const health = useOpsFetch(pilot(tenant!, "health/"), { pollMs: 60000 });
  return <><Section title="Queue, reconciliation and webhook health"><ErrorNotice error={health.error} />{health.loading && !health.data ? <Loading /> : health.data && <Json value={health.data} />}</Section><Section title="Audit snapshots"><form className="flex flex-wrap gap-2 items-end" onSubmit={(event) => { event.preventDefault(); setApplied(actionId); setAppliedSection(section); }}><div><Label htmlFor="audit-action">Action ID</Label><Input id="audit-action" type="number" min={1} step={1} value={actionId} onChange={(e) => setActionId(e.target.value)} /></div><div><Label htmlFor="audit-section">Section (optional)</Label><Input id="audit-section" value={section} onChange={(e) => setSection(e.target.value)} /></div><Button size="sm" variant="outline">Filter snapshots</Button></form><p className="text-xs text-gray-500">The API returns up to 200 snapshots per request.</p><ErrorNotice error={audit.error} />{audit.loading && !audit.data ? <Loading /> : <Json value={audit.data} />}</Section></>;
}
function McpStatus() {
  const { can } = useOps();
  return <Section title="ChatGPT / MCP setup"><Badge tone={can("mcp") ? "green" : "gray"}>{can("mcp") ? "Owner access permitted" : "Owner access unavailable"}</Badge><p className="text-sm text-gray-600">Your deployment administrator configures the public HTTPS /mcp URL, OAuth issuer, audience, owner scope, PKCE and MFA. Map the owner&apos;s immutable identity subject in the membership above. Add that server in ChatGPT&apos;s connection settings and complete OAuth there. This dashboard does not report an active ChatGPT connection or accept MCP tokens.</p></Section>;
}
