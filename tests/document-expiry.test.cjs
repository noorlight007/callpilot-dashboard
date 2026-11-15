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
const source = fs.readFileSync(path.join(project, 'components/jigsaw/document-expiry.tsx'), 'utf8');
const moduleContext = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module: moduleContext, exports: moduleContext.exports, Date, Number, String, Intl, require: requireProject,
});
const { DocumentExpiry, documentExpiryDetails } = moduleContext.exports;
const today = new Date(2026, 10, 10, 12);
const markup = document => renderToStaticMarkup(React.createElement(DocumentExpiry, { document }));

test('expiry is rendered as the printed calendar date, with the actual JobAdder save state', () => {
  const details = documentExpiryDetails({ expiry_date: '2027-02-14', expiry_source: 'ai', expiry_synced_at: '2026-11-10T09:00:00Z' }, today);
  assert.equal(details.label, 'Expires 14 Feb 2027');
  assert.equal(details.description, 'Read from document · Saved in JobAdder');
  assert.doesNotMatch(details.description, /verified|approved/i);
});

test('expiry today is not marked expired, and a previous day is', () => {
  assert.equal(documentExpiryDetails({ expiry_date: '2026-11-10' }, today).label, 'Expires 10 Nov 2026');
  const expired = documentExpiryDetails({ expiry_date: '2026-11-09' }, today);
  assert.equal(expired.label, 'Expired 9 Nov 2026');
  assert.equal(expired.tone, 'red');
});

test('missing and uncertain expiry dates never manufacture a date or successful save', () => {
  for (const status of ['not_found', 'uncertain', 'unavailable', 'unsupported', 'pending']) {
    const details = documentExpiryDetails({ expiry_date: null, expiry_status: status }, today);
    assert.ok(details.description);
    assert.equal(details.label, '');
    assert.doesNotMatch(details.description, /Saved in JobAdder|\d{4}/);
  }
  assert.equal(documentExpiryDetails({}), null, 'Old backend records remain readable without invented status');
});

test('invalid and non-calendar dates are not displayed', () => {
  for (const expiry of ['2026-02-30', '2026-13-01', '2026-1-01', '2026-11-10T00:00:00Z', 'invalid', '<script>']) {
    assert.equal(documentExpiryDetails({ expiry_date: expiry }, today), null);
  }
});

test('a failed JobAdder save remains visible without exposing arbitrary provider errors', () => {
  const html = markup({ expiry_date: '2027-02-14', expiry_source: 'ai', expiry_error_code: 'private key=SECRET' });
  assert.match(html, /Expires 14 Feb 2027/);
  assert.match(html, /Expiry date needs saving in JobAdder/);
  assert.doesNotMatch(html, /SECRET|private key|Saved in JobAdder/);
  assert.match(markup({ expiry_date: '2027-02-14' }), /Waiting to save in JobAdder/);
});
