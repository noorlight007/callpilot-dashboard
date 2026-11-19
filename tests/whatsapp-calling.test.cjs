const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || root;
const requireProject = createRequire(path.join(project, 'package.json'));
const ts = requireProject('typescript');
function compile(source, context = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, require: requireProject, Date, console: { warn() {} }, ...context });
  return module.exports;
}
const serviceSource = fs.readFileSync(path.join(root, 'services/whatsapp-calling-service.ts'), 'utf8');
function service(request) {
  return compile(serviceSource, { require: name => name === '@/services/jigsaw-service' ? { apiRequest: request } : requireProject(name) });
}
const helpers = service(() => { throw new Error('Unexpected API request'); });
const number = '+441316001234';
const permission = { number, can_call: true, can_request: false, status: 'permanent', expires_at: null, detail: '' };

test('WhatsApp permission is bound to the selected number and its expiry', () => {
  assert.equal(helpers.whatsAppPermissionAllowsCall(permission, number), true);
  assert.equal(helpers.whatsAppPermissionAllowsCall(permission, '+441234567890'), false);
  assert.equal(helpers.whatsAppPermissionAllowsCall({ ...permission, can_call: false }, number), false);
  assert.equal(helpers.whatsAppPermissionAllowsCall({ ...permission, expires_at: 'invalid' }, number), false);
  assert.equal(helpers.whatsAppPermissionAllowsCall({ ...permission, expires_at: '2026-11-18T10:00:00Z' }, number, Date.parse('2026-11-18T10:00:00Z')), false);
  assert.equal(helpers.whatsAppPermissionAllowsCall({ ...permission, expires_at: '2026-11-18T10:00:01Z' }, number, Date.parse('2026-11-18T10:00:00Z')), true);
  assert.equal(helpers.isWhatsAppNumber('101'), false);
  assert.equal(helpers.callChannelLabel('whatsapp'), 'WhatsApp');
  assert.equal(helpers.callChannelLabel(undefined), 'Phone');
});

test('WhatsApp sessions use their own endpoint and reject another channel or destination', async () => {
  const calls = [];
  const signed = { destination_number: number, channel: 'whatsapp', call_session_proof: 'proof' };
  const api = service(async (...args) => { calls.push(args); return signed; });
  assert.equal((await api.whatsAppCalling.session(number)).call_session_proof, 'proof');
  assert.equal(calls[0][0], '/voice/api/whatsapp/session/');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), { number });
  await assert.rejects(service(async () => ({ ...signed, channel: 'phone' })).whatsAppCalling.session(number), /did not authorize/);
  await assert.rejects(service(async () => ({ ...signed, destination_number: '+441234567890' })).whatsAppCalling.session(number), /did not authorize/);
});

const source = fs.readFileSync(path.join(root, 'components/voip-dashboard-content.tsx'), 'utf8');
const ast = ts.createSourceFile('phone.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'dialWhatsApp') declaration = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(declaration);
const connection = compile(fs.readFileSync(path.join(project, 'lib/voip-connection.ts'), 'utf8'));
function phone(overrides = {}) {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const stream = { getTracks: () => tracks }, calls = [];
  const client = { newCall(options) { calls.push(options); return { id: 'wa-call' }; } };
  let microphoneRequests = 0, sessionRequests = 0;
  const context = {
    dialNumber: number, normalizeBusinessPhoneNumber: value => value, ...helpers,
    whatsApp: { setup: { outbound_ready: true }, permission, refresh() {} },
    clientRef: { current: client }, clientReadyRef: { current: true },
    activeCallRef: { current: null }, incomingCallRef: { current: null },
    isDialingRef: { current: false }, dialedNumberRef: { current: '' },
    whatsAppCallIdsRef: { current: new Set() }, callId: call => call.id,
    connectionLifecycleRef: { current: { signal: { aborted: false } } },
    setCallError() {}, setIsDialing() {}, setStatusDetail() {}, setDialNumber() {}, showActive() {},
    ensureMicrophoneReady: async () => { microphoneRequests++; return stream; },
    stopMediaStream: value => value?.getTracks().forEach(track => track.stop()),
    friendlyMediaError: error => error.message,
    createAuthorizedCall: connection.createAuthorizedCall,
    whatsAppCalling: { session: async target => { sessionRequests++; assert.equal(target, number); return { call_session_proof: 'whatsapp-proof', extension_uid: 'consultant-extension' }; } },
    ...overrides,
  };
  const dial = compile(`const ${declaration}; module.exports = dialWhatsApp;`, context);
  return { context, calls, tracks, dial, counts: () => ({ microphoneRequests, sessionRequests }) };
}

test('authorized WhatsApp uses the existing RTC client with its signed session', async () => {
  const p = phone(); await p.dial();
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].destinationNumber, number);
  assert.deepEqual(Array.from(p.calls[0].customHeaders, value => ({ ...value })), [
    { name: 'X-CallPilot-Session', value: 'whatsapp-proof' },
    { name: 'X-Voice-Ext', value: 'consultant-extension' },
  ]);
  assert.equal(p.context.activeCallRef.current.callpilotChannel, 'whatsapp');
  assert.equal(p.tracks[0].stopped, false);
  assert.equal(p.context.isDialingRef.current, false);
});

