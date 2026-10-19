"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNotice } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { newKey } from "@/lib/ops/api";
import providerFields from "./provider-fields.json";

/** One key per intent. Failed network requests retain their key; edited requests get a new one. */
export function useMutation<P>(run: (payload: P, key: string) => Promise<any>) {
  const { epoch } = useOps();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const intent = useRef({ key: newKey(), signature: "" });
  const locked = useRef(false);
  const currentEpoch = useRef(epoch);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    currentEpoch.current = epoch;
    intent.current = { key: newKey(), signature: "" };
    // Drop mutation state when the active tenant changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null); setResult(null); setBusy(false); locked.current = false;
  }, [epoch]);
  const submit = async (payload: P) => {
    if (locked.current) return;
    const signature = JSON.stringify(payload);
    if (signature !== intent.current.signature) intent.current = { key: newKey(), signature };
    const startedEpoch = epoch;
    locked.current = true; setBusy(true); setError(null); setResult(null);
    try {
      const value = await run(payload, intent.current.key);
      if (!mounted.current || currentEpoch.current !== startedEpoch) return;
      setResult(value);
      intent.current = { key: newKey(), signature: "" };
      return value;
    } catch (e) {
      if (mounted.current && currentEpoch.current === startedEpoch && (e as Error)?.name !== "AbortError") setError(e);
    } finally {
      if (mounted.current && currentEpoch.current === startedEpoch) { locked.current = false; setBusy(false); }
    }
  };
  return { submit, error, busy, result };
}

export type ProviderSchema = {
  type?: string; format?: string; required?: string[]; properties?: Record<string, ProviderSchema>;
  items?: ProviderSchema; enum?: (string | number)[]; nullable?: boolean; maxLength?: number;
  minLength?: number; minimum?: number; maximum?: number; additionalProperties?: boolean; readOnly?: boolean;
};
export type FieldDef = {
  name: string; label: string; type?: string; required?: boolean;
  options?: (string | number)[]; schema?: ProviderSchema; hint?: string;
};

export const providerReferencePaths: string[] = providerFields.reference_paths;
export const providerAttachmentTypes: Record<string, string[]> = providerFields.attachment_types;

/** Fixed provider fields derived from pilot/jobadder_schema.json, verified 2026-10-11. */
export function providerFormFields(section: string, operation: "create" | "update"): FieldDef[] {
  const sections = providerFields.sections as unknown as Record<string, Partial<Record<"create" | "update", ProviderSchema>>>;
  const schema = sections[section]?.[operation];
  return Object.entries(schema?.properties ?? {}).filter(([, s]) => !s.readOnly).map(([name, s]) => ({
    name, label: name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase()),
    required: schema?.required?.includes(name), schema: s, options: s.enum,
    type: s.type === "boolean" ? "boolean" : s.type === "integer" || s.type === "number" ? "number" : s.type === "object" || s.type === "array" ? "json" : s.format === "date" ? "date" : /email/i.test(name) ? "email" : /description|text/i.test(name) ? "textarea" : "text",
    hint: s.type === "object" ? `Documented fields: ${Object.keys(s.properties ?? {}).join(", ")}` : s.type === "array" ? `JSON array${s.items?.properties ? `; item fields: ${Object.keys(s.items.properties).join(", ")}` : ` of ${s.items?.type ?? "values"}`}` : undefined,
  }));
}

/** Small forms elsewhere use these same documented common fields. */
export const FIELD_PRESETS: Record<string, FieldDef[]> = Object.fromEntries(
  ["candidates", "contacts", "companies", "jobs", "notes"].map((section) => [section, providerFormFields(section, "create").filter((field) => ["firstName", "lastName", "email", "mobile", "name", "jobTitle", "text", "type"].includes(field.name))])
);

