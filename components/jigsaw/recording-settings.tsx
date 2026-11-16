'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Info, Loader2, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/services/jigsaw-service';

export interface VoiceRecordingSetting {
  uid: string;
  number: string;
  label: string;
  is_main: boolean;
  record_calls: boolean;
  recording_announcement?: boolean;
}
interface RecordingSettingsResponse { can_manage: boolean; results: VoiceRecordingSetting[]; }

export function normalizedRecordingSetting(row: VoiceRecordingSetting): VoiceRecordingSetting {
  return { ...row, record_calls: row.record_calls === true, recording_announcement: row.recording_announcement !== false };
}

/** Send only the controls the administrator changed, preserving other updates. */
export function recordingSettingsPatch(previous: VoiceRecordingSetting, next: VoiceRecordingSetting) {
  const patch: { uid: string; record_calls?: boolean; recording_announcement?: boolean } = { uid: next.uid };
  if (previous.record_calls !== next.record_calls) patch.record_calls = next.record_calls;
  if ((previous.recording_announcement !== false) !== (next.recording_announcement !== false)) patch.recording_announcement = next.recording_announcement !== false;
  return patch;
}

export function RecordingSettings() {
  const [rows, setRows] = useState<VoiceRecordingSetting[]>([]), [saved, setSaved] = useState<Record<string, VoiceRecordingSetting>>({});
  const [canManage, setCanManage] = useState<boolean | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState('');
  const [failure, setFailure] = useState(''), [feedback, setFeedback] = useState(''), [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailure('');
    apiRequest<RecordingSettingsResponse>('/voice/api/recording-settings/').then(response => {
      if (!active) return;
      setCanManage(response.can_manage);
      const normalized = (response.results || []).map(normalizedRecordingSetting);
      setRows(normalized); setSaved(Object.fromEntries(normalized.map(row => [row.uid, row])));
    }).catch(error => { if (active) setFailure(error.message || 'Unable to load call recording settings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const update = (uid: string, key: 'record_calls' | 'recording_announcement', value: boolean) => setRows(current => current.map(row => row.uid === uid ? { ...row, [key]: value } : row));
  const save = async (row: VoiceRecordingSetting) => {
    const original = saved[row.uid];
    if (!original) return;
    const patch = recordingSettingsPatch(original, row);
    if (Object.keys(patch).length === 1) return;
    setBusy(row.uid); setFailure(''); setFeedback('');
    try {
      const updated = normalizedRecordingSetting(await apiRequest<VoiceRecordingSetting>('/voice/api/recording-settings/', { method: 'PATCH', body: JSON.stringify(patch) }));
      setRows(current => current.map(item => item.uid === row.uid ? updated : item));
      setSaved(current => ({ ...current, [row.uid]: updated }));
      setFeedback(updated.record_calls && updated.recording_announcement === false
        ? `Saved for ${updated.number}. The spoken announcement is off and call recording stays on. New calls use these settings.`
        : `Recording settings saved for ${updated.number}. New calls use these settings.`);
    } catch (error) { setFailure((error as Error).message || 'Unable to save call recording settings.'); }
    finally { setBusy(''); }
  };
  if (canManage === false && !failure) return null;
  return <section className="jigsaw-card">
    <div className="jigsaw-card-header"><div><h2>Call recording</h2><p>Recording supplies the transcripts used by call automations. The spoken announcement has its own control.</p></div><button type="button" className="jigsaw-btn" disabled={loading || !!busy} onClick={reload}><RefreshCw size={14} />Refresh</button></div>
    {loading ? <div className="jigsaw-card-pad jigsaw-inline" role="status"><Loader2 size={16} className="animate-spin" />Loading recording settings…</div> : rows.length ? rows.map(row => {
      const changed = !!saved[row.uid] && Object.keys(recordingSettingsPatch(saved[row.uid], row)).length > 1;
      return <div className="jigsaw-card-pad jigsaw-form" style={{ borderBottom: '1px solid #eaecf0' }} key={row.uid}>
        <div className="jigsaw-inline"><strong>{row.label || row.number}</strong>{row.label && <span className="jigsaw-small">{row.number}</span>}{row.is_main && <span className="jigsaw-badge">Main number</span>}</div>
        <label className="jigsaw-inline jigsaw-small" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" role="switch" className="jigsaw-switch" aria-label={`Record calls for ${row.number}`} checked={row.record_calls} disabled={!!busy} onChange={event => update(row.uid, 'record_calls', event.target.checked)} /><span>Record calls<br /><small>Keep this enabled for recordings, transcripts and call automations.</small></span></label>
        <label className="jigsaw-inline jigsaw-small" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" role="switch" className="jigsaw-switch" aria-label={`Play recording announcement for ${row.number}`} checked={row.recording_announcement !== false} disabled={!!busy} onChange={event => update(row.uid, 'recording_announcement', event.target.checked)} /><span>Play recording announcement<br /><small>Turn this off to stop the spoken message at the start of new calls. This control does not switch recording off.</small></span></label>
        <div><button type="button" className="jigsaw-btn jigsaw-btn-primary" disabled={!!busy || !changed} onClick={() => save(row)}>{busy === row.uid ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Save recording settings</button></div>
      </div>;
    }) : !failure && <p className="jigsaw-card-pad jigsaw-small">No business voice numbers are configured for this organization yet.</p>}
    {(failure || feedback) && <div className="jigsaw-card-pad"><div className={`jigsaw-notice${failure ? ' error' : ''}`} role={failure ? 'alert' : 'status'}><Info size={16} /><span>{failure || feedback}</span></div></div>}
  </section>;
}
