"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText, Loader2, ShieldCheck, Upload } from "lucide-react";
import { screeningError, screeningTestService, type PublicTestUpload } from "@/services/screening-test-service";
import { dateLabel, Field, inputClass, Message, primaryButton, Saving } from "@/components/testing-screening/shared";

export default function TestingDocumentUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [details, setDetails] = useState<PublicTestUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let alive = true;
    void screeningTestService.publicUploadDetails(token).then((result) => { if (alive) setDetails(result); }).catch((error) => { if (alive) setError(screeningError(error)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!file) return;
    const form = event.currentTarget; setBusy(true); setError(""); setSuccess("");
    try { await screeningTestService.publicUpload(token, file, label.trim()); setFile(null); setLabel(""); form.reset(); setDetails(await screeningTestService.publicUploadDetails(token)); setSuccess("Your document has been received. The test application status has been updated to Documents Received."); }
    catch (error) { setError(screeningError(error)); } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950 sm:py-14"><div className="mx-auto max-w-xl"><div className="mb-7 flex justify-center"><img src="/callpilot_logo.png" alt="CallPilot" className="h-12 w-auto" /></div><section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
    {loading ? <div className="flex items-center justify-center gap-3 py-14 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" />Loading your upload link…</div> : <><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950"><Upload className="h-6 w-6" /></div><p className="text-sm font-semibold text-blue-600 dark:text-blue-400">CallPilot screening test</p><h1 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">Upload your test documents</h1>{details && <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">Hi {details.candidate_name}, add your test documents for <span className="font-medium text-gray-800 dark:text-gray-200">{details.job_title}</span>.</p>}
    <div className="mt-5 space-y-4">{error && <Message message={error} />}{success && <Message message={success} success />}{!details && <p className="text-sm text-gray-500">This link may have expired or may no longer be available. Ask your CallPilot contact for a new upload link.</p>}
    {details?.upload_allowed && <form onSubmit={upload} className="space-y-4"><Field label="Select a document" htmlFor="public-test-document" hint="PDF, Word, JPG, or PNG. Maximum 10 MB."><input id="public-test-document" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm`} required disabled={busy} onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field><Field label="Document label (optional)" htmlFor="public-test-label"><input id="public-test-label" className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="e.g. Test CV" disabled={busy} /></Field><button type="submit" className={`${primaryButton} w-full`} disabled={busy || !file}><Saving busy={busy}><Upload className="h-4 w-4" />Upload document</Saving></button></form>}
    {details && !details.upload_allowed && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">Uploads are not currently available for this application. Please contact the person who shared this link.</p>}
    {!!details?.documents.length && <div className="space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800"><h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Received documents</h2>{details.documents.map((document) => <div key={document.uid} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{document.label || document.name}</p><p className="mt-1 text-sm text-gray-500">{dateLabel(document.created_at)}</p></div></div>)}</div>}</div></>}
    </section><p className="mt-5 flex items-center justify-center gap-2 text-center text-sm text-gray-400"><ShieldCheck className="h-4 w-4" />Personal upload link · No account needed</p></div></main>;
}
