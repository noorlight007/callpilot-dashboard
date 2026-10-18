"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNotice, Json, Loading, PageHeader } from "@/components/ops/common";
import { Require } from "@/components/ops/shell";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { ops } from "@/lib/ops/paths";
import { enc } from "@/lib/ops/api";

export default function FinancePage() {
  // Require owner so no finance request is made for anyone else.
  return <Require perm="finance"><Inner /></Require>;
}

function Inner() {
  const caps = useOpsFetch(ops("finance/capabilities/"));
  const sources: any[] = listOf(caps.data?.sources ?? caps.data);
  const [src, setSrc] = useState("");
  const [res, setRes] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const resources: string[] = (sources.find((s) => String(s.id ?? s.connector_id) === src)?.resources ?? []).map((r: any) => (typeof r === "string" ? r : r.name ?? r.id));
  const data = useOpsFetch(src && res ? ops(`finance/${enc(src)}/${enc(res)}/`) : null, { query: { from: from || undefined, to: to || undefined } });
  const invoices = useOpsFetch(ops("finance/invoices/"));
  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Unmodified source data. Currency and precision are shown as returned." />
      <ErrorNotice error={caps.error} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div><Label htmlFor="src">Source</Label><select id="src" className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={src} onChange={(e) => { setSrc(e.target.value); setRes(""); }}><option value="">Select…</option>{sources.map((s) => <option key={s.id ?? s.connector_id} value={String(s.id ?? s.connector_id)}>{s.name ?? s.id}</option>)}</select></div>
        <div><Label htmlFor="res">Resource</Label><select id="res" className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={res} onChange={(e) => setRes(e.target.value)}><option value="">Select…</option>{resources.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><Label htmlFor="from">From</Label><Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="to">To</Label><Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <ErrorNotice error={data.error} />
      {data.loading && src && res && !data.data ? <Loading /> : data.data && (<><p className="text-xs text-gray-500">Source: {data.data.source ?? src} · fetched {data.data.fetched_at ?? "—"} · filters {JSON.stringify(data.data.filters ?? { from, to })}</p><Json value={data.data} /></>)}
      <h2 className="font-semibold text-sm">Supplier invoice queue</h2>
      <ErrorNotice error={invoices.error} />
      {invoices.loading && !invoices.data ? <Loading /> : listOf(invoices.data).length === 0 ? <Json value={invoices.data} /> : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <caption className="sr-only">Supplier invoices awaiting review</caption>
            <thead><tr className="text-left border-b">{["Supplier", "Invoice", "Amount", "Currency", "Status", "Received"].map((h) => <th key={h} scope="col" className="p-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{listOf(invoices.data).map((i: any, n: number) => (
              <tr key={i.id ?? n} className="border-b last:border-0">
                <td className="p-2">{i.supplier ?? i.supplier_name}</td><td className="p-2">{i.number ?? i.reference ?? i.id}</td>
                {/* amount is displayed exactly as returned: no re-rounding */}
                <td className="p-2">{String(i.amount ?? i.total ?? "")}</td><td className="p-2">{i.currency}</td><td className="p-2">{i.status}</td><td className="p-2">{i.received_at ?? i.created_at}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
