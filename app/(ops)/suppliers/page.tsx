"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { FieldsForm, useMutation } from "@/components/ops/forms";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { pilot } from "@/lib/ops/paths";

const FIELDS = [
  { name: "name", label: "Name", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
];
const MAX_BYTES = 20 * 1024 * 1024;

export default function SuppliersPage() {
  const { tenant, call, me } = useOps();
  const list = useOpsFetch(pilot(tenant!, "suppliers/"));
  const [sel, setSel] = useState<number | "new" | null>(null);
  const detail = useOpsFetch(typeof sel === "number" ? pilot(tenant!, `suppliers/${sel}/`) : null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const canWrite = !!me;
  const save = useMutation(async (b: any, key) => {
    const r = typeof sel === "number"
      ? await call(pilot(tenant!, `suppliers/${sel}/`), { method: "PATCH", body: b, key })
      : await call<any>(pilot(tenant!, "suppliers/"), { method: "POST", body: b, key });
    list.reload(); detail.reload(); setEditing(false);
    if (sel === "new" && r?.id) setSel(r.id);
    return r;
  });
  const act = useMutation(async (data: any, key) => {
    const r: any = await call(pilot(tenant!, "actions/"), { method: "POST", key, body: data });
    setActionId(r.id);
  });
  const [note, setNote] = useState("");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const addFile = async (file: File) => {
    setFileErr(null);
    if (file.size > MAX_BYTES) return setFileErr("Files are limited to 20 MiB.");
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    act.submit({ section: "documents", operation: "create", target: `suppliers/${sel}`, data: { name: file.name, content_base64: btoa(bin), content_type: file.type || "application/octet-stream", type: "Other" } });
  };
  const rows = listOf(list.data);
  return (
    <div>
      <PageHeader title="Suppliers" description="Local supplier records. Supplier invoices are owner-only under Finance.">
        {canWrite && <Button size="sm" onClick={() => { setSel("new"); setEditing(true); }}>New supplier</Button>}
      </PageHeader>
      <ErrorNotice error={list.error ?? detail.error ?? save.error ?? act.error} />
      <div className="grid gap-4 lg:grid-cols-2">
        {list.loading && !list.data ? <Loading /> : rows.length === 0 ? <Empty>No suppliers.</Empty> : (
          <ul className="divide-y border rounded-lg self-start">
            {rows.map((s: any) => <li key={s.id}><button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900" onClick={() => { setSel(s.id); setEditing(false); setActionId(null); }}>{s.name ?? `Supplier ${s.id}`}</button></li>)}
          </ul>
        )}
        <div className="space-y-3">
          {sel == null ? <Empty>Select a supplier.</Empty> : sel === "new" ? (
            <FieldsForm fields={FIELDS} submitLabel="Create supplier" busy={save.busy} onSubmit={(v) => save.submit(v)} />
          ) : detail.loading && !detail.data ? <Loading /> : (
            <>
              <Json value={detail.data} />
              <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit"}</Button>
              {editing && <FieldsForm key={JSON.stringify(detail.data)} fields={FIELDS} initial={detail.data} submitLabel="Save changes" busy={save.busy} onSubmit={(v) => Object.keys(v).length && save.submit(v)} />}
              <div className="space-y-2">
                <Label htmlFor="sn">Add note</Label><Input id="sn" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" disabled={!note.trim() || act.busy} onClick={async () => { await act.submit({ section: "notes", operation: "create", target: `suppliers/${sel}`, data: { text: note } }); setNote(""); }}>Add note</Button>
                <Label htmlFor="sf">Upload document (max 20 MiB)</Label><Input id="sf" type="file" onChange={(e) => e.target.files?.[0] && addFile(e.target.files[0])} />
                {fileErr && <div role="alert" className="text-sm text-red-600">{fileErr}</div>}
              </div>
              {actionId != null && <ActionPanel id={actionId} onSettled={detail.reload} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
