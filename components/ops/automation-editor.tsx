"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNotice } from "@/components/ops/common";
import { useMutation } from "@/components/ops/forms";
import { parseConditions } from "@/components/ops/operations-contracts";
import { useOps } from "@/lib/ops/session";
import { listOf, useOpsFetch } from "@/lib/ops/hooks";
import { chan, ops } from "@/lib/ops/paths";

type Step = { type: "wait" | "send" | "alert"; seconds?: number; channels?: string[]; text?: string; subject?: string; template?: string | Record<string, any>; language?: string; mailbox_id?: string; componentsText?: string };
const CHANNELS = ["sms", "whatsapp", "email"];
const TRIGGERS = ["missed_call", "call_completed", "screening_completed", "out_of_hours", "document_expiring", "campaign"];
const selectClass = "block w-full border rounded-md px-2 py-2 text-sm bg-transparent";

function editableStep(step: Step): Step {
  const template = step.template;
  return { ...step, ...(step.type === "send" ? { channels: step.channels ?? ["whatsapp", "sms", "email"], componentsText: JSON.stringify(typeof template === "object" ? template.components ?? [] : [], null, 2) } : {}) };
}

export function AutomationEditor({ initial, onSaved, onClose }: { initial?: any; onSaved: () => void; onClose: () => void }) {
  const { call, tenant } = useOps();
  const boxes = useOpsFetch(ops("mailboxes/"));
  const mailboxes = listOf(boxes.data).filter((box) => box.active);
  const templatesResult = useOpsFetch(tenant ? chan(tenant, "templates/") : null);
  const templates = listOf(templatesResult.data?.templates).filter((template) => template.status?.toUpperCase() === "APPROVED");
  const channel = useOpsFetch(tenant ? chan(tenant, "settings/") : null);
  const [name, setName] = useState(initial?.name ?? "");
  const [steps, setSteps] = useState<Step[]>((initial?.steps ?? [{ type: "wait", seconds: 3600 }]).map(editableStep));
  const [trigger, setTrigger] = useState<string>(initial?.trigger ?? TRIGGERS[0]);
  const [enabled, setEnabled] = useState(!!initial?.enabled);
  const [consentChecked, setConsentChecked] = useState(false);
  const [stops, setStops] = useState<string[]>(Array.from(new Set([...(initial?.stop_when ?? ["reply", "status_change"]), "opt_out"])));
  const [conditions, setConditions] = useState<{ field: string; value: string; kind: string }[]>(Object.entries(initial?.conditions ?? {}).map(([field, value]) => ({ field, value: typeof value === "string" ? value : JSON.stringify(value), kind: typeof value === "string" ? "text" : "json" })));
  const [validation, setValidation] = useState<unknown>(null);
  const save = useMutation(async (body: any, key) => {
    const result = await call(initial ? ops(`automations/${initial.id}/`) : ops("automations/"), { method: initial ? "PATCH" : "POST", body, key });
    onSaved(); onClose(); return result;
  });
  const update = (index: number, patch: Partial<Step>) => setSteps(steps.map((step, i) => i === index ? { ...step, ...patch } : step));
  const move = (index: number, delta: number) => {
    const next = [...steps], target = index + delta;
    if (target < 0 || target >= steps.length) return;
    [next[index], next[target]] = [next[target], next[index]]; setSteps(next);
  };
  const submit = () => {
    setValidation(null);
    try {
      if (!name.trim() || !trigger.trim()) throw new Error("Name and trigger are required.");
      if (steps.length < 1 || steps.length > 50) throw new Error("Use 1 to 50 steps.");
      if (enabled && !consentChecked) throw new Error("Confirm recipient consent and sender readiness before enabling.");
      const cleaned = steps.map((step, index) => {
        const prefix = `Step ${index + 1}: `;
        if (step.type === "wait") {
          if (!Number.isInteger(step.seconds) || step.seconds! < 0 || step.seconds! > 31536000) throw new Error(prefix + "wait seconds must be an integer from 0 to 31536000.");
          return { type: "wait", seconds: step.seconds };
        }
        if (!step.text?.trim()) throw new Error(prefix + "text is required.");
        if (step.type === "alert") return { type: "alert", text: step.text };
        const channels = step.channels ?? [];
        if (!channels.length) throw new Error(prefix + "select at least one delivery channel.");
        const templateName = typeof step.template === "string" ? step.template : step.template?.name;
        const language = typeof step.template === "object" ? step.template.language?.code ?? step.language ?? "en_GB" : step.language ?? "en_GB";
        const components = JSON.parse(step.componentsText || "[]");
        if (!Array.isArray(components)) throw new Error(prefix + "template components must be a JSON array.");
        if (enabled) {
          if (channels.includes("email") && !mailboxes.some((box) => box.id === step.mailbox_id)) throw new Error(prefix + "select an active permitted email mailbox.");
          if (channels.some((c) => c !== "email") && !channel.data?.active) throw new Error(prefix + "configure an active company sender in Settings.");
          if (channels.includes("sms") && !channel.data?.sms_enabled) throw new Error(prefix + "SMS is disabled for the company sender.");
          if (channels.includes("whatsapp") && (!channel.data?.whatsapp_enabled || !templates.some((t) => t.name === templateName && t.language === language))) throw new Error(prefix + "select an approved WhatsApp template and enabled WhatsApp sender.");
        }
        return { type: "send", channels, text: step.text, ...(step.subject ? { subject: step.subject } : {}), ...(step.mailbox_id ? { mailbox_id: step.mailbox_id } : {}), ...(templateName ? { template: { ...(typeof step.template === "object" ? step.template : {}), name: templateName, language: { code: language }, components } } : {}) };
      });
      void save.submit({ name: name.trim(), trigger: trigger.trim(), enabled, conditions: parseConditions(conditions), steps: cleaned, stop_when: Array.from(new Set([...stops, "opt_out"])) });
    } catch (error) { setValidation(error); }
  };
  return (
    <form className="border rounded-lg p-4 space-y-4" aria-label="Automation editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <fieldset disabled={save.busy} className="space-y-4">
        <div><Label htmlFor="automation-name">Name</Label><Input id="automation-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="automation-trigger">Trigger event</Label><Input id="automation-trigger" required list="automation-triggers" maxLength={64} value={trigger} onChange={(e) => setTrigger(e.target.value)} /><datalist id="automation-triggers">{TRIGGERS.map((value) => <option key={value} value={value} />)}</datalist></div>
        <fieldset className="space-y-3"><legend className="text-sm font-semibold">Ordered steps ({steps.length}/50)</legend>
          {steps.map((step, index) => {
            const channels = step.channels ?? [];
            const templateName = typeof step.template === "string" ? step.template : step.template?.name ?? "";
            const language = typeof step.template === "object" ? step.template.language?.code ?? step.language ?? "en_GB" : step.language ?? "en_GB";
            const selectedTemplate = templates.find((t) => t.name === templateName && t.language === language);
            return <div key={index} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{index + 1}. {step.type}</span><span className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={index === 0} aria-label={`Move step ${index + 1} up`} onClick={() => move(index, -1)}>↑</Button><Button type="button" size="sm" variant="outline" disabled={index === steps.length - 1} aria-label={`Move step ${index + 1} down`} onClick={() => move(index, 1)}>↓</Button><Button type="button" size="sm" variant="outline" onClick={() => setSteps(steps.filter((_, i) => i !== index))}>Remove</Button></span></div>
              {step.type === "wait" && <div><Label htmlFor={`wait-${index}`}>Wait (seconds)</Label><Input id={`wait-${index}`} type="number" min={0} max={31536000} step={1} required value={step.seconds ?? 0} onChange={(e) => update(index, { seconds: Number(e.target.value) })} /></div>}
              {step.type === "send" && <>
                <fieldset className="space-y-2"><legend className="text-sm">Delivery order</legend>{channels.map((value, channelIndex) => <div key={value} className="flex gap-2 items-center text-sm"><span>{channelIndex + 1}. {value}</span><Button type="button" size="sm" variant="outline" disabled={channelIndex === 0} aria-label={`Move ${value} earlier in step ${index + 1}`} onClick={() => { const next = [...channels]; [next[channelIndex - 1], next[channelIndex]] = [next[channelIndex], next[channelIndex - 1]]; update(index, { channels: next }); }}>↑</Button><Button type="button" size="sm" variant="outline" onClick={() => update(index, { channels: channels.filter((c) => c !== value) })}>Remove</Button></div>)}<div className="flex gap-2">{CHANNELS.filter((c) => !channels.includes(c)).map((value) => <Button type="button" key={value} variant="outline" size="sm" onClick={() => update(index, { channels: [...channels, value] })}>Add {value}</Button>)}</div></fieldset>
                <p className="text-xs text-gray-500">Channels run in this order. Uncertain acceptance waits for investigation.</p>
                <Label htmlFor={`text-${index}`}>Message text</Label><Textarea id={`text-${index}`} required value={step.text ?? ""} onChange={(e) => update(index, { text: e.target.value })} />
                <p className="text-xs text-gray-500">Available substitutions: {"{name}, {consultant}, {job_title}, {document_upload_url}"}.</p>
                {channels.includes("whatsapp") && <><Label htmlFor={`template-${index}`}>Approved WhatsApp template / language</Label><select id={`template-${index}`} className={selectClass} value={selectedTemplate?.uid ?? ""} onChange={(e) => { const selected = templates.find((t) => t.uid === e.target.value); update(index, { template: selected ? { name: selected.name, language: { code: selected.language } } : undefined, componentsText: "[]" }); }}><option value="">Select approved template…</option>{templates.map((t) => <option key={t.uid} value={t.uid}>{t.name} ({t.language})</option>)}</select>{templateName && !selectedTemplate && <p className="text-xs text-amber-700">Saved template {templateName} ({language}) is not in the current approved catalog. You can save it disabled.</p>}<Label htmlFor={`components-${index}`}>Template components / parameters (JSON array)</Label><Textarea id={`components-${index}`} rows={4} className="font-mono text-xs" value={step.componentsText ?? "[]"} onChange={(e) => update(index, { componentsText: e.target.value })} />{selectedTemplate && <details className="text-xs"><summary className="cursor-pointer">Approved component definitions</summary><pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedTemplate.components, null, 2)}</pre></details>}</>}
                {channels.includes("email") && <><Label htmlFor={`subject-${index}`}>Email subject (defaults to automation name)</Label><Input id={`subject-${index}`} value={step.subject ?? ""} onChange={(e) => update(index, { subject: e.target.value })} /><Label htmlFor={`mailbox-${index}`}>Active permitted sender mailbox</Label><select id={`mailbox-${index}`} className={selectClass} value={step.mailbox_id ?? ""} onChange={(e) => update(index, { mailbox_id: e.target.value })}><option value="">Select mailbox…</option>{mailboxes.map((box) => <option key={box.id} value={box.id}>{box.address}</option>)}</select></>}
              </>}
              {step.type === "alert" && <div><Label htmlFor={`alert-${index}`}>Alert text</Label><Textarea id={`alert-${index}`} required value={step.text ?? ""} onChange={(e) => update(index, { text: e.target.value })} /></div>}
            </div>;
          })}
          <div className="flex gap-2">{(["wait", "send", "alert"] as const).map((type) => <Button key={type} type="button" size="sm" variant="outline" disabled={steps.length >= 50} onClick={() => setSteps([...steps, editableStep(type === "wait" ? { type, seconds: 3600 } : type === "send" ? { type, channels: ["sms"], text: "" } : { type, text: "" })])}>Add {type}</Button>)}</div>
        </fieldset>
        <fieldset className="space-x-4 text-sm"><legend className="font-semibold mb-1">Stop when</legend>{["reply", "status_change", "opt_out"].map((value) => <label key={value} className="inline-flex items-center gap-1"><input type="checkbox" checked={stops.includes(value)} disabled={value === "opt_out"} onChange={() => setStops(stops.includes(value) ? stops.filter((s) => s !== value) : [...stops, value])} />{value}{value === "opt_out" ? " (required)" : ""}</label>)}</fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold">Trigger conditions (all fields must match exactly)</legend>{conditions.map((condition, index) => <div key={index} className="grid sm:grid-cols-4 gap-2"><Input aria-label={`Condition ${index + 1} field`} placeholder="Event field" required value={condition.field} onChange={(e) => setConditions(conditions.map((row, i) => i === index ? { ...row, field: e.target.value } : row))} /><select className={selectClass} aria-label={`Condition ${index + 1} value type`} value={condition.kind} onChange={(e) => setConditions(conditions.map((row, i) => i === index ? { ...row, kind: e.target.value } : row))}><option value="text">Text</option><option value="json">JSON (number, boolean, object)</option></select><Input aria-label={`Condition ${index + 1} value`} value={condition.value} onChange={(e) => setConditions(conditions.map((row, i) => i === index ? { ...row, value: e.target.value } : row))} /><Button type="button" size="sm" variant="outline" onClick={() => setConditions(conditions.filter((_, i) => i !== index))}>Remove</Button></div>)}<Button type="button" size="sm" variant="outline" onClick={() => setConditions([...conditions, { field: "", value: "", kind: "text" }])}>Add condition</Button></fieldset>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Enable after saving</label>
        {enabled && <label className="flex gap-2 text-sm"><input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} />I have verified recipient consent, approved template parameters and the configured sending channels / mailbox.</label>}
      </fieldset>
      <ErrorNotice error={validation ?? save.error ?? boxes.error ?? templatesResult.error ?? channel.error} />
      <div className="flex gap-2"><Button type="submit" disabled={save.busy}>{save.busy ? "Saving…" : initial ? "Save changes" : enabled ? "Create and enable" : "Create disabled"}</Button><Button type="button" variant="outline" disabled={save.busy} onClick={onClose}>Cancel</Button></div>
    </form>
  );
}
