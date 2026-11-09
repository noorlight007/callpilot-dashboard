'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, MessageCircle, Mic, RefreshCw, UserRound } from 'lucide-react';
import { jigsaw, results, type JsonRecord } from '@/services/jigsaw-service';

const ROOT = '/dashboard/ai-jigsaw';
const outcomes: Record<string, { label: string; color: string }> = {
  queued: { label: 'Action queued', color: 'amber' },
  observed: { label: 'Observation only', color: 'amber' },
  confirmation_required: { label: 'Needs your approval', color: 'amber' },
  no_command: { label: 'No action detected', color: '' },
  ai_unavailable: { label: 'AI needs attention', color: 'red' },
  disabled: { label: 'Command disabled', color: '' },
  dismissed: { label: 'Suggestion dismissed', color: '' },
  setup_required: { label: 'Setup needed', color: 'red' },
  unmatched_contact: { label: 'Match a contact', color: 'amber' },
};

const providers: Record<string, string> = { openai: 'OpenAI', anthropic: 'Claude', phrase_suggestion: 'Phrase suggestion', review_suggestion: 'Review suggestion', document_promise_suggestion: 'Document promise suggestion' };
const providerGuidance: Record<string, string> = {
  model_required: 'Choose a text model in the AI provider settings.',
  model_missing: 'Choose a text model in the AI provider settings.',
  model_unavailable: 'Choose a text model available to this API account.',
  connection_disabled: 'Enable this AI provider connection.',
  connection_required: 'Connect this AI provider in the AI settings.',
  api_key_missing: 'Save this provider’s API key in the AI settings.',
  credentials_missing: 'Save this provider’s API key in the AI settings.',
  credentials_unreadable: 'Reconnect this provider so the server can read its saved credentials.',
  encryption_key_missing: 'Ask your administrator to configure the server credential encryption key.',
  encryption_key_invalid: 'Ask your administrator to correct the server credential encryption key.',
  provider_access_denied: 'Check the API key and account permissions.',
  provider_timeout: 'The provider did not respond in time. Check its connection.',
  provider_unavailable: 'The provider is unavailable. Check its connection.',
  provider_rate_limited: 'The provider limited this request. Check API usage and billing.',
  provider_request_failed: 'Check this provider’s API access and text model in AI settings.',
  provider_response_large: 'The provider response was too large to use. Check the selected text model.',
  provider_response_invalid: 'The provider returned an unusable response. Check the selected text model.',
  invalid_output: 'The provider returned an unusable command decision.',
};

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function percentage(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? `${Math.round(value * 100)}%` : '';
}

/** A saved analysis is evidence of interpretation, never delivery confirmation. */
export function VoiceAnalysisResult({ event }: { event: JsonRecord }) {
  const data = event.payload && typeof event.payload === 'object' ? event.payload as JsonRecord : {};
  const outcome = text(data.outcome), badge = outcomes[outcome] || { label: 'Saved decision', color: '' };
  const confidence = percentage(data.confidence), threshold = percentage(data.confidence_threshold);
  const contact = text(data.contact_uid), excerpt = text(data.transcript_excerpt);
  const summary = text(data.summary) || 'This call was saved before detailed analysis results were available. Check Alerts and the candidate’s messages for its next step.';
  const needsReview = ['confirmation_required', 'ai_unavailable', 'setup_required', 'unmatched_contact'].includes(outcome);
  const errors = data.provider_errors && typeof data.provider_errors === 'object' ? data.provider_errors as JsonRecord : {};
  const created = text(event.created_at), parsed = Date.parse(created);
  return <article className="jigsaw-activity" style={{ alignItems: 'flex-start' }}>
    <span className="jigsaw-icon"><Mic size={16} /></span>
    <div className="flex-1 min-w-0">
      <div className="jigsaw-inline justify-between">
        <strong className="jigsaw-activity-title">{text(data.contact_name) || 'Recruitment call'}</strong>
        <span className={`jigsaw-badge ${badge.color}`}>{badge.label}</span>
      </div>
      <p className="jigsaw-activity-body" style={{ overflowWrap: 'anywhere' }}>{summary}</p>
      {excerpt && <div className="mt-3" style={{ borderLeft: '2px solid #dce3ef', paddingLeft: 12 }}><span className="jigsaw-small">Saved transcript</span><p className="jigsaw-small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 4 }}>{excerpt}</p></div>}
      <div className="jigsaw-inline mt-2 jigsaw-small">
        {Number.isFinite(parsed) && <time dateTime={created}>{new Date(parsed).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>}
        {providers[text(data.provider)] && <span>{providers[text(data.provider)]}</span>}
        {confidence && text(data.command) && <span>Confidence {confidence}{threshold && ` · required ${threshold}`}</span>}
      </div>
      {Object.entries(errors).filter(([provider]) => ['openai', 'anthropic'].includes(provider)).map(([provider, code]) => <p className="jigsaw-small mt-2" key={provider}>{providers[provider]}: {providerGuidance[text(code)] || 'Check this provider’s API access and text model in AI settings.'}</p>)}
      <div className="jigsaw-inline mt-3">
        {needsReview && <Link href={`${ROOT}/workspace/alerts`} className="jigsaw-link"><Bell size={13} /> Open alerts</Link>}
        {(outcome === 'ai_unavailable' || Object.keys(errors).some(provider => ['openai', 'anthropic'].includes(provider))) && <Link href={`${ROOT}/ai`} className="jigsaw-link">Check AI settings</Link>}
        {contact && <><Link href={`${ROOT}/workspace/messages?contact=${encodeURIComponent(contact)}`} className="jigsaw-link"><MessageCircle size={13} /> Candidate messages</Link><Link href={`${ROOT}/workspace/record/${encodeURIComponent(contact)}`} className="jigsaw-link"><UserRound size={13} /> Open record</Link></>}
      </div>
    </div>
  </article>;
}

export function VoiceAnalysisPanel() {
  const [entries, setEntries] = useState<JsonRecord[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    jigsaw<JsonRecord>('events/?kind=ai.decision').then(response => { if (active) setEntries(results<JsonRecord>(response).slice(0, 20)); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Unable to load call analysis.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <section className="jigsaw-card" aria-label="Recent call analysis">
    <div className="jigsaw-card-header"><div><h2>Recent call analysis</h2><p>See what the saved transcript triggered, or why a request needs attention.</p></div><button type="button" className="jigsaw-btn" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} /> Refresh</button></div>
    {loading ? <div className="jigsaw-empty" role="status"><span className="jigsaw-spinner" /><span>Loading call analysis…</span></div> : error ? <div className="jigsaw-card-pad"><p role="alert">{error}</p><button type="button" className="jigsaw-link mt-2" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : entries.length ? entries.map(event => <VoiceAnalysisResult event={event} key={text(event.uid)} />) : <div className="jigsaw-empty"><span className="jigsaw-icon"><Mic size={20} /></span><strong>No call analysis yet</strong><p>After a recorded call is transcribed, its command result appears here. Earlier calls may not have a saved analysis result.</p></div>}
  </section>;
}
