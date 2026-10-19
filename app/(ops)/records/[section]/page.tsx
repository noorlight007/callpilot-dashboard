"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { pilot } from "@/lib/ops/paths";
import { enc } from "@/lib/ops/api";
import { normalizeCapabilities, recordPayload, type SectionCap } from "@/lib/ops/adapters";
import { FieldsForm, providerFormFields, providerReferencePaths, useMutation, type FieldDef } from "@/components/ops/forms";
import { RecordAttachments, RecordNote, RecordTask, RECORD_PARENTS } from "@/components/ops/record-extras";

const ID_FIELDS: Record<string, string> = { candidates: "candidateId", contacts: "contactId", companies: "companyId", jobs: "jobId", applications: "applicationId", interviews: "interviewId", placements: "placementId", documents: "attachmentId", notes: "noteId", tasks: "taskId", jobads: "adId", folders: "folderId", users: "userId" };
const recordPath = (target: string) => target.split("/").map(enc).join("/");
function labelOf(row: any, fallback: string) { return row.name || row.jobTitle || row.title || row.folderName || [row.firstName, row.lastName].filter(Boolean).join(" ") || fallback; }
function ownedBy(record: any, atsUserId: unknown): boolean {
  if (!atsUserId || !record) return false;
  const owner = record.ownerUserId ?? record.owner?.userId ?? record.owner?.id ?? record.recruiter?.userId;
  return String(owner) === String(atsUserId) || (record.recruiters ?? []).some((user: any) => String(user.userId ?? user.id) === String(atsUserId));
}

export default function RecordsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  return <RecordsSection key={section} section={section} />;
}

