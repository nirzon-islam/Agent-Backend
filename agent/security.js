"use strict";

const crypto = require("crypto");
const config = require("./config");

const ALLOWED_ACTIONS = new Set([
  "read", "create", "edit", "delete", "install", "test", "update"
]);

function createRequestId() {
  return crypto.randomBytes(24).toString("hex");
}

function canonicalize(value, seen = new Set(), depth = 0) {
  if (depth > 20) throw new Error("Action is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error("Circular action data is not allowed");
    seen.add(value);
    const result = value.map(item => canonicalize(item, seen, depth + 1));
    seen.delete(value);
    return result;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("Action must contain only plain JSON data");
  }
  if (seen.has(value)) throw new Error("Circular action data is not allowed");
  seen.add(value);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (["__proto__", "prototype", "constructor"].includes(key)) {
      throw new Error("Unsafe action property");
    }
    result[key] = canonicalize(value[key], seen, depth + 1);
  }
  seen.delete(value);
  return result;
}

function hashAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("Invalid action");
  }
  const serialized = JSON.stringify(canonicalize(action));
  if (Buffer.byteLength(serialized, "utf8") > 32768) {
    throw new Error("Action payload is too large");
  }
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function safeHashEqual(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" ||
      !/^[a-f0-9]{64}$/i.test(received) || !/^[a-f0-9]{64}$/i.test(expected)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

function checkActionPermission(type) {
  if (!ALLOWED_ACTIONS.has(type)) throw new Error("Action type is not allowed");
  if (type === "install" && !config.security.allowAutomaticInstall) return { allowed: false, requiresApproval: true };
  if (type === "delete" && !config.security.allowAutomaticDelete) return { allowed: false, requiresApproval: true };
  if (["edit", "create", "update"].includes(type)) return { allowed: false, requiresApproval: true };
  if (type === "test" || type === "read") return { allowed: true, requiresApproval: false };
  return { allowed: false, requiresApproval: true };
}

function verifyBridgeSecret(receivedSecret) {
  const expected = config.bridge.secret;
  if (!expected || typeof receivedSecret !== "string") return false;
  const received = Buffer.from(receivedSecret);
  const stored = Buffer.from(expected);
  if (received.length !== stored.length) return false;
  return crypto.timingSafeEqual(received, stored);
}

module.exports = { createRequestId, hashAction, safeHashEqual, checkActionPermission, verifyBridgeSecret };
