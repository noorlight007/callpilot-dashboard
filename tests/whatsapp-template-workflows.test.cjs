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
function load(relative, replacements = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(project, relative), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Object, String, Array, Event, Error,
    window: { addEventListener() {}, removeEventListener() {} },
    require: name => replacements[name] || requireProject(name),
  });
  return module.exports;
}
const workflows = load('components/jigsaw/whatsapp-template-workflows.ts');
const { WHATSAPP_TEMPLATE_WORKFLOWS, withoutGeneratedTermsTemplates, approvedManualTemplateOptions, templateVariableHint } = workflows;
const mapping = { approved: true, provider: 'telnyx', template_id: 'provider-template' };

test('workflow settings omit generated KID/TOE while explaining optional automations', () => {
  const keys = Array.from(WHATSAPP_TEMPLATE_WORKFLOWS, row => row.key);
  assert.deepEqual(keys, ['document_request', 'onboarding_start', 'shift_offer', 'missed_call_reply', 'document_chaser', 'certificate_renewal', 'shift_filled', 'order_alert']);
  for (const key of ['shift_offer', 'document_chaser', 'shift_filled', 'order_alert']) {
    const row = WHATSAPP_TEMPLATE_WORKFLOWS.find(row => row.key === key);
    assert.equal(row.optional, true);
    assert.match(row.description, /Use only/);
  }
  assert.match(WHATSAPP_TEMPLATE_WORKFLOWS[0].description, /reply with their documents in WhatsApp/);
  assert.match(WHATSAPP_TEMPLATE_WORKFLOWS[0].description, /link is sent only in SMS fallback/);
});

test('removing obsolete mappings preserves custom mappings and leaves the original settings untouched', () => {
  const original = { kid: mapping, TOE: mapping, document_request: mapping, custom_followup: { ...mapping, name: 'custom' } };
  const cleaned = withoutGeneratedTermsTemplates(original);
  assert.deepEqual(Object.keys(cleaned), ['document_request', 'custom_followup']);
  assert.equal(cleaned.document_request, mapping);
  assert.ok(original.kid);
  assert.ok(original.TOE);
});

test('manual composer ignores stale generated-term choices for both connected providers', () => {
  const saved = { kid: mapping, toe: { approved: true, content_sid: 'legacy-toe' },
    document_request: mapping, custom: { ...mapping, name: 'custom' },
    legacy: { approved: true, content_sid: 'legacy-message' }, unapproved: { ...mapping, approved: false }, incomplete: { approved: true, provider: 'telnyx' } };
  assert.deepEqual(approvedManualTemplateOptions(saved, true).map(([key]) => key), ['document_request', 'custom']);
  assert.deepEqual(approvedManualTemplateOptions(saved, false).map(([key]) => key), ['legacy']);
});

test('document request variable guidance reserves upload links for SMS fallback', () => {
  const hint = templateVariableHint('document_request', 2);
  assert.match(hint, /2 body variable/);
  assert.match(hint, /\{message\}, \{name\}, \{phone\}/);
  assert.doesNotMatch(hint, /\{upload_link\}/);
  assert.match(hint, /belongs in SMS fallback/);
  assert.match(templateVariableHint('document_chaser', 1), /\{upload_link\}/);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
function walk(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) { const found = walk(child, predicate); if (found) return found; }
  return null;
}
function allText(element) {
  return React.Children.toArray(element?.props?.children).map(child => typeof child === 'object' ? allText(child) : String(child)).join('');
}
function panelHarness(settings) {
  const values = [], effects = [], refs = [], requests = [];
  let cursor = 0, effectCursor = 0, refCursor = 0, dirty = false, pending = [];
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { const value = typeof next === 'function' ? next(values[index]) : next; if (!Object.is(value, values[index])) { values[index] = value; dirty = true; } }]; },
    useEffect(callback, deps) { const index = effectCursor++; const previous = effects[index]; if (!previous || deps.some((item, itemIndex) => item !== previous.deps[itemIndex])) pending.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; }); },
    useRef(initial) { const index = refCursor++; return refs[index] || (refs[index] = { current: initial }); },
  };
  const module = load('components/jigsaw/telnyx-messaging-settings.tsx', {
    react: hooks, 'lucide-react': {}, './whatsapp-template-workflows': workflows,
    '@/services/jigsaw-service': { results: data => data?.results || [], jigsaw: async (...args) => { requests.push(args); return { settings }; } },
  });
  return { requests, render() { let tree; do { dirty = false; cursor = 0; effectCursor = 0; refCursor = 0; tree = module.TelnyxTemplateSettings(); const callbacks = pending; pending = []; callbacks.forEach(run => run()); } while (dirty); return tree; } };
}

test('template panel saves only active mappings while preserving unrelated agency settings', async () => {
  const settings = { templates: { kid: mapping, toe: mapping, document_request: mapping, custom_followup: mapping }, sms_fallback_seconds: 300, upload_form_url: 'https://example.test/upload' };
  const h = panelHarness(settings); h.render(); await settle();
  const tree = h.render();
  const text = allText(tree);
  assert.match(text, /No KID or TOE WhatsApp templates are needed/);
  assert.match(text, /Shift Offer/);
  assert.match(text, /Optional · not configured/);
  assert.equal(walk(tree, element => element.type === 'h3' && allText(element) === 'Kid'), null);
  const form = walk(tree, element => element.type === 'form');
  await form.props.onSubmit({ preventDefault() {} });
  const patch = h.requests.find(args => args[1] === 'PATCH');
  assert.ok(patch);
  assert.deepEqual(Object.keys(patch[2].settings.templates), ['document_request', 'custom_followup']);
  assert.equal(patch[2].settings.sms_fallback_seconds, 300);
  assert.equal(patch[2].settings.upload_form_url, 'https://example.test/upload');
});
