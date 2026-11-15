import type { JsonRecord } from '@/services/jigsaw-service';

export const WHATSAPP_TEMPLATE_WORKFLOWS = [
  { key: 'document_request', optional: false, description: 'Ask the candidate to reply with their documents in WhatsApp. Choose a template without the upload form link; that link is sent only in SMS fallback.' },
  { key: 'shift_offer', optional: true, description: 'Use only for candidate shift-fill automation. Asks suitable candidates whether they are available for a shift.' },
  { key: 'missed_call_reply', optional: true, description: 'Use only for missed-call follow-up. Acknowledges the missed call and tells the caller a consultant will call back.' },
  { key: 'document_chaser', optional: true, description: 'Use only for automatic document reminders after the configured delay. An approved template is needed outside the 24-hour reply window; leaving this mapping empty does not turn reminders off.' },
  { key: 'shift_filled', optional: true, description: 'Use only for candidate shift-fill automation. Tells other candidates who replied that the shift has now been filled.' },
  { key: 'order_alert', optional: true, description: 'Use only when client order alerts are sent by WhatsApp or both email and WhatsApp. Notifies the consultant or configured staff number about a new held job draft.' },
] as const;

export function withoutGeneratedTermsTemplates(templates: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(templates).filter(([key]) => !['kid', 'toe'].includes(key.toLowerCase())));
}

export function approvedManualTemplateOptions(templates: JsonRecord, telnyx: boolean): [string, JsonRecord][] {
  return Object.entries(withoutGeneratedTermsTemplates(templates)).filter(([, value]) => {
    const mapping = value as JsonRecord;
    return !!mapping?.approved && (telnyx
      ? mapping.provider === 'telnyx' && !!(mapping.template_id || mapping.name)
      : mapping.provider !== 'telnyx' && !!mapping.content_sid);
  }) as [string, JsonRecord][];
}

export function templateVariableHint(workflow: string, count: number): string {
  const common = `This wording has ${count} body variable(s). Use one value per line in placeholder order. Leave empty when there are no variables.`;
  return workflow === 'document_request'
    ? `${common} Use {message}, {name}, {phone}, or plain text. Do not add the upload form link to WhatsApp variables; it belongs in SMS fallback.`
    : `${common} Supported values: {message}, {name}, {phone}, {upload_link}, or plain text.`;
}
