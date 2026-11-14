
"use strict";

const crypto = require("crypto");

const config = require("./config");

const ALLOWED_ACTIONS = new Set([
  "read",
  "create",
  "edit",
  "delete",
  "install",
  "test",
  "update"
]);

function createRequestId() {
  return crypto.randomBytes(24).toString("hex");
}

function hashAction(action) {
  if (!action || typeof action !== "object") {
    throw new Error("Invalid action");
  }

  const serialized = JSON.stringify(action);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function checkActionPermission(type) {
  if (!ALLOWED_ACTIONS.has(type)) {
    throw new Error("Action type is not allowed");
  }

  if (type === "install" && !config.security.allowAutomaticInstall) {
    return { allowed: false, requiresApproval: true };
  }

  if (type === "delete" && !config.security.allowAutomaticDelete) {
    return { allowed: false, requiresApproval: true };
  }

  if (type === "edit" || type === "create" || type === "update") {
    return { allowed: false, requiresApproval: true };
  }

  if (type === "test" || type === "read") {
    return { allowed: true, requiresApproval: false };
  }

  return { allowed: false, requiresApproval: true };
}

function verifyBridgeSecret(receivedSecret) {
  const expected = config.bridge.secret;

  if (!expected || typeof receivedSecret !== "string") {
    return false;
  }

  const received = Buffer.from(receivedSecret);
  const stored = Buffer.from(expected);

  if (received.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, stored);
}

module.exports = {
  createRequestId,
  hashAction,
  checkActionPermission,
  verifyBridgeSecret
};
