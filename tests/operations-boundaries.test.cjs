const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { AsyncLocalStorage } = require('node:async_hooks');
const ts = require('typescript');
const { NextResponse } = require('next/server');

const originalFetch = global.fetch;
const originalBase = process.env.API_BASE_URL;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = originalBase;
});

function source(file, imports = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    name => Object.hasOwn(imports, name) ? imports[name] : require(name), loaded, loaded.exports,
  );
  return loaded.exports;
}
const initialCookies = { cp_access: 'old-access', cp_refresh: 'old-refresh', cp_session_id: 'original-session', cp_session: '1' };
function cookieJar(initial = initialCookies) {
  const values = new Map(Object.entries(initial));
  const writes = [], deletions = [];
  return { values, writes, deletions,
    get: name => values.has(name) ? { value: values.get(name) } : undefined,
    set: (name, value, options) => { writes.push({ name, value, options }); values.set(name, value); },
    delete: name => { deletions.push(name); values.delete(name); },
  };
}
function backend() {
  process.env.API_BASE_URL = 'https://django.example/api/v1';
  const context = new AsyncLocalStorage();
  const api = source('lib/server/backend.ts', {
    'next/headers': { cookies: async () => context.getStore() },
    'next/server': { NextResponse },
  });
  return { ...api, withCookies: (jar, run) => context.run(jar, run) };
}
function request(options = {}) {
  return new Request('https://dashboard.example/api/backend/operations/mailboxes/', options);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('transient refresh HTTP failure preserves the signed-in cookies', async () => {
  const api = backend(), jar = cookieJar();
  global.fetch = async url => url.endsWith('/token/refresh')
    ? Response.json({ detail: 'temporarily unavailable' }, { status: 503 })
    : Response.json({ detail: 'expired access' }, { status: 401 });
  const response = await api.withCookies(jar, () => api.proxyBackend(request(), '/operations/mailboxes/'));
  assert.equal(response.status, 503);
  assert.equal(jar.values.get('cp_refresh'), 'old-refresh');
  assert.deepEqual(jar.deletions, []);
});

test('a refresh network failure can be retried immediately after connectivity returns', async () => {
  const api = backend(), jar = cookieJar();
  let refreshAttempts = 0;
  global.fetch = async (url, options) => {
    if (url.endsWith('/token/refresh')) {
      refreshAttempts++;
      if (refreshAttempts === 1) throw new Error('temporary connection loss');
      return Response.json({ access: 'new-access', refresh: 'new-refresh' });
    }
    return new Headers(options.headers).get('authorization') === 'Bearer new-access'
      ? Response.json({ mailboxes: [] })
      : Response.json({ detail: 'expired access' }, { status: 401 });
  };
  assert.equal((await api.withCookies(jar, () => api.proxyBackend(request(), '/operations/mailboxes/'))).status, 502);
  assert.deepEqual(jar.deletions, []);
  assert.equal((await api.withCookies(jar, () => api.proxyBackend(request(), '/operations/mailboxes/'))).status, 200);
  assert.equal(refreshAttempts, 2);
  assert.equal(jar.values.get('cp_refresh'), 'new-refresh');
});

test('concurrent expired requests share one refresh while preserving separate response cookies', async () => {
  const api = backend(), firstJar = cookieJar(), secondJar = cookieJar();
  const started = deferred(), ready = deferred();
  let refreshAttempts = 0;
  global.fetch = async (url, options) => {
    if (url.endsWith('/token/refresh')) {
      refreshAttempts++; started.resolve(); await ready.promise;
      return Response.json({ access: 'new-access', refresh: 'new-refresh' });
    }
    return new Headers(options.headers).get('authorization') === 'Bearer new-access'
      ? Response.json([]) : Response.json({}, { status: 401 });
  };
  const first = api.withCookies(firstJar, () => api.proxyBackend(request(), '/operations/mailboxes/'));
  const second = api.withCookies(secondJar, () => api.proxyBackend(request(), '/operations/mailboxes/'));
  await started.promise; ready.resolve();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(refreshAttempts, 1);
  assert.equal(firstJar.values.get('cp_access'), 'new-access');
  assert.equal(secondJar.values.get('cp_access'), 'new-access');
});

test('an aborted refresh cannot emit new authentication cookies', async () => {
  const api = backend(), jar = cookieJar(), controller = new AbortController();
  const started = deferred(), ready = deferred();
  global.fetch = async url => {
    if (url.endsWith('/token/refresh')) { started.resolve(); await ready.promise; return Response.json({ access: 'too-late-access' }); }
    return Response.json({}, { status: 401 });
  };
  const response = api.withCookies(jar, () => api.proxyBackend(request({ signal: controller.signal }), '/operations/mailboxes/'));
  await started.promise; controller.abort(); ready.resolve();
  assert.equal((await response).status, 499);
  assert.deepEqual(jar.writes, []);
  assert.deepEqual(jar.deletions, []);
});

test('a refresh that finishes after logout cannot restore or clear browser cookies', async () => {
  const api = backend(), pendingJar = cookieJar(), logoutJar = cookieJar();
  const started = deferred(), ready = deferred();
  global.fetch = async url => {
    if (url.endsWith('/token/refresh')) { started.resolve(); await ready.promise; return Response.json({ access: 'too-late-access', refresh: 'too-late-refresh' }); }
    return Response.json({}, { status: 401 });
  };
  const pending = api.withCookies(pendingJar, () => api.proxyBackend(request(), '/operations/mailboxes/'));
  await started.promise;
  await api.withCookies(logoutJar, () => api.clearSession());
  ready.resolve(); await pending;
  assert.deepEqual(pendingJar.writes, [], 'retired requests must not revive credentials');
  assert.deepEqual(pendingJar.deletions, [], 'retired response must not delete cookies from a later sign-in');
});

test('an older refresh response cannot overwrite or delete a replacement sign-in', async () => {
  const api = backend(), pendingJar = cookieJar(), signInJar = cookieJar();
  const started = deferred(), ready = deferred();
  global.fetch = async url => {
    if (url.endsWith('/token/refresh')) { started.resolve(); await ready.promise; return Response.json({ access: 'old-account-access', refresh: 'old-account-refresh' }); }
    if (url.endsWith('/token')) return Response.json({ access: 'new-account-access', refresh: 'new-account-refresh' });
    return Response.json({}, { status: 401 });
  };
  const pending = api.withCookies(pendingJar, () => api.proxyBackend(request(), '/operations/mailboxes/'));
  await started.promise;
  const signedIn = await api.withCookies(signInJar, () => api.signIn(request({ method: 'POST', headers: { origin: 'https://dashboard.example', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'new@example.com', password: 'password' }) })));
  assert.equal(signedIn.status, 200);
  assert.equal(signInJar.values.get('cp_access'), 'new-account-access');
  assert.notEqual(signInJar.values.get('cp_session_id'), 'original-session');
  ready.resolve(); await pending;
  assert.deepEqual(pendingJar.writes, []);
  assert.deepEqual(pendingJar.deletions, []);
});

