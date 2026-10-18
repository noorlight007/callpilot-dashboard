"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { pilot } from "@/lib/ops/paths";
import { enc, newKey } from "@/lib/ops/api";
import { canWrite as capCanWrite, normalizeCapabilities, recordPayload, type SectionCap } from "@/lib/ops/adapters";
import { FIELD_PRESETS, FieldsForm } from "@/components/ops/forms";

export default function RecordsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const { tenant, me } = useOps();
  const caps = useOpsFetch(pilot(tenant!, "capabilities/"));
  const [keywords, setKeywords] = useState("");
  const [applied, setApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const sections = normalizeCapabilities(caps.data);
  const cap = sections.find((s) => s.name === section);
  const canWrite = capCanWrite(cap);

  const list = useOpsFetch(pilot(tenant!, `records/${enc(section)}/`), { query: { Limit: 25, Offset: offset, Keywords: applied || undefined } });
  const items = listOf(recordPayload(list.data));

  return (
    <div>
      <PageHeader title={section[0].toUpperCase() + section.slice(1)} description={me && !me.ats_connected ? "Connect your JobAdder login in Settings to see records." : undefined}>
        {cap?.create && <Button size="sm" onClick={() => setSel("new")}>New</Button>}
      </PageHeader>
      <nav aria-label="Sections" className="flex flex-wrap gap-1 mb-4">
        {sections.filter((s) => s.list).map((s) => {
          const n = s.name;
          return <Link key={n} href={`/records/${n}`} className={`text-xs rounded-full border px-3 py-1 ${n === section ? "bg-gray-900 text-white" : ""}`}>{n}</Link>;
        })}
      </nav>
      <form className="flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); setOffset(0); setApplied(keywords); }}>
        <Label htmlFor="kw" className="sr-only">Search</Label>
        <Input id="kw" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Search…" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <ErrorNotice error={list.error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {list.loading && !list.data ? <Loading /> : items.length === 0 ? <Empty>No records.</Empty> : (
            <ul className="divide-y border rounded-lg">
              {items.map((r: any, i: number) => {
                const id = String(r.id ?? r.candidateId ?? r.jobId ?? r.contactId ?? r.companyId ?? i);
                const name = r.name ?? [r.firstName, r.lastName].filter(Boolean).join(" ") ?? r.jobTitle ?? id;
                return (
                  <li key={id}>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900" onClick={() => setSel(id)}>
                      <span className="font-medium">{name || id}</span> <span className="text-gray-500">#{id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button>
            <Button size="sm" variant="outline" disabled={items.length < 25} onClick={() => setOffset(offset + 25)}>Next</Button>
          </div>
        </div>
        <div>
          {sel === "new" ? (
            <RecordForm key="new" section={section} onDone={() => list.reload()} />
          ) : sel ? (
            <RecordDetail key={sel} section={section} id={sel} sections={sections} onChanged={list.reload} />
          ) : <Empty>Select a record.</Empty>}
        </div>
      </div>
    </div>
  );
}

function RecordDetail({ section, id, sections, onChanged }: { section: string; id: string; sections: SectionCap[]; onChanged: () => void }) {
  const { tenant, call, can } = useOps();
  // What this tenant's backend actually supports for the record and its nested sections.
  const cap = sections.find((s) => s.name === section);
  const has = (name: string, flag: "create" | "update") => !!sections.find((s) => s.name === name)?.[flag];
  const canWrite = capCanWrite(cap);
  const deleteMode = cap?.deleteMode;
  const rec = useOpsFetch(pilot(tenant!, `records/${enc(section)}/${enc(id)}/`));
  const docs = useOpsFetch(pilot(tenant!, "records/documents/"), { query: { parent: `${section}/${id}` } });
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const after = recordPayload(rec.data);
  return (
    <div className="space-y-3">
      {rec.loading && !rec.data ? <Loading /> : <Json value={after} />}
      <ErrorNotice error={rec.error ?? err} />
      <div className="flex gap-2">
        {cap?.update && <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit"}</Button>}
        {/* Delete only creates a confirmation proposal; nothing is removed until YES is typed. */}
        {!can("can_delete") ? null : deleteMode === "unavailable" || !cap?.delete ? <span className="text-xs text-gray-500 self-center">Delete unavailable</span> : (
          <Button size="sm" variant="outline" onClick={async () => {
            try { setErr(null); const r: any = await call(pilot(tenant!, `records/${enc(section)}/${enc(id)}/`), { method: "DELETE", key: newKey() }); setActionId(r.id); } catch (e) { setErr(e); }
          }}>{deleteMode === "archive" ? "Archive…" : "Delete…"}</Button>
        )}
      </div>
      {editing && <RecordForm section={section} id={id} initial={after} onDone={() => { rec.reload(); onChanged(); }} />}
      {actionId != null && <ActionPanel id={actionId} deleteMode={deleteMode} onSettled={() => { rec.reload(); onChanged(); }} />}
      {has("notes", "create") && <AddNote section={section} id={id} />}
      {has("applications", "create") && (section === "jobs" || section === "candidates") && <AddApplication section={section} id={id} />}
      {has("interviews", "create") && section === "applications" && <AddInterview id={id} />}
      <Attachments section={section} id={id} docs={docs} canWrite={has("documents", "create")} />
    </div>
  );
}

/** Free-form editor for provider fields (JSON); the provider validates the fields. */
function RecordForm({ section, id, initial, onDone }: { section: string; id?: string; initial?: any; onDone: () => void }) {
  const { tenant, call } = useOps();
  const [text, setText] = useState(id ? "{\n  \n}" : "{\n  \n}");
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const key = useRef(newKey());
  const lastText = useRef(text);
  const preset = FIELD_PRESETS[section];
  const [raw, setRaw] = useState(!preset);
  const submitBody = async (body: any) => {
    try {
      setErr(null);
      const sig = JSON.stringify(body);
      if (sig !== lastText.current) { key.current = newKey(); lastText.current = sig; }
      const r: any = await call(pilot(tenant!, id ? `records/${enc(section)}/${enc(id)}/` : `records/${enc(section)}/`), { method: id ? "PATCH" : "POST", body, key: key.current });
      setActionId(r.id);
    } catch (e) { setErr(e); }
  };
  const submit = async () => {
    try {
      setErr(null);
      const body = JSON.parse(text);
      if (text !== lastText.current) { key.current = newKey(); lastText.current = text; } // changed request => new key
      const r: any = await call(pilot(tenant!, id ? `records/${enc(section)}/${enc(id)}/` : `records/${enc(section)}/`), { method: id ? "PATCH" : "POST", body, key: key.current });
      setActionId(r.id);
    } catch (e) { setErr(e); }
  };
  if (preset && !raw) {
    return (
      <div className="space-y-2">
        <FieldsForm fields={preset} initial={id ? initial : undefined} submitLabel={id ? "Save changes" : "Create"} onSubmit={submitBody} />
        <ErrorNotice error={err} />
        <button className="text-xs underline" onClick={() => setRaw(true)}>Advanced: edit raw provider fields</button>
        {actionId != null && <ActionPanel id={actionId} onSettled={onDone} />}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor="fields">{id ? "Changed provider fields (JSON)" : "Provider fields (JSON)"}</Label>
      <Textarea id="fields" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <ErrorNotice error={err} />
      <Button size="sm" onClick={submit}>{id ? "Save changes" : "Create"}</Button>
      {actionId != null && <ActionPanel id={actionId} onSettled={onDone} />}
    </div>
  );
}

const MAX_BYTES = 20 * 1024 * 1024;

function Attachments({ section, id, docs, canWrite }: { section: string; id: string; docs: { data: any; reload: () => void }; canWrite: boolean }) {
  const { tenant, call } = useOps();
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setErr(null);
    if (file.size > MAX_BYTES) return setErr(new Error("Files are limited to 20 MiB."));
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r: any = await call(pilot(tenant!, "actions/"), { method: "POST", key: newKey(), body: { section: "documents", operation: "create", target: `${section}/${id}`, data: { name: file.name, content_base64: btoa(bin), content_type: file.type || "application/octet-stream", type: "Other" } } });
      setActionId(r.id);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Attachments</h3>
      {listOf(recordPayload(docs.data)).map((d: any, i: number) => <div key={i} className="text-xs">{d.name ?? d.fileName ?? JSON.stringify(d)}</div>)}
      {canWrite && (<><Label htmlFor="upl" className="text-xs">Upload (max 20 MiB)</Label><Input id="upl" type="file" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></>)}
      <ErrorNotice error={err} />
      {actionId != null && <ActionPanel id={actionId} onSettled={() => docs.reload()} />}
    </div>
  );
}

function AddNote({ section, id }: { section: string; id: string }) {
  const { tenant, call } = useOps();
  const [text, setText] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const key = useRef(newKey());
  return (
    <div className="space-y-2">
      <Label htmlFor="note">Add note</Label>
      <Textarea id="note" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      <ErrorNotice error={err} />
      <Button size="sm" variant="outline" disabled={!text.trim()} onClick={async () => {
        try { setErr(null); const r: any = await call(pilot(tenant!, "actions/"), { method: "POST", key: key.current, body: { section: "notes", operation: "create", target: `${section}/${id}`, data: { text } } }); key.current = newKey(); setText(""); setActionId(r.id); } catch (e) { setErr(e); }
      }}>Add note</Button>
      {actionId != null && <ActionPanel id={actionId} />}
    </div>
  );
}

function ActionForm({ title, label, build }: { title: string; label: string; build: (v: string) => any }) {
  const { tenant, call } = useOps();
  const [v, setV] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const key = useRef(newKey());
  return (
    <div className="space-y-2">
      <Label htmlFor={title}>{label}</Label>
      <Input id={title} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} />
      <ErrorNotice error={err} />
      <Button size="sm" variant="outline" disabled={!v} onClick={async () => {
        try { setErr(null); const r: any = await call(pilot(tenant!, "actions/"), { method: "POST", key: key.current, body: build(v) }); key.current = newKey(); setV(""); setActionId(r.id); } catch (e) { setErr(e); }
      }}>{title}</Button>
      {actionId != null && <ActionPanel id={actionId} />}
    </div>
  );
}

function AddApplication({ section, id }: { section: string; id: string }) {
  // Under a job the body carries candidateId; under a candidate it carries jobId. Both are arrays.
  const field = section === "jobs" ? "candidateId" : "jobId";
  return <ActionForm title="Create application" label={section === "jobs" ? "Candidate ID" : "Job ID"} build={(v) => ({ section: "applications", operation: "create", target: `${section}/${id}`, data: { [field]: [Number(v)] } })} />;
}

function AddInterview({ id }: { id: string }) {
  const { tenant, call } = useOps();
  const [kind, setKind] = useState<"external" | "internal">("external");
  const [f, setF] = useState({ location: "", startAt: "", endAt: "", people: "" });
  const [err, setErr] = useState<unknown>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const key = useRef(newKey());
  const ids = f.people.split(",").map((x) => Number(x.trim())).filter(Boolean);
  const ok = f.location.trim() && ids.length > 0;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Schedule interview</h3>
      <Label htmlFor="iv-kind">Type</Label>
      <select id="iv-kind" className="block border rounded-md px-2 py-2 text-sm bg-transparent" value={kind} onChange={(e) => setKind(e.target.value as "external" | "internal")}>
        <option value="external">External (client contacts)</option>
        <option value="internal">Internal (our users)</option>
      </select>
      <Label htmlFor="iv-loc">Location *</Label><Input id="iv-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
      <Label htmlFor="iv-people">{kind === "external" ? "Interviewer contact IDs *" : "Interviewer user IDs *"} (comma-separated)</Label>
      <Input id="iv-people" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value.replace(/[^\d,\s]/g, "") })} />
      <Label htmlFor="iv-start">Start</Label><Input id="iv-start" type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} />
      <Label htmlFor="iv-end">End</Label><Input id="iv-end" type="datetime-local" value={f.endAt} onChange={(e) => setF({ ...f, endAt: e.target.value })} />
      <ErrorNotice error={err} />
      <Button size="sm" variant="outline" disabled={!ok} onClick={async () => {
        try {
          setErr(null);
          const data: Record<string, unknown> = { _interview_type: kind, location: f.location, [kind === "external" ? "interviewersContactIds" : "interviewersUserIds"]: ids };
          if (f.startAt) data.startAt = new Date(f.startAt).toISOString();
          if (f.endAt) data.endAt = new Date(f.endAt).toISOString();
          const r: any = await call(pilot(tenant!, "actions/"), { method: "POST", key: key.current, body: { section: "interviews", operation: "create", target: `applications/${id}`, data } });
          key.current = newKey(); setActionId(r.id);
        } catch (e) { setErr(e); }
      }}>Schedule interview</Button>
      {actionId != null && <ActionPanel id={actionId} />}
    </div>
  );
}
