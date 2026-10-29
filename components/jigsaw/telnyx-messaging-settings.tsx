'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Check, CheckCircle2, ExternalLink, Info, Loader2, MessageCircle, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { jigsaw, results, type AgencySettings, type JsonRecord } from '@/services/jigsaw-service';

interface MessagingConnection {
  uid: string;
  credential_mode: 'platform' | 'own';
  enabled: boolean;
  status: string;
  api_key_configured: boolean;
  platform_available: boolean;
  signup_available: boolean;
  sms_from: string;
  messaging_profile_id: string;
  whatsapp_from: string;
  waba_id: string;
  coexistence_state: string;
  webhook_public_key: string;
  webhook_key_configured: boolean;
  sms_ready: boolean;
  whatsapp_ready: boolean;
  last_checked_at: string | null;
  last_error: string;
}
interface SignupSession { uid: string; signup_type: string; status: string; state: string; waba_id: string; expires_at: string; created_at: string; }
interface SenderNumber { phone_number: string; display_name?: string; status: string; ready?: boolean; coexistence_state?: string; messaging_profile_id?: string; }
interface ProviderTemplate { id: string; name: string; language: string; status: string; components?: { type: string; text?: string }[]; }
const WORKFLOWS = ['document_request', 'shift_offer', 'missed_call_reply', 'document_chaser', 'kid', 'toe', 'shift_filled', 'order_alert'];
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not checked yet';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this action. Please try again.';

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`jigsaw-notice${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}><Info size={16} /><div>{children}</div></div>;
}
function Field({ children, title, hint }: { children: ReactNode; title: string; hint?: string }) {
  return <label className="jigsaw-field">{title}{children}{hint && <small>{hint}</small>}</label>;
}
function ReadyBadge({ ready, children }: { ready: boolean; children: ReactNode }) {
  return <span className={`jigsaw-badge ${ready ? 'green' : 'amber'}`}>{children}</span>;
}

export function TelnyxMessagingSettings() {
  const [connection, setConnection] = useState<MessagingConnection | null>(null);
  const [draft, setDraft] = useState<MessagingConnection | null>(null);
  const [sessions, setSessions] = useState<SignupSession[]>([]);
  const [waNumbers, setWaNumbers] = useState<SenderNumber[]>([]);
  const [smsNumbers, setSmsNumbers] = useState<SenderNumber[]>([]);
  const [numbersLoaded, setNumbersLoaded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [signupType, setSignupType] = useState<'standard' | 'coexistence'>('standard');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [feedback, setFeedback] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  const applyConnection = useCallback((value: MessagingConnection) => { setConnection(value); setDraft(value); }, []);
  const reload = useCallback(async () => {
    const [value, signup] = await Promise.all([
      jigsaw<MessagingConnection>('telnyx/connection/'),
      jigsaw<{ results: SignupSession[] }>('telnyx/whatsapp/sessions/'),
    ]);
    applyConnection(value);
    setSessions(results<SignupSession>(signup));
  }, [applyConnection]);
  useEffect(() => {
    let active = true;
    Promise.all([jigsaw<MessagingConnection>('telnyx/connection/'), jigsaw<{ results: SignupSession[] }>('telnyx/whatsapp/sessions/')])
      .then(([value, signup]) => { if (active) { applyConnection(value); setSessions(results<SignupSession>(signup)); } })
      .catch((error) => { if (active) setFailure(errorText(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyConnection]);

  const run = async (action: string, task: () => Promise<void>) => {
    setBusy(action); setFailure(''); setFeedback('');
    try { await task(); } catch (error) { setFailure(errorText(error)); } finally { setBusy(''); }
  };
  const loadNumbers = async () => {
    const [whatsapp, sms] = await Promise.allSettled([
      jigsaw<{ results: SenderNumber[] }>('telnyx/whatsapp/numbers/'),
      jigsaw<{ results: SenderNumber[] }>('telnyx/sms/numbers/'),
    ]);
    if (whatsapp.status === 'fulfilled') setWaNumbers(results<SenderNumber>(whatsapp.value));
    if (sms.status === 'fulfilled') setSmsNumbers(results<SenderNumber>(sms.value));
    setNumbersLoaded(true);
    const failures = [whatsapp, sms].filter((value): value is PromiseRejectedResult => value.status === 'rejected');
    if (failures.length) throw new Error(failures.map((value) => errorText(value.reason)).join(' '));
  };
  const save = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft) return;
    void run('save', async () => {
      applyConnection(await jigsaw<MessagingConnection>('telnyx/connection/', 'PATCH', {
        enabled: draft.enabled,
        credential_mode: draft.credential_mode,
        sms_from: draft.sms_from,
        messaging_profile_id: draft.messaging_profile_id,
        webhook_public_key: draft.webhook_public_key,
      }));
      setFeedback('Telnyx settings saved. Readiness below reflects the verified connection.');
    });
  };
  const startSignup = () => {
    // Open during the click so browsers can allow the hosted authorization window.
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setAuthorizationUrl('');
    void run('signup', async () => {
      try {
        const response = await jigsaw<{ session: SignupSession; url: string }>('telnyx/whatsapp/start/', 'POST', { signup_type: signupType });
        const url = new URL(response.url);
        if (url.protocol !== 'https:' || url.hostname !== 'acct.fyi' || url.username || url.password) throw new Error('The authorization address could not be verified. Ask your CallPilot administrator for help.');
        // This short-lived URL stays in memory only and is cleared when the page closes.
        setAuthorizationUrl(url.href);
        setSessions((current) => [response.session, ...current.filter((item) => item.uid !== response.session.uid)]);
        if (popup) popup.location.replace(url.href);
        setFeedback('Complete the Telnyx and Meta authorization, then check the signup status here.');
      } catch (error) { popup?.close(); throw error; }
    });
  };
  const refreshSignup = (session: SignupSession) => void run(`session-${session.uid}`, async () => {
    const response = await jigsaw<{ session: SignupSession; connection: MessagingConnection }>(`telnyx/whatsapp/sessions/${encodeURIComponent(session.uid)}/refresh/`, 'POST', {});
    applyConnection(response.connection);
    setSessions((current) => current.map((item) => item.uid === response.session.uid ? response.session : item));
    setAuthorizationUrl('');
    setFeedback('Signup status checked. Refresh the available numbers and select your verified WhatsApp sender.');
    await loadNumbers();
  });
  const change = <K extends keyof MessagingConnection>(key: K, value: MessagingConnection[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);

  return <section className="jigsaw-card" id="telnyx-messaging">
    <div className="jigsaw-card-header"><div><h2>Connect with Telnyx</h2><p>Your agency’s SMS and WhatsApp service, alongside the existing Telnyx business phone.</p></div>{connection && <ReadyBadge ready={connection.whatsapp_ready || connection.sms_ready}>{label(connection.status)}</ReadyBadge>}</div>
    <div className="jigsaw-card-pad jigsaw-form">
      {loading ? <div className="jigsaw-inline" role="status"><span className="jigsaw-spinner" />Loading your messaging connection…</div> : !connection || !draft ? <><Notice error>{failure || 'Unable to load your connection.'}</Notice><div><button className="jigsaw-btn" disabled={!!busy} onClick={() => void run('reload', async () => { await reload(); })}><RefreshCw size={14} /> Try again</button></div></> : <>
        <Notice><strong>Connect your own WhatsApp Business Account.</strong> Keep using your CallPilot login. A business administrator authorizes the existing WhatsApp account with Meta in a separate window.</Notice>
        <div className="jigsaw-messaging-readiness">
          <div><span className="jigsaw-icon"><MessageCircle size={18} /></span><div><strong>WhatsApp Business</strong><p>{connection.whatsapp_from || 'Select your authorized business number'}</p></div><ReadyBadge ready={connection.whatsapp_ready}>{connection.whatsapp_ready ? 'Ready' : 'Setup required'}</ReadyBadge></div>
          <div><span className="jigsaw-icon"><ShieldCheck size={18} /></span><div><strong>SMS fallback</strong><p>{connection.sms_from || 'Select an SMS-capable Telnyx number'}</p></div><ReadyBadge ready={connection.sms_ready}>{connection.sms_ready ? 'Ready' : 'Setup required'}</ReadyBadge></div>
        </div>
        <form className="jigsaw-form" onSubmit={save}>
          <div className="jigsaw-form-grid"><Field title="Telnyx service" hint="Use the service provided by CallPilot, or connect a Telnyx account owned by your agency."><select className="jigsaw-input" value={draft.credential_mode} onChange={(event) => { change('credential_mode', event.target.value as 'platform' | 'own'); setApiKey(''); setWaNumbers([]); setSmsNumbers([]); setNumbersLoaded(false); }}><option value="platform">CallPilot Telnyx service</option><option value="own">My agency’s Telnyx account</option></select></Field><div className="jigsaw-field">Connection access<div className="jigsaw-inline"><ReadyBadge ready={draft.credential_mode === 'platform' ? connection.platform_available : connection.api_key_configured}>{draft.credential_mode === 'platform' ? connection.platform_available ? 'CallPilot service available' : 'Administrator setup needed' : connection.api_key_configured ? 'Agency key stored' : 'Add your agency API key'}</ReadyBadge></div><small>API keys are encrypted on the server and are never returned to the browser.</small></div></div>
          {draft.credential_mode === 'platform' && !connection.platform_available && <Notice>Your CallPilot administrator needs to configure the Telnyx messaging service. You can also use your agency’s own Telnyx account.</Notice>}
          {draft.credential_mode === 'own' && <div className="jigsaw-form-grid"><Field title="Agency Telnyx API key" hint="Create this in your agency’s Telnyx Mission Control account. Leave empty to keep the stored key."><input className="jigsaw-input" type="password" autoComplete="new-password" value={apiKey} placeholder="Add or replace your API key" onChange={(event) => setApiKey(event.target.value)} /></Field><div className="jigsaw-inline items-end"><button className="jigsaw-btn" type="button" disabled={!!busy || !apiKey.trim()} onClick={() => void run('credentials', async () => { applyConnection(await jigsaw<MessagingConnection>('telnyx/credentials/', 'POST', { api_key: apiKey.trim() })); setApiKey(''); setWaNumbers([]); setSmsNumbers([]); setNumbersLoaded(false); setFeedback('Agency API key stored securely. Test access before enabling messaging.'); })}><ShieldCheck size={14} /> Save agency API key</button></div></div>}
          <details className="jigsaw-messaging-advanced"><summary>Provider settings for your administrator</summary><div className="jigsaw-form-grid"><Field title="Telnyx messaging profile ID" hint="The profile used by the selected SMS sender."><input className="jigsaw-input" value={draft.messaging_profile_id || ''} onChange={(event) => change('messaging_profile_id', event.target.value)} /></Field><Field title="Telnyx webhook public key" hint="The public signature-verification key from Telnyx. This is not an API key."><input className="jigsaw-input" value={draft.webhook_public_key || ''} onChange={(event) => change('webhook_public_key', event.target.value)} /></Field></div></details>
          <label className="jigsaw-inline jigsaw-small"><input type="checkbox" checked={draft.enabled} onChange={(event) => change('enabled', event.target.checked)} />Enable Telnyx messaging for this agency</label>
          {!connection.enabled && <p className="jigsaw-small">For first-time setup, save and test access first, select your verified sender below, then enable messaging and save again.</p>}
          <div className="jigsaw-inline"><button className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save connection</button><button className="jigsaw-btn" type="button" disabled={!!busy || draft.credential_mode !== connection.credential_mode} onClick={() => void run('test', async () => { applyConnection(await jigsaw<MessagingConnection>('telnyx/test/', 'POST', {})); setFeedback('Telnyx account access checked. Sender readiness is shown separately.'); })}><RefreshCw size={14} /> Test account access</button></div>
        </form>

        <div className="jigsaw-messaging-section">
          <div className="jigsaw-section-title"><div><h3>1. Authorize your WhatsApp Business</h3><p className="jigsaw-small">Choose the setup that matches your existing account.</p></div></div>
          <div className="jigsaw-signup-choices" role="radiogroup" aria-label="WhatsApp Business setup">
            <label className={signupType === 'standard' ? 'selected' : ''}><input type="radio" name="whatsapp-signup-type" value="standard" checked={signupType === 'standard'} onChange={() => setSignupType('standard')} /><div><strong>Connect a Business Account</strong><p>Select your WhatsApp Business Account and verify a number through Meta.</p></div></label>
            <label className={signupType === 'coexistence' ? 'selected' : ''}><input type="radio" name="whatsapp-signup-type" value="coexistence" checked={signupType === 'coexistence'} onChange={() => setSignupType('coexistence')} /><div><strong>Keep using the WhatsApp Business App</strong><p>Connect an eligible existing app number and continue using it on your phone.</p></div></label>
          </div>
          {!connection.signup_available && <p className="jigsaw-small">Your CallPilot administrator must complete the Telnyx and Meta provider setup before business authorization is available.</p>}
          <div className="jigsaw-inline"><button className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy || !connection.signup_available || draft.credential_mode !== connection.credential_mode} onClick={startSignup}>{busy === 'signup' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />} Connect your WhatsApp Business</button>{authorizationUrl && <a className="jigsaw-link" href={authorizationUrl} target="_blank" rel="noopener noreferrer">Continue authorization <ExternalLink size={12} /></a>}</div>
          {sessions.length > 0 && <div className="jigsaw-signup-sessions">{sessions.slice(0, 3).map((session) => <div className="jigsaw-rule" key={session.uid}><div><strong>{session.signup_type === 'coexistence' ? 'Business App connection' : 'Business Account connection'}</strong><p>{label(session.status)}{session.state ? ` · ${label(session.state)}` : ''} · Started {dateLabel(session.created_at)}</p></div><button className="jigsaw-btn" disabled={!!busy} onClick={() => refreshSignup(session)}>{busy === `session-${session.uid}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check status</button></div>)}</div>}
        </div>

        <div className="jigsaw-messaging-section">
          <div className="jigsaw-section-title"><div><h3>2. Choose your business senders</h3><p className="jigsaw-small">Only numbers authorized for this agency can be selected.</p></div><button className="jigsaw-btn" disabled={!!busy || draft.credential_mode !== connection.credential_mode} onClick={() => void run('numbers', loadNumbers)}><RefreshCw size={14} /> Refresh numbers</button></div>
          <div className="jigsaw-form-grid">
            <Field title="WhatsApp Business number" hint={connection.coexistence_state ? `Business App connection: ${label(connection.coexistence_state)}. The connection must be active before sending.` : 'A completed signup is followed by provider verification of the business number.'}><select className="jigsaw-input" value={connection.whatsapp_from || ''} disabled={!!busy || !numbersLoaded || draft.credential_mode !== connection.credential_mode} onChange={(event) => { const phone_number = event.target.value; if (phone_number) void run('whatsapp-number', async () => { applyConnection(await jigsaw<MessagingConnection>('telnyx/whatsapp/select/', 'POST', { phone_number })); setFeedback('Your agency’s verified WhatsApp sender was selected.'); }); }}><option value="">Select a verified WhatsApp number…</option>{connection.whatsapp_from && !waNumbers.some((item) => item.phone_number === connection.whatsapp_from) && <option value={connection.whatsapp_from}>{connection.whatsapp_from} · Current sender</option>}{waNumbers.map((item) => <option key={item.phone_number} value={item.phone_number} disabled={!item.ready}>{item.phone_number}{item.display_name ? ` · ${item.display_name}` : ''}{!item.ready ? ` · ${label(item.coexistence_state || item.status || 'Not ready')}` : ''}</option>)}</select></Field>
            <Field title="Telnyx SMS fallback number" hint="Select the number, then save the connection above. It must support SMS and belong to this agency."><select className="jigsaw-input" value={draft.sms_from || ''} disabled={!!busy || !numbersLoaded || draft.credential_mode !== connection.credential_mode} onChange={(event) => { const sender = smsNumbers.find((item) => item.phone_number === event.target.value); change('sms_from', event.target.value); if (sender?.messaging_profile_id) change('messaging_profile_id', sender.messaging_profile_id); }}><option value="">Select an SMS-capable Telnyx number…</option>{draft.sms_from && !smsNumbers.some((item) => item.phone_number === draft.sms_from) && <option value={draft.sms_from}>{draft.sms_from} · Current sender</option>}{smsNumbers.map((item) => <option key={item.phone_number} value={item.phone_number}>{item.phone_number}</option>)}</select></Field>
          </div>
          {numbersLoaded && waNumbers.length === 0 && <p className="jigsaw-small">No authorized WhatsApp numbers are available yet. Complete business authorization and check its status.</p>}
          {numbersLoaded && smsNumbers.length === 0 && <p className="jigsaw-small">No SMS-capable numbers were returned. Your administrator can add or enable a number in Telnyx.</p>}
          <div><button className="jigsaw-btn" disabled={!!busy} onClick={() => save()}><Check size={14} /> Save sender settings</button></div>
        </div>
        <div className="jigsaw-inline justify-between"><span className="jigsaw-small">Last checked: {dateLabel(connection.last_checked_at)}</span>{!disconnecting ? <button className="jigsaw-btn jigsaw-btn-danger" disabled={!!busy} onClick={() => setDisconnecting(true)}><Unplug size={14} /> Disconnect messaging</button> : <div className="jigsaw-inline"><span className="jigsaw-small">Stop Telnyx messaging for this agency?</span><button className="jigsaw-btn" disabled={!!busy} onClick={() => setDisconnecting(false)}>Cancel</button><button className="jigsaw-btn jigsaw-btn-danger" disabled={!!busy} onClick={() => void run('disconnect', async () => { applyConnection(await jigsaw<MessagingConnection>('telnyx/disconnect/', 'POST', {})); setDisconnecting(false); setWaNumbers([]); setSmsNumbers([]); setNumbersLoaded(false); setAuthorizationUrl(''); setFeedback('Telnyx messaging disconnected.'); })}>Confirm disconnect</button></div>}</div>
        {connection.last_error && <Notice error>{connection.last_error}</Notice>}
      </>}
      {feedback && <Notice>{feedback}</Notice>}{failure && connection && <Notice error>{failure}</Notice>}
    </div>
  </section>;
}

