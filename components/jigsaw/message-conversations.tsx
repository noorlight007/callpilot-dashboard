'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Info, Loader2, MessageCircle, Paperclip, Plus, RefreshCw, Search, Send, Users } from 'lucide-react';
import { jigsaw, results, type AgencySettings, type Contact, type JsonRecord, type Message } from '@/services/jigsaw-service';
import { useConversationHistory } from '@/hooks/use-conversation-history';
import { conversationPath, conversationPreview, conversationTitle, type Conversation } from '@/lib/conversation-history';
import { messageDeliveryHint } from '@/lib/message-delivery';
import { approvedManualTemplateOptions } from './whatsapp-template-workflows';
import { RecordContactSelector } from './record-contact-selector';

const ROOT = '/dashboard/ai-jigsaw';
const dateText = (value?: string) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const title = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className={`jigsaw-notice${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}><Info size={16} /><div>{children}</div></div>; }
function Loading() { return <div className="jigsaw-empty" role="status"><Loader2 size={20} className="animate-spin" />Loading messages…</div>; }

export function ConversationRow({ conversation, onOpen }: { conversation: Conversation; onOpen: () => void }) {
  const name = conversationTitle(conversation), last = conversation.last_message;
  return <button type="button" className="jigsaw-conversation-row" onClick={onOpen} aria-label={`Open conversation with ${name}`}>
    <span className="jigsaw-avatar">{conversation.contact_name ? conversation.contact_name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase() : <MessageCircle size={19} />}</span>
    <span className="jigsaw-conversation-content"><span className="jigsaw-conversation-top"><strong>{name}</strong><time>{dateText(last?.created_at)}</time></span>
      {conversation.contact_name && conversation.number && <span className="jigsaw-small">{conversation.number}</span>}
      <span className="jigsaw-conversation-preview">{last?.direction === 'outbound' ? 'You: ' : ''}{conversationPreview(conversation)}</span>
      <span className="jigsaw-inline"><span className="jigsaw-small">{conversation.message_count} message{conversation.message_count === 1 ? '' : 's'}</span>{conversation.channels.map(channel => <span className="jigsaw-badge" key={channel}>{channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}</span>)}</span>
    </span><ArrowRight size={16} aria-hidden="true" />
  </button>;
}

export function MessageConversations() {
  const params = useSearchParams(), router = useRouter();
  const key = params.get('number') || '', contactUid = params.get('contact') || '';
  const [seed, setSeed] = useState<Conversation | null>(null), [resolving, setResolving] = useState(false), [resolutionError, setResolutionError] = useState('');
  const [settings, setSettings] = useState<AgencySettings | null>(null), [settingsError, setSettingsError] = useState(''), [settingsRevision, setSettingsRevision] = useState(0);
  useEffect(() => { let active = true; setSettingsError(''); jigsaw<AgencySettings>('settings/').then(value => { if (active) setSettings(value); }).catch(error => { if (active) setSettingsError(error.message); }); return () => { active = false; }; }, [settingsRevision]);
  useEffect(() => {
    let active = true; setResolutionError('');
    if (key || !contactUid) { setResolving(false); if (!key) setSeed(null); return; }
    setResolving(true); setSeed(null);
    jigsaw<Contact>(`contacts/${encodeURIComponent(contactUid)}/`).then(contact => {
      if (!active) return;
      if (!contact.phone) throw new Error('This contact has no phone number. Open an existing conversation or start one with a number.');
      setSeed({ conversation_number: contact.phone, number: contact.phone, contact_uid: contact.uid, contact_name: contact.name, message_count: 0, channels: [] });
    }).catch(error => { if (active) setResolutionError(error.message); }).finally(() => { if (active) setResolving(false); });
    return () => { active = false; };
  }, [key, contactUid]);
  const open = (conversation: Conversation) => { setSeed(conversation); router.push(conversationPath(conversation.conversation_number)); };
  const activeKey = key || (contactUid && seed?.contact_uid === contactUid ? seed.conversation_number : '');
  return <div className="jigsaw-stack jigsaw-conversations">
    {settingsError && <Notice error>{settingsError} <button type="button" className="jigsaw-link" onClick={() => setSettingsRevision(value => value + 1)}>Retry settings</button></Notice>}
    {resolving ? <Loading /> : resolutionError ? <Notice error>{resolutionError} <button className="jigsaw-link" type="button" onClick={() => router.push(`${ROOT}/workspace/messages`)}>All messages</button></Notice> : activeKey ?
      <ConversationThread key={activeKey} conversationKey={activeKey} initial={seed?.conversation_number === activeKey ? seed : null} settings={settings} /> : <ConversationList onOpen={open} />}
  </div>;
}

function ConversationList({ onOpen }: { onOpen: (conversation: Conversation) => void }) {
  const [data, setData] = useState<JsonRecord>({ results: [] }), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [offset, setOffset] = useState(0), [revision, setRevision] = useState(0), [creating, setCreating] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    let active = true, inFlight = false;
    setLoading(true); setError('');
    const load = async (quiet = false) => { if (inFlight) return; inFlight = true; try {
      const response = await jigsaw<JsonRecord>(`conversations/?limit=30&offset=${offset}&q=${encodeURIComponent(search)}`);
      if (active) { setData(response); setError(''); }
    } catch (failure) { if (active && !quiet) setError((failure as Error).message); } finally { inFlight = false; if (active && !quiet) setLoading(false); } };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 8000);
    const visible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [offset, search, revision]);
  return <section className="jigsaw-card"><div className="jigsaw-card-header"><div><h2>All messages</h2><p>One conversation per number. Open it to see the full WhatsApp and SMS history.</p></div><div className="jigsaw-inline"><button type="button" className="jigsaw-btn" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="Refresh conversations"><RefreshCw size={15} /></button><button type="button" className="jigsaw-btn jigsaw-btn-primary" onClick={() => setCreating(value => !value)}><Plus size={15} />New conversation</button></div></div>
    {creating && <NewConversation onOpen={onOpen} onClose={() => setCreating(false)} />}
    <div className="jigsaw-card-pad"><label className="jigsaw-field">Search conversations<span className="jigsaw-search"><Search size={15} /><input type="search" value={query} placeholder="Candidate, contact or phone number" onChange={event => { setQuery(event.target.value); setOffset(0); }} /></span></label></div>
    {loading ? <Loading /> : error ? <div className="jigsaw-card-pad"><Notice error>{error} <button type="button" className="jigsaw-link" onClick={() => setRevision(value => value + 1)}>Try again</button></Notice></div> : results<Conversation>(data).length ? <div>{results<Conversation>(data).map(conversation => <ConversationRow key={conversation.conversation_number} conversation={conversation} onOpen={() => onOpen(conversation)} />)}</div> : <div className="jigsaw-empty"><MessageCircle size={22} /><strong>{search ? 'No matching conversations' : 'No conversations yet'}</strong><p>{search ? 'Try another name or number.' : 'Incoming messages appear here. Start a new conversation to message a candidate or number.'}</p></div>}
    <div className="jigsaw-card-pad jigsaw-inline justify-between"><span className="jigsaw-small">{Number(data.count || 0)} conversation{Number(data.count || 0) === 1 ? '' : 's'}</span><div className="jigsaw-inline"><button className="jigsaw-btn" type="button" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}><ArrowLeft size={14} />Previous</button><button className="jigsaw-btn" type="button" disabled={loading || data.next == null} onClick={() => setOffset(Number(data.next))}>Next<ArrowRight size={14} /></button></div></div>
  </section>;
}

function NewConversation({ onOpen, onClose }: { onOpen: (conversation: Conversation) => void; onClose: () => void }) {
  const [number, setNumber] = useState(''), [contact, setContact] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const open = async (event: FormEvent) => { event.preventDefault(); setError(''); setBusy(true); try {
    let recipient = number.trim(), person: Contact | null = null;
    if (!recipient && contact) { person = await jigsaw<Contact>(`contacts/${encodeURIComponent(contact)}/`); recipient = person.phone; }
    if (!recipient) throw new Error('Enter a phone number or choose a contact with a phone number.');
    onOpen({ conversation_number: recipient, number: recipient, contact_uid: person?.uid || null, contact_name: person?.name || '', message_count: 0, channels: [] });
  } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); } };
  return <form className="jigsaw-card-pad jigsaw-form jigsaw-new-conversation" onSubmit={open}><label className="jigsaw-field">Phone number<input className="jigsaw-input" type="tel" value={number} placeholder="+44…" disabled={busy} onChange={event => { setNumber(event.target.value); setContact(''); }} /></label><details><summary className="jigsaw-link cursor-pointer">Or choose a candidate / contact</summary><div className="mt-3"><RecordContactSelector value={contact} disabled={busy} onChange={value => { setContact(value); setNumber(''); }} /></div></details>{error && <Notice error>{error}</Notice>}<div className="jigsaw-inline"><button className="jigsaw-btn jigsaw-btn-primary" type="submit" disabled={busy || (!number.trim() && !contact)}>{busy ? 'Opening…' : 'Open conversation'}</button><button type="button" className="jigsaw-btn" onClick={onClose}>Cancel</button></div></form>;
}

function ConversationThread({ conversationKey, initial, settings }: { conversationKey: string; initial: Conversation | null; settings: AgencySettings | null }) {
  const messages = useConversationHistory(conversationKey), list = useRef<HTMLDivElement | null>(null), previousLast = useRef('');
  const [downloadError, setDownloadError] = useState('');
  const conversation = messages.conversation || initial || { conversation_number: conversationKey, number: conversationKey.startsWith('+') ? conversationKey : '', contact_uid: null, contact_name: '', message_count: 0, channels: [] };
  const last = messages.items.at(-1)?.uid || '';
  useEffect(() => {
    if (last && last !== previousLast.current && list.current) {
      const node = list.current;
      if (!previousLast.current || node.scrollHeight - node.scrollTop - node.clientHeight < 220) node.scrollTop = node.scrollHeight;
    }
    previousLast.current = last;
  }, [last]);
  const older = () => { const node = list.current, height = node?.scrollHeight || 0, top = node?.scrollTop || 0; messages.loadOlder();
    // The button remains visible while older messages arrive; preserve the
    // reader's position when the DOM grows above their current view.
    if (node) pendingScroll.current = { height, top };
  };
  const pendingScroll = useRef<{ height: number; top: number } | null>(null);
  useEffect(() => { if (!messages.loadingOlder && pendingScroll.current && list.current) { const old = pendingScroll.current; list.current.scrollTop = old.top + list.current.scrollHeight - old.height; pendingScroll.current = null; } }, [messages.loadingOlder, messages.items.length]);
  const download = async (attachment: JsonRecord) => { setDownloadError(''); try { const blob = await jigsaw<Blob>(`messages/attachments/${encodeURIComponent(attachment.uid)}/download/`); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = attachment.filename || 'attachment'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (error) { setDownloadError((error as Error).message); } };
  return <><div><Link className="jigsaw-link jigsaw-inline" href={`${ROOT}/workspace/messages`}><ArrowLeft size={15} />All messages</Link></div><section className="jigsaw-card"><div className="jigsaw-card-header"><div><h2>{conversationTitle(conversation)}</h2><p>{conversation.number || 'Sender has no replyable phone number'} · {messages.count} message{messages.count === 1 ? '' : 's'}</p></div><div className="jigsaw-inline">{conversation.contact_uid && <Link className="jigsaw-btn" href={`${ROOT}/workspace/record/${conversation.contact_uid}`}><Users size={14} />Open contact</Link>}<button className="jigsaw-btn" type="button" onClick={messages.reload} aria-label="Refresh conversation"><RefreshCw size={15} /></button></div></div>
    <div className="jigsaw-chat-list jigsaw-conversation-history" ref={list} aria-label="Conversation messages">
      {messages.next != null && <div className="jigsaw-history-more"><button type="button" className="jigsaw-btn" disabled={messages.loadingOlder} onClick={older}>{messages.loadingOlder ? 'Loading older messages…' : 'Load older messages'}</button></div>}
      {messages.loading ? <Loading /> : messages.items.length ? messages.items.map(message => <div className={`jigsaw-bubble${message.direction === 'outbound' ? ' outbound' : ''}`} key={message.uid}><div style={{ whiteSpace: 'pre-wrap' }}>{message.body}</div>{message.attachments?.map(attachment => <button type="button" className="jigsaw-btn mt-2" key={attachment.uid} onClick={() => download(attachment)}><Paperclip size={13} />{attachment.filename}</button>)}<div className="jigsaw-bubble-meta"><span>{message.channel === 'whatsapp' ? 'WhatsApp' : message.channel.toUpperCase()}</span><span>{dateText(message.created_at)}</span><span>{title(message.status)}</span></div>{messageDeliveryHint(message) && <p className="jigsaw-small mt-2">{messageDeliveryHint(message)}</p>}</div>) : <div className="jigsaw-empty"><MessageCircle size={22} /><strong>No messages yet</strong><p>Your messages with this number will appear here.</p></div>}
    </div>{(messages.error || downloadError) && <div className="jigsaw-card-pad"><Notice error>{messages.error || downloadError}</Notice></div>}
    {settings ? <ConversationComposer conversation={conversation} settings={settings} onSent={messages.reload} /> : <div className="jigsaw-card-pad jigsaw-small">Loading messaging settings…</div>}
  </section></>;
}

export function ConversationComposer({ conversation, settings, onSent }: { conversation: Conversation; settings: AgencySettings; onSent: () => void }) {
  const [body, setBody] = useState(''), [template, setTemplate] = useState(''), [files, setFiles] = useState<File[]>([]), [busy, setBusy] = useState(false), [failure, setFailure] = useState(''), [feedback, setFeedback] = useState('');
  const telnyx = settings.settings.messaging_provider === 'telnyx', mediaLimit = telnyx ? 1 : 10, textLimit = telnyx && files.length ? 1024 : 4096;
  const bytes = new TextEncoder().encode(body).length, selectedTemplate = settings.settings.templates?.[template];
  const usesMessage = !!selectedTemplate && Array.isArray(selectedTemplate.parameters) && selectedTemplate.parameters.some((value: unknown) => typeof value === 'string' && value.includes('{message}'));
  const options = approvedManualTemplateOptions(settings.settings.templates || {}, telnyx);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!conversation.number) return; setFailure(''); setFeedback('');
    if (files.length > mediaLimit || (telnyx && bytes > textLimit)) { setFailure('Check the attachment count and message size before sending.'); return; }
    setBusy(true); try {
      const data = { ...(conversation.contact_uid ? { contact: conversation.contact_uid } : {}), to_number: conversation.number, body, ...(template && !files.length ? { template } : {}) };
      const form = new FormData(); Object.entries(data).forEach(([key, value]) => form.set(key, value)); files.forEach(file => form.append('files', file));
      const message = await jigsaw<Message>('messages/', 'POST', files.length ? form : data);
      setFeedback(message.status === 'observed' ? 'Message recorded for review. No message was sent in observation mode.' : 'Message queued. Delivery status updates in this conversation.');
      setBody(''); setTemplate(''); setFiles([]); onSent();
    } catch (error) { setFailure((error as Error).message); } finally { setBusy(false); }
  };
  const suggest = async () => { if (!conversation.contact_uid) return; setBusy(true); setFailure(''); try { const result = await jigsaw<JsonRecord>('messages/suggest-reply/', 'POST', { contact_uid: conversation.contact_uid, conversation_number: conversation.conversation_number }); if (!result.reply) throw new Error('AI could not make a useful draft. Write your reply manually.'); setBody(result.reply); setTemplate(''); setFeedback('AI draft only. Check the wording and facts before sending.'); } catch (error) { setFailure((error as Error).message); } finally { setBusy(false); } };
  if (!conversation.number) return <div className="jigsaw-card-pad"><Notice>This sender has no replyable phone number. You can read its messages here.</Notice></div>;
  return <form className="jigsaw-chat-compose" onSubmit={submit}><p className="jigsaw-small">WhatsApp first; SMS fallback follows failure or timeout. Outside the 24-hour reply window, use an approved template.</p><div className="jigsaw-form-grid"><label className="jigsaw-field">Approved template (optional)<select className="jigsaw-input" value={template} disabled={files.length > 0 || busy} onChange={event => { const key = event.target.value; setTemplate(key); const chosen = settings.settings.templates?.[key]; const variable = telnyx && Array.isArray(chosen?.parameters) && chosen.parameters.some((value: unknown) => typeof value === 'string' && value.includes('{message}')); if (chosen?.body && !variable) setBody(chosen.body); else if (variable && body === selectedTemplate?.body) setBody(''); }}><option value="">Free-text reply within the 24-hour window</option>{options.map(([key]) => <option key={key} value={key}>{title(key)}</option>)}</select></label><div className="jigsaw-inline items-end"><Link className="jigsaw-link" href={`${ROOT}/whatsapp`}>Manage templates and sender →</Link></div></div><textarea className="jigsaw-input" aria-label="Message text" placeholder="Write your message…" required={!files.length} value={body} maxLength={textLimit} disabled={busy} readOnly={!!template && telnyx && !usesMessage} onChange={event => setBody(event.target.value)} />
    {!!template && telnyx && <p className="jigsaw-small">{usesMessage ? 'Your text fills the {message} variable in the approved template.' : 'Approved wording is shown above. Variables use the saved template mapping.'}</p>}
    {files.length > 0 && <p className="jigsaw-small">{files.map(file => file.name).join(', ')}</p>}{failure && <Notice error>{failure}</Notice>}{feedback && <Notice>{feedback}</Notice>}
    <div className="jigsaw-inline"><label className="jigsaw-btn"><Paperclip size={14} />Attach photo or file<input className="sr-only" type="file" disabled={busy} multiple={!telnyx} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={event => { const selected = Array.from(event.target.files || []); if (selected.length > mediaLimit || selected.reduce((sum, file) => sum + file.size, 0) > 5 * 1024 * 1024) { setFailure(`Choose up to ${mediaLimit} file${mediaLimit === 1 ? '' : 's'}, 5 MB combined.`); return; } setFailure(''); setFiles(selected); setTemplate(''); }} /></label>{files.length > 0 && <button className="jigsaw-btn" type="button" disabled={busy} onClick={() => setFiles([])}>Clear attachments</button>}<button className="jigsaw-btn" type="button" disabled={busy || !conversation.contact_uid} onClick={suggest}>Suggest reply</button><span className="jigsaw-small">Attachments need an active WhatsApp reply window.{telnyx && ` ${bytes.toLocaleString()} / ${textLimit.toLocaleString()} bytes`}</span></div>
    <div className="jigsaw-inline justify-between"><span className="jigsaw-small">{settings.mode === 'live' ? 'Live messaging' : 'Observation mode · review alerts only'}</span><button className="jigsaw-btn jigsaw-btn-primary" type="submit" disabled={busy || (!body.trim() && !files.length)}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{settings.mode === 'live' ? 'Send message' : 'Create review message'}</button></div>
  </form>;
}
