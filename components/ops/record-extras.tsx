"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionPanel } from "./action-panel";
import { Empty, ErrorNotice, Loading } from "./common";
import { FieldsForm, providerAttachmentTypes, providerFormFields, useMutation } from "./forms";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { recordPayload } from "@/lib/ops/adapters";
import { pilot } from "@/lib/ops/paths";
import { enc, newKey } from "@/lib/ops/api";

export const RECORD_PARENTS = ["candidates", "contacts", "companies", "jobs", "applications", "placements"];
const MAX_BYTES = 20 * 1024 * 1024;

export function RecordNote({ parent, canCreate, local = false }: { parent: string; canCreate: boolean; local?: boolean }) {
  const { tenant, call } = useOps();
  const prefix = useId();
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const notes = useOpsFetch(pilot(tenant!, "records/notes/"), { query: { parent } });
  const create = useMutation(async (data: any, key) => {
    const action = await call<any>(pilot(tenant!, "actions/"), { method: "POST", key, body: { section: "notes", operation: "create", target: parent, data } });
    setText(""); return action;
  });
  return <section className="space-y-2" aria-label="Notes">
    <h3 className="font-semibold text-sm">Notes</h3>
    <ErrorNotice error={notes.error ?? create.error} />
    {notes.loading && !notes.data ? <Loading /> : listOf(recordPayload(notes.data)).length ? <ul className="space-y-2 text-sm">{listOf(recordPayload(notes.data)).map((note, i) => <li key={note.noteId ?? note.id ?? i} className="p-2 border rounded whitespace-pre-wrap">{note.text ?? "Note content unavailable"}{note.created_at && <div className="text-xs text-gray-500">{new Date(note.created_at).toLocaleString()}</div>}</li>)}</ul> : <Empty>No notes.</Empty>}
    {canCreate && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); create.submit({ text: text.trim(), ...(!local && type ? { type } : {}) }); }}>
      <Label htmlFor={`${prefix}-note`}>New note</Label><Textarea id={`${prefix}-note`} rows={2} required value={text} disabled={create.busy} onChange={(e) => setText(e.target.value)} />
      {!local && <><Label htmlFor={`${prefix}-type`}>Note type (optional provider label)</Label><Input id={`${prefix}-type`} maxLength={50} value={type} onChange={(e) => setType(e.target.value)} /></>}
      <Button size="sm" variant="outline" disabled={!text.trim() || create.busy}>Queue note</Button>
    </form>}
    {create.result?.id && <ActionPanel id={create.result.id} onSettled={(a) => a.status === "succeeded" && notes.reload()} />}
  </section>;
}

