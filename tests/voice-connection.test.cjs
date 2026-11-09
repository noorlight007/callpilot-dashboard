const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');

const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || path.resolve(__dirname, '..');
const requireProject = createRequire(path.join(project, 'package.json'));
const ts = requireProject('typescript');
const React = requireProject('react');
const { renderToStaticMarkup } = requireProject('react-dom/server');
const componentSource = fs.readFileSync(path.join(__dirname, '../components/voip-dashboard-content.tsx'), 'utf8');
const sourceFile = ts.createSourceFile('phone.tsx', componentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function compile(source, context = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, require: requireProject, console: { warn() {}, error() {} }, ...context });
  return module.exports;
}
function declaration(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === name) found = node.getText(sourceFile);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(found, `Production declaration ${name} exists`);
  return `const ${found};`;
}
function getFunction(name, context) { return compile(`${declaration(name)}\nmodule.exports = ${name};`, context); }
const connection = compile(fs.readFileSync(path.join(__dirname, '../lib/voip-connection.ts'), 'utf8'));
const extensionUid = '3a06f1bf-534d-437e-8f23-ecfa51327042';
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function phone(overrides = {}) {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const stream = { getTracks: () => tracks };
  const calls = [];
  const call = { id: 'mock-call', state: 'trying' };
  const client = { newCall(options) { calls.push(options); return call; } };
  const context = {
    dialNumber: '+441316001234', sanitizeCallableNumber: number => number, phoneSetup: null,
    clientRef: { current: client }, clientReadyRef: { current: true },
    incomingCallRef: { current: null }, activeCallRef: { current: null },
    isDialingRef: { current: false }, dialedNumberRef: { current: '' },
    connectionLifecycleRef: { current: { signal: { aborted: false } } },
    cfgRef: { current: { callerId: '+441310000000', extensionUid: 'profile-user-not-extension' } },
    setIsDialing() {}, setCallError() {}, setStatusDetail() {}, setDialNumber() {}, showActive() {},
    ensureMicrophoneReady: async () => stream,
    stopMediaStream: value => value?.getTracks().forEach(track => track.stop()),
    friendlyMediaError: error => error.message,
    apiRequest: async () => ({ call_session_proof: 'signed-proof', extension_uid: extensionUid }),
    createAuthorizedCall: connection.createAuthorizedCall,
    ...overrides
  };
  return { context, tracks, calls, client, call, dial: getFunction('dial', context) };
}

test('outbound call uses a fresh signed session and server extension identity', async () => {
  const requests = [];
  const p = phone({ apiRequest: async (...args) => { requests.push(args); return { call_session_proof: 'fresh-proof', extension_uid: extensionUid }; } });
  await p.dial();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], '/voice/api/token/');
  assert.equal(requests[0][1].method, 'POST');
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].destinationNumber, '+441316001234');
  assert.deepEqual(Array.from(p.calls[0].customHeaders, row => ({ ...row })), [
    { name: 'X-CallPilot-Session', value: 'fresh-proof' },
    { name: 'X-Voice-Ext', value: extensionUid }
  ]);
  assert.equal(p.tracks[0].stopped, false, 'RTC owns the successful call microphone');
  assert.equal(p.context.isDialingRef.current, false);
});

test('older token response omits the extension header without using 101 or a profile UID', async () => {
  const p = phone({ apiRequest: async () => ({ call_session_proof: 'proof-only' }) });
  await p.dial();
  assert.equal(p.calls.length, 1);
  assert.deepEqual(Array.from(p.calls[0].customHeaders, row => ({ ...row })), [{ name: 'X-CallPilot-Session', value: 'proof-only' }]);
});

test('authorization failure releases the microphone and never starts RTC', async () => {
  const p = phone({ apiRequest: async () => ({ extension_uid: extensionUid }) });
  await p.dial();
  assert.equal(p.calls.length, 0);
  assert.equal(p.tracks[0].stopped, true);
  assert.equal(p.context.isDialingRef.current, false);
});

for (const [name, change] of [
  ['replacement client', p => { p.context.clientRef.current = { newCall() { throw new Error('Unexpected replacement call'); } }; }],
  ['registration lost', p => { p.context.clientReadyRef.current = false; }],
  ['incoming call', p => { p.context.incomingCallRef.current = { id: 'incoming' }; }],
  ['another active call', p => { p.context.activeCallRef.current = { id: 'other' }; }],
  ['phone unmounted', p => { p.context.connectionLifecycleRef.current.signal.aborted = true; }]
]) {
  test(`async ${name} prevents outbound call and releases microphone`, async () => {
    const session = deferred();
    const p = phone({ apiRequest: () => session.promise });
    const pending = p.dial();
    await Promise.resolve();
    change(p);
    session.resolve({ call_session_proof: 'fresh-proof', extension_uid: extensionUid });
    await pending;
    assert.equal(p.calls.length, 0);
    assert.equal(p.tracks[0].stopped, true);
    assert.equal(p.context.isDialingRef.current, false);
  });
}