export function validateProviderValue(value: any, schema: ProviderSchema, path: string): void {
  if (value === null && (schema.nullable || !schema.type)) return;
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path} must be an object.`);
    for (const required of schema.required ?? []) if (!(required in value)) throw new Error(`${path}.${required} is required.`);
    for (const [key, child] of Object.entries(value)) {
      const field = schema.properties?.[key];
      if (!field && schema.additionalProperties === false) throw new Error(`${path}.${key} is not a documented field.`);
      if (field) validateProviderValue(child, field, `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
    value.forEach((item, index) => validateProviderValue(item, schema.items ?? {}, `${path}[${index}]`));
  } else if (schema.type === "integer" || schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isSafeInteger(value))) throw new Error(`${path} must be ${schema.type === "integer" ? "an integer" : "a number"}.`);
    if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${path} must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new Error(`${path} must be at most ${schema.maximum}.`);
  } else if (schema.type && typeof value !== schema.type) throw new Error(`${path} must be ${schema.type}.`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} must be one of the displayed choices.`);
  if (typeof value === "string") {
    if (schema.maxLength && value.length > schema.maxLength) throw new Error(`${path} exceeds ${schema.maxLength} characters.`);
    if (schema.minLength && value.length < schema.minLength) throw new Error(`${path} needs at least ${schema.minLength} characters.`);
    if (schema.format === "date-time" && (Number.isNaN(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))) throw new Error(`${path} requires an ISO date and time with timezone.`);
  }
}

export function FieldsForm({ fields, initial, onSubmit, submitLabel, busy }: { fields: FieldDef[]; initial?: Record<string, any>; onSubmit: (v: Record<string, any>) => void; submitLabel: string; busy?: boolean }) {
  const prefix = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const display = (field: FieldDef) => values[field.name] ?? (initial?.[field.name] === undefined || initial?.[field.name] === null ? "" : field.type === "json" ? JSON.stringify(initial[field.name], null, 2) : String(initial[field.name]));
  const missing = fields.some((field) => field.required && !display(field).trim());
  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault(); setError(null);
      try {
        const output: Record<string, any> = {};
        for (const field of fields) {
          if (!(field.name in values) && (!field.required || !initial)) continue;
          const text = display(field);
          if (!text && !field.required && !initial) continue;
          const value = text === "" && field.schema?.nullable ? null : field.type === "json" ? (text.trim() ? JSON.parse(text) : null) : field.type === "number" ? (text.trim() ? Number(text) : null) : field.type === "boolean" ? (text === "" ? undefined : text === "true") : text;
          if (value === undefined) continue;
          if (field.schema) validateProviderValue(value, field.schema, field.label);
          if (initial && JSON.stringify(value) === JSON.stringify(initial[field.name]) && !field.required) continue;
          output[field.name] = value;
        }
        if (!Object.keys(output).length) throw new Error("Choose at least one field to save.");
        onSubmit(output);
      } catch (e) { setError(e); }
    }}>
      {fields.map((field) => {
        const id = `${prefix}-${field.name}`;
        return <div key={field.name} className="space-y-1">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          {field.type === "boolean" || field.options ? <select id={id} disabled={busy} className="w-full border rounded-md px-2 py-2 text-sm bg-transparent" value={display(field)} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}>
            <option value="">Choose…</option>{(field.options ?? ["true", "false"]).map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
          </select> : field.type === "json" || field.type === "textarea" ? <Textarea id={id} rows={field.type === "json" ? 3 : 2} disabled={busy} className={field.type === "json" ? "font-mono text-xs" : ""} value={display(field)} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} /> : <Input id={id} type={field.type ?? "text"} disabled={busy} required={field.required} maxLength={field.schema?.maxLength} step={field.schema?.type === "integer" ? "1" : "any"} value={display(field)} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} />}
          {field.hint && <p className="text-xs text-gray-500">{field.hint}</p>}
        </div>;
      })}
      <ErrorNotice error={error} />
      <Button type="submit" size="sm" disabled={missing || busy || !Object.keys(values).length}>{submitLabel}</Button>
    </form>
  );
}

export { ErrorNotice };
