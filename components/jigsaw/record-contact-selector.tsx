'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { jigsaw, results, type Contact, type JsonRecord } from '@/services/jigsaw-service';

const PAGE_SIZE = 50;
type Props = {
  value: string;
  onChange: (uid: string) => void;
  disabled?: boolean;
  candidateOnly?: boolean;
  initialSearch?: string;
  revision?: number;
};

export function RecordContactSelector({ value, onChange, disabled = false, candidateOnly = false, initialSearch = '', revision = 0 }: Props) {
  const [query, setQuery] = useState(initialSearch), [search, setSearch] = useState(initialSearch.trim());
  const [kind, setKind] = useState(''), [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const [data, setData] = useState<JsonRecord>({ results: [] }), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const activeKind = candidateOnly ? 'candidate' : kind;
  const waitingForSearch = query.trim() !== search;

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const path = `contacts/?limit=${PAGE_SIZE}&offset=${offset}&q=${encodeURIComponent(search)}${activeKind ? `&kind=${activeKind}` : ''}`;
    jigsaw<JsonRecord>(path).then((response) => { if (active) setData(response); })
      .catch((failure) => { if (active) setError(failure.message || 'Unable to search ATS records.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, activeKind, offset, retry, revision]);

  const contacts = results<Contact>(data).filter((contact) => !!contact.ats_id && (!candidateOnly || contact.kind === 'candidate'));
  const selected = contacts.find((contact) => contact.uid === value);
  const busy = disabled || loading || waitingForSearch;
  const changePage = (nextOffset: number) => { onChange(''); setOffset(nextOffset); };

  return <div className="jigsaw-form" style={{ gap: 12 }}>
    <div className="jigsaw-inline">
      <label className="jigsaw-field" style={{ flex: '1 1 250px' }}>
        Search {candidateOnly ? 'candidates' : 'ATS records'}
        <span className="jigsaw-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Search matching ATS records" placeholder="Name, phone number or email" value={query} disabled={disabled} onChange={(event) => { setQuery(event.target.value); setOffset(0); onChange(''); }} /></span>
      </label>
      {!candidateOnly && <label className="jigsaw-field" style={{ flex: '0 1 180px' }}>
        Record type
        <select className="jigsaw-input" aria-label="Filter matching ATS record type" value={kind} disabled={disabled} onChange={(event) => { setKind(event.target.value); setOffset(0); onChange(''); }}>
          <option value="">All record types</option><option value="candidate">Candidates</option><option value="client">Clients</option>
        </select>
      </label>}
    </div>
    <label className="jigsaw-field">
      {candidateOnly ? 'Candidate receiving these documents' : 'Correct ATS record'}
      <select className="jigsaw-input" aria-label="Select matching ATS record" value={selected ? value : ''} disabled={busy || !!error || !contacts.length} onChange={(event) => onChange(event.target.value)}>
        <option value="">{loading || waitingForSearch ? 'Searching ATS records…' : 'Choose the correct ATS record…'}</option>
        {contacts.map((contact) => <option key={contact.uid} value={contact.uid}>{contact.name} · {contact.kind === 'candidate' ? 'Candidate' : contact.kind === 'client' ? 'Client' : contact.kind} · {contact.phone || contact.email || 'No contact details'}{contact.phone && contact.email ? ` · ${contact.email}` : ''} · ATS #{contact.ats_id}</option>)}
      </select>
    </label>
    {error ? <div role="alert" className="jigsaw-small"><span>{error}</span> <button type="button" className="jigsaw-link" disabled={disabled} onClick={() => setRetry((previous) => previous + 1)}>Try again</button></div> : <div className="jigsaw-inline" aria-live="polite">
      <span className="jigsaw-small">{loading || waitingForSearch ? 'Searching…' : !contacts.length ? 'No matching ATS records. Try another name, phone number or email, or sync contacts.' : `Showing ${offset + 1}–${offset + results<Contact>(data).length} of ${Number(data.count ?? contacts.length).toLocaleString()} records`}</span>
      {data.previous != null && <button type="button" className="jigsaw-btn" aria-label="Previous matching ATS records" disabled={busy} onClick={() => changePage(Number(data.previous))}><ArrowLeft size={14} />Previous</button>}
      {data.next != null && <button type="button" className="jigsaw-btn" aria-label="Next matching ATS records" disabled={busy} onClick={() => changePage(Number(data.next))}>Next<ArrowRight size={14} /></button>}
    </div>}
    {selected && <div className="jigsaw-small" style={{ overflowWrap: 'anywhere' }}><div>Selected: {selected.name} · {selected.kind === 'candidate' ? 'Candidate' : selected.kind === 'client' ? 'Client' : selected.kind} · ATS #{selected.ats_id}</div><div>{[selected.phone, selected.email].filter(Boolean).join(' · ')}</div></div>}
  </div>;
}
