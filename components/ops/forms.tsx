"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNotice } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { newKey } from "@/lib/ops/api";

/** Small helper: run a mutation with a stable idempotency key that renews only when the payload changes. */
export function useMutation<P>(run: (payload: P, key: string) => Promise<any>) {
  const { epoch } = useOps();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const key = useRef<{ k: string; sig: string }>({ k: newKey(), sig: "" });
  const submit = async (payload: P) => {
    const sig = JSON.stringify(payload);
    if (sig !== key.current.sig) key.current = { k: newKey(), sig };
    setBusy(true);
    setError(null);
    try {
      const r = await run(payload, key.current.k);
      setResult(r);
      key.current = { k: newKey(), sig: "" }; // done: next submit is a new intent
      return r;
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  void epoch;
  return { submit, error, busy, result };
}

export type FieldDef = { name: string; label: string; type?: string; required?: boolean };

/** Section presets for the documented JobAdder fields; anything else goes through the JSON editor. */
export const FIELD_PRESETS: Record<string, FieldDef[]> = {
  candidates: [
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "mobile", label: "Mobile", type: "tel" },
  ],
  contacts: [
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "mobile", label: "Mobile", type: "tel" },
  ],
  companies: [{ name: "name", label: "Company name", required: true }, { name: "phone", label: "Phone", type: "tel" }],
  jobs: [{ name: "jobTitle", label: "Job title", required: true }],
  notes: [{ name: "text", label: "Note", required: true }],
};

export function FieldsForm({ fields, initial, onSubmit, submitLabel, busy }: { fields: FieldDef[]; initial?: Record<string, any>; onSubmit: (v: Record<string, any>) => void; submitLabel: string; busy?: boolean }) {
  const [v, setV] = useState<Record<string, any>>(initial ?? {});
  const missing = fields.some((f) => f.required && !String(v[f.name] ?? "").trim());
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const out: Record<string, any> = {}; for (const f of fields) if (String(v[f.name] ?? "") !== String(initial?.[f.name] ?? "")) out[f.name] = v[f.name]; onSubmit(initial ? out : v); }}>
      {fields.map((f) => (
        <div key={f.name}>
          <Label htmlFor={`f-${f.name}`}>{f.label}{f.required ? " *" : ""}</Label>
          <Input id={`f-${f.name}`} type={f.type ?? "text"} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
        </div>
      ))}
      <Button type="submit" size="sm" disabled={missing || busy}>{submitLabel}</Button>
    </form>
  );
}

export { ErrorNotice };
