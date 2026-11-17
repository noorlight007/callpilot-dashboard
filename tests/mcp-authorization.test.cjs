const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../node_modules/typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/mcp-authorization.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: mod.exports, module: mod, URL, URLSearchParams, encodeURIComponent });
const { mcpFlow, mcpLoginDestination, mcpContinuation } = mod.exports;
const flow = 'a'.repeat(54);
test('MCP flow accepts only bounded URL-safe opaque state', () => {
  assert.equal(mcpFlow('?flow=' + flow), flow);
  for (const value of ['', '../wrong', 'x'.repeat(201), 'spaces in state']) assert.equal(mcpFlow('?flow=' + value), null);
});
test('login continuation never redirects to an external URL or an arbitrary dashboard page', () => {
  assert.equal(mcpLoginDestination('?next=' + encodeURIComponent('/mcp/connect?flow=' + flow)), '/mcp/connect?flow=' + flow);
  for (const value of ['https://evil.test/mcp/connect?flow=' + flow, '//evil.test', '/dashboard', '/mcp/connect?flow=short', '/mcp/connect?flow=' + flow + '#x']) assert.equal(mcpLoginDestination('?next=' + encodeURIComponent(value)), null);
});
test('approval continuation is restricted to the configured API origin and exact callback route', () => {
  const valid = 'https://devapi.callpilot.pro/jobadder-chatgpt/oauth/callpilot/callback?flow=' + flow + '&approval=' + flow;
  assert.equal(mcpContinuation(valid, 'https://devapi.callpilot.pro/api/v1'), valid);
  for (const value of [valid.replace('devapi.callpilot.pro', 'evil.test'), valid.replace('https:', 'http:'), valid.replace('/oauth/callpilot/callback', '/admin'), valid + '#fragment', valid.replace('approval=' + flow, 'approval=short')]) assert.equal(mcpContinuation(value, 'https://devapi.callpilot.pro/api/v1'), null);
});
