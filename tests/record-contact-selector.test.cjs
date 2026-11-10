const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || path.resolve(__dirname, '..');
const requireProject = createRequire(path.join(project, 'package.json'));
const React = requireProject('react');
const ts = requireProject('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/jigsaw/record-contact-selector.tsx'), 'utf8');
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const settle = () => new Promise(resolve => setImmediate(resolve));
const contact = (uid, kind = 'candidate') => ({ uid, name: `Record ${uid}`, kind, ats_id: `${uid}-ats`, phone: '+441234567890', email: 'person@example.test' });
function harness(props = {}) {
  const values = [], effects = [], timers = new Map(), requests = [], changes = [];
  let cursor = 0, effectCursor = 0, timerId = 0, dirty = false, pending = [];
  const hooks = {
    useState(initial) { const id = cursor++; if (!(id in values)) values[id] = initial; return [values[id], next => { const value = typeof next === 'function' ? next(values[id]) : next; if (!Object.is(value, values[id])) { values[id] = value; dirty = true; } }]; },
    useEffect(callback, deps) { const id = effectCursor++; const previous = effects[id]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) { pending.push(() => { previous?.cleanup?.(); effects[id] = { deps, cleanup: callback() }; }); } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Number, Error, encodeURIComponent,
    window: { setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); } },
    require: name => name === 'react' ? hooks : name === 'lucide-react' ? { ArrowLeft: () => null, ArrowRight: () => null, Search: () => null } : name === '@/services/jigsaw-service' ? { jigsaw: (...args) => { const request = deferred(); requests.push({ args, ...request }); return request.promise; }, results: value => value?.results || [] } : requireProject(name),
  });
  const input = { value: '', onChange(value) { input.value = value; changes.push(value); }, ...props };
  return {
    requests, changes, props: input,
    render() { let tree; do { dirty = false; cursor = 0; effectCursor = 0; tree = module.exports.RecordContactSelector(input); const queued = pending; pending = []; queued.forEach(run => run()); } while (dirty); return tree; },
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(run => run()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}
function find(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) { const match = find(child, predicate); if (match) return match; }
  return null;
}
const byLabel = (tree, label) => find(tree, element => element.props?.['aria-label'] === label);
const text = element => React.Children.toArray(element?.props?.children).map(child => typeof child === 'object' ? text(child) : String(child)).join('');

test('document matching searches only candidates and displays distinct record identifiers', async () => {
  const h = harness({ candidateOnly: true, initialSearch: '+44123' });
  h.render();
  assert.equal(h.requests[0].args[0], 'contacts/?limit=50&offset=0&q=%2B44123&kind=candidate');
  h.requests[0].resolve({ results: [contact('candidate-1'), contact('client-1', 'client')], count: 1 }); await settle();
  const tree = h.render();
  assert.equal(byLabel(tree, 'Filter matching ATS record type'), null);
  const select = byLabel(tree, 'Select matching ATS record');
  assert.match(text(select), /Candidate.*person@example.test.*ATS #candidate-1-ats/);
  assert.doesNotMatch(text(select), /client-1/);
  select.props.onChange({ target: { value: 'candidate-1' } });
  assert.match(text(h.render()), /Selected: Record candidate-1.*Candidate.*ATS #candidate-1-ats/);
});

test('matching records beyond the first page remain available without stale selection', async () => {
  const h = harness(); h.render();
  h.requests[0].resolve({ results: [contact('first')], count: 501, offset: 0, next: 50, previous: null }); await settle();
  byLabel(h.render(), 'Select matching ATS record').props.onChange({ target: { value: 'first' } });
  byLabel(h.render(), 'Next matching ATS records').props.onClick();
  const loading = h.render();
  assert.equal(h.props.value, '');
  assert.equal(byLabel(loading, 'Select matching ATS record').props.disabled, true);
  assert.equal(h.requests[1].args[0], 'contacts/?limit=50&offset=50&q=');
  h.requests[1].resolve({ results: [contact('next-page')], count: 501, offset: 50, previous: 0, next: 100 }); await settle();
  assert.match(text(h.render()), /Record next-page/);
  assert.ok(byLabel(h.render(), 'Previous matching ATS records'));
});

test('server-side debounced search ignores a late response for the old query', async () => {
  const h = harness(); h.render();
  byLabel(h.render(), 'Search matching ATS records').props.onChange({ target: { value: 'alex@example.test' } });
  assert.equal(byLabel(h.render(), 'Select matching ATS record').props.disabled, true);
  h.flushTimers(); h.render();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].args[0], 'contacts/?limit=50&offset=0&q=alex%40example.test');
  h.requests[1].resolve({ results: [contact('searched')], count: 1 }); await settle();
  h.requests[0].resolve({ results: [contact('stale')], count: 999 }); await settle();
  const tree = h.render();
  assert.match(text(tree), /Record searched/);
  assert.doesNotMatch(text(tree), /Record stale/);
});

test('consultants can filter ordinary matches to clients and must select again', async () => {
  const h = harness(); h.render();
  h.requests[0].resolve({ results: [contact('candidate')], count: 1 }); await settle();
  byLabel(h.render(), 'Select matching ATS record').props.onChange({ target: { value: 'candidate' } });
  byLabel(h.render(), 'Filter matching ATS record type').props.onChange({ target: { value: 'client' } }); h.render();
  assert.equal(h.props.value, '');
  assert.equal(h.requests[1].args[0], 'contacts/?limit=50&offset=0&q=&kind=client');
  h.requests[1].resolve({ results: [contact('client', 'client')], count: 1 }); await settle();
  assert.match(text(h.render()), /Record client.*Client/);
});

test('search errors disable selection until an explicit retry succeeds', async () => {
  const h = harness(); h.render();
  h.requests[0].reject(new Error('Unable to load contacts')); await settle();
  let tree = h.render();
  assert.equal(byLabel(tree, 'Select matching ATS record').props.disabled, true);
  assert.match(text(find(tree, element => element.props?.role === 'alert')), /Unable to load contacts/);
  find(tree, element => element.type === 'button' && text(element) === 'Try again').props.onClick(); h.render();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ results: [contact('retry')], count: 1 }); await settle();
  assert.equal(byLabel(h.render(), 'Select matching ATS record').props.disabled, false);
});
