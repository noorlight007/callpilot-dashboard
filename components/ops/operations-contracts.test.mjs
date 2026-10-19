import assert from "node:assert/strict";
import test from "node:test";
import { campaignExpired, parseCampaignRecipients, parseConditions } from "./operations-contracts.ts";

test("campaign CSV preserves quoted names and matches server phone-first deduplication", () => {
  const rows = parseCampaignRecipients('phone,email,name\r\n+441234567890,one@example.com,"Smith, Jane"\r\n+441234567890,other@example.com,Duplicate\r\n,USER@example.com,Email only\r\n,user@example.com,Duplicate email\r\n');
  assert.deepEqual(rows, [
    { phone: "+441234567890", email: "one@example.com", name: "Smith, Jane" },
    { phone: "", email: "USER@example.com", name: "Email only" },
  ]);
});

test("invalid recipient input cannot silently produce a proposal", () => {
  assert.throws(() => parseCampaignRecipients("phone,email,name\n01234567890,,Local"), /E.164/);
  assert.throws(() => parseCampaignRecipients('phone,email,name\n,user@example.com,"Unclosed'), /quoted/);
  assert.throws(() => parseCampaignRecipients("phone,email,name\n,user@example.com,Comma,Name"), /needs phone,email,name/);
  assert.throws(() => parseCampaignRecipients("phone,email,name\n,,Missing"), /needs a phone or email/);
});

test("campaign confirmations expire exactly at the server deadline and reject missing expiry", () => {
  const expiry = "2026-10-19T10:15:00Z";
  assert.equal(campaignExpired(expiry, Date.parse(expiry) - 1), false);
  assert.equal(campaignExpired(expiry, Date.parse(expiry)), true);
  assert.equal(campaignExpired(undefined), true);
  assert.equal(campaignExpired("not-a-date"), true);
});

test("condition editing preserves the event value's JSON type", () => {
  const result = parseConditions([
    { field: "statusId", value: "42", kind: "json" },
    { field: "available", value: "true", kind: "json" },
    { field: "label", value: "42", kind: "text" },
  ]);
  assert.equal(result.statusId, 42);
  assert.equal(result.available, true);
  assert.equal(result.label, "42");
  assert.throws(() => parseConditions([{ field: "", value: "x", kind: "text" }]), /needs a field/);
  assert.throws(() => parseConditions([{ field: "a", value: "x", kind: "text" }, { field: "a", value: "y", kind: "text" }]), /repeated/);
});