export function RecordAttachments({ parent, canCreate, canList = true }: { parent: string; canCreate: boolean; canList?: boolean }) {
  const { tenant, call } = useOps();
  const prefix = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const docs = useOpsFetch(canList ? pilot(tenant!, "records/documents/") : null, { query: { parent } });
  const [file, setFile] = useState<File | null>(null);
  const fileIntent = useRef(newKey());
  const [meta, setMeta] = useState({ type: "Other", expiry: "", category: "" });
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const update = useMutation(async (payload: { id: string; data: any }, key) => call(pilot(tenant!, `records/documents/${parent.split("/").map(enc).join("/")}/${enc(payload.id)}/`), { method: "PATCH", body: payload.data, key }));
  const upload = useMutation(async (payload: { file: File; meta: typeof meta; fileIntent: string }, key) => {
    const bytes = new Uint8Array(await payload.file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const action = await call<any>(pilot(tenant!, "actions/"), { method: "POST", key, body: { section: "documents", operation: "create", target: parent, data: {
      name: payload.file.name, content_base64: btoa(binary), content_type: payload.file.type || "application/octet-stream", type: payload.meta.type,
      ...(payload.meta.expiry ? { expiry: payload.meta.expiry } : {}), ...(payload.meta.category ? { category: payload.meta.category } : {}),
    } } });
    setFile(null); if (fileInput.current) fileInput.current.value = ""; return action;
  });
  const download = useMutation(async (attachment: any) => {
    const id = attachment.attachmentId ?? attachment.id;
    const action = await call<any>(pilot(tenant!, `records/documents/${parent.split("/").map(enc).join("/")}/${enc(String(id))}/`));
    const data = recordPayload(action);
    if (typeof data?.content_base64 !== "string") throw new Error("The provider did not return downloadable file content.");
    const bytes = Uint8Array.from(atob(data.content_base64), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = data.name ?? attachment.name ?? "attachment"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const rows = listOf(recordPayload(docs.data));
  const documentTypes = providerAttachmentTypes[parent.split("/")[0]] ?? ["Other"];
  return <section className="space-y-2" aria-label="Attachments">
    <h3 className="text-sm font-semibold">Attachments</h3>
    <ErrorNotice error={docs.error ?? error ?? upload.error ?? download.error ?? update.error} />
    {canList && (docs.loading && !docs.data ? <Loading /> : rows.length ? <ul className="space-y-1">{rows.map((doc, i) => { const id = String(doc.attachmentId ?? doc.id ?? ""); return <li key={id || i} className="text-sm border rounded p-2 space-y-2"><div className="flex justify-between gap-2"><span>{doc.name ?? doc.fileName ?? `Attachment ${i + 1}`}{doc.expiry && <span className="block text-xs text-gray-500">Expires {doc.expiry}</span>}</span>{id && <div className="flex gap-1"><Button size="sm" variant="outline" disabled={download.busy} onClick={() => download.submit(doc)}>Download</Button>{canCreate && !parent.startsWith("suppliers/") && <Button size="sm" variant="outline" onClick={() => setEditing(editing === id ? null : id)}>Edit metadata</Button>}</div>}</div>{editing === id && <FieldsForm key={id} fields={[{ name: "type", label: "Document type", options: documentTypes }, { name: "category", label: "Provider category", schema: { type: "string", nullable: true } }, { name: "expiry", label: "Expiry", type: "date", schema: { type: "string", format: "date", nullable: true } }]} initial={doc} busy={update.busy} submitLabel="Queue metadata update" onSubmit={(data) => update.submit({ id, data })} />}</li>; })}</ul> : <Empty>No attachments.</Empty>)}
    {canCreate && <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      if (!file || file.size === 0 || file.size > MAX_BYTES) return setError(new Error("Choose a non-empty file up to 20 MiB."));
      // A new file selection is a new intent; retries keep its key.
      upload.submit({ file, meta, fileIntent: fileIntent.current });
    }}>
      <p className="text-xs text-gray-500">Maximum 20 MiB decoded per file. Files download as attachments.</p>
      <Label htmlFor={`${prefix}-file`}>Choose document</Label><Input ref={fileInput} id={`${prefix}-file`} type="file" disabled={upload.busy} onChange={(e) => { setError(null); setFile(e.target.files?.[0] ?? null); fileIntent.current = newKey(); }} />
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label htmlFor={`${prefix}-type`}>Document type</Label><select id={`${prefix}-type`} className="w-full border rounded p-2 text-sm bg-transparent" value={meta.type} onChange={(e) => setMeta({ ...meta, type: e.target.value })}>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
        <div><Label htmlFor={`${prefix}-expiry`}>Expiry (optional)</Label><Input id={`${prefix}-expiry`} type="date" value={meta.expiry} onChange={(e) => setMeta({ ...meta, expiry: e.target.value })} /></div>
        <div><Label htmlFor={`${prefix}-category`}>Category (optional)</Label><Input id={`${prefix}-category`} value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} /></div>
      </div>
      <Button size="sm" variant="outline" disabled={!file || upload.busy}>Queue document upload</Button>
    </form>}
    {update.result?.id && <ActionPanel id={update.result.id} onSettled={(action) => { if (action.status === "succeeded") { docs.reload(); setEditing(null); } }} />}
    {upload.result?.id && <ActionPanel id={upload.result.id} onSettled={(a) => a.status === "succeeded" && docs.reload()} />}
  </section>;
}

export function RecordTask({ parent }: { parent: string }) {
  const { tenant, me, call } = useOps();
  const [open, setOpen] = useState(false);
  const create = useMutation(async (data: any, key) => call(pilot(tenant!, "actions/"), { method: "POST", key, body: { section: "tasks", operation: "create", target: parent, data } }));
  const fields = providerFormFields("tasks", "create");
  return <section className="space-y-2"><Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Close task form" : "Add task"}</Button>
    {open && <FieldsForm fields={fields} initial={me?.role === "standard_staff" && me.ats_user_id ? { assignees: [Number(me.ats_user_id)] } : undefined} submitLabel="Queue task" busy={create.busy} onSubmit={create.submit} />}
    <ErrorNotice error={create.error} />{create.result?.id && <ActionPanel id={create.result.id} />}
  </section>;
}