function templateBody(template: ProviderTemplate) {
  return template.components?.find((component) => String(component.type).toUpperCase() === 'BODY')?.text || '';
}
function templateIdentifier(template: ProviderTemplate) { return template.id || `${template.name}:${template.language}`; }
function variableCount(body: string) { return new Set(Array.from(body.matchAll(/\{\{(\d+)\}\}/g), (match) => match[1])).size; }

export function TelnyxTemplateSettings() {
  const [templates, setTemplates] = useState<JsonRecord>({});
  const [available, setAvailable] = useState<ProviderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [failure, setFailure] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    let active = true;
    jigsaw<AgencySettings>('settings/').then((data) => { if (active) { setTemplates(data.settings.templates || {}); setSettingsLoaded(true); } }).catch((error) => { if (active) setFailure(errorText(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const loadApproved = async () => {
    setBusy('inventory'); setInventoryError(''); setFeedback('');
    try { const response = await jigsaw<{ results: ProviderTemplate[] }>('telnyx/templates/'); setAvailable(results<ProviderTemplate>(response).filter((template) => template.status.toUpperCase() === 'APPROVED')); setInventoryLoaded(true); } catch (error) { setInventoryError(errorText(error)); } finally { setBusy(''); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!settingsLoaded) return; setBusy('save'); setFailure(''); setFeedback('');
    try {
      // Fetch the other settings again so this panel cannot overwrite changes made in another panel.
      const current = await jigsaw<AgencySettings>('settings/');
      await jigsaw('settings/', 'PATCH', { settings: { ...current.settings, templates } });
      setFeedback('Workflow template mappings saved. Telnyx checks approval again when a message is sent.');
    } catch (error) { setFailure(errorText(error)); } finally { setBusy(''); }
  };
  const update = (workflow: string, value: JsonRecord) => setTemplates((current) => ({ ...current, [workflow]: value }));
  return <section className="jigsaw-card"><div className="jigsaw-card-header"><div><h2>Approved WhatsApp templates</h2><p>Match each workflow to an approved template in your agency’s connected Telnyx account.</p></div><button className="jigsaw-btn" disabled={!!busy || loading} onClick={loadApproved}><RefreshCw size={14} /> Load approved templates</button></div><div className="jigsaw-card-pad">
    {loading ? <div className="jigsaw-inline" role="status"><span className="jigsaw-spinner" />Loading template mappings…</div> : <form className="jigsaw-form" onSubmit={save}>
      <Notice>Outside the 24-hour WhatsApp reply window, use an approved template. Submit templates in Telnyx first, then load them here. Their approved wording is kept intact.</Notice>
      {inventoryError && <Notice error>{inventoryError}</Notice>}
      {inventoryLoaded && available.length === 0 && <Notice>No approved templates were returned for this agency. Confirm the selected WhatsApp sender and the approval status in Telnyx.</Notice>}
      <div className="jigsaw-template-grid">{WORKFLOWS.map((workflow) => {
        const mapping = templates[workflow] || {};
        const legacy = !!mapping.content_sid && mapping.provider !== 'telnyx';
        const chosen = available.find((template) => mapping.provider === 'telnyx' && (mapping.template_id ? template.id === mapping.template_id : template.name === mapping.name && template.language === mapping.language));
        const selected = chosen ? templateIdentifier(chosen) : mapping.template_id || mapping.name ? '__saved' : legacy ? '__legacy' : '';
        return <div className="jigsaw-template-entry jigsaw-form" key={workflow}><div className="jigsaw-inline justify-between"><h3>{label(workflow)}</h3>{chosen ? <span className="jigsaw-badge green"><CheckCircle2 size={11} /> Approved in Telnyx</span> : legacy ? <span className="jigsaw-badge">Existing legacy template</span> : <span className="jigsaw-badge amber">{mapping.approved ? 'Saved mapping' : 'Template needed'}</span>}</div>
          <Field title={`${label(workflow)} template`}><select className="jigsaw-input" value={selected} disabled={!!busy} onChange={(event) => {
            const template = available.find((item) => templateIdentifier(item) === event.target.value);
            if (event.target.value === '__saved' || event.target.value === '__legacy') return;
            update(workflow, template ? { provider: 'telnyx', approved: true, ...(template.id ? { template_id: template.id } : {}), name: template.name, language: template.language, body: templateBody(template), parameters: variableCount(templateBody(template)) === 1 ? ['{message}'] : [], sms_body: mapping.sms_body || '' } : { approved: false, provider: 'telnyx', body: '', sms_body: mapping.sms_body || '' });
          }}><option value="">Choose an approved Telnyx template…</option>{selected === '__saved' && <option value="__saved">Saved: {mapping.name || mapping.template_id} · Load templates to verify</option>}{legacy && <option value="__legacy">Keep the existing legacy mapping</option>}{available.map((template) => <option key={templateIdentifier(template)} value={templateIdentifier(template)}>{template.name} · {template.language}</option>)}</select></Field>
          {(mapping.body || chosen) && <Field title="Approved message wording"><textarea className="jigsaw-input" readOnly value={mapping.body || ''} /></Field>}
          {mapping.provider === 'telnyx' && !!mapping.approved && <Field title="Template variable values (in order)" hint={`This wording has ${variableCount(mapping.body || '')} body variable(s). Use one value per line in placeholder order. Supported values: {message}, {name}, {phone}, {upload_link}, or plain text. Leave empty when there are no variables.`}><textarea className="jigsaw-input" value={(Array.isArray(mapping.parameters) ? mapping.parameters : []).join('\n')} onChange={(event) => update(workflow, { ...mapping, parameters: event.target.value ? event.target.value.split('\n') : [] })} placeholder="{name}&#10;{upload_link}" /></Field>}
          <Field title="SMS fallback text" hint="Document requests must include the secure upload link."><textarea className="jigsaw-input" value={mapping.sms_body || ''} onChange={(event) => update(workflow, { ...mapping, sms_body: event.target.value })} /></Field>
        </div>;
      })}</div>
      {feedback && <Notice>{feedback}</Notice>}{failure && <Notice error>{failure}</Notice>}
      <div><button className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy || !settingsLoaded}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save template mappings</button></div>
    </form>}
  </div></section>;
}
