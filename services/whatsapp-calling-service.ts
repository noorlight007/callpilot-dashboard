import { apiRequest } from '@/services/jigsaw-service';
import type { VoiceCallSession } from '@/lib/voip-connection';

export interface WhatsAppCallingSetup {
  enabled: boolean;
  business_number: string;
  routing_number_uid: string;
  phone_number_id: string;
  call_control_app_id: string;
  inbound_isolated: boolean;
  has_meta_token: boolean;
  verified_at: string | null;
  ready: boolean;
  inbound_ready: boolean;
  outbound_ready: boolean;
  can_manage: boolean;
  checks: { key: string; ok: boolean; detail: string }[];
  numbers: { uid: string; e164: string; label: string }[];
  limitations: string[];
}

export interface WhatsAppCallPermission {
  number: string;
  status: string;
  can_call: boolean;
  can_request: boolean;
  expires_at: string | null;
  detail: string;
}

export interface WhatsAppCallSession extends VoiceCallSession {
  destination_number: string;
  channel: 'whatsapp';
}

export const isWhatsAppNumber = (value: string) => /^\+[1-9]\d{6,14}$/.test(value);
export const callChannelLabel = (channel?: string) => channel === 'whatsapp' ? 'WhatsApp' : 'Phone';
export function rtcCallChannel(call: any): 'phone' | 'whatsapp' {
  if (call?.callpilotChannel === 'whatsapp') return 'whatsapp';
  const headers = call?.options?.customHeaders;
  return Array.isArray(headers) && headers.some(header => typeof header?.name === 'string' && header.name.toLowerCase() === 'x-callpilot-channel' && header.value === 'whatsapp') ? 'whatsapp' : 'phone';
}
export function whatsAppPermissionAllowsCall(permission: WhatsAppCallPermission | null, number: string, now = Date.now()) {
  if (!permission || permission.number !== number || permission.can_call !== true) return false;
  return !permission.expires_at || new Date(permission.expires_at).getTime() > now;
}

export const whatsAppCalling = {
  setup: (signal?: AbortSignal) => apiRequest<WhatsAppCallingSetup>('/voice/api/whatsapp/', { signal }),
  permission: (number: string, signal?: AbortSignal) => apiRequest<WhatsAppCallPermission>(`/voice/api/whatsapp/permissions/?number=${encodeURIComponent(number)}`, { signal }),
  requestPermission: (number: string) => apiRequest<WhatsAppCallPermission>('/voice/api/whatsapp/permissions/', { method: 'POST', body: JSON.stringify({ number }) }),
  async session(number: string): Promise<WhatsAppCallSession> {
    const session = await apiRequest<WhatsAppCallSession>('/voice/api/whatsapp/session/', { method: 'POST', body: JSON.stringify({ number }) });
    if (session.channel !== 'whatsapp' || session.destination_number !== number) {
      throw new Error('The service did not authorize the selected WhatsApp call. Check its permission and try again.');
    }
    return session;
  },
};