function RecordsSection({ section }: { section: string }) {
  const { tenant, me, isOwner } = useOps();
  const caps = useOpsFetch(pilot(tenant!, "capabilities/"));
  const sections = normalizeCapabilities(caps.data).filter((item) => item.name !== "webhooks" || isOwner);
  const cap = sections.find((item) => item.name === section);
  const [keywords, setKeywords] = useState(""); const [applied, setApplied] = useState("");
  const [offset, setOffset] = useState(0); const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const special = ["documents", "custom_fields", "reference"].includes(section);
  const list = useOpsFetch(cap?.list && !special ? pilot(tenant!, `records/${enc(section)}/`) : null, { query: { Limit: 25, Offset: offset, Keywords: applied || undefined } });
  const rows = listOf(recordPayload(list.data));
  const hasForm = providerFormFields(section, "create").length > 0;
  const standardCanCreate = me?.role !== "standard_staff" || (!!me.ats_user_id && ["candidates", "contacts", "companies", "jobs", "jobads"].includes(section));
  return <div>
    <PageHeader title={section.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())} description={me && !me.ats_connected ? "Link your own JobAdder account in Settings. The provider checks your granted permissions." : "Lists are bounded snapshots from the connected provider."}>
      {cap?.create && hasForm && standardCanCreate && <Button size="sm" onClick={() => setSelected("new")}>New {section === "companies" ? "company" : section.replace(/s$/, "")}</Button>}
    </PageHeader>
    <nav aria-label="Record sections" className="flex flex-wrap gap-1 mb-4">{sections.filter((item) => item.list || item.get).map((item) => <Link key={item.name} href={`/records/${item.name}`} aria-current={item.name === section ? "page" : undefined} className={`text-xs rounded-full border px-3 py-1 ${item.name === section ? "bg-gray-900 text-white" : ""}`}>{item.name.replaceAll("_", " ")}</Link>)}</nav>
    <ErrorNotice error={caps.error ?? list.error} />
    {caps.loading && !caps.data ? <Loading label="Checking supported provider operations…" /> : !cap ? <Empty>This section is unavailable for your account.</Empty> : special ? <SpecialSection section={section} cap={cap} /> : <>
      {cap.list && <form className="flex gap-2 mb-4" onSubmit={(event) => { event.preventDefault(); setOffset(0); setApplied(keywords); }}><Label htmlFor="record-search" className="sr-only">Search records</Label><Input id="record-search" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Provider keywords…" /><Button type="submit" variant="outline">Search</Button></form>}
      {cap.get && <form className="flex gap-2 mb-4" onSubmit={(event) => { event.preventDefault(); setSelected(lookup.trim()); }}><Label htmlFor="record-lookup" className="sr-only">Record ID</Label><Input id="record-lookup" value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder={section === "interviews" ? "Interview ID / application ID" : "Open a known record ID"} /><Button size="sm" variant="outline" disabled={!lookup.trim() || (section === "interviews" && !/^\d+\/\d+$/.test(lookup.trim()))}>Open</Button></form>}
      {["applications", "interviews"].includes(section) && <p className="text-sm text-gray-500 mb-4">{section === "applications" ? "Create applications from a candidate or job record." : "Schedule interviews from an application record. Opening an interview requires interview ID/application ID."}</p>}
      {me?.role === "standard_staff" && <p className="text-xs text-gray-500 mb-4">You can update records owned by your linked ATS user. New records are assigned to that user.</p>}
      <div className="grid gap-4 lg:grid-cols-2"><div>
        {cap.list ? list.loading && !list.data ? <Loading /> : rows.length ? <ul className="divide-y border rounded-lg">{rows.map((row, index) => {
          const identifier = row[ID_FIELDS[section]] ?? row.id;
          const id = identifier == null ? "" : String(identifier);
          return <li key={id || index}>{cap.get && id ? <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900" aria-pressed={selected === id} onClick={() => setSelected(id)}><span className="font-medium">{labelOf(row, id)}</span> <span className="text-gray-500">#{id}</span></button> : <div className="p-3 text-sm">{labelOf(row, `Record ${index + 1}`)}</div>}</li>;
        })}</ul> : <Empty>No records.</Empty> : <Empty>This section supports lookup by ID.</Empty>}
        {cap.list && <div className="flex gap-2 mt-3"><Button size="sm" variant="outline" disabled={offset === 0 || list.loading} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button size="sm" variant="outline" disabled={rows.length < 25 || list.loading} onClick={() => setOffset(offset + 25)}>Next</Button><span className="text-xs text-gray-500 self-center">From {offset + 1}</span></div>}
      </div><div>{selected === "new" && cap.create && standardCanCreate ? <RecordForm key="new" section={section} onDone={list.reload} /> : selected && cap.get ? <RecordDetail key={selected} section={section} id={selected} sections={sections} onChanged={list.reload} /> : <Empty>Select a record.</Empty>}</div></div>
    </>}
  </div>;
}

function SpecialSection({ section, cap }: { section: string; cap: SectionCap }) {
  const { tenant, me } = useOps();
  const [parent, setParent] = useState(section === "custom_fields" ? "candidates" : section === "reference" ? "countries" : "");
  const [draft, setDraft] = useState(parent);
  const list = useOpsFetch(cap.list && parent ? pilot(tenant!, `records/${section}/`) : null, { query: { parent } });
  const parentRecord = useOpsFetch(section === "documents" && parent && me?.role === "standard_staff" ? pilot(tenant!, `records/${recordPath(parent)}/`) : null);
  const canUpload = cap.create && (me?.role !== "standard_staff" || ownedBy(recordPayload(parentRecord.data), me?.ats_user_id));
  return <div className="space-y-3">
    <p className="text-sm text-gray-500">{section === "documents" ? "Choose the parent record to view and upload attachments." : section === "custom_fields" ? "View configured field definitions. Edit their values from the matching record." : "Select a documented reference path. Reference data is read only."}</p>
    <form className="flex gap-2 items-end" onSubmit={(event) => { event.preventDefault(); setParent(draft); }}><div className="flex-1"><Label htmlFor="parent-path">{section === "documents" ? "Parent (section/record ID)" : section === "custom_fields" ? "Record section" : "Reference path"}</Label>
      {section === "custom_fields" ? <select id="parent-path" className="w-full border rounded p-2 text-sm bg-transparent" value={draft} onChange={(e) => setDraft(e.target.value)}>{RECORD_PARENTS.map((name) => <option key={name}>{name}</option>)}</select> : section === "reference" ? <select id="parent-path" className="w-full border rounded p-2 text-sm bg-transparent" value={draft} onChange={(e) => setDraft(e.target.value)}>{providerReferencePaths.map((name) => <option key={name}>{name}</option>)}</select> : <Input id="parent-path" placeholder="candidates/123" pattern="(candidates|contacts|companies|jobs|applications|placements)/[0-9]+" required value={draft} onChange={(e) => setDraft(e.target.value)} />}</div><Button size="sm" variant="outline">Load</Button></form>
    <ErrorNotice error={list.error} />
    {section === "documents" ? parent ? <RecordAttachments key={parent} parent={parent} canCreate={canUpload} /> : <Empty>Choose a parent record.</Empty> : list.loading && !list.data ? <Loading /> : <Json value={recordPayload(list.data)} />}
  </div>;
}

function RecordDetail({ section, id, sections, onChanged }: { section: string; id: string; sections: SectionCap[]; onChanged: () => void }) {
  const { tenant, me, call, can } = useOps();
  const cap = sections.find((item) => item.name === section);
  const has = (name: string, operation: "create" | "list") => !!sections.find((item) => item.name === name)?.[operation];
  const record = useOpsFetch(pilot(tenant!, `records/${enc(section)}/${recordPath(id)}/`));
  const after = recordPayload(record.data);
  const writable = me?.role !== "standard_staff" || ownedBy(after, me.ats_user_id);
  const [editing, setEditing] = useState(false);
  const remove = useMutation(async (_: void, key) => call(pilot(tenant!, `records/${enc(section)}/${recordPath(id)}/`), { method: "DELETE", key }));
  const parentSupported = RECORD_PARENTS.includes(section);
  const onDone = () => { record.reload(); onChanged(); };
  return <div className="space-y-4">
    <ErrorNotice error={record.error ?? remove.error} />
    {record.loading && !record.data ? <Loading /> : after != null && <Json value={after} />}
    {record.data && <div className="flex flex-wrap gap-2">
      {cap?.update && writable && providerFormFields(section, "update").length > 0 && <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit record"}</Button>}
      {can("can_delete") && (cap?.delete ? <Button size="sm" variant="outline" disabled={remove.busy || !!remove.result?.id} onClick={() => remove.submit()}>{cap.deleteMode === "archive" ? "Propose archive…" : "Propose delete…"}</Button> : <span className="text-xs text-gray-500 self-center">Delete / archive unavailable</span>)}
    </div>}
    {me?.role === "standard_staff" && record.data && !writable && <p className="text-sm text-gray-500">Read only: ownership does not match your linked ATS user.</p>}
    {editing && writable && <RecordForm section={section} id={id} initial={after} onDone={onDone} />}
    {remove.result?.id && <ActionPanel id={remove.result.id} deleteMode={cap?.deleteMode} onSettled={(action) => action.status === "succeeded" && onDone()} />}
    {parentSupported && record.data && <>
      {has("notes", "list") && <RecordNote parent={`${section}/${id}`} canCreate={writable && has("notes", "create")} />}
      {writable && has("tasks", "create") && <RecordTask parent={`${section}/${id}`} />}
      {has("documents", "list") && <RecordAttachments parent={`${section}/${id}`} canCreate={writable && has("documents", "create")} />}
      {writable && ["candidates", "jobs"].includes(section) && has("applications", "create") && me?.role !== "standard_staff" && <ApplicationForm section={section} id={id} />}
      {writable && section === "applications" && has("interviews", "create") && me?.role !== "standard_staff" && <InterviewForm id={id} />}
    </>}
  </div>;
}

function RecordForm({ section, id, initial, onDone }: { section: string; id?: string; initial?: any; onDone: () => void }) {
  const { tenant, me, call } = useOps();
  const fields = providerFormFields(section, id ? "update" : "create").filter((field) => me?.role !== "standard_staff" || !["ownerUserId", "recruiterUserId"].includes(field.name));
  const definitions = useOpsFetch(RECORD_PARENTS.includes(section) ? pilot(tenant!, "records/custom_fields/") : null, { query: { parent: section } });
  const customFields: FieldDef[] = listOf(recordPayload(definitions.data)).filter((field) => Number.isInteger(field.fieldId)).map((field) => ({
    name: `custom_${field.fieldId}`, label: field.name || `Custom field ${field.fieldId}`, required: !id && !!field.mandatory,
    schema: field.multiSelect ? { type: "array", items: { type: "string", ...(field.values?.length ? { enum: field.values } : {}) } } : undefined,
    type: field.multiSelect ? "json" : field.type === "Date" ? "date" : field.type === "Url" ? "url" : field.multiLine ? "textarea" : "text", options: field.multiSelect ? undefined : field.values?.length ? field.values : undefined,
    hint: field.multiSelect ? `JSON list; allowed values: ${(field.values ?? []).join(", ")}` : undefined,
  }));
  const customInitial = Object.fromEntries((Array.isArray(initial?.custom) ? initial.custom : []).map((field: any) => [`custom_${field.fieldId}`, field.value]));
  const mutation = useMutation(async (values: Record<string, any>, key) => {
    const data: Record<string, any> = {}; const custom: any[] = [];
    for (const [name, value] of Object.entries(values)) { if (name.startsWith("custom_")) custom.push({ fieldId: Number(name.slice(7)), value }); else data[name] = value; }
    if (custom.length) data.custom = custom;
    if (!id && me?.role === "standard_staff" && me.ats_user_id) data[section === "candidates" ? "recruiterUserId" : "ownerUserId"] = section === "candidates" ? [Number(me.ats_user_id)] : Number(me.ats_user_id);
    return call(pilot(tenant!, id ? `records/${section}/${recordPath(id)}/` : `records/${section}/`), { method: id ? "PATCH" : "POST", body: data, key });
  });
  return <div className="space-y-3 border rounded-lg p-3">
    <h2 className="font-semibold text-sm">{id ? "Edit record" : "Create record"}</h2><p className="text-xs text-gray-500">Provider fields from the verified schema. Status and owner IDs must match this account&apos;s reference data. Structured fields accept only their documented keys.</p>
    <ErrorNotice error={mutation.error ?? definitions.error} />
    {definitions.loading && RECORD_PARENTS.includes(section) ? <Loading label="Loading configured custom fields…" /> : <FieldsForm key={`${id ?? "new"}-${customFields.map((field) => field.name).join()}`} fields={[...fields, ...customFields]} initial={initial ? { ...initial, ...customInitial } : undefined} busy={mutation.busy} submitLabel={id ? "Queue changes" : "Queue creation"} onSubmit={mutation.submit} />}
    {mutation.result?.id && <ActionPanel id={mutation.result.id} onSettled={(action) => action.status === "succeeded" && onDone()} />}
  </div>;
}

function ApplicationForm({ section, id }: { section: string; id: string }) {
  const { tenant, call } = useOps(); const [other, setOther] = useState("");
  const create = useMutation(async (value: string, key) => call(pilot(tenant!, "actions/"), { method: "POST", key, body: { section: "applications", operation: "create", target: `${section}/${id}`, data: { [section === "jobs" ? "candidateId" : "jobId"]: [Number(value)] } } }));
  return <section className="space-y-2"><form className="space-y-2" onSubmit={(event) => { event.preventDefault(); create.submit(other); }}><Label htmlFor="application-other">{section === "jobs" ? "Candidate" : "Job"} ID</Label><Input id="application-other" type="number" min={1} step={1} required value={other} onChange={(e) => setOther(e.target.value)} /><Button size="sm" variant="outline" disabled={!other || create.busy}>Queue application</Button></form><ErrorNotice error={create.error} />{create.result?.id && <ActionPanel id={create.result.id} />}</section>;
}

function InterviewForm({ id }: { id: string }) {
  const { tenant, call } = useOps(); const [kind, setKind] = useState("external");
  const fields: FieldDef[] = [{ name: "location", label: "Location", required: true }, { name: kind === "external" ? "interviewersContactIds" : "interviewersUserIds", label: kind === "external" ? "Interviewer contact IDs (JSON array)" : "Interviewer user IDs (JSON array)", type: "json", required: true, schema: { type: "array", items: { type: "integer" } } }, { name: "startAt", label: "Start (ISO date and time with timezone)", schema: { type: "string", format: "date-time" } }, { name: "endAt", label: "End (ISO date and time with timezone)", schema: { type: "string", format: "date-time" } }];
  const create = useMutation(async (data: any, key) => { if (data.startAt && data.endAt && Date.parse(data.endAt) <= Date.parse(data.startAt)) throw new Error("The end must be after the start."); return call(pilot(tenant!, "actions/"), { method: "POST", key, body: { section: "interviews", operation: "create", target: `applications/${id}`, data: { ...data, _interview_type: kind } } }); });
  return <section className="space-y-2"><h3 className="text-sm font-semibold">Schedule interview</h3><Label htmlFor="interview-kind">Interview type</Label><select id="interview-kind" className="block border rounded p-2 text-sm bg-transparent" value={kind} onChange={(event) => setKind(event.target.value)}><option value="external">External (client contacts)</option><option value="internal">Internal (our users)</option></select><FieldsForm key={kind} fields={fields} submitLabel="Queue interview" busy={create.busy} onSubmit={create.submit} /><ErrorNotice error={create.error} />{create.result?.id && <ActionPanel id={create.result.id} />}</section>;
}
