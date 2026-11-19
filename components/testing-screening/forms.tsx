"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { screeningError, screeningTestService, type TestJob, type TestApplication } from "@/services/screening-test-service";
import { Field, inputClass, Message, NativeSelect, primaryButton, Saving, secondaryButton } from "./shared";

export function JobDialog({ job, onClose, onSaved }: { job?: TestJob; onClose: () => void; onSaved: (job: TestJob) => void }) {
  const [title, setTitle] = useState(job?.title || "");
  const [description, setDescription] = useState(job?.description || "");
  const [location, setLocation] = useState(job?.location || "");
  const [salary, setSalary] = useState(job?.salary || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = { title: title.trim(), description: description.trim(), location: location.trim(), salary: salary.trim() };
      const saved = job ? await screeningTestService.updateJob(job.uid, data) : await screeningTestService.createJob(data);
      onSaved(saved);
    } catch (error) { setError(screeningError(error)); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl"><DialogHeader><DialogTitle>{job ? "Edit test job" : "Create a test job"}</DialogTitle><DialogDescription>The AI uses this job description to prepare its screening questions.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      {error && <Message message={error} />}
      <Field label="Job title" htmlFor="test-job-title"><input id="test-job-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required autoFocus placeholder="e.g. Warehouse Operative" /></Field>
      <Field label="Job description" htmlFor="test-job-description" hint="Include responsibilities, experience, and essential requirements."><textarea id="test-job-description" className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={7} required placeholder="Describe the role you want to screen for…" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Location (optional)" htmlFor="test-job-location"><input id="test-job-location" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={255} placeholder="e.g. London" /></Field><Field label="Salary or pay (optional)" htmlFor="test-job-salary"><input id="test-job-salary" className={inputClass} value={salary} onChange={(e) => setSalary(e.target.value)} maxLength={255} placeholder="e.g. £14 per hour" /></Field></div>
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"><button type="button" className={secondaryButton} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primaryButton} disabled={busy || !title.trim() || !description.trim()}><Saving busy={busy}>{job ? "Save job" : "Create job"}</Saving></button></div>
    </form></DialogContent></Dialog>;
}

export function CandidateDialog({ jobs, jobUid, autoCalling, onClose, onSaved }: { jobs: TestJob[]; jobUid?: string; autoCalling: boolean; onClose: () => void; onSaved: (application: TestApplication) => void }) {
  const [selectedJob, setSelectedJob] = useState(jobUid || jobs.find((job) => job.is_active)?.uid || "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { onSaved(await screeningTestService.createApplication({ job_uid: selectedJob, first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), mobile: mobile.trim() })); }
    catch (error) { setError(screeningError(error)); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl"><DialogHeader><DialogTitle>Apply a test candidate</DialogTitle><DialogDescription>Use an email and mobile you can access. No candidate account or password is needed.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      {error && <Message message={error} />}
      <Field label="Test job" htmlFor="test-candidate-job"><NativeSelect id="test-candidate-job" className={inputClass} value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} required><option value="" disabled>Select a job</option>{jobs.filter((job) => job.is_active).map((job) => <option key={job.uid} value={job.uid}>{job.title}</option>)}</NativeSelect></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" htmlFor="test-candidate-first"><input id="test-candidate-first" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} autoComplete="given-name" required /></Field><Field label="Last name" htmlFor="test-candidate-last"><input id="test-candidate-last" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} autoComplete="family-name" required /></Field></div>
      <Field label="Email" htmlFor="test-candidate-email"><input id="test-candidate-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
      <Field label="Mobile number" htmlFor="test-candidate-mobile" hint="Include the country code, for example +447700900123."><input id="test-candidate-mobile" type="tel" className={inputClass} value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={32} autoComplete="tel" placeholder="+44…" required /></Field>
      <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">The application starts as Applied. {autoCalling ? "Automatic calling is enabled: the screening will be queued within your calling schedule." : "You can start the screening call from the candidate's details."}</p>
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"><button type="button" className={secondaryButton} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primaryButton} disabled={busy || !selectedJob}><Saving busy={busy}>Add application</Saving></button></div>
    </form></DialogContent></Dialog>;
}