test('the catch-all handler preserves both operations slashes and legacy no-slash routes', async () => {
  const forwarded = [];
  const route = source('app/api/backend/[...path]/route.ts', {
    '@/lib/server/backend': {
      proxyBackend: async (_request, path) => { forwarded.push(path); return Response.json({}); },
      json: (value, status) => Response.json(value, { status }),
    },
  });
  await route.GET(new Request('https://dashboard.example/api/backend/operations/mailboxes/'), { params: Promise.resolve({ path: ['operations', 'mailboxes'] }) });
  await route.POST(new Request('https://dashboard.example/api/backend/organizations/me', { method: 'POST' }), { params: Promise.resolve({ path: ['organizations', 'me'] }) });
  assert.deepEqual(forwarded, ['/operations/mailboxes/', '/organizations/me']);
  const invalid = await route.GET(request(), { params: Promise.resolve({ path: ['operations', '../finance'] }) });
  assert.equal(invalid.status, 400);
  assert.equal(forwarded.length, 2);
});

test('anonymous password recovery reaches only the fixed upstream without bearer credentials', async () => {
  const api = backend(), jar = cookieJar({});
  let forwarded;
  global.fetch = async (url, options) => { forwarded = { url, headers: new Headers(options.headers) }; return Response.json({ detail: 'Reset email sent' }); };
  const response = await api.withCookies(jar, () => api.proxyBackend(new Request('https://dashboard.example/api/backend/auth/organizations/forget_password', { method: 'POST', headers: { origin: 'https://dashboard.example', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }) }), '/auth/organizations/forget_password'));
  assert.equal(response.status, 200);
  assert.equal(forwarded.url, 'https://django.example/api/v1/auth/organizations/forget_password');
  assert.equal(forwarded.headers.get('authorization'), null);
  assert.deepEqual(jar.writes, []);
});
