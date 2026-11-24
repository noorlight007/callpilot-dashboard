'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Info, Loader2, Mail, Paperclip, RefreshCw, Search } from 'lucide-react';
import { jigsaw, results, type JsonRecord } from '@/services/jigsaw-service';
import { RecordContactSelector } from './record-contact-selector';

const BASE = 'integrations/microsoft365/';
const ROOT = '/dashboard/ai-jigsaw';
const PAGE_SIZE = 30;
const COLORS: Record<string, string> = { green: 'Completed', amber: 'Check needed', red: 'Failed / attention needed', blue: 'Queued / information' };
const STATUSES = ['queued', 'processing', 'completed', 'needs_review', 'needs_match', 'waiting_media', 'failed', 'observed'];
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this request.';
const dateText = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not available';
const title = (value: unknown) => String(value || '').replace(/_/g, ' ').replace(/\bagencies\b/gi, 'businesses').replace(/\bagency\b/gi, 'business').replace(/\b\w/g, letter => letter.toUpperCase());
export function workflowReviewMessage(item: JsonRecord): string {
  return item.content_review_required === true
    ? 'Check the attachment content. One or more files could not be classified confidently; the affected files are held for a document check.'
    : 'Check the provider result before continuing. An uncertain send is not retried automatically.';
}
const safeLink = (value: unknown) => { try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

export function emailList(value: string): string[] {
  return [...new Set(value.split(/[\s,;]+/).map(item => item.trim().toLowerCase()).filter(Boolean))];
}
function localDateTime(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function workflowDraft(config: JsonRecord): JsonRecord {
  return {
    mailboxes: Array.isArray(config.mailboxes) ? config.mailboxes : [], sync_enabled: !!config.sync_enabled,
    start_from: localDateTime(config.start_from), internal_domains: (config.internal_domains || []).join('\n'),
    notify_from: config.notify_from || '', timesheets_to: config.timesheets_to || '', orders_notify_to: config.orders_notify_to || '',
    forward_timesheets: !!config.forward_timesheets, process_documents: !!config.process_documents, notify_orders: !!config.notify_orders,
    create_new_clients: !!config.create_new_clients, webhooks_enabled: !!config.webhooks_enabled,
    record_communications: !!config.record_communications, notifications_paused: !!config.notifications_paused,
  };
}
export function workflowPayload(draft: JsonRecord): JsonRecord {
  const payload: JsonRecord = {
    mailboxes: [...new Set((draft.mailboxes as string[]).map(email => email.toLowerCase()))], sync_enabled: !!draft.sync_enabled,
    internal_domains: emailList(String(draft.internal_domains || '')), notify_from: String(draft.notify_from || '').trim().toLowerCase(),
    timesheets_to: String(draft.timesheets_to || '').trim().toLowerCase(), orders_notify_to: String(draft.orders_notify_to || '').trim().toLowerCase(),
    forward_timesheets: !!draft.forward_timesheets, process_documents: !!draft.process_documents, notify_orders: !!draft.notify_orders,
    create_new_clients: !!draft.create_new_clients, webhooks_enabled: !!draft.webhooks_enabled,
    record_communications: !!draft.record_communications, notifications_paused: !!draft.notifications_paused,
  };
  if (draft.start_from) {
    const value = new Date(draft.start_from);
    if (!Number.isFinite(value.getTime())) throw new Error('Choose a valid go-live date and time.');
    payload.start_from = value.toISOString();
  }
  if ((payload.forward_timesheets || payload.notify_orders) && !payload.mailboxes.includes(payload.notify_from)) throw new Error('Choose a sending mailbox from the selected staff mailboxes.');
  if (payload.forward_timesheets && !payload.timesheets_to) throw new Error('Enter the payroll recipient for hours and timesheets.');
  if (payload.notify_orders && !payload.orders_notify_to) throw new Error('Enter the recipient for client orders and enquiries.');
  return payload;
}
function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="jigsaw-card"><div className="jigsaw-card-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div><div className="jigsaw-card-pad">{children}</div></section>;
}
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`jigsaw-notice${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}><Info size={16} /><div>{children}</div></div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="jigsaw-field" style={{ minWidth: 0 }}>{label}{children}{hint && <small>{hint}</small>}</label>;
}
function Loading() { return <p className="jigsaw-inline" role="status"><Loader2 size={16} className="animate-spin" />Loading Microsoft 365 settings…</p>; }

export function Microsoft365Workflows() {
  const [status, setStatus] = useState<JsonRecord | null>(null), [draft, setDraft] = useState<JsonRecord | null>(null), [mailboxes, setMailboxes] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [failure, setFailure] = useState(''), [mailboxFailure, setMailboxFailure] = useState(''), [feedback, setFeedback] = useState(''), [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setFailure('');
    try {
      const health = await jigsaw<JsonRecord>(`${BASE}status/`);
      setStatus(health);
      if (health.can_manage === false) return;
      const connection = await jigsaw<JsonRecord>('integrations/connections/microsoft365/');
      setDraft(workflowDraft(connection.config || {}));
      try { const catalog = await jigsaw<JsonRecord>('integrations/mailboxes/'); setMailboxes(results(catalog)); setMailboxFailure(''); }
      catch (error) { setMailboxFailure(errorText(error)); }
    } catch (error) { setFailure(errorText(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; if (active) void load(); return () => { active = false; }; }, [load]);
  const update = (key: string, value: unknown) => setDraft(previous => previous ? { ...previous, [key]: value } : previous);
  const selected: string[] = draft?.mailboxes || [];
  const choices = [...new Set([...mailboxes.map(row => row.email), ...selected])].sort();
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!draft) return; setBusy('save'); setFailure(''); setFeedback('');
    try { const updated = await jigsaw<JsonRecord>('integrations/connections/microsoft365/', 'PATCH', { config: workflowPayload(draft) }); setDraft(workflowDraft(updated.config || {})); setFeedback('Microsoft 365 workflow settings saved. Review observed cases before enabling Live automations.'); setStatus(await jigsaw(`${BASE}status/`)); }
    catch (error) { setFailure(errorText(error)); } finally { setBusy(''); }
  };
  const pauseNotifications = async (paused: boolean) => {
    setBusy('notifications'); setFailure(''); setFeedback('');
    try { const updated = await jigsaw<JsonRecord>('integrations/connections/microsoft365/', 'PATCH', { config: { notifications_paused: paused } }); setDraft(previous => previous ? { ...previous, notifications_paused: !!updated.config?.notifications_paused } : previous); setStatus(await jigsaw(`${BASE}status/`)); setFeedback(paused ? 'Client enquiry emails paused. Mail import, document filing and payroll routing continue.' : 'Client enquiry emails resumed with duplicate and relevance checks.'); } catch (error) { setFailure(errorText(error)); } finally { setBusy(''); }
  };
  const sync = async () => {
    setBusy('sync'); setFailure(''); setFeedback('');
    try { const response = await jigsaw<JsonRecord>(`${BASE}sync/`, 'POST', {}); setFeedback(response.detail || 'Mailbox catch-up queued. Refresh activity to see background progress.'); setRevision(value => value + 1); setStatus(await jigsaw(`${BASE}status/`)); }
    catch (error) { setFailure(errorText(error)); } finally { setBusy(''); }
  };
  return <div className="jigsaw-stack jigsaw-m365">
    <Panel title="Email workflow status" subtitle="Mail events, catch-up and automatic actions use the existing CallPilot background workers." action={<button type="button" className="jigsaw-btn" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={14} />Refresh</button>}>
      {loading ? <Loading /> : failure && !status ? <Notice error>{failure}</Notice> : status && <div className="jigsaw-form">
        <div className="jigsaw-inline"><span className={`jigsaw-badge ${status.enabled ? 'green' : 'amber'}`}>{status.enabled ? 'Connection enabled' : 'Connection disabled'}</span><span className="jigsaw-badge">{status.mode === 'live' ? 'Live automations' : 'Alerts only / observation'}</span><span className="jigsaw-small">Last catch-up: {dateText(status.last_sync_at)}</span></div>
        {status.last_error_code && <Notice error>Microsoft 365 needs attention: {title(status.last_error_code)}. Check access and the activity below.</Notice>}
        {status.can_manage === false ? <Notice>A business owner or administrator configures mailbox access and these workflows.</Notice> : <>
          <Notice><strong>Genuine New Business Only</strong><p>One concise notification per new client enquiry, order or booking. Routine correspondence, supplier insurance and general administration do not create notification emails. Replies and forwards of the same opportunity are grouped; a genuinely separate new requirement in an existing chain can create its own summary. Uncertain requests remain in the dashboard for review.</p></Notice>
          <div className="jigsaw-inline"><span className={`jigsaw-badge ${status.notification_policy?.paused || draft?.notifications_paused ? 'amber' : draft?.notify_orders ? 'green' : 'gray'}`}>{status.notification_policy?.paused || draft?.notifications_paused ? 'Client Notifications Paused' : !draft?.notify_orders ? 'Client Notifications Disabled' : 'Client Notifications Enabled'}</span><button type="button" className="jigsaw-btn" disabled={!!busy || !draft?.notify_orders} onClick={() => pauseNotifications(!(status.notification_policy?.paused || draft?.notifications_paused))}>{status.notification_policy?.paused || draft?.notifications_paused ? 'Resume Client Notifications' : 'Pause Client Notifications'}</button></div>
          {status.notification_policy && <p className="jigsaw-small">{status.notification_policy.sent || 0} Sent · {status.notification_policy.held || 0} Held For Review · {status.notification_policy.suppressed || 0} Suppressed Or Duplicate</p>}
          <div className="jigsaw-inline">{STATUSES.filter(key => typeof status.queue?.[key] === 'number').map(key => <span className="jigsaw-small" key={key}><strong>{status.queue[key]}</strong> {title(key)}</span>)}</div>
          {Array.isArray(status.subscriptions) && <div className="jigsaw-table-wrap"><table className="jigsaw-table"><thead><tr><th>Mailbox webhook</th><th>Status</th><th>Expires</th></tr></thead><tbody>{status.subscriptions.length ? status.subscriptions.map((item: JsonRecord) => <tr key={item.mailbox}><td>{item.mailbox}</td><td>{title(item.status)}{item.error_code && <span className="block jigsaw-small">{title(item.error_code)}</span>}</td><td>{dateText(item.expires_at)}</td></tr>) : <tr><td colSpan={3}>No active webhook details returned. Enable webhooks after saving the approved mailbox selection.</td></tr>}</tbody></table></div>}
          {(status.notification_url || status.lifecycle_url) && <details className="jigsaw-small"><summary>Microsoft callback addresses</summary>{[['Message notifications', status.notification_url], ['Lifecycle notifications', status.lifecycle_url]].map(([label, value]) => value && <p key={label} style={{ overflowWrap: 'anywhere' }}><strong>{label}:</strong> {value}</p>)}</details>}
          <div><button type="button" className="jigsaw-btn" disabled={!!busy || !status.enabled || !status.sync_enabled} onClick={sync}>{busy === 'sync' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Queue mailbox catch-up</button></div>
        </>}
      </div>}
      {feedback && <div className="mt-3"><Notice>{feedback}</Notice></div>}{failure && status && <div className="mt-3"><Notice error>{failure}</Notice></div>}
    </Panel>
    {!loading && status?.can_manage !== false && draft && <Panel title="Staff mailboxes and automatic routing" subtitle="Save these settings before queuing catch-up. Changes do not send a test email or start a call.">
      <form className="jigsaw-form" onSubmit={save}>
        {mailboxFailure && <Notice error>{mailboxFailure} Reconnect Microsoft 365 or correct directory permissions, then refresh. Existing selected addresses are preserved.</Notice>}
        <div><h3>Choose the mailboxes CallPilot may import</h3><p className="jigsaw-small">Your Microsoft administrator must also restrict application permissions to these mailboxes.</p><div className="jigsaw-form-grid mt-3">{choices.length ? choices.map(email => <label key={email} className="jigsaw-inline jigsaw-small" style={{ overflowWrap: 'anywhere' }}><input type="checkbox" checked={selected.includes(email)} disabled={!!busy} onChange={event => update('mailboxes', event.target.checked ? [...selected, email] : selected.filter(value => value !== email))} />{email}</label>) : <p className="jigsaw-small">No staff mailbox choices are available yet. Connect Microsoft 365 and refresh.</p>}</div></div>
        <div className="jigsaw-form-grid"><Field label="Start processing from" hint="Your browser's local date/time. Earlier emails are skipped; choose the agreed go-live time."><input className="jigsaw-input" type="datetime-local" value={draft.start_from} onChange={event => update('start_from', event.target.value)} disabled={!!busy} /></Field><Field label="Internal email domains" hint="One domain per line, without @. Staff-to-staff messages from these domains are ignored."><textarea className="jigsaw-input" rows={3} value={draft.internal_domains} placeholder={'yourcompany.co.uk\nrd1.co.uk'} disabled={!!busy} onChange={event => update('internal_domains', event.target.value)} /></Field></div>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.sync_enabled} disabled={!!busy} onChange={event => update('sync_enabled', event.target.checked)} />Enable scheduled mailbox catch-up</label>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.webhooks_enabled} disabled={!!busy} onChange={event => update('webhooks_enabled', event.target.checked)} />Use Microsoft webhooks for new mail, with renewal and catch-up recovery</label>
        <div className="jigsaw-form-grid"><Field label="Sending staff mailbox" hint="Used to send payroll text summaries and order/enquiry notifications. It must be one of your selected mailboxes, with scoped Mail.Send access."><select className="jigsaw-input" value={draft.notify_from} disabled={!!busy} onChange={event => update('notify_from', event.target.value)}><option value="">Choose a selected sending mailbox…</option>{draft.notify_from && !selected.includes(draft.notify_from) && <option value={draft.notify_from}>Saved address: {draft.notify_from} · select its mailbox above</option>}{selected.map(email => <option key={email} value={email}>{email}</option>)}</select></Field><Field label="Payroll recipient" hint="Timesheets from Email, WhatsApp and SMS use one layout: candidate name from JobAdder, client and week ending from confirmed placements/timesheet periods, hours, source and sender details. Missing client/week values stay empty."><input className="jigsaw-input" type="email" value={draft.timesheets_to} placeholder="debbie@rd1.co.uk" disabled={!!busy} onChange={event => update('timesheets_to', event.target.value)} /></Field><Field label="Client order and enquiry recipient" hint="One summary per genuine new enquiry, order or booking. Uncertain requests stay in the dashboard; routine correspondence is excluded."><input className="jigsaw-input" type="email" value={draft.orders_notify_to} placeholder="steven@rd1.co.uk" disabled={!!busy} onChange={event => update('orders_notify_to', event.target.value)} /></Field></div>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.forward_timesheets} disabled={!!busy} onChange={event => update('forward_timesheets', event.target.checked)} />Forward worker hours and timesheets to payroll</label>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.process_documents} disabled={!!busy} onChange={event => update('process_documents', event.target.checked)} />Save email documents to JobAdder and run candidate name/date checks</label>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.notify_orders} disabled={!!busy} onChange={event => update('notify_orders', event.target.checked)} />Notify staff about genuine new client orders, enquiries and bookings</label>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.record_communications} disabled={!!busy} onChange={event => update('record_communications', event.target.checked)} />Save relevant candidate and client communications to their JobAdder records</label>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.create_new_clients} disabled={!!busy} onChange={event => update('create_new_clients', event.target.checked)} />Create a new JobAdder company/contact for an unmatched client order or enquiry</label>
        <Notice>Keep Alerts only selected while checking real cases. Live actions use these recipients and the existing ATS/WhatsApp connections. Missing, unreadable, expired or mismatched documents need review; AI checks do not verify identity or right to work. Generated KID/TOE delivery keeps its existing payment-choice and timing rules.</Notice>
        <Notice>Candidate files are uploaded directly to the matched JobAdder candidate’s Documents section. Printed expiry dates are saved on the document automatically when readable.</Notice>
        <div><button type="submit" className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Save mailbox workflows</button></div>
      </form>
    </Panel>}
    {!loading && status?.can_manage !== false && status && <><Microsoft365Activity revision={revision} /><Microsoft365EmailInbox revision={revision} /></>}
  </div>;
}

export function Microsoft365Activity({ revision = 0 }: { revision?: number }) {
  const [level, setLevel] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState(''), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [offset, setOffset] = useState(0), [reload, setReload] = useState(0);
  const [data, setData] = useState<JsonRecord>({ results: [] }), [loading, setLoading] = useState(true), [failure, setFailure] = useState(''), [retrying, setRetrying] = useState(''), [feedback, setFeedback] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    let active = true; setLoading(true); setFailure('');
    const params = new URLSearchParams({ level, category, status, q: search, limit: String(PAGE_SIZE), offset: String(offset) });
    jigsaw<JsonRecord>(`${BASE}activity/?${params}`).then(value => { if (active) setData(value); }).catch(error => { if (active) setFailure(errorText(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [level, category, status, search, offset, reload, revision]);
  const retry = async (item: JsonRecord) => { if (!item.retryable || !item.run_uid) return; setRetrying(item.run_uid); setFailure(''); setFeedback(''); try { const result = await jigsaw<JsonRecord>(`${BASE}retry/${encodeURIComponent(item.run_uid)}/`, 'POST', {}); setFeedback(result.detail || 'Safe failed steps queued again. Completed steps are preserved.'); setReload(value => value + 1); } catch (error) { setFailure(errorText(error)); } finally { setRetrying(''); } };
  return <Panel title="Email activity" subtitle="Actual processing outcomes across email, WhatsApp and SMS. Completed steps are not repeated." action={<button type="button" className="jigsaw-btn" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />Refresh activity</button>}>
    <div className="jigsaw-form"><div className="jigsaw-form-grid"><Field label="Activity color"><select className="jigsaw-input" value={level} onChange={event => { setLevel(event.target.value); setOffset(0); }}><option value="">All outcomes</option>{Object.entries(COLORS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Message category"><select className="jigsaw-input" value={category} onChange={event => { setCategory(event.target.value); setOffset(0); }}><option value="">All categories</option>{['hours_timesheet', 'client_order', 'client_enquiry', 'client_booking', 'candidate_communication', 'client_communication', 'business_document', 'other'].map(value => <option value={value} key={value}>{title(value)}</option>)}</select></Field><Field label="Processing state"><select className="jigsaw-input" value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}><option value="">All states</option>{STATUSES.map(value => <option value={value} key={value}>{title(value)}</option>)}</select></Field><Field label="Search activity"><span className="jigsaw-search"><Search size={14} /><input type="search" value={query} placeholder="Mailbox or message" onChange={event => { setQuery(event.target.value); setOffset(0); }} /></span></Field></div>
      {feedback && <Notice>{feedback}</Notice>}{failure ? <Notice error>{failure}</Notice> : loading ? <Loading /> : results<JsonRecord>(data).length ? results<JsonRecord>(data).map(item => <article className="jigsaw-activity" key={item.uid}><span className={`jigsaw-badge ${item.level === 'blue' ? '' : item.level}`}>{COLORS[item.level] || 'Activity'}</span><div className="flex-1 min-w-0"><strong className="jigsaw-activity-title">{item.message || 'Saved activity'}</strong><p className="jigsaw-small">{item.mailbox || 'Messaging'} · {title(item.category)} · {dateText(item.created_at)}</p>{item.error_code && <p className="jigsaw-small">{title(item.error_code)}</p>}{item.retryable === true && item.run_uid && <button type="button" className="jigsaw-btn mt-2" disabled={!!retrying} onClick={() => retry(item)}>{retrying === item.run_uid ? 'Queuing…' : 'Retry safe failed steps'}</button>}{item.run_status === 'needs_match' && item.run_uid && <RunRecordMatch item={item} onMatched={() => setReload(value => value + 1)} />}{item.run_status === 'needs_review' && <p className="jigsaw-small">{workflowReviewMessage(item)}</p>}</div></article>) : <p className="jigsaw-small">No activity matches these filters.</p>}
      <div className="jigsaw-inline justify-between"><span className="jigsaw-small">{typeof data.count === 'number' ? `${data.count} matching activities` : ''}</span><div className="jigsaw-inline"><button type="button" className="jigsaw-btn" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ArrowLeft size={14} />Previous</button><button type="button" className="jigsaw-btn" disabled={loading || data.next == null} onClick={() => setOffset(Number(data.next))}>Next<ArrowRight size={14} /></button></div></div>
    </div>
  </Panel>;
}

function Microsoft365EmailInbox({ revision = 0 }: { revision?: number }) {
  const [held, setHeld] = useState(false), [reload, setReload] = useState(0), [data, setData] = useState<JsonRecord>({ results: [] }), [loading, setLoading] = useState(true), [failure, setFailure] = useState('');
  const [offset, setOffset] = useState(0), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { let active = true; setLoading(true); setFailure('');
    const params = new URLSearchParams({ held: String(held), q: search, limit: String(PAGE_SIZE), offset: String(offset) });
    jigsaw<JsonRecord>(`integrations/emails/?${params}`).then(value => { if (active) setData(value); }).catch(error => { if (active) setFailure(errorText(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [held, reload, revision, offset, search]);
  return <Panel title="Imported email and document checks" subtitle="Read imported emails and document checks. Matching JobAdder records are updated automatically; multiple matches do not wait for selection." action={<div className="jigsaw-inline"><button type="button" className="jigsaw-btn" onClick={() => { setHeld(value => !value); setOffset(0); }}>{held ? 'Show all mail' : 'Held for matching'}</button><button type="button" className="jigsaw-btn" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />Refresh mail</button></div>}>
    <div className="jigsaw-form"><Field label="Search imported email"><input type="search" className="jigsaw-input" value={query} placeholder="Subject, sender or mailbox" onChange={event => { setQuery(event.target.value); setOffset(0); }} /></Field>
    {failure ? <Notice error>{failure}</Notice> : loading ? <Loading /> : results<JsonRecord>(data).length ? results<JsonRecord>(data).map(email => <ImportedEmail key={email.uid} email={email} onMatched={() => setReload(value => value + 1)} />) : <p className="jigsaw-small">No imported email matches this view. Select staff mailboxes, save scheduled sync and queue a catch-up.</p>}
    <div className="jigsaw-inline justify-between"><span className="jigsaw-small">{Number(data.count || 0)} emails</span><div className="jigsaw-inline"><button type="button" className="jigsaw-btn" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ArrowLeft size={14} />Previous</button><button type="button" className="jigsaw-btn" disabled={loading || data.next == null} onClick={() => setOffset(Number(data.next))}>Next<ArrowRight size={14} /></button></div></div></div>
  </Panel>;
}
export function ImportedEmail({ email, onMatched }: { email: JsonRecord; onMatched: () => void }) {
  const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const run = email.automation || {}, source = safeLink(email.web_link);
  const match = async () => { setBusy(true); setFailure(''); try { await jigsaw(`integrations/emails/${encodeURIComponent(email.uid)}/match/`, 'POST', { email_uid: email.uid, contact_uid: selected }); onMatched(); } catch (error) { setFailure(errorText(error)); } finally { setBusy(false); } };
  const reviewNotification = async (decision: string) => { if (!run.uid) return; setBusy(true); setFailure(''); try { await jigsaw(`${BASE}runs/${encodeURIComponent(run.uid)}/notification-review/`, 'POST', { decision }); onMatched(); } catch (error) { setFailure(errorText(error)); } finally { setBusy(false); } };
  const download = async (attachment: JsonRecord) => { setFailure(''); try { const blob = await jigsaw<Blob>(`integrations/email-attachments/${encodeURIComponent(attachment.uid)}/`); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = attachment.name || 'email-attachment'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (error) { setFailure(errorText(error)); } };
  return <article className="jigsaw-activity"><span className="jigsaw-icon"><Mail size={16} /></span><div className="flex-1 min-w-0"><div className="jigsaw-inline justify-between"><strong className="jigsaw-activity-title">{email.subject || '(No subject)'}</strong><span className="jigsaw-badge">{title(run.status || email.match_state)}</span></div><p className="jigsaw-small">{email.sender_name ? `${email.sender_name} · ` : ''}{email.sender} · {email.mailbox} · {dateText(email.received_at)}</p>
    {run.category && <p className="jigsaw-small">{title(run.category)}{Number(run.classification?.confidence ?? 0) < 0.95 ? ' · AI uncertain; review the source' : ''}</p>}{run.outcome && <p className="jigsaw-activity-body">{run.outcome}</p>}{run.notification && <p className="jigsaw-small"><strong>Business Notification: {title(run.notification.status)}</strong>{run.notification.reason && ` · ${run.notification.reason}`}</p>}{run.classification?.decision_reason && <p className="jigsaw-small">{run.classification.decision_reason}</p>}
    {run.notification?.status === 'held' && run.uid && ['client_order', 'client_enquiry', 'client_booking'].includes(run.category) && ['needs_review', 'needs_match'].includes(run.status) && <div className="jigsaw-form mt-3"><Notice>This request needs a human decision. Check the original email; confirming schedules one business notification using the existing recipient.</Notice><div className="jigsaw-inline"><button className="jigsaw-btn jigsaw-btn-primary" disabled={busy} onClick={() => reviewNotification('confirm')}>Confirm New Business Enquiry</button><button className="jigsaw-btn" disabled={busy} onClick={() => reviewNotification('dismiss')}>No Notification Needed</button></div></div>}
    {Array.isArray(run.issues) && run.issues.length > 0 && <Notice>{run.issues.map((issue: unknown, index: number) => <p key={index}>{typeof issue === 'string' ? issue : 'This document needs a consultant check.'}</p>)}</Notice>}
    {run.steps && typeof run.steps === 'object' && Object.keys(run.steps).length > 0 && <details className="jigsaw-small mt-2"><summary>Processing steps</summary>{Object.entries(run.steps).map(([key, value]) => <p key={key}>{title(key)}: {title(typeof value === 'object' && value !== null ? (value as JsonRecord).status : value)}</p>)}</details>}
    <details className="jigsaw-small mt-2"><summary>Read email</summary><p className="mt-2" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{email.body}</p></details>
    {source && <a href={source} target="_blank" rel="noreferrer" className="jigsaw-link inline-block mt-2">Open original email in Microsoft 365 →</a>}
    {Array.isArray(email.attachments) && email.attachments.length > 0 && <div className="jigsaw-inline mt-3">{email.attachments.map((attachment: JsonRecord, index: number) => attachment.uid && !attachment.unsupported ? <button type="button" key={attachment.uid} className="jigsaw-btn" onClick={() => download(attachment)}><Paperclip size={13} />{attachment.name || 'Download attachment'}</button> : <span className="jigsaw-small" key={index}>{attachment.name || 'Attachment'} · Check in original mailbox</span>)}</div>}
    {(run.status === 'needs_match' || email.match_state !== 'matched') && !['completed', 'observed', 'needs_review', 'processing'].includes(run.status) ? <div className="jigsaw-form mt-3"><RecordContactSelector value={selected} onChange={setSelected} disabled={busy} initialSearch={email.sender || ''} /><div><button type="button" className="jigsaw-btn jigsaw-btn-primary" disabled={busy || !selected} onClick={match}>{busy ? 'Linking…' : 'Link record and resume'}</button></div></div> : email.contact_uid && <Link href={`${ROOT}/workspace/record/${encodeURIComponent(email.contact_uid)}`} className="jigsaw-link inline-block mt-3">Open ATS contact →</Link>}
    {failure && <div className="mt-3"><Notice error>{failure}</Notice></div>}
  </div></article>;
}

function RunRecordMatch({ item, onMatched }: { item: JsonRecord; onMatched: () => void }) {
  const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const match = async () => { setBusy(true); setFailure(''); try { await jigsaw(`${BASE}runs/${encodeURIComponent(item.run_uid)}/match/`, 'POST', { contact_uid: selected }); onMatched(); } catch (error) { setFailure(errorText(error)); } finally { setBusy(false); } };
  return <details className="mt-3"><summary className="jigsaw-link cursor-pointer">Choose the matching ATS record</summary><div className="jigsaw-form mt-3"><RecordContactSelector value={selected} onChange={setSelected} disabled={busy} candidateOnly={item.category === 'hours_timesheet'} /><button className="jigsaw-btn" type="button" disabled={busy || !selected} onClick={match}>{busy ? 'Linking…' : 'Link record and resume'}</button>{failure && <Notice error>{failure}</Notice>}</div></details>;
}
