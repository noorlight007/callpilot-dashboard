'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, Database, ExternalLink, Info, Loader2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { JigsawApiError, jigsaw } from '@/services/jigsaw-service';

interface Choice { id: number; name: string; email?: string; }
interface Member { id: number; name: string; email: string; }
interface Workflow { key: string; label: string; status_name: string; resource: 'candidates' | 'contacts'; }
interface Mappings {
  status_ids: Record<string, number>;
  consultant_ids: Record<string, number>;
  draft_job_status_id: number | null;
}
interface Configuration {
  connected: boolean;
  can_manage: boolean;
  mappings: Mappings;
  workflows: Workflow[];
  members: Member[];
}
type Catalog = 'candidate_statuses' | 'contact_statuses' | 'job_statuses' | 'consultants';
interface Lookups {
  candidate_statuses: Choice[];
  contact_statuses: Choice[];
  job_statuses: Choice[];
  consultants: Choice[];
  errors: Partial<Record<Catalog, string>>;
}
interface Draft {
  statuses: Record<string, string>;
  consultants: Record<string, string>;
  draftStatus: string;
}
const CATALOG_NAMES: Record<Catalog, string> = {
  candidate_statuses: 'Candidate statuses',
  contact_statuses: 'Client contact statuses',
  job_statuses: 'Job statuses',
  consultants: 'JobAdder consultants',
};
const EMPTY_DRAFT: Draft = { statuses: {}, consultants: {}, draftStatus: '' };
const text = (value?: number | null) => value == null ? '' : String(value);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to load these settings. Please try again.';
const statusCatalog = (workflow: Workflow): Catalog => workflow.resource === 'candidates' ? 'candidate_statuses' : 'contact_statuses';

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`jigsaw-notice${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}><Info size={16} /><div>{children}</div></div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="jigsaw-field" style={{ minWidth: 0 }}>{label}{children}{hint && <small>{hint}</small>}</label>;
}
function Destination({ label, value, saved, choices, verified, disabled, onChange, emptyLabel, hint }: {
  label: string; value: string; saved: string; choices: Choice[]; verified: boolean; disabled: boolean;
  onChange: (value: string) => void; emptyLabel: string; hint?: string;
}) {
  const missing = !!value && !choices.some((choice) => String(choice.id) === value);
  return <Field label={label} hint={hint}>
    <select className="jigsaw-input" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {missing && <option value={value}>{value === saved ? 'Saved choice' : 'Selected choice'} · {verified ? 'not available in JobAdder' : 'load choices to verify'} ({value})</option>}
      {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}{choice.email ? ` · ${choice.email}` : ''}</option>)}
    </select>
    {missing && verified && <small>The saved selection is unavailable. Choose a current option or clear this mapping.</small>}
  </Field>;
}

export function JobAdderMappingSettings() {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [failure, setFailure] = useState('');
  const [lookupFailure, setLookupFailure] = useState('');
  const [feedback, setFeedback] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [draftConfirmed, setDraftConfirmed] = useState(false);

  const applyConfig = useCallback((value: Configuration) => {
    setConfig(value);
    setDraft({
      statuses: Object.fromEntries(Object.entries(value.mappings.status_ids).map(([key, id]) => [key, text(id)])),
      consultants: Object.fromEntries(Object.entries(value.mappings.consultant_ids).map(([key, id]) => [key, text(id)])),
      draftStatus: text(value.mappings.draft_job_status_id),
    });
    setDraftConfirmed(false);
  }, []);
  const loadConfig = useCallback(async () => {
    setLoading(true); setFailure(''); setAccessDenied(false);
    try { applyConfig(await jigsaw<Configuration>('jobadder/mappings/')); }
    catch (error) { if (error instanceof JigsawApiError && error.status === 403) setAccessDenied(true); else setFailure(errorMessage(error)); }
    finally { setLoading(false); }
  }, [applyConfig]);
  useEffect(() => {
    let active = true;
    jigsaw<Configuration>('jobadder/mappings/').then((value) => { if (active) applyConfig(value); })
      .catch((error) => { if (active) { if (error instanceof JigsawApiError && error.status === 403) setAccessDenied(true); else setFailure(errorMessage(error)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyConfig]);

  const loadChoices = async () => {
    setBusy('load'); setLookupFailure(''); setFeedback('');
    try { setLookups(await jigsaw<Lookups>('jobadder/lookups/')); }
    catch (error) { setLookupFailure(errorMessage(error)); setLookups(null); }
    finally { setBusy(''); }
  };
  const choices = (catalog: Catalog) => lookups && !lookups.errors[catalog] ? lookups[catalog] : [];
  const verified = (catalog: Catalog) => !!lookups && !lookups.errors[catalog];
  const update = (category: 'statuses' | 'consultants', key: string, value: string) => {
    setDraft((current) => ({ ...current, [category]: { ...current[category], [key]: value } }));
    setFeedback(''); setFailure('');
  };
  const changedStatuses: Record<string, number | null> = {};
  const changedConsultants: Record<string, number | null> = {};
  let invalidSelection = false;
  for (const workflow of config?.workflows || []) {
    const value = draft.statuses[workflow.status_name] || '';
    if (value !== text(config?.mappings.status_ids[workflow.status_name])) {
      changedStatuses[workflow.status_name] = value ? Number(value) : null;
      if (value && !choices(statusCatalog(workflow)).some((choice) => String(choice.id) === value)) invalidSelection = true;
    }
  }
  for (const member of config?.members || []) {
    const value = draft.consultants[String(member.id)] || '';
    if (value !== text(config?.mappings.consultant_ids[String(member.id)])) {
      changedConsultants[String(member.id)] = value ? Number(value) : null;
      if (value && !choices('consultants').some((choice) => String(choice.id) === value)) invalidSelection = true;
    }
  }
  const draftChanged = !!config && draft.draftStatus !== text(config.mappings.draft_job_status_id);
  const needsDraftConfirmation = draftChanged && !!draft.draftStatus;
  if (needsDraftConfirmation && !choices('job_statuses').some((choice) => String(choice.id) === draft.draftStatus)) invalidSelection = true;
  const dirty = !!Object.keys(changedStatuses).length || !!Object.keys(changedConsultants).length || draftChanged;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!config?.can_manage || !dirty || invalidSelection || (needsDraftConfirmation && !draftConfirmed)) return;
    setBusy('save'); setFailure(''); setFeedback('');
    const payload = {
      ...(Object.keys(changedStatuses).length ? { status_ids: changedStatuses } : {}),
      ...(Object.keys(changedConsultants).length ? { consultant_ids: changedConsultants } : {}),
      ...(draftChanged ? { draft_job_status_id: draft.draftStatus ? Number(draft.draftStatus) : null } : {}),
      ...(needsDraftConfirmation ? { draft_status_confirmed: true } : {}),
    };
    try { applyConfig(await jigsaw<Configuration>('jobadder/mappings/', 'PATCH', payload)); setFeedback('JobAdder mappings saved for your agency.'); }
    catch (error) { setFailure(errorMessage(error)); }
    finally { setBusy(''); }
  };

  return <section className="jigsaw-card" id="jobadder-mappings">
    <div className="jigsaw-card-header" style={{ flexWrap: 'wrap' }}><div><h2>JobAdder workflow settings</h2><p>Choose the statuses and consultant assignments your agency uses.</p></div>{config?.can_manage && config.connected && <button className="jigsaw-btn" disabled={!!busy || loading} onClick={loadChoices}>{busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Load JobAdder choices</button>}</div>
    <div className="jigsaw-card-pad jigsaw-form">
      {loading ? <div className="jigsaw-inline" role="status"><span className="jigsaw-spinner" />Loading JobAdder settings…</div> : accessDenied || (config && !config.can_manage) ? <Notice>An agency owner or administrator can manage these JobAdder settings.</Notice> : !config ? <><Notice error>{failure || 'Unable to load JobAdder settings.'}</Notice><div><button className="jigsaw-btn" onClick={loadConfig}><RefreshCw size={14} /> Try again</button></div></> : !config.connected ? <><Notice>Connect your agency’s JobAdder account before choosing workflow settings.</Notice><div><Link href="/dashboard/connect-ats" className="jigsaw-btn jigsaw-btn-primary">Connect JobAdder <ExternalLink size={14} /></Link></div></> : <>
        <Notice>Load the choices from your connected JobAdder account, then select the destinations you want. Map only the workflows you use; actions without a mapping wait for setup.</Notice>
        {lookupFailure && <Notice error>{lookupFailure}</Notice>}
        {lookups && Object.entries(lookups.errors).map(([catalog, message]) => <Notice key={catalog} error><strong>{CATALOG_NAMES[catalog as Catalog] || catalog}:</strong> {message} Other available choices can still be saved.</Notice>)}
        <form className="jigsaw-form" onSubmit={save}>
          <div className="jigsaw-form"><div className="jigsaw-inline"><span className="jigsaw-icon"><Database size={17} /></span><div><h3>Workflow statuses</h3><p className="jigsaw-small">Select the JobAdder status for each step. Your workflow names remain the same.</p></div></div>
            <div className="jigsaw-form-grid">{config.workflows.map((workflow) => <Destination key={workflow.key} label={`${workflow.label} JobAdder status`} value={draft.statuses[workflow.status_name] || ''} saved={text(config.mappings.status_ids[workflow.status_name])} choices={choices(statusCatalog(workflow))} verified={verified(statusCatalog(workflow))} disabled={!!busy} emptyLabel="Leave this step unmapped" hint={`${workflow.resource === 'candidates' ? 'Candidate' : 'Client contact'} record · Workflow: ${workflow.status_name}`} onChange={(value) => update('statuses', workflow.status_name, value)} />)}</div>
          </div>
          <hr className="jigsaw-divider" />
          <div className="jigsaw-form"><div className="jigsaw-inline"><span className="jigsaw-icon"><Users size={17} /></span><div><h3>Consultant assignments</h3><p className="jigsaw-small">Match each CallPilot consultant to the person who should receive their JobAdder callback tasks.</p></div></div>
            {config.members.length ? <div className="jigsaw-form-grid">{config.members.map((member) => <Destination key={member.id} label={`JobAdder consultant for ${member.name || member.email}`} value={draft.consultants[String(member.id)] || ''} saved={text(config.mappings.consultant_ids[String(member.id)])} choices={choices('consultants')} verified={verified('consultants')} disabled={!!busy} emptyLabel="No JobAdder consultant selected" hint={member.email} onChange={(value) => update('consultants', String(member.id), value)} />)}</div> : <p className="jigsaw-small">No active CallPilot consultants are available to map.</p>}
          </div>
          <hr className="jigsaw-divider" />
          <div className="jigsaw-form"><div className="jigsaw-inline"><span className="jigsaw-icon"><ShieldCheck size={17} /></span><div><h3>Client order drafts</h3><p className="jigsaw-small">Select the job status your agency uses for unpublished drafts awaiting consultant review.</p></div></div>
            <Destination label="New order draft status" value={draft.draftStatus} saved={text(config.mappings.draft_job_status_id)} choices={choices('job_statuses')} verified={verified('job_statuses')} disabled={!!busy} emptyLabel="Do not create order drafts" hint="Your JobAdder administrator should confirm this status keeps new orders unpublished." onChange={(value) => { setDraft((current) => ({ ...current, draftStatus: value })); setDraftConfirmed(false); setFeedback(''); setFailure(''); }} />
            {needsDraftConfirmation && <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draftConfirmed} disabled={!!busy} onChange={(event) => setDraftConfirmed(event.target.checked)} /> I confirm this JobAdder status is for unpublished drafts that require consultant review.</label>}
          </div>
          {invalidSelection && <Notice error>Load the current JobAdder choices and choose an available option for each changed setting before saving.</Notice>}
          {failure && <Notice error>{failure}</Notice>}{feedback && <Notice>{feedback}</Notice>}
          <div className="jigsaw-inline"><button className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy || !dirty || invalidSelection || (needsDraftConfirmation && !draftConfirmed)}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save JobAdder mappings</button><span className="jigsaw-small">{dirty ? 'You have unsaved changes.' : 'Changes are saved only when you choose Save.'}</span></div>
        </form>
      </>}
    </div>
  </section>;
}