for (const [name, change] of [
  ['not ready', { setup: { outbound_ready: false }, permission }],
  ['permission missing', { setup: { outbound_ready: true }, permission: null }],
  ['permission denied', { setup: { outbound_ready: true }, permission: { ...permission, can_call: false } }],
  ['another recipient', { setup: { outbound_ready: true }, permission: { ...permission, number: '+441234567890' } }],
]) {
  test(`WhatsApp ${name} starts no media or call`, async () => {
    const p = phone({ whatsApp: change }); await p.dial();
    assert.equal(p.calls.length, 0);
    assert.equal(p.counts().microphoneRequests, 0);
    assert.equal(p.counts().sessionRequests, 0);
  });
}

test('WhatsApp authorization failure releases media and never falls back to Phone', async () => {
  const p = phone({ whatsAppCalling: { session: async () => { throw new Error('Permission revoked'); } } });
  await p.dial();
  assert.equal(p.calls.length, 0);
  assert.equal(p.tracks[0].stopped, true);
  assert.equal(p.context.isDialingRef.current, false);
});

test('an incoming call during WhatsApp authorization prevents RTC start', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const p = phone({ whatsAppCalling: { session: () => pending } });
  const dialing = p.dial();
  await Promise.resolve();
  p.context.incomingCallRef.current = { id: 'incoming' };
  resolve({ call_session_proof: 'proof' }); await dialing;
  assert.equal(p.calls.length, 0);
  assert.equal(p.tracks[0].stopped, true);
});

test('WhatsApp contact link stays in Jigsaw and preserves its channel', () => {
  const links = compile(fs.readFileSync(path.join(root, 'components/jigsaw/business-phone-link.tsx'), 'utf8'), { require: name => name === 'next/link' ? {} : requireProject(name) });
  assert.equal(links.businessPhoneHref(number, 'whatsapp'), '/dashboard/ai-jigsaw/workspace/phone?dial=%2B441316001234&channel=whatsapp');
  assert.equal(links.businessPhoneHref(number), '/dashboard/ai-jigsaw/workspace/phone?dial=%2B441316001234');
});

test('incoming WhatsApp labels trust only the explicit CallPilot SIP metadata', () => {
  assert.equal(helpers.rtcCallChannel({ options: { customHeaders: [{ name: 'X-CallPilot-Channel', value: 'whatsapp' }] } }), 'whatsapp');
  assert.equal(helpers.rtcCallChannel({ options: { customHeaders: [{ name: 'X-CallPilot-Channel', value: 'WHATSAPP' }] } }), 'phone');
  assert.equal(helpers.rtcCallChannel({ options: { customHeaders: [{ name: 'X-Provider-Channel', value: 'whatsapp' }] } }), 'phone');
  assert.equal(helpers.rtcCallChannel({ number: '+441316001234' }), 'phone');
});

test('a late permission request cannot replace the new recipient’s permission', async () => {
  const values = [], effects = [], timers = [];
  let cursor = 0, resolveRequest;
  const depsEqual = (left, right) => !!left && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const hooks = {
    useState(initial) { const id = cursor++; if (!(id in values)) values[id] = initial; return [values[id], next => { values[id] = typeof next === 'function' ? next(values[id]) : next; }]; },
    useRef(initial) { const id = cursor++; return values[id] ||= { current: initial }; },
    useCallback(callback, deps) { const id = cursor++; if (!depsEqual(values[id]?.deps, deps)) values[id] = { callback, deps }; return values[id].callback; },
    useEffect(callback, deps) { const id = cursor++; if (!depsEqual(values[id]?.deps, deps)) { values[id]?.cleanup?.(); values[id] = { deps }; effects.push(() => { values[id].cleanup = callback(); }); } },
  };
  const api = { ...helpers, whatsAppCalling: {
    setup: async () => ({ outbound_ready: true }),
    permission: async selected => ({ ...permission, number: selected, can_call: false, can_request: true }),
    requestPermission: () => new Promise(resolve => { resolveRequest = resolve; }),
  } };
  const source = fs.readFileSync(path.join(root, 'hooks/use-whatsapp-calling.ts'), 'utf8');
  const hook = compile(source, {
    require: name => name === 'react' ? hooks : name === '@/services/whatsapp-calling-service' ? api : requireProject(name),
    AbortController,
    setTimeout(callback) { const timer = { callback }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cancelled = true; },
  });
  function render(selected) { cursor = 0; const result = hook.useWhatsAppCalling(selected, true); while (effects.length) effects.shift()(); return result; }
  async function flush() { while (timers.length) { const timer = timers.shift(); if (!timer.cancelled) await timer.callback(); } }
  render(number); await flush();
  const oldRequest = render(number).request();
  const nextNumber = '+441234567890';
  render(nextNumber); await flush();
  resolveRequest({ ...permission, can_call: true }); await oldRequest;
  const current = render(nextNumber);
  assert.equal(current.permission.number, nextNumber);
  assert.equal(current.permission.can_call, false);
  assert.equal(current.requesting, false);
});
