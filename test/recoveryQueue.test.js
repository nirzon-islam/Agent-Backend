"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const recoveryQueue = require("../agent/recoveryQueue");

function appstate(overrides = []) {
  return JSON.stringify([
    { key: "c_user", value: "123456789012345", domain: ".facebook.com", path: "/" },
    { key: "xs", value: "session-token", domain: ".facebook.com", path: "/" },
    ...overrides
  ]);
}

test("detects Bot ID from c_user without a manually supplied ID", () => {
  const parsed = recoveryQueue.normalizeCookie(appstate());
  assert.equal(parsed.botId, "123456789012345");
});

test("accepts cookie entries using name instead of key", () => {
  const parsed = recoveryQueue.normalizeCookie(JSON.stringify([
    { name: "c_user", value: "123456789012345", domain: "www.facebook.com" },
    { name: "xs", value: "session-token", domain: "www.facebook.com" }
  ]));
  assert.equal(parsed.botId, "123456789012345");
});

test("rejects conflicting c_user identities", () => {
  assert.throws(() => recoveryQueue.normalizeCookie(appstate([
    { key: "c_user", value: "987654321012345", domain: ".facebook.com" }
  ])), /conflicting/);
});

test("rejects non-Facebook cookie domains", () => {
  assert.throws(() => recoveryQueue.normalizeCookie(JSON.stringify([
    { key: "c_user", value: "123456789012345", domain: "evil.example" },
    { key: "xs", value: "session-token", domain: ".facebook.com" }
  ])), /non-Facebook/);
});

test("requires both c_user and xs", () => {
  assert.throws(() => recoveryQueue.normalizeCookie(JSON.stringify([
    { key: "c_user", value: "123456789012345", domain: ".facebook.com" }
  ])), /c_user and xs/);
});

test("queues and claims a different account without a manual Bot ID", () => {
  const queued = recoveryQueue.submit({ cookie: appstate(), ownerId: "test-owner" });
  assert.equal(queued.botId, "123456789012345");
  const claimed = recoveryQueue.claimNext();
  assert.equal(claimed.requestId, queued.requestId);
  assert.equal(claimed.botId, queued.botId);
  assert.equal(claimed.cookie, appstate());
  assert.equal(recoveryQueue.claimNext(), null);
});

test("accepts progress states emitted by the GoatBot recovery handler", () => {
  const queued = recoveryQueue.submit({ cookie: appstate(), ownerId: "test-owner" });
  const claimed = recoveryQueue.claimNext();
  assert.equal(claimed.requestId, queued.requestId);
  for (const state of ["validating", "authenticated", "starting", "mqtt_connecting", "online"]) {
    assert.equal(recoveryQueue.reportProgress({
      requestId: queued.requestId,
      botId: queued.botId,
      state,
      message: state
    }), true);
  }
  const status = recoveryQueue.getStatus(queued.requestId, "test-owner");
  assert.equal(status.state, "online");
});
