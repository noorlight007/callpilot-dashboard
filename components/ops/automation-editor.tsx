"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNotice } from "@/components/ops/common";
import { useMutation } from "@/components/ops/forms";
import { useOps } from "@/lib/ops/session";
import { ops } from "@/lib/ops/paths";

type Step =
  | { type: "wait"; seconds: number }
  | { type: "send"; channels: string[]; text: string; template?: string; mailbox_id?: string }
  | { type: "alert"; message: string };

const CHANNELS = ["sms", "whatsapp", "email"];
// Triggers the backend currently emits.
const TRIGGERS = ["missed_call", "call_completed", "screening_completed", "out_of_hours", "document_expiring"];

/** Create or edit a definition. Always saved disabled for new ones; opt_out stop is mandatory. */
/** Drop empty optional send settings so only real values are sent. */
function cleanStep(s: Step): Step {
  if (s.type !== "send") return s;
  const out: Step = { type: "send", channels: s.channels, text: s.text };
  if (s.template) out.template = s.template;
  if (s.mailbox_id) out.mailbox_id = s.mailbox_id;
  return out;
}

export function AutomationEditor({ initial, onSaved, onClose }: { initial?: any; onSaved: () => void; onClose: () => void }) {
  const { call } = useOps();
  const [name, setName] = useState(initial?.name ?? "");
  const [steps, setSteps] = useState<Step[]>(initial?.steps ?? [{ type: "wait", seconds: 3600 }]);
  const [trigger, setTrigger] = useState<string>(initial?.trigger ?? TRIGGERS[0]);
  const [stops, setStops] = useState<string[]>(initial?.stop_when ?? ["opt_out"]);
  // `conditions` is an object of equality matches against the event payload.
  const [conds, setConds] = useState<{ field: string; value: string }[]>(Object.entries(initial?.conditions ?? {}).map(([field, value]) => ({ field, value: String(value) })));
  const save = useMutation(async (b: any, key) => {
    await call(initial ? ops(`automations/${initial.id}/`) : ops("automations/"), { method: initial ? "PATCH" : "POST", body: b, key });
    onSaved(); onClose();
  });
  const upd = (i: number, patch: Partial<Step>) => setSteps(steps.map((s, n) => (n === i ? ({ ...s, ...patch } as Step) : s)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= steps.length) return; const c = [...steps]; [c[i], c[j]] = [c[j], c[i]]; setSteps(c); };
  const toggleStop = (c: string) => c === "opt_out" ? null : setStops(stops.includes(c) ? stops.filter((x) => x !== c) : [...stops, c]);

  return (
    <div className="border rounded-lg p-4 space-y-4" role="form" aria-label="Automation editor">
      <div><Label htmlFor="an">Name</Label><Input id="an" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold">Steps</legend>
        {steps.map((s, i) => (
          <div key={i} className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">{i + 1}. {s.type}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="outline" aria-label="Move up" onClick={() => move(i, -1)}>↑</Button>
                <Button size="sm" variant="outline" aria-label="Move down" onClick={() => move(i, 1)}>↓</Button>
                <Button size="sm" variant="outline" onClick={() => setSteps(steps.filter((_, n) => n !== i))}>Remove</Button>
              </span></div>
            {s.type === "wait" && <div><Label htmlFor={`w${i}`}>Wait (seconds)</Label><Input id={`w${i}`} type="number" min={0} value={s.seconds} onChange={(e) => upd(i, { seconds: Number(e.target.value) })} /></div>}
            {s.type === "send" && (<>
              <div className="flex gap-3 text-sm">{CHANNELS.map((c) => <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={s.channels.includes(c)} onChange={() => upd(i, { channels: s.channels.includes(c) ? s.channels.filter((x) => x !== c) : [...s.channels, c] })} />{c}</label>)}</div>
              <p className="text-xs text-gray-500">Channels are tried in the order selected.</p>
              <Label htmlFor={`m${i}`}>Message text (use {"{name}"} for the contact name)</Label><Textarea id={`m${i}`} value={s.text} onChange={(e) => upd(i, { text: e.target.value })} />
              <Label htmlFor={`t${i}`}>Approved template name</Label><Input id={`t${i}`} value={s.template ?? ""} onChange={(e) => upd(i, { template: e.target.value })} />
              <Label htmlFor={`b${i}`}>Mailbox ID (for email)</Label><Input id={`b${i}`} value={s.mailbox_id ?? ""} onChange={(e) => upd(i, { mailbox_id: e.target.value })} />
            </>)}
            {s.type === "alert" && <div><Label htmlFor={`a${i}`}>Alert message</Label><Input id={`a${i}`} value={s.message} onChange={(e) => upd(i, { message: e.target.value })} /></div>}
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { type: "wait", seconds: 3600 }])}>+ Wait</Button>
          <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { type: "send", channels: ["sms"], text: "" }])}>+ Send</Button>
          <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { type: "alert", message: "" }])}>+ Alert</Button>
        </div>
      </fieldset>
      <fieldset className="text-sm space-x-4"><legend className="font-semibold mb-1">Stop when</legend>
        {["reply", "status_change", "opt_out"].map((c) => <label key={c} className="inline-flex items-center gap-1"><input type="checkbox" checked={stops.includes(c)} disabled={c === "opt_out"} onChange={() => toggleStop(c)} />{c}{c === "opt_out" ? " (required)" : ""}</label>)}
      </fieldset>
      <div><Label htmlFor="atr">Trigger</Label>
        <select id="atr" className="block border rounded-md px-2 py-2 text-sm bg-transparent" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGERS.map((t) => <option key={t}>{t}</option>)}
        </select></div>
      <fieldset className="space-y-2"><legend className="text-sm font-semibold">Only when (all must match exactly)</legend>
        {conds.map((t, i) => (
          <div key={i} className="flex gap-2"><Input aria-label="Field" placeholder="field" value={t.field} onChange={(e) => setConds(conds.map((x, n) => n === i ? { ...x, field: e.target.value } : x))} /><Input aria-label="Value" placeholder="value" value={t.value} onChange={(e) => setConds(conds.map((x, n) => n === i ? { ...x, value: e.target.value } : x))} /><Button size="sm" variant="outline" onClick={() => setConds(conds.filter((_, n) => n !== i))}>Remove</Button></div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setConds([...conds, { field: "", value: "" }])}>+ Condition</Button>
      </fieldset>
      <ErrorNotice error={save.error} />
      <div className="flex gap-2">
        <Button disabled={!name || steps.length === 0 || save.busy} onClick={() => save.submit({ name, trigger, conditions: Object.fromEntries(conds.filter((c) => c.field).map((c) => [c.field, c.value])), steps: steps.map(cleanStep), stop_when: Array.from(new Set([...stops, "opt_out"])), ...(initial ? {} : { enabled: false }) })}>{initial ? "Save changes" : "Create (disabled)"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
