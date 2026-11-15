import type { JsonRecord } from '@/services/jigsaw-service';

function calendarDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function documentExpiryDetails(document: JsonRecord, today = new Date()) {
  const expiry = calendarDate(document.expiry_date);
  if (!expiry) {
    const descriptions: Record<string, string> = {
      pending: 'Reading expiry date…', processing: 'Reading expiry date…',
      not_found: 'No expiry date found on the document.',
      uncertain: 'Expiry date unclear. Check the document.',
      unavailable: 'Expiry date could not be read. Check the document.',
      unsupported: 'Check the expiry date on this document.',
    };
    const description = descriptions[String(document.expiry_status || '')];
    return description ? { label: '', tone: '', description } : null;
  }
  // A printed expiry date is a calendar day, not a midnight timestamp that can
  // move into the previous day in a consultant's timezone. It remains valid
  // through that day; the badge marks it expired only on a later local day.
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const expired = expiry < localToday;
  const formatted = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${expiry}T00:00:00Z`));
  const sync = document.expiry_synced_at ? 'Saved in JobAdder' : document.expiry_error_code ? 'Expiry date needs saving in JobAdder' : 'Waiting to save in JobAdder';
  return { label: `${expired ? 'Expired' : 'Expires'} ${formatted}`, tone: expired ? 'red' : '',
    description: `${document.expiry_source === 'ai' ? 'Read from document · ' : ''}${sync}` };
}

export function DocumentExpiry({ document }: { document: JsonRecord }) {
  const details = documentExpiryDetails(document);
  if (!details) return null;
  return <div className="jigsaw-inline mt-2" style={{ gap: 8 }}>
    {details.label && <span className={`jigsaw-badge ${details.tone}`}>{details.label}</span>}
    <span className="jigsaw-small">{details.description}</span>
  </div>;
}
