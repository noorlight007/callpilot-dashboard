'use client';

import type { Alert, JsonRecord } from '@/services/jigsaw-service';

const stateLabels: Record<string, string> = {
  completed: 'Updated', failed: 'Update failed', uncertain: 'Outcome unconfirmed',
  pending: 'Waiting', processing: 'Updating',
};
const text = (value: unknown, limit = 255) => typeof value === 'string' ? value.slice(0, limit) : '';
const title = (value: unknown) => text(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const recordLink = (value: unknown) => {
  try {
    const url = new URL(text(value, 1000));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
};

export function isAutomaticRecordUpdate(alert: Pick<Alert, 'kind' | 'payload'>): boolean {
  return alert.kind === 'multiple_records_updated' && alert.payload?.informational === true;
}

export function AutomaticRecordUpdates({ payload }: { payload: JsonRecord }) {
  const records = Array.isArray(payload.targets) ? payload.targets.filter((target: unknown): target is JsonRecord => !!target && typeof target === 'object' && !Array.isArray(target)) : [];
  const completed = records.filter(record => record.status === 'completed').length;
  const failed = records.filter(record => record.status === 'failed').length;
  const unconfirmed = records.filter(record => record.status === 'uncertain').length;
  return <section className="jigsaw-form mt-3" aria-label="Automatic JobAdder record updates" style={{ width: '100%', gap: 10 }}>
    <p className="jigsaw-small">Updates were applied automatically; no contact selection is required.</p>
    <p className="jigsaw-small" role="status">{completed} of {records.length} records updated{failed ? ` · ${failed} failed` : ''}{unconfirmed ? ` · ${unconfirmed} unconfirmed` : ''}</p>
    <ul aria-label="JobAdder record update results" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {records.map((record, index) => {
        const link = recordLink(record.ats_url);
        const operations = Array.isArray(record.operations) ? record.operations.filter((operation: unknown): operation is JsonRecord => !!operation && typeof operation === 'object') : [];
        const label = `${title(record.kind) || 'Record'} #${text(String(record.ats_id ?? ''))}`;
        return <li className="jigsaw-rule" key={text(record.key) || `${record.kind}:${record.ats_id}:${index}`}>
          <div className="min-w-0"><strong>{label}</strong><p className="jigsaw-small">{stateLabels[record.status] || title(record.status) || 'Waiting'}</p>
            {operations.length > 0 && <ul className="jigsaw-small" style={{ paddingLeft: 18, margin: '4px 0 0' }}>{operations.map((operation, operationIndex) => <li key={`${text(operation.operation)}:${operationIndex}`}>{title(text(operation.operation).split(':')[0]) || 'Activity'}: {stateLabels[operation.status] || title(operation.status) || 'Waiting'}</li>)}</ul>}
          </div>
          {link && <a className="jigsaw-link" href={link} target="_blank" rel="noopener noreferrer">Open JobAdder record →</a>}
        </li>;
      })}
    </ul>
  </section>;
}
