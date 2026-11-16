"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { safeBaseUrl } = require("../agent/routes/aiSettings");

test("safeBaseUrl accepts public HTTPS provider URLs", () => {
  assert.equal(safeBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
});

test("safeBaseUrl rejects non-HTTPS URLs and URL credentials", () => {
  assert.throws(() => safeBaseUrl("http://api.example.com"), /public HTTPS/);
  assert.throws(() => safeBaseUrl("https://user:pass@api.example.com/v1"), /public HTTPS/);
});

test("safeBaseUrl rejects local and private network hosts", () => {
  for (const value of [
    "https://localhost/v1",
    "https://service.local/v1",
    "https://metadata.google.internal/v1",
    "https://router.lan/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.8/v1",
    "https://192.168.1.8/v1",
    "https://172.20.0.2/v1",
    "https://169.254.169.254/v1",
    "https://[::1]/v1",
    "https://[fd00::1]/v1"
  ]) {
    assert.throws(() => safeBaseUrl(value), /public HTTPS/);
  }
});

test("safeBaseUrl rejects query strings and fragments", () => {
  assert.throws(() => safeBaseUrl("https://api.example.com/v1?token=x"), /public HTTPS/);
  assert.throws(() => safeBaseUrl("https://api.example.com/v1#fragment"), /public HTTPS/);
});
