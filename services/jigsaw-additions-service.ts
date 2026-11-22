import { apiRequest, jigsaw, type JsonRecord } from '@/services/jigsaw-service';

export const SALES_STATUSES = [
  ['new_lead', 'New Lead'], ['contacted', 'Contacted'], ['interested', 'Interested'],
  ['negotiating', 'Negotiating'], ['client_won', 'Client Won'],
] as const;

export function publicSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); if (url.protocol === 'https:' || url.protocol === 'http:') return url.href; } catch { /* Do not render provider text as a URL. */ }
}

export function cleanupSettingsPayload(draft: JsonRecord) {
  const confidence = Number(draft.auto_confidence);
  if (!Number.isFinite(confidence) || confidence < .9 || confidence > 1) throw new Error('Automatic confidence must be between 90% and 100%.');
  const catalogue = (Array.isArray(draft.catalogue) ? draft.catalogue : []).map((card: JsonRecord) => {
    const field = card.expiry_field_id === '' || card.expiry_field_id == null ? null : Number(card.expiry_field_id);
    if (field !== null && (!Number.isSafeInteger(field) || field < 1)) throw new Error(`Choose a positive JobAdder expiry field ID for ${card.name || card.key}.`);
    const categories = Array.isArray(card.categories) ? card.categories : String(card.categories || '').split(',').map(x => x.trim()).filter(Boolean);
    const { grade_categories_json, ...saved } = card;
    let grades = card.grade_categories || {};
    if (grade_categories_json !== undefined) { try { grades = JSON.parse(grade_categories_json); } catch { throw new Error(`Use a JSON object of grade names and categories for ${card.name || card.key}.`); } }
    if (!grades || typeof grades !== 'object' || Array.isArray(grades) || Object.entries(grades).some(([key, value]) => !key.trim() || typeof value !== 'string' || !value.trim())) throw new Error(`Use a category name for each grade of ${card.name || card.key}.`);
    return { ...saved, expiry_field_id: field, categories, grade_categories: grades };
  });
  const days = Number(draft.renewal_reminder_days ?? 7);
  if (!Number.isSafeInteger(days) || days < 1 || days > 90) throw new Error('Reminder interval must be between 1 and 90 days.');
  return {
    enabled: !!draft.enabled, nightly_enabled: !!draft.nightly_enabled, messaging_enabled: !!draft.messaging_enabled,
    auto_confidence: confidence, catalogue, opt_out_tags: Array.isArray(draft.opt_out_tags) ? draft.opt_out_tags : String(draft.opt_out_tags || '').split(',').map(x => x.trim()).filter(Boolean),
    out_of_date_tag: String(draft.out_of_date_tag || ''), renewal_template: String(draft.renewal_template || ''),
    renewal_reminder_days: days, email_from: String(draft.email_from || ''), notice_days: [60, 30, 0],
  };
}

export function salesSettingsPayload(draft: JsonRecord) {
  const cap = Number(draft.daily_cap ?? 20);
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 50) throw new Error('The daily sending cap must be between 1 and 50.');
  const followup = Number(draft.followup_days ?? 7);
  if (!Number.isSafeInteger(followup) || followup < 1 || followup > 90) throw new Error('Follow-up delay must be between 1 and 90 days.');
  const sender = String(draft.sending_mailbox || '').trim(), consultant = String(draft.consultant_email || '').trim();
  if (sender && consultant && sender.toLowerCase() === consultant.toLowerCase()) throw new Error('Choose a separate sales sending mailbox. Replies go to the consultant mailbox.');
  const allowed = ['enabled', 'email_mode', 'domain_verified', 'industry', 'industry_label', 'pitch_facts', 'information_email', 'source_sync_enabled', 'ai_calls_enabled', 'triggers'];
  return { ...Object.fromEntries(allowed.filter(key => draft[key] !== undefined).map(key => [key, draft[key]])), daily_cap: cap, followup_days: followup, sending_mailbox: sender, consultant_email: consultant };
}

export const cleanup = <T = JsonRecord>(path: string, method = 'GET', data?: unknown) => jigsaw<T>(`candidate-cleanup/${path}`, method, data);
export const sales = <T = JsonRecord>(path: string, method = 'GET', data?: unknown) => jigsaw<T>(`sales/${path}`, method, data);

export async function downloadJigsawFile(path: string, filename?: string) {
  const blob = await apiRequest<Blob>(`/jigsaw/${path}`);
  if (!(blob instanceof Blob)) throw new Error('The server did not return a document.');
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename || 'document'; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
