const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || path.resolve(__dirname, '..');
const requireProject = createRequire(path.join(project, 'package.json'));
const React = requireProject('react');
const { renderToStaticMarkup } = requireProject('react-dom/server');
const ts = requireProject('typescript');
const source = fs.readFileSync(path.join(__dirname, '../components/jigsaw/voice-analysis-panel.tsx'), 'utf8');

function load(hooks = React, request = () => Promise.resolve({ results: [] })) {
  const module = { exports: {} }, calls = [];
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, Date, Number, Error, encodeURIComponent,
    require: name => name === 'react' ? hooks : name === 'next/link' ? { default: props => React.createElement('a', props, props.children) } : name === 'lucide-react' ? { Bell: () => null, MessageCircle: () => null, Mic: () => null, RefreshCw: () => null, UserRound: () => null } : name === '@/services/jigsaw-service' ? { jigsaw: (...args) => { calls.push(args); return request(...args); }, results: response => response?.results || [] } : requireProject(name),
  });
  return { ...module.exports, calls };
}
const { VoiceAnalysisResult } = load();
const event = (outcome, data = {}) => ({ uid: 'decision-1', created_at: '2026-11-09T06:27:52Z', payload: { outcome, contact_uid: 'candidate-1', contact_name: 'Test candidate', transcript_excerpt: 'I will send you the document after.', summary: 'Review this document promise before sending.', ...data } });
const markup = value => renderToStaticMarkup(React.createElement(VoiceAnalysisResult, { event: value }));

test('an unclear document promise shows its transcript and explicit approval route', () => {
  const html = markup(event('confirmation_required', { command: 'document_request', confidence: .5, confidence_threshold: .9 }));
  assert.match(html, /Needs your approval/);
  assert.match(html, /I will send you the document after\./);
  assert.match(html, /Confidence 50%/);
  assert.match(html, /required 90%/);
  assert.match(html, /href="\/dashboard\/ai-jigsaw\/workspace\/alerts"/);
  assert.match(html, /messages\?contact=candidate-1/);
  assert.doesNotMatch(html, /Message sent|Delivered/);
});

test('queued and observed decisions do not imply WhatsApp delivery', () => {
  assert.match(markup(event('queued')), /Action queued/);
  const html = markup(event('observed', { summary: 'Recorded for observation. No message was sent.' }));
  assert.match(html, /Observation only/);
  assert.match(html, /No message was sent/);
  assert.doesNotMatch(html, /Open alerts/);
});

test('provider failures are safe guidance rather than arbitrary error details', () => {
  const html = markup(event('ai_unavailable', { provider_errors: { openai: 'model_required', anthropic: 'PRIVATE api_key=SECRET', malicious: 'SECRET' } }));
  assert.match(html, /Choose a text model/);
  assert.match(html, /Claude: Check this provider/);
  assert.match(html, /Check AI settings/);
  assert.doesNotMatch(html, /PRIVATE|api_key|SECRET|malicious/);
  const review = markup(event('confirmation_required', { provider: 'review_suggestion', provider_errors: { openai: 'model_required' } }));
  assert.match(review, /Review suggestion/);
  assert.match(review, /Check AI settings/);
  assert.match(markup(event('dismissed')), /Suggestion dismissed/);
});

test('historical and malformed decisions remain readable without invented confidence', () => {
  const html = markup({ payload: { confidence: NaN, confidence_threshold: 2 }, created_at: 'invalid' });
  assert.match(html, /Saved decision/);
  assert.match(html, /saved before detailed analysis results/);
  assert.doesNotMatch(html, /Confidence|NaN|Invalid Date|Candidate messages/);
  const escaped = markup(event('no_command', { transcript_excerpt: '<script>unexpected()</script>' }));
  assert.match(escaped, /&lt;script&gt;/);
  assert.doesNotMatch(escaped, /<script>/);
});

test('the panel only fetches analysis events and ignores a late response after unmount', async () => {
  const states = [], effects = []; let cursor = 0, resolve;
  const pending = new Promise(done => { resolve = done; });
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
    useEffect(callback) { effects.push(callback); },
  };
  const panel = load(hooks, () => pending);
  panel.VoiceAnalysisPanel();
  const cleanup = effects.shift()();
  assert.equal(panel.calls.length, 1);
  assert.deepEqual(Array.from(panel.calls[0]), ['events/?kind=ai.decision']);
  cleanup(); resolve({ results: [event('queued')] });
  await pending; await Promise.resolve(); await Promise.resolve();
  assert.equal(states[0].length, 0);
  assert.equal(states[1], true);
});
