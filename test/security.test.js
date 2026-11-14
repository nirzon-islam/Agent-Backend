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
