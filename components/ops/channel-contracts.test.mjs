import assert from "node:assert/strict";
import test from "node:test";
import { channelSendAllowed, liveCallForPhone, templateParameters, templateSendComponents, withinWhatsAppWindow } from "./channel-contracts.ts";

test("WhatsApp free text closes exactly at 24 hours and missing channel history stays closed", () => {
  const inbound = "2026-10-18T10:00:00Z";
  const deadline = Date.parse(inbound) + 24 * 60 * 60 * 1000;
  assert.equal(withinWhatsAppWindow(inbound, deadline - 1), true);
  assert.equal(withinWhatsAppWindow(inbound, deadline), false);
  assert.equal(withinWhatsAppWindow(undefined, deadline), false);
  assert.equal(withinWhatsAppWindow("invalid", deadline), false);
});

test("standard staff sending requires their membership assignment, including voice reply channels", () => {
  assert.equal(channelSendAllowed("standard_staff", 7, 7), true);
  assert.equal(channelSendAllowed("standard_staff", 7, 8), false);
  assert.equal(channelSendAllowed("standard_staff", 7, null), false);
  assert.equal(channelSendAllowed("standard_staff", undefined, undefined), false);
  assert.equal(channelSendAllowed(undefined, undefined, undefined), false);
  assert.equal(channelSendAllowed("full_staff", 7, 8), true);
  assert.equal(channelSendAllowed("super_user", 7, null), true);
});

test("caller pop uses the newest live call and cannot reuse a completed call for the same phone", () => {
  const completed = { number: "+441234567890", status: "completed", started_at: "2026-10-19T10:05:00Z" };
  const ringing = { number: "+44 1234 567890", status: "ringing", started_at: "2026-10-19T10:04:00Z" };
  const earlier = { number: "+441234567890", status: "in_progress", started_at: "2026-10-19T10:00:00Z" };
  assert.equal(liveCallForPhone([earlier, completed, ringing], "+441234567890"), ringing);
  assert.equal(liveCallForPhone([completed], "+441234567890"), undefined);
  assert.equal(liveCallForPhone([ringing], "+441234567891"), undefined);
});

test("template substitutions preserve provider component type, URL button index, and repeated parameter order", () => {
  const template = { uid: "en-template", name: "availability", language: "en_GB", status: "APPROVED", components: [
    { type: "HEADER", format: "TEXT", text: "Hello {{1}}" },
    { type: "BODY", text: "{{2}} for {{1}}; reminder {{1}}" },
    { type: "BUTTONS", buttons: [{ type: "PHONE_NUMBER" }, { type: "URL", url: "https://example.com/{{1}}" }] },
  ] };
  const values = { "en-template:0:1": "Jane", "en-template:1:1": "Monday", "en-template:1:2": "Available", "en-template:2-1:1": "record-123" };
  assert.deepEqual(templateSendComponents(template, values), [
    { type: "header", parameters: [{ type: "text", text: "Jane" }] },
    { type: "body", parameters: [{ type: "text", text: "Monday" }, { type: "text", text: "Available" }] },
    { type: "button", sub_type: "url", index: "1", parameters: [{ type: "text", text: "record-123" }] },
  ]);
  assert.throws(() => templateSendComponents(template, {}), /Supply header parameter/);
  assert.throws(() => templateSendComponents({ ...template, status: "PENDING" }, values), /approved/);
});

test("media, named, and nonsequential template parameters cannot silently send empty components", () => {
  const base = { uid: "x", name: "x", language: "en_GB", status: "APPROVED" };
  for (const component of [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Hi {{name}}" }, { type: "BODY", text: "Hi {{2}}" }]) {
    const template = { ...base, components: [component] };
    assert.equal(templateParameters(template).unsupported, true);
    assert.throws(() => templateSendComponents(template, {}), /unsupported/);
  }
});
