const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

const originalFetch = global.fetch;
const originalBase = process.env.API_BASE_URL;
const originalOrigin = process.env.DASHBOARD_ORIGIN;
delete process.env.DASHBOARD_ORIGIN;
const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.DASHBOARD_ORIGIN; else process.env.DASHBOARD_ORIGIN = originalOrigin;
  if (originalBase === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = originalBase;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
});

function source(file, imports = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    name => Object.hasOwn(imports, name) ? imports[name] : require(name), moduleObject, moduleObject.exports,
  );
  return moduleObject.exports;
}
function backend(initial = { cp_access: 'private-access', cp_refresh: 'private-refresh', cp_session_id: 'session-test' }) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  const jar = { get: name => values.has(name) ? { value: values.get(name) } : undefined,
    set: (name, value, options) => { values.set(name, value); writes.push({ name, value, options }); },
    delete: name => values.delete(name) };
  process.env.API_BASE_URL = 'https://django.example/api/v1';
  delete process.env.DASHBOARD_ORIGIN;
  const api = source('lib/server/backend.ts', { 'next/headers': { cookies: async () => jar }, 'next/server': { NextResponse } });
  return { ...api, values, writes };
}
const request = (body = {}, extra = {}) => new Request('https://dashboard.example/api/backend/operations/email/send/', {
  method: 'POST', headers: { origin: 'https://dashboard.example', 'content-type': 'application/json', ...extra }, body: JSON.stringify(body),
});

test('password sign-in keeps JWTs in HttpOnly cookies and removes legacy browser credentials', async () => {
  const api = backend({ access: 'legacy', refresh: 'legacy' });
  process.env.NODE_ENV = 'production';
  global.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).remember_me, true);
    return Response.json({ access: 'new-access', refresh: 'new-refresh', otp_required: false });
  };
  const response = await api.signIn(request({ email: 'person@example.com', password: 'test-password', remember_me: true }));
  assert.deepEqual(await response.json(), { authenticated: true });
  for (const name of ['cp_access', 'cp_refresh']) {
    const cookie = api.writes.find(write => write.name === name);
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.sameSite, 'lax');
  }
  assert.equal(api.values.has('access'), false);
  assert.equal(api.values.has('refresh'), false);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('OTP submits the exact challenge and code, preserving remember-me server side', async () => {
  const api = backend({ cp_login_remember: '1' });
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://django.example/api/v1/token/verify-otp');
    assert.deepEqual(JSON.parse(options.body), { challenge_id: 'challenge-uuid', otp_code: '123456' });
    return Response.json({ access: 'verified-access', refresh: 'verified-refresh' });
  };
  const response = await api.signIn(request({ challenge_id: 'challenge-uuid', otp_code: '123456', access: 'ignored' }), true);
  assert.deepEqual(await response.json(), { authenticated: true });
  assert.equal(api.writes.find(write => write.name === 'cp_refresh').options.maxAge, 7 * 86400);
  assert.equal(api.values.has('cp_login_remember'), false);
});

test('cross-origin writes and provider credential bypasses cannot reach Django', async () => {
  const api = backend();
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({}); };
  assert.equal((await api.proxyBackend(request({}, { origin: 'https://attacker.example' }), '/operations/email/send/')).status, 403);
  assert.equal((await api.proxyBackend(request({}, { 'sec-fetch-site': 'cross-site' }), '/operations/email/send/')).status, 403);
  assert.equal((await api.proxyBackend(request(), '/token/refresh')).status, 400);
  assert.equal((await api.proxyBackend(request(), '/../admin')).status, 400);
  assert.equal(calls, 0);
});

test('expired access refreshes once and preserves tenant, payload, trailing slash and idempotency key', async () => {
  const api = backend();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body && Buffer.from(options.body).toString(), headers: new Headers(options.headers) });
    if (url.endsWith('/token/refresh')) return Response.json({ access: 'rotated-access', refresh: 'rotated-refresh' });
    return calls.length === 1 ? Response.json({ detail: 'expired' }, { status: 401 }) : Response.json({ status: 'queued' }, { status: 202 });
  };
  const response = await api.proxyBackend(request({ text: 'One send' }, { 'x-tenant-id': '23', 'idempotency-key': 'one-user-intent', authorization: 'Bearer untrusted-browser-input' }), '/channels/23/send/');
  assert.equal(response.status, 202);
  assert.equal(calls.length, 3);
  for (const index of [0, 2]) {
    assert.equal(calls[index].url, 'https://django.example/api/v1/channels/23/send/');
    assert.equal(calls[index].headers.get('x-tenant-id'), '23');
    assert.equal(calls[index].headers.get('idempotency-key'), 'one-user-intent');
    assert.equal(calls[index].body, '{"text":"One send"}');
  }
  assert.equal(calls[0].headers.get('authorization'), 'Bearer private-access');
  assert.equal(calls[2].headers.get('authorization'), 'Bearer rotated-access');
});

test('uncertain network failures are surfaced without automatically resending a mutation', async () => {
  const api = backend();
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('connection lost after write'); };
  const response = await api.proxyBackend(request({ text: 'one' }, { 'idempotency-key': 'retry-same-intent' }), '/channels/23/send/');
  assert.equal(response.status, 502);
  assert.equal(calls, 1);
});

test('failed refresh clears session instead of replaying an unauthorized write', async () => {
  const api = backend();
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({ detail: 'expired' }, { status: 401 }); };
  assert.equal((await api.proxyBackend(request(), '/operations/email/send/')).status, 401);
  assert.equal(calls, 2);
  assert.equal(api.values.has('cp_refresh'), false);
  assert.equal(api.values.has('cp_session'), false);
});

test('proxy refuses anonymous private data and preserves URL-encoded phone searches', async () => {
  const anonymous = backend({});
  let urlSeen;
  global.fetch = async url => { urlSeen = url; return Response.json({ consents: [] }); };
  assert.equal((await anonymous.proxyBackend(new Request('https://dashboard.example/api/backend/operations/finance/invoices/'), '/operations/finance/invoices/')).status, 401);
  assert.equal(urlSeen, undefined);
  const api = backend();
  await api.proxyBackend(new Request('https://dashboard.example/api/backend/channels/23/consent/?phone=%2B441234567890'), '/channels/23/consent/');
  assert.equal(urlSeen, 'https://django.example/api/v1/channels/23/consent/?phone=%2B441234567890');
});

test('capability and privacy adapters honor archive mappings, read-only sections and reviewed messages', () => {
  const adapters = source('lib/ops/adapters.ts');
  const rows = adapters.normalizeCapabilities({ sections: {
    candidates: { list: true, get: true, create: true, update: true, delete: false, delete_behavior: 'archived' },
    users: { list: true, get: true, create: false, update: false, delete: false },
    documents: { parent_required: true, composite_id_for_get: true, delete: true, delete_behavior: 'deleted' },
  } });
  assert.equal(rows.find(row => row.name === 'candidates').delete, true);
  assert.equal(rows.find(row => row.name === 'candidates').deleteMode, 'archive');
  assert.equal(adapters.canWrite(rows.find(row => row.name === 'users')), false);
  assert.equal(rows.find(row => row.name === 'documents').parent_required, true);
  assert.equal(adapters.messageNeedsReview({ status: 'received', result: { review_action: 123 } }), false);
  assert.equal(adapters.messageNeedsReview({ status: 'review' }), true);
  assert.equal(adapters.safeUrl('javascript:alert(1)'), undefined);
  assert.equal(Number.isNaN(adapters.tenantIdFrom({ id: null })), true);
});
