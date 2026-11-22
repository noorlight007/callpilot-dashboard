const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const project = path.resolve(__dirname, '..');
const ts = require(path.join(project, 'node_modules/typescript'));
const React = require(path.join(project, 'node_modules/react'));
const { renderToStaticMarkup } = require(path.join(project, 'node_modules/react-dom/server'));

function load(file, extras = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(project, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Date, Number, Object, String, Set, Error, Array, URL, encodeURIComponent,
    require: name => extras[name] || (name === 'react' ? React : name === 'react/jsx-runtime' ? require(path.join(project, 'node_modules/react/jsx-runtime')) : name === 'next/link' ? { default: props => React.createElement('a', props, props.children) } : name === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : name === './record-contact-selector' ? { RecordContactSelector: () => null } : name === '@/services/jigsaw-service' ? { jigsaw() {}, results: value => value?.results || [] } : require(name)),
  }); return module.exports;
}

const api = load('services/jigsaw-additions-service.ts');
test('cleanup requires readable date IDs and confidence of at least ninety percent', () => {
  assert.throws(() => api.cleanupSettingsPayload({ auto_confidence: .89 }), /90%/);
  assert.throws(() => api.cleanupSettingsPayload({ auto_confidence: .95, catalogue: [{ name: 'CSCS', expiry_field_id: '1.5' }] }), /positive JobAdder/);
  const value = api.cleanupSettingsPayload({ auto_confidence: .95, catalogue: [{ key: 'cscs', expiry_field_id: '123', categories: 'Labourer, Trades' }], renewal_reminder_days: 7 });
  assert.equal(value.catalogue[0].expiry_field_id, 123); assert.deepEqual(Array.from(value.catalogue[0].categories), ['Labourer', 'Trades']);
  assert.deepEqual(Array.from(value.notice_days), [60, 30, 0]); assert.equal(value.messaging_enabled, false);
});
test('sales settings enforce daily caps and a separate sending mailbox', () => {
  assert.throws(() => api.salesSettingsPayload({ daily_cap: 51 }), /between 1 and 50/);
  assert.throws(() => api.salesSettingsPayload({ daily_cap: 20, sending_mailbox: 'Steven@business.test', consultant_email: 'steven@business.test' }), /separate sales/);
  const value = api.salesSettingsPayload({ daily_cap: '20', followup_days: '7', sending_mailbox: 'sales@business.test', consultant_email: 'steven@business.test', paused_reason: 'blocked', source_status: {}, client_secret: 'never', enabled: false, email_mode: 'draft' });
  assert.equal(value.daily_cap, 20); assert.equal(value.followup_days, 7); assert.equal(value.enabled, false);
  assert.equal(value.paused_reason, undefined); assert.equal(value.source_status, undefined); assert.equal(value.client_secret, undefined);
});
test('evidence links cannot execute scripts or open data documents', () => {
  assert.equal(api.publicSource('javascript:alert(1)'), undefined); assert.equal(api.publicSource('data:text/html,<script>'), undefined);
  assert.equal(api.publicSource('https://www.find-tender.service.gov.uk/Notice/123'), 'https://www.find-tender.service.gov.uk/Notice/123');
});
const mail = load('components/jigsaw/microsoft365-workflows.tsx');
test('email workflow saves an explicit notification pause and communication setting', () => {
  const draft = mail.workflowDraft({ mailboxes: [], notifications_paused: true, record_communications: true, client_secret: 'never' });
  const payload = mail.workflowPayload(draft, []);
  assert.equal(payload.notifications_paused, true); assert.equal(payload.record_communications, true); assert.equal(payload.client_secret, undefined);
});
test('held business notification has a review decision while duplicate or sent emails cannot resend', () => {
  const html = notification => renderToStaticMarkup(React.createElement(mail.ImportedEmail, { email: { uid: 'email', subject: 'Staffing enquiry', sender: 'client@business.test', automation: { uid: 'run', status: 'needs_review', category: 'client_booking', notification } }, onMatched() {} }));
  assert.match(html({ status: 'held', reason: 'Read the source' }), /Confirm New Business Enquiry/);
  assert.match(html({ status: 'held', reason: 'Read the source' }), /No Notification Needed/);
  assert.doesNotMatch(html({ status: 'duplicate' }), /Confirm New Business Enquiry/);
  assert.doesNotMatch(html({ status: 'sent' }), /Confirm New Business Enquiry/);
  assert.match(html({ status: 'held', reason: '<script>invalid</script>' }), /&lt;script&gt;/);
});
