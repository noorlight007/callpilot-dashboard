"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { ActionPanel } from "@/components/ops/action-panel";
import { FieldsForm, useMutation, type FieldDef } from "@/components/ops/forms";
import { RecordAttachments, RecordNote } from "@/components/ops/record-extras";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { recordPayload } from "@/lib/ops/adapters";
import { pilot } from "@/lib/ops/paths";

const FIELDS: FieldDef[] = [{ name: "name", label: "Supplier name", required: true }, { name: "email", label: "Email", type: "email" }, { name: "mobile_e164", label: "Mobile (E.164, for example +441234567890)", type: "tel" }];

export default function SuppliersPage() {
  const { tenant, isOwner } = useOps();
  const [name, setName] = useState(""); const [applied, setApplied] = useState("");
  const list = useOpsFetch(pilot(tenant!, "suppliers/"), { query: { Name: applied || undefined } });
  const rows = listOf(recordPayload(list.data));
  const [selected, setSelected] = useState<number | "new" | null>(null);
  return <div>
    <PageHeader title="Suppliers" description="Local supplier contacts, notes and documents. Supplier invoices are available to the owner in Finance.">
      {isOwner && <Button size="sm" onClick={() => setSelected("new")}>New supplier</Button>}
    </PageHeader>
    <ErrorNotice error={list.error ?? (list.data?.status === "failed" ? new Error(list.data.error) : null)} />
    <form className="flex gap-2 mb-4" onSubmit={(event) => { event.preventDefault(); setApplied(name); }}><Label htmlFor="supplier-name" className="sr-only">Search supplier name</Label><Input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Search supplier name…" /><Button variant="outline">Search</Button></form>
    <div className="grid gap-4 lg:grid-cols-2"><div>
      {list.loading && !list.data ? <Loading /> : rows.length ? <ul className="divide-y border rounded-lg">{rows.map((supplier) => <li key={supplier.id}><button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900" aria-pressed={selected === supplier.id} onClick={() => setSelected(supplier.id)}><span className="font-medium">{supplier.name}</span><span className="block text-xs text-gray-500">{supplier.email || supplier.mobile_e164 || "No contact details"}</span></button></li>)}</ul> : <Empty>No suppliers.</Empty>}
      <p className="text-xs text-gray-500 mt-2">Showing up to 200 local suppliers{recordPayload(list.data)?.totalCount != null ? ` of ${recordPayload(list.data).totalCount}` : ""}.</p>
    </div><div>{selected === "new" && isOwner ? <SupplierEditor key="new" onDone={(id) => { list.reload(); if (id) setSelected(id); }} /> : typeof selected === "number" ? <SupplierDetail key={selected} id={selected} onChanged={list.reload} /> : <Empty>Select a supplier.</Empty>}</div></div>
  </div>;
}

function SupplierEditor({ supplier, onDone }: { supplier?: any; onDone: (id?: number) => void }) {
  const { tenant, call } = useOps();
  const save = useMutation(async (body: any, key) => {
    if (body.mobile_e164 && !/^\+[1-9][0-9]{7,14}$/.test(body.mobile_e164)) throw new Error("Enter a valid E.164 mobile number, including + and country code.");
    return call<any>(pilot(tenant!, supplier ? `suppliers/${supplier.id}/` : "suppliers/"), { method: supplier ? "PATCH" : "POST", body, key });
  });
  return <div className="space-y-3 border rounded-lg p-3"><h2 className="font-semibold text-sm">{supplier ? "Edit supplier" : "Create supplier"}</h2><p className="text-xs text-gray-500">Contact changes update the verified local supplier mapping after the queued action succeeds.</p>
    <FieldsForm fields={supplier ? [...FIELDS, { name: "active", label: "Active", type: "boolean" }] : FIELDS} initial={supplier} submitLabel={supplier ? "Queue changes" : "Queue supplier creation"} busy={save.busy} onSubmit={save.submit} />
    <ErrorNotice error={save.error} />
    {save.result?.id && <ActionPanel id={save.result.id} onSettled={(action) => { if (action.status === "succeeded") onDone(Number(action.after?.supplierId ?? action.after?.id ?? supplier?.id)); }} />}
  </div>;
}

function SupplierDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const { tenant, me, isOwner, isFull, can, call } = useOps();
  const detail = useOpsFetch(pilot(tenant!, `suppliers/${id}/`));
  const supplier = recordPayload(detail.data);
  const [editing, setEditing] = useState(false);
  const canAdd = isFull || (!!me && supplier?.owner_id === me.user_id);
  const remove = useMutation(async (_: void, key) => call(pilot(tenant!, "actions/"), { method: "POST", key, body: { section: "suppliers", operation: "delete", target: String(id), data: {} } }));
  return <div className="space-y-4">
    <ErrorNotice error={detail.error ?? remove.error ?? (detail.data?.status === "failed" ? new Error(detail.data.error) : null)} />
    {detail.loading && !detail.data ? <Loading /> : supplier?.id ? <>
      <div className="flex justify-between items-center"><h2 className="font-semibold">{supplier.name}</h2><Badge tone={supplier.active ? "green" : "gray"}>{supplier.active ? "active" : "inactive"}</Badge></div>
      <Json value={supplier} />
      <div className="flex flex-wrap gap-2">{isOwner && <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit supplier"}</Button>}{can("can_delete") && <Button size="sm" variant="outline" disabled={remove.busy || !!remove.result?.id} onClick={() => remove.submit()}>Propose deletion…</Button>}</div>
      {editing && isOwner && <SupplierEditor supplier={supplier} onDone={() => { detail.reload(); onChanged(); }} />}
      {remove.result?.id && <><p className="text-sm text-amber-700">Deleting a local supplier removes its notes, documents and identity mapping. Automatic undo is unavailable.</p><ActionPanel id={remove.result.id} deleteMode="delete" onSettled={(action) => { if (action.status === "succeeded") { onChanged(); detail.reload(); } }} /></>}
      <RecordNote key={`notes-${id}`} parent={`suppliers/${id}`} local canCreate={canAdd} />
      <RecordAttachments key={`documents-${id}`} parent={`suppliers/${id}`} canCreate={canAdd} />
    </> : detail.data && <Empty>Supplier details are unavailable.</Empty>}
  </div>;
}
