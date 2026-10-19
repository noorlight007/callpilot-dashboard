"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, Empty, ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { Require } from "@/components/ops/shell";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { useOps } from "@/lib/ops/session";
import { ops } from "@/lib/ops/paths";
import { enc } from "@/lib/ops/api";

export default function FinancePage() {
  const { epoch } = useOps();
  return <Require owner perm="finance"><FinanceWorkspace key={epoch} /></Require>;
}

function FinanceWorkspace() {
  const caps = useOpsFetch(ops("finance/capabilities/"));
  const sources = listOf(caps.data);
  const [src, setSrc] = useState("");
  const [resource, setResource] = useState("");
  const [filters, setFilters] = useState<{ name: string; value: string }[]>([]);
  const [request, setRequest] = useState<{ source: string; resource: string; query: Record<string, string> } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const source = sources.find((s) => String(s.id) === src);
  const resources = listOf(source?.resources);
  const data = useOpsFetch(request ? ops(`finance/${enc(request.source)}/${enc(request.resource)}/`) : null, { query: request?.query });
  const invoices = useOpsFetch(ops("finance/invoices/"));
  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Read source reports with their original values, currency and precision." />
      <ErrorNotice error={caps.error} />
      {caps.loading && !caps.data ? <Loading /> : sources.length === 0 ? <Empty>No financial sources are configured.</Empty> : <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault(); setError(null);
        if (!source || !resources.some((r) => r.resource === resource)) return;
        const query: Record<string, string> = {};
        for (const filter of filters) {
          const name = filter.name.trim();
          if (!name || name === "tenant_id" || Object.prototype.hasOwnProperty.call(query, name)) { setError(new Error("Use unique source filter names; tenant_id is managed by your session.")); return; }
          query[name] = filter.value;
        }
        setRequest({ source: src, resource, query });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="src">Source</Label><select id="src" className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={src} onChange={(e) => { setSrc(e.target.value); setResource(""); setRequest(null); setFilters([]); }}><option value="">Select…</option>{sources.map((s) => <option key={s.id} value={String(s.id)}>{s.product} ({s.kind}, #{s.id})</option>)}</select></div>
          <div><Label htmlFor="resource">Available resource</Label><select id="resource" className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={resource} onChange={(e) => { setResource(e.target.value); setRequest(null); }}><option value="">Select…</option>{resources.map((r) => <option key={r.resource} value={r.resource}>{r.resource}{r.scope ? ` · ${r.scope}` : ""}</option>)}</select></div>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Source date / query filters</legend>
          <p className="text-xs text-gray-500">Use the exact parameter names documented by this source, including its date format. CallPilot passes these values through unchanged.</p>
          {filters.map((filter, index) => <div key={index} className="flex gap-2"><Input aria-label={`Filter ${index + 1} name`} placeholder="Source parameter name" value={filter.name} onChange={(e) => setFilters(filters.map((f, i) => i === index ? { ...f, name: e.target.value } : f))} /><Input aria-label={`Filter ${index + 1} value`} placeholder="Value or source date" value={filter.value} onChange={(e) => setFilters(filters.map((f, i) => i === index ? { ...f, value: e.target.value } : f))} /><Button type="button" variant="outline" onClick={() => setFilters(filters.filter((_, i) => i !== index))}>Remove</Button></div>)}
          <Button type="button" variant="outline" size="sm" onClick={() => setFilters([...filters, { name: "", value: "" }])}>Add filter</Button>
        </fieldset>
        <ErrorNotice error={error} />
        <Button type="submit" disabled={!src || !resource || data.loading && !!request}>Fetch source data</Button>
      </form>}
      <ErrorNotice error={data.error} />
      {request && data.loading && !data.data ? <Loading /> : data.data && <section className="space-y-2" aria-label="Source data"><p className="text-xs text-gray-500">Source: {data.data.product} · connector #{data.data.connector_id} · resource {data.data.resource} · fetched {data.data.fetched_at}</p><p className="text-xs text-gray-500">Submitted source filters: {JSON.stringify(request?.query ?? {})}</p><Json value={data.data.data} /></section>}
      <section aria-label="Supplier invoices" className="space-y-2">
        <h2 className="font-semibold text-sm">Supplier invoice review queue (latest 100)</h2>
        <ErrorNotice error={invoices.error} />
        {invoices.loading && !invoices.data ? <Loading /> : listOf(invoices.data).length === 0 ? <Empty>No supplier invoices.</Empty> : <ul className="divide-y border rounded-lg">{listOf(invoices.data).map((invoice) => <li key={invoice.id} className="p-3 space-y-2 text-sm"><div>Supplier {invoice.supplier_id || "awaiting identification"} <Badge>{invoice.status}</Badge></div><p className="text-xs text-gray-500">Received {invoice.created_at} · mailbox {invoice.mailbox_id} · forwarding {invoice.outbox_id || "not queued"}</p><details><summary className="cursor-pointer">Review original invoice content</summary><p className="whitespace-pre-wrap break-words py-2">{invoice.text || "No text supplied."}</p>{invoice.media?.length > 0 && <><p className="text-xs text-gray-500">Original media metadata; retrieve attachments from the trusted source mailbox.</p><Json value={invoice.media} /></>}</details></li>)}</ul>}
      </section>
    </div>
  );
}
