"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const security = require("../agent/security");

test("hashAction is independent of object key insertion order", () => {
  assert.equal(
    security.hashAction({ type: "edit", payload: { b: 2, a: 1 } }),
    security.hashAction({ payload: { a: 1, b: 2 }, type: "edit" })
  );
});

test("hashAction changes when action content changes", () => {
  assert.notEqual(
    security.hashAction({ type: "edit", path: "a.js" }),
    security.hashAction({ type: "edit", path: "b.js" })
  );
});

test("hashAction rejects circular and non-JSON values", () => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => security.hashAction(circular), /Circular/);
  assert.throws(() => security.hashAction({ value: undefined }), /plain JSON/);
});

test("hashAction rejects unsafe property names and oversized payloads", () => {
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => security.hashAction(unsafe), /Unsafe/);
  assert.throws(() => security.hashAction({ data: "x".repeat(33000) }), /too large/);
});

test("safeHashEqual only accepts matching SHA-256 hex digests", () => {
  const hash = security.hashAction({ type: "edit" });
  assert.equal(security.safeHashEqual(hash, hash), true);
  assert.equal(security.safeHashEqual(hash, "0".repeat(64)), false);
  assert.equal(security.safeHashEqual("invalid", hash), false);
});

test("protected action types require approval; read/test do not", () => {
  assert.equal(security.checkActionPermission("read").requiresApproval, false);
  assert.equal(security.checkActionPermission("test").requiresApproval, false);
  assert.equal(security.checkActionPermission("edit").requiresApproval, true);
  assert.equal(security.checkActionPermission("create").requiresApproval, true);
  assert.equal(security.checkActionPermission("update").requiresApproval, true);
  assert.equal(security.checkActionPermission("delete").requiresApproval, true);
  assert.equal(security.checkActionPermission("install").requiresApproval, true);
  assert.throws(() => security.checkActionPermission("shell"));
});

test("executable action schema matches the restricted Railway executor", () => {
  assert.equal(security.validateExecutableAction({
    type: "edit", path: "languages/bn.lang", content: "hello"
  }).type, "edit");
  assert.equal(security.validateExecutableAction({
    type: "read", path: "languages/bn.lang"
  }).type, "read");
  assert.equal(security.validateExecutableAction({
    type: "test", path: "languages/helper.js"
  }).type, "test");
  assert.throws(() => security.validateExecutableAction({
    type: "delete", path: "languages/bn.lang"
  }), /Unsupported executable action/);
  assert.equal(security.validateExecutableAction({
    type: "edit", path: "scripts/cmds/admin.js", content: "x"
  }).path, "scripts/cmds/admin.js");
  assert.equal(security.validateExecutableAction({
    type: "create", path: "scripts/events/onMessage.js", content: "module.exports = {};"
  }).path, "scripts/events/onMessage.js");
  assert.throws(() => security.validateExecutableAction({
    type: "edit", path: "scripts/cmds/admin.txt", content: "x"
  }), /outside the language workspace/);
  assert.throws(() => security.validateExecutableAction({
    type: "edit", path: "languages/bn.lang", content: "x", command: "rm -rf"
  }), /invalid shape/);
  assert.throws(() => security.validateExecutableAction({
    type: "edit", path: "languages/bn.lang", content: "x".repeat(65537)
  }), /64 KiB/);
  assert.throws(() => security.validateExecutableAction({
    type: "test", path: "languages/file.lang"
  }), /JavaScript files/);
});


test("multi-step plans accept bounded read-only and file actions", () => {
  const plan = {
    type: "plan",
    summary: "Inspect language files",
    steps: [
      { type: "list", path: "languages" },
      { type: "readMany", path: "languages" },
      { type: "read", path: "languages/bn.lang" },
      { type: "edit", path: "languages/bn.lang", content: "updated" }
    ]
  };
  assert.equal(security.validateExecutablePlan(plan), plan);
});

test("multi-step plans reject empty, oversized, and malformed plans", () => {
  assert.throws(() => security.validateExecutablePlan({ type: "plan", steps: [] }), /Invalid multi-step plan/);
  assert.throws(() => security.validateExecutablePlan({
    type: "plan", steps: Array.from({ length: 13 }, () => ({ type: "list", path: "languages" }))
  }), /Invalid multi-step plan/);
  assert.throws(() => security.validateExecutablePlan({
    type: "plan", steps: [{ type: "list", path: "scripts" }]
  }), /outside the language workspace/);
  assert.throws(() => security.validateExecutablePlan({
    type: "plan", steps: [{ type: "shell", command: "echo unsafe" }]
  }), /Unsupported executable action/);
  assert.throws(() => security.validateExecutablePlan({
    type: "plan", summary: "x".repeat(501), steps: [{ type: "list", path: "languages" }]
  }), /Invalid plan summary/);
  assert.throws(() => security.validateExecutablePlan({
    type: "plan", steps: [{ type: "read", path: "languages/bn.lang", extra: true }]
  }), /invalid shape/);
});

test("multi-step plans reject unknown top-level fields", () => {
  assert.throws(() => security.validateExecutablePlan({
    type: "plan",
    steps: [{ type: "list", path: "languages" }],
    executeImmediately: true
  }), /Invalid multi-step plan/);
});
