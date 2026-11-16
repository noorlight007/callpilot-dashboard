const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const project = path.resolve(__dirname, '..'), requireProject = createRequire(path.join(project, 'package.json'));
const React = requireProject('react'), { renderToStaticMarkup } = requireProject('react-dom/server'), ts = requireProject('typescript');
function load(relative, imports = {}, globals = {}) {
  const module = { exports: {} }, source = fs.readFileSync(path.join(project, relative), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Date, Map, Number, String, Error, Object, Array, TextEncoder, FormData, encodeURIComponent,
    require: name => name in imports ? imports[name] : requireProject(name), ...globals,
  }); return module.exports;
}
const helpers = load('lib/conversation-history.ts');
const message = (i, extra = {}) => ({ uid: String(i), to_number: '+447911123456', body: `Message ${i}`, channel: 'whatsapp', direction: 'inbound', status: 'received', created_at: new Date(Date.parse('2026-11-16T08:00:00Z') + i * 1000).toISOString(), ...extra });
const page = (messages, count, next) => ({ results: messages, count, next });

test('overlapping history pages merge WhatsApp/SMS once in chronological order', () => {
  let state = helpers.mergeConversationPage(helpers.emptyHistory(), page([message(3), message(2)], 4, 2));
  state = helpers.mergeConversationPage(state, page([message(2), message(1, { channel: 'sms' }), message(0)], 4, null), true);
  assert.deepEqual(Array.from(state.items, row => row.uid), ['0', '1', '2', '3']);
  assert.equal(state.items[1].channel, 'sms'); assert.equal(state.next, null);
});
test('latest delivery status replaces an existing bubble while older messages remain', () => {
  let state = helpers.mergeConversationPage(helpers.emptyHistory(), page([message(3, { status: 'queued' })], 4, 1));
  state = helpers.mergeConversationPage(state, page([message(2), message(1)], 4, 3), true);
  state = helpers.mergeConversationPage(state, page([message(4), message(3, { status: 'delivered' })], 5, 2));
  assert.deepEqual(Array.from(state.items, row => row.uid), ['1', '2', '3', '4']); assert.equal(state.items[2].status, 'delivered'); assert.equal(state.next, 4);
});
test('fully loaded history stays complete after a new inbound message', () => {
  let state = helpers.mergeConversationPage(helpers.emptyHistory(), page([message(0)], 1, null));
  state = helpers.mergeConversationPage(state, page([message(1), message(0)], 2, null));
  assert.equal(state.items.length, 2); assert.equal(state.next, null);
});
test('a large new burst resets the next boundary so no history gap is skipped', () => {
  const state = { ...helpers.emptyHistory(), items: [message(0)], count: 1, next: null };
  const refreshed = helpers.mergeConversationPage(state, page([message(100)], 101, 50));
  assert.equal(refreshed.next, 50);
});
test('candidate names label number conversations and preview never invents delivery', () => {
  const conversation = { conversation_number: '+447911123456', number: '+447911123456', contact_name: 'Test Candidate', last_message: message(1, { body: 'Hello\n   candidate', status: 'queued' }) };
  assert.equal(helpers.conversationTitle(conversation), 'Test Candidate'); assert.equal(helpers.conversationPreview(conversation), 'Hello candidate');
  assert.equal(helpers.conversationPath(conversation.conversation_number), '/dashboard/ai-jigsaw/workspace/messages?number=%2B447911123456');
});
const noopIcon = () => null;
const icons = { ArrowLeft: noopIcon, ArrowRight: noopIcon, Info: noopIcon, Loader2: noopIcon, MessageCircle: noopIcon, Paperclip: noopIcon, Plus: noopIcon, RefreshCw: noopIcon, Search: noopIcon, Send: noopIcon, Users: noopIcon };
function component(imports = {}) { return load('components/jigsaw/message-conversations.tsx', {
  react: React, 'next/link': { default: props => React.createElement('a', props, props.children) }, 'next/navigation': {}, 'lucide-react': icons,
  '@/services/jigsaw-service': { jigsaw() {}, results: value => value?.results || [] }, '@/hooks/use-conversation-history': {}, '@/lib/conversation-history': helpers,
  '@/lib/message-delivery': { messageDeliveryHint: () => '' }, './whatsapp-template-workflows': { approvedManualTemplateOptions: () => [] }, './record-contact-selector': {}, ...imports,
}); }
test('conversation rows show name, number, preview, count and both channels', () => {
  const { ConversationRow } = component();
  const html = renderToStaticMarkup(React.createElement(ConversationRow, { conversation: { conversation_number: '+447911123456', number: '+447911123456', contact_uid: 'candidate1', contact_name: 'Test Candidate', message_count: 650, channels: ['whatsapp', 'sms'], last_message: message(1, { body: '<script>untrusted</script>' }) }, onOpen() {} }));
  assert.match(html, /Open conversation with Test Candidate/); assert.match(html, /650 messages/); assert.match(html, /WhatsApp/); assert.match(html, /SMS/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
});
function walk(element, predicate) { if (!element || typeof element !== 'object') return null; if (predicate(element)) return element; for (const child of React.Children.toArray(element.props?.children)) { const found = walk(child, predicate); if (found) return found; } return null; }
test('composer explicitly replies to the opened number even when a contact is linked', async () => {
  const values = ['Test reply', 'document_request', [], false, '', ''], requests = []; let cursor = 0, sent = 0;
  const hooks = { ...React, useState(initial) { const id = cursor++; return [values[id] ?? initial, value => { values[id] = value; }]; } };
  const { ConversationComposer } = component({ react: hooks, '@/services/jigsaw-service': { results: () => [], jigsaw: async (...args) => { requests.push(args); return { status: 'queued' }; } } });
  const tree = ConversationComposer({ conversation: { number: '+447911123457', contact_uid: 'candidate1' }, settings: { mode: 'live', settings: { messaging_provider: 'telnyx', templates: {} } }, onSent() { sent++; } });
  await walk(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(requests.length, 1); assert.equal(requests[0][0], 'messages/'); assert.equal(requests[0][2].to_number, '+447911123457'); assert.equal(requests[0][2].contact, 'candidate1'); assert.equal(sent, 1); assert.equal(values[1], '', 'A sent template must not leave an empty read-only composer');
});
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function feed(request) {
  const values = [], effects = [], refs = [], timers = new Map(), listeners = new Map(), requests = []; let cursor = 0, refCursor = 0, timerId = 0;
  const hooks = { useState(initial) { const id = cursor++; if (!(id in values)) values[id] = initial; return [values[id], value => { values[id] = value; }]; }, useRef(initial) { const id = refCursor++; return refs[id] || (refs[id] = { current: initial }); }, useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } };
  const window = { setInterval(fn) { timers.set(++timerId, fn); return timerId; }, clearInterval: id => timers.delete(id) };
  const module = load('hooks/use-conversation-history.ts', { react: hooks, '@/lib/conversation-history': helpers, '@/services/jigsaw-service': { jigsaw: path => { requests.push(path); return request(path); } } }, { window, document });
  const render = key => { cursor = 0; refCursor = 0; return module.useConversationHistory(key); };
  render('+447911123456'); const cleanup = effects.shift()();
  return { values, requests, render, cleanup, poll() { for (const callback of timers.values()) callback(); }, document, timers, listeners, startEffect: () => effects.shift()() };
}
test('open threads poll for new inbound messages even when no delivery is pending', async () => {
  let calls = 0; const h = feed(() => Promise.resolve(++calls === 1 ? page([message(0)], 1, null) : page([message(1), message(0)], 2, null)));
  await tick(); h.poll(); await tick(); assert.equal(h.requests.length, 2); assert.equal(h.values[0].items.length, 2); assert.equal(h.values[0].loading, false); h.cleanup();
});
test('older history uses the next page, includes more than the latest 500 and deduplicates overlap', async () => {
  let calls = 0; const h = feed(() => Promise.resolve(++calls === 1 ? page([message(650), message(649)], 651, 50) : page([message(649), message(0)], 651, 100)));
  await tick(); h.render('+447911123456').loadOlder(); await tick(); assert.match(h.requests[1], /offset=50/); assert.equal(h.values[0].items[0].uid, '0'); assert.equal(h.values[0].items.length, 3); h.cleanup();
});
test('late requests from a closed thread cannot replace another conversation', async () => {
  const pending = deferred(); let calls = 0; const h = feed(() => ++calls === 1 ? pending.promise : Promise.resolve(page([message(10)], 1, null)));
  h.cleanup(); h.render('+447911123457'); h.startEffect(); await tick(); pending.resolve(page([message(1)], 1, null)); await tick(); assert.equal(h.values[0].items[0].uid, '10');
});
test('hidden tabs pause incoming polling and cleanup removes timers', async () => {
  const h = feed(() => Promise.resolve(page([message(1)], 1, null))); await tick(); h.document.visibilityState = 'hidden'; h.poll(); assert.equal(h.requests.length, 1); h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});


test('loading older messages waits for an in-flight refresh instead of dropping the click', async () => {
  const pending = deferred(); let calls = 0;
  const h = feed(() => ++calls === 1 ? Promise.resolve(page([message(100)], 101, 50)) : calls === 2 ? pending.promise : Promise.resolve(page([message(49)], 101, 100)));
  await tick(); h.poll(); h.render('+447911123456').loadOlder();
  assert.equal(h.requests.length, 2);
  pending.resolve(page([message(100)], 101, 50)); await tick(); await tick();
  assert.equal(h.requests.length, 3); assert.match(h.requests[2], /offset=50/); assert.equal(h.values[0].items[0].uid, '49'); h.cleanup();
});
