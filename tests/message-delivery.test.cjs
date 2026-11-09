const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || path.resolve(__dirname, '..');
const requireProject = createRequire(path.join(project, 'package.json'));
const ts = requireProject('typescript');
const sourceRoot = path.resolve(__dirname, '..');

function load(file, imports, extra = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Date, Error, Number,
    require: name => name in imports ? imports[name] : requireProject(name), ...extra,
  });
  return module.exports;
}
const delivery = load('lib/message-delivery.ts', {});
const message = (status, extra = {}) => ({ direction: 'outbound', status, created_at: '2026-11-09T08:00:00Z', ...extra });
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function feed(request) {
  const values = [], effects = [], timers = new Map(), listeners = new Map(), calls = [];
  let cursor = 0, timerId = 0;
  const document = { visibilityState: 'visible', addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); } };
  const window = { setInterval: callback => { timers.set(++timerId, callback); return timerId; }, clearInterval: id => timers.delete(id) };
  const hooks = {
    useState(initial) { const id = cursor++; if (!(id in values)) values[id] = initial; return [values[id], next => { values[id] = typeof next === 'function' ? next(values[id]) : next; }]; },
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
  };
  const module = load('hooks/use-message-feed.ts', { react: hooks, '@/services/jigsaw-service': { jigsaw: url => { calls.push(url); return request(url); }, results: value => value.results || [] }, '@/lib/message-delivery': delivery }, { window, document });
  const render = url => { cursor = 0; return module.useMessageFeed(url); };
  render('messages/?contact=first');
  const cleanup = effects.shift()();
  return { values, calls, document, timers, listeners, cleanup, render, startEffect: () => effects.shift()(), poll: () => [...timers.values()].forEach(callback => callback()) };
}

test('queued messages explain worker delay, never claim delivery', () => {
  assert.match(delivery.messageDeliveryHint(message('queued'), Date.parse('2026-11-09T08:00:30Z')), /Waiting for the messaging worker/);
  assert.match(delivery.messageDeliveryHint(message('queued'), Date.parse('2026-11-09T08:01:00Z')), /Ask your administrator to check the messaging worker/);
  assert.match(delivery.messageDeliveryHint(message('sent')), /awaiting delivery confirmation/);
  assert.equal(delivery.messageDeliveryHint(message('delivered')), '');
  assert.equal(delivery.messageDeliveryHint(message('read', { failure_reason: 'An earlier delivery attempt failed.' })), '');
  assert.equal(delivery.messageDeliveryHint(message('queued', { direction: 'inbound' })), '');
  assert.match(delivery.messageDeliveryHint(message('queued', { created_at: 'invalid' })), /Waiting for the messaging worker/);
});

test('review and failure reasons remain visible and terminal states stop polling', () => {
  assert.equal(delivery.messageDeliveryHint(message('needs_review', { failure_reason: 'The provider outcome needs review.' })), 'The provider outcome needs review.');
  assert.match(delivery.messageDeliveryHint(message('needs_review')), /Check Alerts/);
  for (const status of ['queued', 'pending', 'sending', 'sent']) assert.equal(delivery.messageNeedsRefresh(message(status)), true);
  for (const status of ['observed', 'needs_review', 'delivered', 'read', 'failed', 'undelivered', 'cancelled']) assert.equal(delivery.messageNeedsRefresh(message(status)), false);
  assert.equal(delivery.messageNeedsRefresh(message('sent', { direction: 'inbound' })), false);
});

test('background refresh preserves the conversation until delivery changes and stops at a terminal result', async () => {
  const pending = deferred(); let attempts = 0;
  const h = feed(() => ++attempts === 1 ? Promise.resolve({ results: [message('queued')] }) : pending.promise);
  await tick();
  assert.equal(h.values[1], false);
  h.poll();
  assert.equal(h.calls.length, 2);
  assert.equal(h.values[1], false, 'Quiet polling must not replace the chat with a loading screen');
  assert.equal(h.values[0].results[0].status, 'queued');
  h.poll(); assert.equal(h.calls.length, 2, 'Overlapping delivery requests are suppressed');
  pending.resolve({ results: [message('delivered')] }); await tick();
  assert.equal(h.values[0].results[0].status, 'delivered');
  h.poll(); assert.equal(h.calls.length, 2);
  h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});

test('hidden tabs pause polling; a temporary refresh error retains existing messages', async () => {
  let attempts = 0;
  const h = feed(() => ++attempts === 1 ? Promise.resolve({ results: [message('sent')] }) : Promise.reject(new Error('Temporary outage')));
  await tick(); h.document.visibilityState = 'hidden'; h.poll(); assert.equal(h.calls.length, 1);
  h.document.visibilityState = 'visible'; h.listeners.get('visibilitychange')(); await tick();
  assert.equal(h.calls.length, 2); assert.equal(h.values[0].results[0].status, 'sent'); assert.equal(h.values[2], '');
  h.cleanup();
});

test('late requests cannot update an unmounted conversation', async () => {
  const pending = deferred(); const h = feed(() => pending.promise);
  h.cleanup(); pending.resolve({ results: [message('sent')] }); await tick();
  assert.equal(h.values[0].results.length, 0);
  assert.equal(h.values[1], true);
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});
