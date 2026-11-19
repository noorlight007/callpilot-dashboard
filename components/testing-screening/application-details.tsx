"use client";

import { useState, type FormEvent } from "react";
import { Copy, Download, FileText, Mail, Phone, PhoneCall, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { screeningError, screeningTestService, type TestApplication, type TestDocument } from "@/services/screening-test-service";
import { activeCallStates, dateLabel, Field, humanize, inputClass, Message, primaryButton, Saving, secondaryButton, StatusBadge } from "./shared";

function transcriptMessages(value: unknown): { role: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const text = record.content ?? record.text ?? record.message ?? record.answer ?? "";
    return typeof text === "string" && text.trim() ? [{ role: String(record.role ?? record.speaker ?? "Message"), text }] : [];
  });
}

export function ApplicationDetails({ application, ready, onClose, onStartCall, onRefresh }: { application: TestApplication; ready: boolean; onClose: () => void; onStartCall: (application: TestApplication) => void; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState<"overview" | "calls" | "documents">("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [uploadLink, setUploadLink] = useState("");
  const canUpload = ["DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED"].includes(application.status);
  const canCall = !activeCallStates.has(application.call_state);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!file) return;
    const form = event.currentTarget; setBusy(true); setError(""); setSuccess("");
    try { await screeningTestService.upload(application.uid, file, label.trim()); setFile(null); setLabel(""); form.reset(); await onRefresh(); setSuccess("Document uploaded. The application is now Documents Received."); }
    catch (error) { setError(screeningError(error)); } finally { setBusy(false); }
  };
  const getLink = async () => {
    setLinkBusy(true); setError("");
    try { const result = await screeningTestService.uploadLink(application.uid); setUploadLink(result.url); }
    catch (error) { setError(screeningError(error)); } finally { setLinkBusy(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(uploadLink); setSuccess("Upload link copied."); }
    catch { setError("The link could not be copied automatically. Select and copy it from the field below."); }
  };
  const download = async (document: TestDocument) => {
    setError("");
    try {
      const blob = await screeningTestService.download(document.uid);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = document.name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(screeningError(error)); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-3xl"><DialogHeader><div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={application.status} label={application.status_label} /><span className="text-sm text-gray-500">{humanize(application.call_state)}</span></div><DialogTitle className="text-xl">{application.first_name} {application.last_name}</DialogTitle><DialogDescription>{application.job_title} · Applied {dateLabel(application.created_at)}</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-1 text-sm text-gray-600 dark:text-gray-300"><p className="flex items-center gap-2"><Mail className="h-4 w-4" />{application.email}</p><p className="flex items-center gap-2"><Phone className="h-4 w-4" />{application.mobile}</p></div>{canCall && <button type="button" className={primaryButton} disabled={!ready} onClick={() => onStartCall(application)}><PhoneCall className="h-4 w-4" />{application.attempts.length ? "Run screening again" : "Start test call"}</button>}</div>
    {application.last_error && <Message message={application.last_error} />}{error && <Message message={error} onClose={() => setError("")} />}{success && <Message message={success} success onClose={() => setSuccess("")} />}
    <div role="tablist" aria-label="Candidate details" className="flex gap-1 border-b border-gray-200 dark:border-gray-800">{(["overview", "calls", "documents"] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} aria-controls={`test-panel-${value}`} id={`test-tab-${value}`} onClick={() => setTab(value)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === value ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}>{value === "calls" ? `Calls (${application.attempts.length})` : value === "documents" ? `Documents (${application.documents.length})` : "Timeline"}</button>)}</div>
    <div role="tabpanel" id={`test-panel-${tab}`} aria-labelledby={`test-tab-${tab}`} className="min-h-40">
      {tab === "overview" && <div className="space-y-5 py-2">{application.ai_decision && <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900"><p className="text-sm text-gray-500">Latest screening outcome</p><p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{humanize(application.ai_decision)}</p></div>}{application.events.length ? <ol className="space-y-0">{[...application.events].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map((event, index) => <li key={event.uid} className="relative flex gap-4 pb-6 last:pb-0"><div className="relative flex w-5 shrink-0 justify-center"><div className={`z-10 mt-1 h-3 w-3 rounded-full ${index === 0 ? "bg-blue-600 ring-4 ring-blue-50 dark:ring-blue-950" : "bg-gray-300 dark:bg-gray-600"}`} />{index < application.events.length - 1 && <span className="absolute bottom-0 left-1/2 top-4 w-px bg-gray-200 dark:bg-gray-700" />}</div><div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{event.status_label || humanize(event.status)}</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{event.message}</p><p className="mt-1 text-sm text-gray-400">{dateLabel(event.created_at)}</p></div></li>)}</ol> : <p className="py-5 text-sm text-gray-500">Your application timeline will appear here.</p>}</div>}
      {tab === "calls" && <div className="space-y-4 py-2">{!application.attempts.length && <div className="py-8 text-center"><PhoneCall className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p className="font-medium text-gray-800 dark:text-gray-200">No calls yet</p><p className="mt-1 text-sm text-gray-500">Start a test call to see its outcome and transcript.</p></div>}{application.attempts.map((attempt, index) => { const messages = transcriptMessages(attempt.conversation_json); return <article key={attempt.uid} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Call attempt {application.attempts.length - index}</h3><p className="mt-1 text-sm text-gray-500">{dateLabel(attempt.created_at)}</p></div><div className="text-right"><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{humanize(attempt.state)}</p><p className="mt-1 text-sm text-gray-500">{attempt.ai_decision ? humanize(attempt.ai_decision) : "Awaiting result"}{attempt.call_duration ? ` · ${attempt.call_duration}` : ""}</p></div></div>{attempt.error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{attempt.error}</p>}{messages.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-blue-600 dark:text-blue-400">View conversation transcript</summary><div className="mt-3 max-h-80 space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-900">{messages.map((message, item) => <div key={item}><p className="text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">{humanize(message.role)}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-300">{message.text}</p></div>)}</div></details>}</article>; })}</div>}
      {tab === "documents" && <div className="space-y-5 py-2">{canUpload ? <><div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-blue-800 dark:text-blue-200">Use a personal upload link to test without signing in as a candidate.</p><button type="button" className={secondaryButton} disabled={linkBusy} onClick={getLink}><Saving busy={linkBusy}>{uploadLink ? "Refresh upload link" : "Get upload link"}</Saving></button></div>{uploadLink && <div className="mt-3 flex gap-2"><label htmlFor="test-upload-link" className="sr-only">Personal upload link</label><input id="test-upload-link" className={inputClass} readOnly value={uploadLink} onFocus={(e) => e.target.select()} /><button type="button" className={secondaryButton} aria-label="Copy upload link" onClick={copyLink}><Copy className="h-4 w-4" /></button></div>}</div><form onSubmit={upload} className="space-y-3 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-700"><h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><Upload className="h-4 w-4" />Upload a test document</h3><Field label="Document" htmlFor="test-document-file" hint="PDF, Word, JPG, or PNG. Maximum 10 MB."><input id="test-document-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm`} required disabled={busy} onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field><Field label="Document label (optional)" htmlFor="test-document-label"><input id="test-document-label" className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="e.g. Test CV" /></Field><button type="submit" className={primaryButton} disabled={busy || !file}><Saving busy={busy}>Upload document</Saving></button></form></> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">Document upload becomes available after a successful screening with document requests enabled.</p>}
      <div className="space-y-2">{application.documents.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No documents uploaded yet.</p>}{application.documents.map((document) => <div key={document.uid} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><FileText className="h-5 w-5 shrink-0 text-blue-600" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{document.label || document.name}</p><p className="truncate text-sm text-gray-500">{document.label ? `${document.name} · ` : ""}{dateLabel(document.created_at)}</p></div><button type="button" className={secondaryButton} aria-label={`Download ${document.name}`} onClick={() => download(document)}><Download className="h-4 w-4" /></button></div>)}</div></div>}
    </div>
  </DialogContent></Dialog>;
}
