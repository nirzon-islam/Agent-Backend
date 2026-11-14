"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const requireOwner = require("../agent/middleware/requireOwner");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("requireOwner rejects missing authentication", () => {
  const res = responseRecorder();
  let called = false;
  requireOwner({}, res, () => { called = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test("requireOwner rejects non-owner roles", () => {
  const res = responseRecorder();
  let called = false;
  requireOwner({ user: { id: "admin-1", role: "admin" } }, res, () => { called = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test("requireOwner permits authenticated owner", () => {
  const res = responseRecorder();
  let called = false;
  requireOwner({ user: { id: "owner-1", role: "owner" } }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});
