const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const project = process.env.CALLPILOT_FRONTEND_TEST_ROOT || path.resolve(__dirname, '..');
const React = require(path.join(project, 'node_modules/react'));
const { renderToStaticMarkup } = require(path.join(project, 'node_modules/react-dom/server'));
const ts = require(path.join(project, 'node_modules/typescript'));
const moduleSource = fs.readFileSync(path.join(project, 'components/jigsaw/automatic-record-updates.tsx'), 'utf8');
const componentModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(moduleSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module: componentModule, exports: componentModule.exports, URL, String, Array, Number,
  require: name => name === 'react/jsx-runtime' ? require(path.join(project, 'node_modules/react/jsx-runtime')) : require(name),
});
const { AutomaticRecordUpdates, isAutomaticRecordUpdate } = componentModule.exports;
const target = (kind, ats_id, status = 'completed', extra = {}) => ({ kind, ats_id, key: `${kind}:${ats_id}`, status, ats_url: `https://eu3.jobadder.com/${kind === 'candidate' ? 'candidates' : 'contacts'}/${ats_id}`, operations: [{ operation: 'note', status }], ...extra });
const html = payload => renderToStaticMarkup(React.createElement(AutomaticRecordUpdates, { payload }));

test('automatic matching is informational only for the explicit backend receipt', () => {
  assert.equal(isAutomaticRecordUpdate({ kind: 'multiple_records_updated', payload: { informational: true } }), true);
  assert.equal(isAutomaticRecordUpdate({ kind: 'ambiguous_match', payload: { informational: true } }), false);
  assert.equal(isAutomaticRecordUpdate({ kind: 'multiple_records_updated', payload: {} }), false);
  assert.equal(isAutomaticRecordUpdate({ kind: 'voice_command', payload: { informational: false } }), false);
});

test('receipt shows every record and safe ATS links without any selection or approval controls', () => {
  const result = html({ updated_count: 2, targets: [target('candidate', '42'), target('client', '73')] });
  assert.match(result, /Updates were applied automatically; no contact selection is required/);
  assert.match(result, /Candidate #42/); assert.match(result, /Client #73/);
  assert.match(result, /2 of 2 records updated/);
  assert.match(result, /href="https:\/\/eu3.jobadder.com\/candidates\/42"/);
  assert.match(result, /href="https:\/\/eu3.jobadder.com\/contacts\/73"/);
  assert.match(result, /rel="noopener noreferrer"/);
  assert.doesNotMatch(result, /<select|<button|Approve|Link selected record/);
});

test('partial writes show record and operation outcomes without pretending all updates succeeded', () => {
  const result = html({ updated_count: 99, targets: [target('candidate', '42'), target('client', '73', 'failed', { operations: [{ operation: 'note', status: 'completed' }, { operation: 'attachment:private-file-id', status: 'failed' }] }), target('candidate', '43', 'uncertain')] });
  assert.match(result, /1 of 3 records updated · 1 failed · 1 unconfirmed/);
  assert.match(result, /Update failed/); assert.match(result, /Outcome unconfirmed/);
  assert.match(result, /Note: Updated/); assert.match(result, /Attachment: Update failed/);
  assert.doesNotMatch(result, /private-file-id|99 of|<select/);
});

test('unsafe URLs are never rendered as links and record values are escaped', () => {
  const result = html({ targets: [target('candidate', '<script>danger()</script>', 'completed', { ats_url: 'javascript:alert(1)' }), target('client', '73', 'failed', { ats_url: 'https://name:password@eu3.jobadder.com/contacts/73' }), target('client', '74', 'pending', { ats_url: 'data:text/html,<script>danger()</script>' }), target('client', '75', 'processing', { ats_url: '/contacts/75' })] });
  assert.doesNotMatch(result, /<a |<script>|javascript:|password|data:text/);
  assert.match(result, /&lt;script&gt;danger\(\)&lt;\/script&gt;/);
  assert.match(result, /Waiting/); assert.match(result, /Updating/);
});

test('malformed or absent result lists do not introduce contact selection', () => {
  assert.match(html({ targets: [null, 'invalid', []] }), /0 of 0 records updated/);
  assert.doesNotMatch(html({}), /<select|<button/);
});