test('microphone failure starts no call or token request', async () => {
  let requests = 0;
  const p = phone({ ensureMicrophoneReady: async () => { throw new Error('Microphone blocked'); }, apiRequest: async () => { requests++; } });
  await p.dial();
  assert.equal(p.calls.length, 0);
  assert.equal(requests, 0);
  assert.equal(p.context.isDialingRef.current, false);
});

test('reconnect defers while the dial session is being authorized', async () => {
  const p = phone();
  let scheduled;
  p.context.isDialingRef.current = true;
  const connect = getFunction('connect', { ...p.context, scheduleReconnect: delay => { scheduled = delay; } });
  await connect();
  assert.equal(scheduled, 15000);
  assert.equal(p.calls.length, 0);
});

test('reconnect also rechecks dialing after its replacement token request', async () => {
  const p = phone();
  const token = deferred();
  const session = { current: false };
  let disconnects = 0, scheduled;
  p.client.disconnect = () => { disconnects++; };
  const context = {
    ...p.context, isConnectingRef: { current: false }, reconnectTimerRef: { current: null }, readyWatchdogRef: { current: null },
    scheduleReconnect: delay => { scheduled = delay; }, clearTimeout() {},
    loadTelnyxSdk: async () => class MockRTC {},
    fetchTelnyxToken: async () => { session.current = true; return token.promise; },
    cookieUtils: { get: () => null }, getCookie: () => null,
    setStatus() {}, setExtension() {}, getVoiceRegistration: () => ({ extension: '203' })
  };
  const pending = getFunction('connect', context)();
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(session.current, true);
  context.isDialingRef.current = true;
  token.resolve('mock-token');
  await pending;
  assert.equal(disconnects, 0);
  assert.equal(scheduled, 15000);
  assert.equal(context.clientRef.current, p.client);
});

function lookupMarkup(data, phoneNumber = '+441316001234', callNumber = phoneNumber) {
  const passthrough = ({ children }) => React.createElement('span', null, children);
  const context = {
    callerLookup: { phone: phoneNumber, loading: false, error: null, data },
    phoneOfCall: call => call.number,
    safeAtsUrl: url => url?.startsWith('https://') ? url : '',
    contactRecordHref: uid => `/dashboard/ai-jigsaw/workspace/record/${encodeURIComponent(uid)}`,
    Link: ({children, ...props}) => React.createElement('a', props, children),
    Badge: passthrough, Loader2: passthrough, Phone: passthrough, Mail: passthrough, Building2: passthrough, ExternalLink: passthrough
  };
  context.renderLookupDetail = getFunction('renderLookupDetail', context);
  return renderToStaticMarkup(getFunction('renderCallerLookupPanel', context)({ number: callNumber }));
}
const contact = { uid: extensionUid, name: 'Alex Example', kind: 'candidate', phone: '+441316001234', email: 'alex@example.test', ats_id: '1234', ats_url: 'https://ats.example.test/candidate/1234', status: 'Available', skills: ['Plumbing'], metadata: { company_name: 'Example Ltd' } };
test('matched incoming and outgoing caller panel includes shared contact details and record links', () => {
  const markup = lookupMarkup({ source: 'AI Jigsaw', match_state: 'matched', found: true, contact, matches: [contact] });
  for (const value of ['Alex Example', 'candidate', '+441316001234', 'alex@example.test', 'Example Ltd', 'Plumbing', 'Open AI Jigsaw record', contact.ats_url]) assert.ok(markup.includes(value), value);
});
test('ambiguous number has no automatic selected identity', () => {
  const markup = lookupMarkup({ source: 'AI Jigsaw', match_state: 'ambiguous', found: true, contact: null, matches: [contact, { ...contact, uid: 'other', name: 'Blair Example' }] });
  assert.ok(markup.includes('The caller has not been matched.'));
  assert.ok(markup.includes('Alex Example'));
  assert.ok(markup.includes('Blair Example'));
  assert.ok(!markup.includes('<strong>Alex Example'));
});
test('unknown number and another call never inherit a contact name', () => {
  const markup = lookupMarkup({ source: 'AI Jigsaw', match_state: 'unknown', found: false, contact: null, matches: [] });
  assert.ok(markup.includes('No AI Jigsaw contact matches this number.'));
  assert.ok(!markup.includes('Alex Example'));
  assert.equal(lookupMarkup({ match_state: 'matched', contact, matches: [contact] }, contact.phone, '+441234567890'), '');
});
test('phone source has no duplicate contact endpoints, live ATS lookup or sample history fallback', () => {
  for (const value of ['/contacts/fetch', '/jobadder-caller-lookup/', 'setContactsList', 'renderContactsPanel', 'Sarah Jenkins', 'SoundHelix-Song']) assert.ok(!componentSource.includes(value), value);
  assert.ok(componentSource.includes('/voice/api/contact-lookup/'));
  assert.ok(componentSource.includes('<Link href={JIGSAW_CONTACTS_HREF}'));
  assert.ok(!componentSource.includes('href={JIGSAW_CONTACTS_HREF} target="_blank"'));
  assert.ok(componentSource.includes('<Link href={contactRecordHref(c.contact_uid)}'));
});

