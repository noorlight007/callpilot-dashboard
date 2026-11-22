'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { jigsaw, type JsonRecord } from '@/services/jigsaw-service';

export function label(value: unknown) { return String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
export function date(value: unknown) { if (!value) return '—'; const parsed = new Date(String(value)); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : String(value); }
export function Status({ value }: { value?: unknown }) {
  const name = String(value || 'pending');
  const color = ['completed', 'approved', 'active', 'interested', 'client_won', 'sent', 'connected'].includes(name) ? 'green' : ['failed', 'rejected', 'blocked', 'expired', 'do_not_call'].includes(name) ? 'red' : ['needs_review', 'needs_research', 'queued', 'contacted', 'negotiating', 'observed', 'running'].includes(name) ? 'amber' : '';
  return <span className={`jigsaw-badge ${color}`}>{label(name)}</span>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className={`jigsaw-notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><Info size={16} /><div>{children}</div></div>; }
export function Field({ label: name, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="jigsaw-field">{name}{children}{hint && <small>{hint}</small>}</label>; }
export function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) { return <section className="jigsaw-card"><div className="jigsaw-card-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="jigsaw-empty">{children}</div>; }
export function useAdditionResource<T = JsonRecord>(path: string, initial: T, poll = false) {
  const [data, setData] = useState<T>(initial), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { let active = true; setLoading(true); setError(''); jigsaw<T>(path).then(next => { if (active) setData(next); }).catch(failure => { if (active) setError(failure.message || 'Unable to load this page.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [path, revision]);
  useEffect(() => { if (!poll) return; const timer = window.setInterval(reload, 5000); return () => window.clearInterval(timer); }, [poll, reload]);
  return { data, setData, loading, error, reload };
}
export function ResourceState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (loading) return <div className="jigsaw-empty" role="status"><span className="jigsaw-spinner" />Loading…</div>;
  if (error) return <div className="jigsaw-card-pad"><Notice error>{error} <button className="jigsaw-link" onClick={reload}>Try again</button></Notice></div>;
  return null;
}
export function Refresh({ onClick }: { onClick: () => void }) { return <button className="jigsaw-btn" onClick={onClick}><RefreshCw size={14} /> Refresh</button>; }
export function Search({ value, onChange, placeholder = 'Search records' }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <input className="jigsaw-input" type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} />; }
export function matches(row: JsonRecord, query: string, fields: string[]) { const text = query.trim().toLocaleLowerCase(); return !text || fields.some(field => String(row[field] ?? '').toLocaleLowerCase().includes(text)); }
