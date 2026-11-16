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
const source = fs.readFileSync(path.join(project, 'components/jigsaw/recording-settings.tsx'), 'utf8');
function load(hooks = React, request = () => Promise.resolve({ can_manage: false, results: [] })) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Object, Error,
    require: name => name === 'react' ? hooks : name === 'lucide-react' ? Object.fromEntries(['Check', 'Info', 'Loader2', 'RefreshCw'].map(name => [name, () => null])) : name === '@/services/jigsaw-service' ? { apiRequest: request } : requireProject(name),
  });
  return module.exports;
}
const { normalizedRecordingSetting, recordingSettingsPatch } = load();
const number = { uid: 'voice-number-1', number: '+441234567890', label: 'Business line', is_main: true, record_calls: true, recording_announcement: true };

test('missing announcement values remain on while preserving recording', () => {
  const value = normalizedRecordingSetting({ ...number, recording_announcement: undefined });
  assert.equal(value.recording_announcement, true); assert.equal(value.record_calls, true);
  assert.equal(normalizedRecordingSetting({ ...number, recording_announcement: false }).recording_announcement, false);
});
test('switching off the announcement does not submit or turn off recording', () => {
  const value = recordingSettingsPatch(number, { ...number, recording_announcement: false });
  assert.deepEqual(Object.keys(value), ['uid', 'recording_announcement']); assert.equal(value.recording_announcement, false);
  const recording = recordingSettingsPatch(number, { ...number, record_calls: false });
  assert.deepEqual(Object.keys(recording), ['uid', 'record_calls']); assert.equal(recording.record_calls, false);
});
test('an unchanged setting has no provider fields to save', () => {
  assert.deepEqual(Object.keys(recordingSettingsPatch(number, number)), ['uid']);
  assert.deepEqual(Object.keys(recordingSettingsPatch({ ...number, recording_announcement: undefined }, number)), ['uid']);
});
const settle = () => new Promise(resolve => setImmediate(resolve));
function walk(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) { const found = walk(child, predicate); if (found) return found; }
  return null;
}
function allText(element) { return React.Children.toArray(element?.props?.children).map(child => typeof child === 'object' ? allText(child) : String(child)).join(''); }
function harness(response, patchResponse = { ...number, recording_announcement: false }) {
  const values = [], effects = [], requests = [];
  let cursor = 0, effectCursor = 0, dirty = false, pending = [];
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { const value = typeof next === 'function' ? next(values[index]) : next; if (!Object.is(value, values[index])) { values[index] = value; dirty = true; } }]; },
    useEffect(callback, deps) { const index = effectCursor++; const previous = effects[index]; if (!previous || deps.some((item, itemIndex) => item !== previous.deps[itemIndex])) pending.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; }); },
    useCallback(callback) { return callback; },
  };
  const { RecordingSettings } = load(hooks, async (...args) => { requests.push(args); if (args[1]?.method === 'PATCH') return patchResponse; if (response instanceof Error) throw response; return response; });
  return { requests, render() { let tree; do { dirty = false; cursor = 0; effectCursor = 0; tree = RecordingSettings(); const callbacks = pending; pending = []; callbacks.forEach(run => run()); } while (dirty); return tree; } };
}

test('owner can disable announcement, save only that setting, and keep recording enabled', async () => {
  const h = harness({ can_manage: true, results: [number] }); h.render(); await settle(); let tree = h.render();
  const toggle = walk(tree, item => item.type === 'input' && item.props['aria-label'] === `Play recording announcement for ${number.number}`);
  assert.equal(toggle.props.checked, true); toggle.props.onChange({ target: { checked: false } }); tree = h.render();
  const save = walk(tree, item => item.type === 'button' && allText(item) === 'Save recording settings');
  assert.equal(save.props.disabled, false); await save.props.onClick(); tree = h.render();
  const request = h.requests.find(args => args[1]?.method === 'PATCH');
  assert.equal(request[0], '/voice/api/recording-settings/'); assert.deepEqual(JSON.parse(request[1].body), { uid: number.uid, recording_announcement: false });
  assert.match(allText(tree), /spoken announcement is off and call recording stays on/);
  assert.equal(walk(tree, item => item.type === 'input' && item.props['aria-label'] === `Record calls for ${number.number}`).props.checked, true);
});
test('server response reflects a concurrent recording change without the announcement save overwriting it', async () => {
  const h = harness({ can_manage: true, results: [number] }, { ...number, record_calls: false, recording_announcement: false }); h.render(); await settle(); let tree = h.render();
  walk(tree, item => item.type === 'input' && item.props['aria-label'].startsWith('Play recording')).props.onChange({ target: { checked: false } }); tree = h.render();
  await walk(tree, item => item.type === 'button' && allText(item) === 'Save recording settings').props.onClick(); tree = h.render();
  assert.equal(JSON.parse(h.requests.find(args => args[1]?.method === 'PATCH')[1].body).record_calls, undefined);
  assert.equal(walk(tree, item => item.type === 'input' && item.props['aria-label'].startsWith('Record calls')).props.checked, false);
});
test('staff do not see administrative recording controls', async () => {
  const h = harness({ can_manage: false, results: [] }); h.render(); await settle(); assert.equal(h.render(), null);
});
test('load failures remain visible and can be refreshed', async () => {
  const h = harness(new Error('Recording settings unavailable')); h.render(); await settle(); const tree = h.render();
  assert.match(allText(tree), /Recording settings unavailable/); assert.ok(walk(tree, item => item.props?.role === 'alert')); assert.equal(walk(tree, item => item.type === 'input'), null);
});
