const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const project = path.resolve(__dirname, '..');
const ts = require(path.join(project, 'node_modules/typescript'));
const React = require(path.join(project, 'node_modules/react'));
const { renderToStaticMarkup } = require(path.join(project, 'node_modules/react-dom/server'));
const moduleSource = fs.readFileSync(path.join(project, 'components/jigsaw/microsoft365-workflows.tsx'), 'utf8');
const exportsObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(moduleSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module: exportsObject, exports: exportsObject.exports, Date, Number, Object, String, Set, Error, Array, URL, encodeURIComponent,
  require: name => name === 'react' ? React : name === 'react/jsx-runtime' ? require(path.join(project, 'node_modules/react/jsx-runtime')) : name === 'next/link' ? { default: props => React.createElement('a', props, props.children) } : name === 'lucide-react' ? { Mail: () => null, Info: () => null } : name === './record-contact-selector' ? { RecordContactSelector: () => React.createElement('span', null, 'Search records') } : name === '@/services/jigsaw-service' ? { jigsaw() {}, results: d => d?.results || [] } : require(name),
});
const { workflowDraft, workflowPayload, emailList, ImportedEmail } = exportsObject.exports;
const types = [{ name: 'Passport', attachment_type: 'Other', requires_expiry: true }, { name: 'CV', attachment_type: 'Resume', requires_expiry: false }];
const ready = () => workflowDraft({ mailboxes: ['staff@example.test'], notify_from: 'staff@example.test', timesheets_to: 'payroll@example.test', orders_notify_to: 'orders@example.test' });
test('workflow payload is limited to routing settings and omits app secrets and tenant edits', () => {
  const payload = workflowPayload(workflowDraft({ ...ready(), tenant_id: 'not-resubmitted', client_secret: 'SECRET', internal_domains: ['company.test'] }), types);
  assert.equal(payload.client_secret, undefined); assert.equal(payload.tenant_id, undefined); assert.deepEqual(Array.from(payload.internal_domains), ['company.test']);
  assert.equal(payload.document_fields.CV.attachment_type, 'Resume'); assert.equal(payload.document_fields.Passport.requires_expiry, true);
});
test('enabled forwarding requires a selected sender and payroll recipient', () => {
  assert.throws(() => workflowPayload({ ...ready(), forward_timesheets: true, notify_from: 'outside@example.test' }, types), /sending mailbox/);
  assert.throws(() => workflowPayload({ ...ready(), forward_timesheets: true, timesheets_to: '' }, types), /payroll recipient/);
  assert.throws(() => workflowPayload({ ...ready(), notify_orders: true, orders_notify_to: '' }, types), /recipient for client orders/);
});
test('custom date field IDs stay blank or use positive integers', () => {
  const draft = ready(); draft.document_fields = { Passport: { issue_date_field_id: '100', expiry_date_field_id: '', requires_expiry: false } };
  const payload = workflowPayload(draft, types);
  assert.equal(payload.document_fields.Passport.issue_date_field_id, 100); assert.equal(payload.document_fields.Passport.expiry_date_field_id, null); assert.equal(payload.document_fields.Passport.requires_expiry, false);
  draft.document_fields.Passport.issue_date_field_id = '3.5'; assert.throws(() => workflowPayload(draft, types), /positive JobAdder field ID/);
});
test('go-live time is sent with timezone while untouched blank time is omitted', () => {
  const draft = ready(); assert.equal(workflowPayload(draft, types).start_from, undefined);
  draft.start_from = '2026-11-16T12:30'; assert.match(workflowPayload(draft, types).start_from, /Z$/);
  draft.start_from = 'not-a-date'; assert.throws(() => workflowPayload(draft, types), /valid go-live date/);
});
test('mailbox/domain input normalizes and deduplicates values', () => { assert.deepEqual(Array.from(emailList('Example.test; example.test\nSECOND.test')), ['example.test', 'second.test']); });
const html = automation => renderToStaticMarkup(React.createElement(ImportedEmail, { email: { uid: 'email1', subject: 'Test', sender: 'candidate@example.test', mailbox: 'staff@example.test', body: '<script>untrusted()</script>', match_state: 'unknown', automation }, onMatched() {} }));
test('email shows document issues and escapes untrusted body text', () => { const result = html({ status: 'completed', issues: ['Printed holder name mismatch'], outcome: 'Saved with review needed' }); assert.match(result, /Printed holder name mismatch/); assert.match(result, /&lt;script&gt;/); assert.doesNotMatch(result, /<script>/); });
test('completed and uncertain workflows do not offer a new record assignment', () => { assert.doesNotMatch(html({ status: 'completed' }), /Link record and resume/); assert.doesNotMatch(html({ status: 'needs_review' }), /Link record and resume/); assert.match(html({ status: 'needs_match' }), /Link record and resume/); });
