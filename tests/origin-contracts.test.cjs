const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
const originalOrigin = process.env.DASHBOARD_ORIGIN;
const originalBase = process.env.API_BASE_URL;
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.DASHBOARD_ORIGIN; else process.env.DASHBOARD_ORIGIN = originalOrigin;
  if (originalBase === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = originalBase;
});
function backend() {
  delete process.env.DASHBOARD_ORIGIN;
  process.env.API_BASE_URL = 'https://django.example/api/v1';
  const values = new Map();
  const jar = { get: name => values.has(name) ? { value: values.get(name) } : undefined, set: (name, value) => values.set(name, value), delete: name => values.delete(name) };
  const output = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/server/backend.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(
    name => name === 'next/headers' ? { cookies: async () => jar } : name === 'next/server' ? { NextResponse } : require(name), loaded, loaded.exports,
  );
  return loaded.exports;
}
const proxied = (origin = 'https://dashboard.example', extra = {}) => new Request('http://localhost:3000/api/session/login', {
  method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...extra },
  body: JSON.stringify({ email: 'person@example.com', password: 'example-password' }),
});

test('configured HTTPS dashboard origin allows password and OTP sign-in through an internal HTTP proxy URL', async () => {
  const api = backend();
  assert.equal(api.sameOrigin(proxied()), false); // Reproduces the original deployment failure.
  process.env.DASHBOARD_ORIGIN = 'https://dashboard.example/';
  const sent = [];
  global.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return sent.length === 1 ? Response.json({ otp_required: true, challenge_id: 'challenge-id' }) : Response.json({ access: 'verified-access', refresh: 'verified-refresh' });
  };
  const login = await api.signIn(proxied());
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { otp_required: true, challenge_id: 'challenge-id' });
  const otp = await api.signIn(new Request('http://localhost:3000/api/session/otp', {
    method: 'POST', headers: { origin: 'https://dashboard.example', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify({ challenge_id: 'challenge-id', otp_code: '123456' }),
  }), true);
  assert.equal(otp.status, 200);
  assert.deepEqual(await otp.json(), { authenticated: true });
  assert.deepEqual(sent[1].body, { challenge_id: 'challenge-id', otp_code: '123456' });
});

test('public dashboard config rejects wrong scheme, hostname, port and internal origins', () => {
  const api = backend(); process.env.DASHBOARD_ORIGIN = 'https://dashboard.example';
  for (const origin of ['http://dashboard.example', 'https://attacker.example', 'https://dashboard.example:444', 'http://localhost:3000', 'null']) {
    assert.equal(api.sameOrigin(proxied(origin)), false, origin);
  }
  assert.equal(api.sameOrigin(proxied('https://dashboard.example')), true);
});

test('forwarded headers cannot authorize an unconfigured or attacker-controlled origin', () => {
  const api = backend();
  const headers = { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https', forwarded: 'host=attacker.example;proto=https' };
  assert.equal(api.sameOrigin(proxied('https://attacker.example', headers)), false);
  process.env.DASHBOARD_ORIGIN = 'https://dashboard.example';
  assert.equal(api.sameOrigin(proxied('https://attacker.example', headers)), false);
  assert.equal(api.sameOrigin(proxied('https://dashboard.example', { 'sec-fetch-site': 'cross-site' })), false);
});

test('invalid public origin config fails closed, including malformed URLs and URL paths', () => {
  const api = backend();
  for (const origin of ['not-a-url', 'https://user:password@dashboard.example', 'https://dashboard.example/login', 'https://dashboard.example?x=1', 'https://dashboard.example#fragment', 'file:///tmp/dashboard']) {
    process.env.DASHBOARD_ORIGIN = origin;
    assert.equal(api.sameOrigin(proxied()), false, origin);
  }
});

test('direct local access still uses the request URL when public origin is unset', () => {
  const api = backend();
  assert.equal(api.sameOrigin(proxied('http://localhost:3000')), true);
  assert.equal(api.sameOrigin(proxied('http://127.0.0.1:3000')), false);
});
