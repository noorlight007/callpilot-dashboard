'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Info, Loader2, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/services/jigsaw-service';
import { whatsAppCalling, type WhatsAppCallingSetup } from '@/services/whatsapp-calling-service';
import { BusinessPhoneLink } from './business-phone-link';

export function WhatsAppCallingSettings() {
  const [setup, setSetup] = useState<WhatsAppCallingSetup | null>(null);
  const [draft, setDraft] = useState({ enabled: false, business_number: '', routing_number_uid: '', phone_number_id: '', call_control_app_id: '', inbound_isolated: false });
  const [token, setToken] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState('');
  const [failure, setFailure] = useState(''), [feedback, setFeedback] = useState('');
  const accept = useCallback((data: WhatsAppCallingSetup) => {
    setSetup(data);
    setDraft({ enabled: data.enabled, business_number: data.business_number || '', routing_number_uid: data.routing_number_uid || '', phone_number_id: data.phone_number_id || '', call_control_app_id: data.call_control_app_id || '', inbound_isolated: data.inbound_isolated === true });
  }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setFailure('');
    try { const data = await whatsAppCalling.setup(signal); if (!signal?.aborted) accept(data); }
    catch (error) { if (!signal?.aborted) setFailure((error as Error).message || 'Unable to check WhatsApp calling.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [accept]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const settingsChanged = !!setup && (Object.keys(draft) as (keyof typeof draft)[]).some(key => draft[key] !== setup[key]);
  const savedConfiguration = !!setup?.phone_number_id && !!setup.call_control_app_id && !!setup.routing_number_uid;
  const act = async (action: 'save' | 'credentials' | 'test') => {
    setBusy(action); setFailure(''); setFeedback('');
    try {
      if (action === 'save') {
        accept(await apiRequest<WhatsAppCallingSetup>('/voice/api/whatsapp/', { method: 'PATCH', body: JSON.stringify(draft) }));
        setFeedback('WhatsApp calling settings saved. Run provider checks to confirm readiness.');
      } else if (action === 'credentials') {
        await apiRequest('/voice/api/whatsapp/credentials/', { method: 'POST', body: JSON.stringify({ meta_access_token: token }) });
        setToken(''); accept(await whatsAppCalling.setup()); setFeedback('Meta access token saved. Run provider checks, then enable calling and save settings.');
      } else {
        const data = await apiRequest<WhatsAppCallingSetup>('/voice/api/whatsapp/test/', { method: 'POST' });
        accept(data); setFeedback(data.checks.length && data.checks.every(check => check.ok) ? data.enabled ? 'Provider checks passed.' : 'Provider checks passed. Enable calling and save settings.' : 'Provider checks finished. Complete the checks below.');
      }
    } catch (error) { setFailure((error as Error).message || 'Unable to update WhatsApp calling.'); }
    finally { setBusy(''); }
  };
  return <section className="jigsaw-card">
    <div className="jigsaw-card-header"><div><h2>WhatsApp calling</h2><p>Make and receive WhatsApp voice calls in your existing CallPilot phone.</p></div><button type="button" className="jigsaw-btn" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={14} />Refresh</button></div>
    {loading ? <div className="jigsaw-card-pad jigsaw-inline" role="status"><Loader2 size={16} className="animate-spin" />Checking WhatsApp calling…</div> : setup && <div className="jigsaw-card-pad jigsaw-form">
      <div className="jigsaw-inline"><span className={`jigsaw-badge ${setup.ready ? 'green' : 'amber'}`}>{!setup.enabled ? 'Disabled' : setup.ready ? 'Ready' : 'Setup required'}</span><span className="jigsaw-small">Incoming: {setup.inbound_ready ? 'Ready' : 'Unavailable'} · Outgoing: {setup.outbound_ready ? 'Ready' : 'Unavailable'}</span></div>
      <p className="jigsaw-small">Requires a WhatsApp Cloud API number with calling access, the same Telnyx account as your business phone, and a dedicated WhatsApp Call Control application. WhatsApp app coexistence is unsupported. Outgoing calls require the recipient’s active call permission.</p>
      <div className="jigsaw-notice"><Info size={16} /><p className="jigsaw-small">This adapter requires isolated Telnyx WhatsApp BYON calling routing. Keep your existing telephone number on its current application. A shared Phone and WhatsApp number needs provider-supported channel isolation before it can be ready.</p></div>
      {setup.can_manage ? <>
        <p className="jigsaw-small">Start with calling disabled: save these settings, save your Meta access token, run provider checks, then enable calling and save again. Save any configuration changes with calling disabled before testing.</p>
        <label className="jigsaw-inline jigsaw-small"><input type="checkbox" role="switch" className="jigsaw-switch" checked={draft.enabled} disabled={!!busy} onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))} />Enable WhatsApp calling</label>
        <div className="jigsaw-form-grid">
          <label className="jigsaw-field">WhatsApp business number<input className="jigsaw-input" type="tel" placeholder="+44…" value={draft.business_number} disabled={!!busy} onChange={event => setDraft(current => ({ ...current, business_number: event.target.value }))} /></label>
          <label className="jigsaw-field">Consultant routing line<select className="jigsaw-input" value={draft.routing_number_uid} disabled={!!busy} onChange={event => setDraft(current => ({ ...current, routing_number_uid: event.target.value }))}><option value="">Choose a business line</option>{setup.numbers.map(number => <option key={number.uid} value={number.uid}>{number.label ? `${number.label} · ` : ''}{number.e164}</option>)}</select><small>Uses this line’s consultant routing for incoming WhatsApp calls.</small></label>
          <label className="jigsaw-field">Meta phone number ID<input className="jigsaw-input" value={draft.phone_number_id} disabled={!!busy} onChange={event => setDraft(current => ({ ...current, phone_number_id: event.target.value }))} /></label>
          <label className="jigsaw-field">Telnyx WhatsApp Call Control app ID<input className="jigsaw-input" value={draft.call_control_app_id} disabled={!!busy} onChange={event => setDraft(current => ({ ...current, call_control_app_id: event.target.value }))} /><small>Use a dedicated application separate from ordinary Phone calls.</small></label>
        </div>
        <label className="jigsaw-inline jigsaw-small" style={{ alignItems: 'flex-start' }}><input type="checkbox" checked={draft.inbound_isolated} disabled={!!busy} onChange={event => setDraft(current => ({ ...current, inbound_isolated: event.target.checked }))} /><span>This dedicated application handles WhatsApp calls only; my ordinary telephone number stays on its existing application.</span></label>
        <div className="jigsaw-inline"><button type="button" className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy} onClick={() => void act('save')}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Save calling settings</button><button type="button" className="jigsaw-btn" disabled={!!busy || settingsChanged || !savedConfiguration || !setup.has_meta_token} onClick={() => void act('test')}>{busy === 'test' && <Loader2 size={14} className="animate-spin" />}Run provider checks</button></div>
        <label className="jigsaw-field">Meta access token<input className="jigsaw-input" type="password" autoComplete="new-password" value={token} disabled={!!busy} placeholder={setup.has_meta_token ? 'A token is saved. Enter a replacement if needed.' : 'Enter the calling permission access token'} onChange={event => setToken(event.target.value)} /><small>Stored on the backend. The saved token is never returned here.</small></label>
        <div><button type="button" className="jigsaw-btn" disabled={!!busy || !token.trim() || settingsChanged || !savedConfiguration} onClick={() => void act('credentials')}>{busy === 'credentials' && <Loader2 size={14} className="animate-spin" />}Save access token</button></div>
      </> : <p className="jigsaw-small">Your business administrator manages WhatsApp calling settings.</p>}
      <ul className="jigsaw-checklist">{setup.checks.map(check => <li key={check.key} style={check.ok ? undefined : { color: '#b42318' }}><Check size={15} /><span>{check.ok ? '' : 'Action needed: '}{check.detail}</span></li>)}</ul>
      {!!setup.limitations.length && <ul className="jigsaw-small" style={{ paddingLeft: 18, listStyle: 'disc' }}>{setup.limitations.map(detail => <li key={detail}>{detail}</li>)}</ul>}
      {setup.verified_at && <p className="jigsaw-small">Last provider check: {new Date(setup.verified_at).toLocaleString()}</p>}
      <div><BusinessPhoneLink channel="whatsapp" className="jigsaw-btn">Open WhatsApp phone</BusinessPhoneLink></div>
    </div>}
    {(failure || feedback) && <div className="jigsaw-card-pad"><div className={`jigsaw-notice${failure ? ' error' : ''}`} role={failure ? 'alert' : 'status'}><Info size={16} /><span>{failure || feedback}</span></div></div>}
  </section>;
}
