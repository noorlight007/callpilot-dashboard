import type { JsonRecord, Message } from '@/services/jigsaw-service';

export interface Conversation {
  conversation_number: string;
  number: string;
  contact_uid: string | null;
  contact_name: string;
  message_count: number;
  channels: string[];
  last_message?: Message | null;
}
export interface HistoryState {
  items: Message[];
  count: number;
  next: number | null;
  conversation: Conversation | null;
}
export const HISTORY_PAGE_SIZE = 50;
export const emptyHistory = (): HistoryState => ({ items: [], count: 0, next: null, conversation: null });

/** Merge delivery updates and overlapping pages without duplicate bubbles. */
export function mergeConversationPage(previous: HistoryState, page: JsonRecord, older = false): HistoryState {
  const incoming: Message[] = Array.isArray(page.results) ? page.results : [];
  const items = new Map(previous.items.map(message => [message.uid, message]));
  incoming.forEach(message => items.set(message.uid, message));
  const count = Number(page.count ?? items.size);
  const nextPage = typeof page.next === 'number' ? page.next : null;
  let next = nextPage;
  if (!older && previous.items.length) {
    const added = count - previous.count;
    // If a whole page arrived between refreshes, rescan from the latest page
    // boundary rather than leaving a gap in the loaded history.
    next = added > HISTORY_PAGE_SIZE ? nextPage : previous.next == null ? null : Math.max(0, previous.next + added);
    if (next != null && next >= count) next = null;
  }
  return {
    items: [...items.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.uid.localeCompare(b.uid)),
    count, next, conversation: page.conversation || previous.conversation,
  };
}
export function conversationTitle(conversation: Conversation): string {
  return conversation.contact_name || conversation.number || 'WhatsApp conversation';
}
export function conversationPreview(conversation: Conversation): string {
  const message = conversation.last_message;
  if (!message) return 'No messages yet';
  return message.body?.trim().replace(/\s+/g, ' ') || (message.attachments?.length ? 'Photo or file' : 'Message');
}
export function conversationPath(key: string): string {
  return `/dashboard/ai-jigsaw/workspace/messages?number=${encodeURIComponent(key)}`;
}
