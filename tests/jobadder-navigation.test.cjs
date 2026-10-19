const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/ops/jobadder-auth.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
vm.runInThisContext(`(function(module,exports){${output}\n})`)(loaded, loaded.exports);
const { jobAdderReturnTo, jobAdderResult, signInReturnPath } = loaded.exports;

test('OAuth return page preserves path, existing query and fragment without replaying prior feedback', () => {
  assert.equal(jobAdderReturnTo('https://dashboard.example/settings?tab=ats&jobadder=error#connections'), 'https://dashboard.example/settings?tab=ats#connections');
  assert.equal(jobAdderResult(new URLSearchParams('jobadder=connected')), 'connected');
  assert.equal(jobAdderResult(new URLSearchParams('jobadder=error')), 'error');
  assert.equal(jobAdderResult(new URLSearchParams('jobadder=arbitrary-provider-message')), null);
});
test('sign-in can continue to the originating local page without requiring OTP', () => {
  assert.equal(signInReturnPath('/settings?tab=ats#connections', 'https://dashboard.example'), '/settings?tab=ats#connections');
});
test('sign-in continuation rejects external, protocol-relative, backslash and auth/API destinations', () => {
  for (const target of ['https://attacker.example', '//attacker.example/settings', '/\\attacker.example', '/login?next=/settings', '/api/session', '/settings\n']) {
    assert.equal(signInReturnPath(target, 'https://dashboard.example'), null, target);
  }
  assert.equal(signInReturnPath('/records/candidates?Keywords=Jane#record', 'https://dashboard.example'), '/records/candidates?Keywords=Jane#record');
});
