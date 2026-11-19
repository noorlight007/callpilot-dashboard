"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, Trash2, Volume2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimezoneSelect } from "@/components/timezone-select";
import { flowService } from "@/services/flow-service";
import { screeningError, screeningTestService, type TestConfig } from "@/services/screening-test-service";
import { Field, inputClass, Message, NativeSelect, primaryButton, Saving, secondaryButton } from "./shared";

interface PhoneOption { uid: string; phone_number: string; friendly_name?: string; voice_capable?: boolean; status?: string }
interface VoiceOption { voice_id: string; name: string; preview_url?: string }
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaults: TestConfig = { enabled: false, phone_uid: null, voice_id: "jRAAK67SEFE9m7ci5DhD", primary_questions: [], end_call_if_primary_answer_negative: false, documents_enabled: true, timezone: "UTC", calling_time_after_status_update: 0, calling_start_time: "00:00", calling_end_time: "23:59", calling_days: [0, 1, 2, 3, 4, 5, 6] };

export function SettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (config: TestConfig) => void }) {
  const [config, setConfig] = useState<TestConfig>(defaults);
  const [phones, setPhones] = useState<PhoneOption[]>([]);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  useEffect(() => {
    let alive = true;
    void Promise.allSettled([screeningTestService.config(), flowService.getPhoneNumbers(), flowService.getVoices()]).then(([settings, numbers, voiceOptions]) => {
      if (!alive) return;
      if (settings.status === "fulfilled") setConfig({ ...defaults, ...settings.value }); else setError(screeningError(settings.reason));
      if (numbers.status === "fulfilled") setPhones(Array.isArray(numbers.value.data) ? numbers.value.data : numbers.value.data.results || []); else setError(screeningError(numbers.reason));
      if (voiceOptions.status === "fulfilled") setVoices(Array.isArray(voiceOptions.value.data) ? voiceOptions.value.data : voiceOptions.value.data.results || []); else setVoiceError("Voice previews could not be loaded. You can keep or enter a voice ID below.");
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  const update = <K extends keyof TestConfig>(key: K, value: TestConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { enabled, phone_uid, voice_id, end_call_if_primary_answer_negative, documents_enabled, timezone, calling_time_after_status_update, calling_start_time, calling_end_time, calling_days } = config;
      onSaved(await screeningTestService.saveConfig({ enabled, phone_uid, voice_id: voice_id.trim(), primary_questions: config.primary_questions.map((question) => question.trim()).filter(Boolean), end_call_if_primary_answer_negative, documents_enabled, timezone, calling_time_after_status_update, calling_start_time, calling_end_time, calling_days }));
    } catch (error) { setError(screeningError(error)); } finally { setBusy(false); }
  };
  const voice = voices.find((item) => item.voice_id === config.voice_id);
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-2xl"><DialogHeader><DialogTitle>Testing AI call settings</DialogTitle><DialogDescription>Configure calls for your test jobs. These settings are separate from your ATS screening workflow.</DialogDescription></DialogHeader>
    {loading ? <div className="py-12 text-center text-gray-500"><Saving busy>Loading settings…</Saving></div> : <form onSubmit={submit} className="space-y-6">
      {error && <Message message={error} />}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Calling number" htmlFor="test-config-phone"><NativeSelect id="test-config-phone" className={inputClass} value={config.phone_uid || ""} onChange={(e) => update("phone_uid", e.target.value || null)} required><option value="">Choose your business number</option>{phones.filter((phone) => phone.voice_capable !== false).map((phone) => <option key={phone.uid} value={phone.uid}>{phone.phone_number}{phone.friendly_name ? ` · ${phone.friendly_name}` : ""}</option>)}</NativeSelect>{!phones.length && <Link className="text-sm text-blue-600 hover:underline" href="/dashboard/phone-numbers">Add a business phone number</Link>}</Field>
      <Field label="AI voice" htmlFor="test-config-voice">{voices.length ? <NativeSelect id="test-config-voice" className={inputClass} value={config.voice_id} onChange={(e) => update("voice_id", e.target.value)}>{!voices.some((voice) => voice.voice_id === config.voice_id) && <option value={config.voice_id}>Current voice ({config.voice_id})</option>}{voices.map((voice) => <option key={voice.voice_id} value={voice.voice_id}>{voice.name}</option>)}</NativeSelect> : <input id="test-config-voice" className={inputClass} value={config.voice_id} onChange={(e) => update("voice_id", e.target.value)} required />}</Field></div>
      {voiceError && <p className="text-sm text-amber-700 dark:text-amber-300">{voiceError}</p>}
      {voice?.preview_url && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900"><Volume2 className="h-5 w-5 text-blue-600" /><span className="text-sm text-gray-600 dark:text-gray-300">Preview {voice.name}</span><audio key={voice.voice_id} controls preload="none" src={voice.preview_url} className="h-9 max-w-full" /></div>}
      <div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-gray-900 dark:text-gray-100">Primary screening questions</h3><p className="text-sm text-gray-500">Add up to three yes/no questions. The AI also prepares questions from your job description.</p></div><button type="button" className={secondaryButton} disabled={config.primary_questions.length >= 3} onClick={() => update("primary_questions", [...config.primary_questions, ""])}><Plus className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Add</span></button></div>
      {config.primary_questions.map((question, index) => <div key={index} className="flex items-start gap-2"><label className="sr-only" htmlFor={`test-primary-${index}`}>Primary question {index + 1}</label><input id={`test-primary-${index}`} className={inputClass} value={question} onChange={(e) => update("primary_questions", config.primary_questions.map((existing, item) => item === index ? e.target.value : existing))} maxLength={255} placeholder="e.g. Do you have the right to work in the UK?" /><button className="rounded-lg p-3 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800" type="button" aria-label={`Remove question ${index + 1}`} onClick={() => update("primary_questions", config.primary_questions.filter((_, item) => item !== index))}><Trash2 className="h-4 w-4" /></button></div>)}
      <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={config.end_call_if_primary_answer_negative} onChange={(e) => update("end_call_if_primary_answer_negative", e.target.checked)} />End screening when an essential primary answer is negative</label></div>
      <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Calling schedule</h3><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Timezone</label><TimezoneSelect value={config.timezone} onChange={(value) => update("timezone", value)} /></div><Field label="Delay after application (minutes)" htmlFor="test-config-delay"><input id="test-config-delay" type="number" min={0} max={10080} className={inputClass} value={config.calling_time_after_status_update} onChange={(e) => update("calling_time_after_status_update", Number(e.target.value))} required /></Field></div>
      <div className="grid grid-cols-2 gap-4"><Field label="Calling starts" htmlFor="test-config-start"><input id="test-config-start" type="time" className={inputClass} value={config.calling_start_time.slice(0, 5)} onChange={(e) => update("calling_start_time", e.target.value)} required /></Field><Field label="Calling ends" htmlFor="test-config-end"><input id="test-config-end" type="time" className={inputClass} value={config.calling_end_time.slice(0, 5)} onChange={(e) => update("calling_end_time", e.target.value)} required /></Field></div>
      <fieldset><legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Calling days</legend><div className="flex flex-wrap gap-2">{days.map((day, index) => <label key={day} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${config.calling_days.includes(index) ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}><input type="checkbox" className="sr-only" checked={config.calling_days.includes(index)} onChange={(e) => update("calling_days", e.target.checked ? [...config.calling_days, index].sort() : config.calling_days.filter((item) => item !== index))} />{day}</label>)}</div></fieldset></div>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"><label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-blue-600" checked={config.documents_enabled} onChange={(e) => update("documents_enabled", e.target.checked)} /><span><span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Request documents after successful screening</span><span className="text-sm text-gray-500">Test the upload process with a personal link that requires no candidate login.</span></span></label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-blue-600" checked={config.enabled} onChange={(e) => update("enabled", e.target.checked)} /><span><span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Automatically call new test applications</span><span className="text-sm text-gray-500">The scheduler calls Applied candidates during your calling hours after the configured delay. Calls use screening credits. Leave off to start each call manually.</span></span></label></div>
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"><button type="button" className={secondaryButton} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primaryButton} disabled={busy || !config.phone_uid || !config.voice_id.trim() || !config.calling_days.length}><Saving busy={busy}>Save testing settings</Saving></button></div>
    </form>}</DialogContent></Dialog>;
}