test('contact call link opens the Jigsaw phone in the current tab and normalizes its number', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/jigsaw/business-phone-link.tsx'), 'utf8');
  const link = compile(source, { require: name => name === 'next/link'
    ? { default: ({children, ...props}) => React.createElement('a', props, children) }
    : requireProject(name) });
  const markup = renderToStaticMarkup(React.createElement(link.BusinessPhoneLink, {number: '+44 (131) 600-1234'}, 'Call contact'));
  assert.ok(markup.includes('href="/dashboard/ai-jigsaw/workspace/phone?dial=%2B441316001234"'));
  assert.ok(!markup.includes('target='));
  assert.equal(link.businessPhoneHref('javascript:alert(1)'), '/dashboard/ai-jigsaw/workspace/phone');
  assert.equal(link.normalizeBusinessPhoneNumber('+8801815553036'), '+8801815553036');
});

const failureHelpers = compile(fs.readFileSync(path.join(__dirname, '../lib/voice-failures.ts'), 'utf8'));
test('failed destination calls show the server failure and distinguish caller ID setup from normal hangups', () => {
  assert.equal(failureHelpers.callFailureMessage({status:'failed', failure_reason:'Telnyx 10009: No outbound voice profile'}), 'Telnyx 10009: No outbound voice profile');
  assert.match(failureHelpers.callFailureMessage({status:'failed', hangup_cause:'no_main_number'}), /No active main business number/);
  assert.equal(failureHelpers.callFailureMessage({status:'completed',hangup_cause:'normal_clearing'}), '');
  assert.match(failureHelpers.rtcFailureMessage({cause:'NO_ANSWER',sipCode:480}), /NO_ANSWER \/ SIP 480/);
});
test('incomplete backend setup blocks dialing before any microphone or provider request', async () => {
  let mediaRequests=0;
  const p = phone({ phoneSetup: {local_checks_ok:false}, ensureMicrophoneReady: async () => {mediaRequests++;} });
  await p.dial();
  assert.equal(mediaRequests,0);
  assert.equal(p.calls.length,0);
});

test('rechecking configured caller ID lets the next explicit Call action proceed', async () => {
  const p = phone({phoneSetup:{local_checks_ok:false}});
  await p.dial();
  assert.equal(p.calls.length,0);
  p.context.phoneSetup.local_checks_ok=true;
  await p.dial();
  assert.equal(p.calls.length,1);
});

test('phone header and caller ID load the backend voice number rather than an organization contact number', async () => {
  let mainNumber, org, result;
  const cfg={current:{callerId:'old-general-number'}};
  const setup={local_checks_ok:true, main_number:'+441316001234', organization_name:'Voice agency'};
  const load=getFunction('loadPhoneSetup', {
    useCallback:fn=>fn, apiRequest:async url=>{assert.equal(url,'/voice/api/setup/');return setup;},
    setPhoneSetupBusy(){},setPhoneSetupError(){},setPhoneSetup:value=>{result=value;},
    setMainNumber:value=>{mainNumber=value;},setOrgName:value=>{org=value;},cfgRef:cfg
  });
  await load();
  assert.equal(result,setup);
  assert.equal(mainNumber,'+441316001234');
  assert.equal(cfg.current.callerId,mainNumber);
  assert.equal(org,'Voice agency');
});
