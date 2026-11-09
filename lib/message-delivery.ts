import type { Message } from '@/services/jigsaw-service';

type DeliveryMessage = Pick<Message, 'direction' | 'status' | 'created_at' | 'failure_reason'>;

export function messageNeedsRefresh(message: DeliveryMessage): boolean {
  return message.direction === 'outbound' && ['queued', 'pending', 'sending', 'sent'].includes(message.status);
}

export function messageDeliveryHint(message: DeliveryMessage, now = Date.now()): string {
  if (message.direction !== 'outbound' || ['delivered', 'read'].includes(message.status)) return '';
  if (message.failure_reason) return message.failure_reason;
  if (['queued', 'pending'].includes(message.status)) {
    const created = Date.parse(message.created_at);
    return Number.isFinite(created) && now - created >= 60_000
      ? 'Waiting to send. Ask your administrator to check the messaging worker.'
      : 'Waiting for the messaging worker to send this message.';
  }
  if (message.status === 'sent') return 'Sent to the provider; awaiting delivery confirmation.';
  if (message.status === 'needs_review') return 'Sending needs review. Check Alerts before trying again.';
  if (['failed', 'undelivered'].includes(message.status)) return 'This message was not delivered. Check Alerts for the next step.';
  return '';
}
