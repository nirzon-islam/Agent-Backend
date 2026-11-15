"use strict";

const crypto = require("crypto");
const config = require("./config");

const ALLOWED_ACTIONS = new Set(["read", "create", "edit", "delete", "restore", "move", "install", "test", "update", "restart"]);
const EXECUTABLE_ACTION_TYPES = new Set(["create", "edit", "read", "test", "delete", "restore", "move", "install", "update", "restart"]);
const MAX_PLAN_STEPS = 20;
const PROTECTED_SEGMENTS = new Set([".git", "node_modules", "secrets", "cache", "cookies", "Fca_Database"]);

function safePath(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 500 || value.includes("\\") || value.startsWith("/") || value.includes("\0")) return false;
  const parts = value.split("/");
  return parts.every(part =>
    /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part) &&
    !PROTECTED_SEGMENTS.has(part) && !part.startsWith(".") &&
    !/^account/i.test(part) && !/^appstate/i.test(part) &&
    !/^credential/i.test(part) && !/^cookie/i.test(part)
  );
}

function validateWorkspaceDirectory(value) {
  return safePath(value) && value.length <= 300;
}

function validateExecutablePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || plan.type !== "plan" ||
      Object.keys(plan).some(key => !["type", "steps", "summary"].includes(key)) ||
      !Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > MAX_PLAN_STEPS) {
    throw new Error("Invalid multi-step plan");
  }
  if (plan.summary !== undefined && (typeof plan.summary !== "string" || plan.summary.length > 500)) throw new Error("Invalid plan summary");
  for (const step of plan.steps) {
    if (!step || typeof step !== "object" || Array.isArray(step)) throw new Error("Invalid plan step");
    if (step.type === "list" || step.type === "readMany") {
      if (Object.keys(step).some(key => !["type", "path"].includes(key)) || !validateWorkspaceDirectory(step.path)) {
        throw new Error("Plan directory is outside the server workspace or protected");
      }
    } else validateExecutableAction(step);
  }
  return plan;
}

function validateExecutableAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action) || Object.getPrototypeOf(action) !== Object.prototype) throw new Error("Invalid executable action");
  if (!EXECUTABLE_ACTION_TYPES.has(action.type)) throw new Error("Unsupported executable action type");
  const required = {
    create: ["type", "path", "content"], edit: ["type", "path", "content"],
    read: ["type", "path"], test: ["type", "path"], delete: ["type", "path"],
    restore: ["type", "path", "backupId"], move: ["type", "path", "destination"],
    install: ["type", "manager"], update: ["type", "manager"], restart: ["type"]
  }[action.type];
  if (Object.keys(action).some(key => !required.includes(key)) || required.some(key => !Object.prototype.hasOwnProperty.call(action, key))) {
    throw new Error("Executable action has an invalid shape");
  }
  if (["install", "update"].includes(action.type)) {
    if (action.manager !== "npm-ci" && action.manager !== "npm-update") throw new Error("Only approved npm dependency operations are supported");
    return action;
  }
  if (!safePath(action.path)) throw new Error("Executable action path is outside the server workspace or protected");
  if (action.type === "move" && (!safePath(action.destination) || action.destination === action.path)) throw new Error("Invalid move destination");
  if (action.type === "restore" && (typeof action.backupId !== "string" || !/^[a-f0-9]{64}$/.test(action.backupId))) throw new Error("Invalid backup identifier");
  if (action.type === "test" && !action.path.endsWith(".js")) throw new Error("Syntax test supports JavaScript files only");
  if (action.type === "create" || action.type === "edit") {
    if (typeof action.content !== "string" || Buffer.byteLength(action.content, "utf8") > 262144) throw new Error("Executable action content must be text up to 256 KiB");
  }
  return action;
}

function createRequestId() { return crypto.randomBytes(24).toString("hex"); }
function canonicalize(value, seen = new Set(), depth = 0) {
  if (depth > 20) throw new Error("Action is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error("Circular action data is not allowed");
    seen.add(value); const result = value.map(item => canonicalize(item, seen, depth + 1)); seen.delete(value); return result;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("Action must contain only plain JSON data");
  if (seen.has(value)) throw new Error("Circular action data is not allowed");
  seen.add(value); const result = {};
  for (const key of Object.keys(value).sort()) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Unsafe action property");
    result[key] = canonicalize(value[key], seen, depth + 1);
  }
  seen.delete(value); return result;
}
function hashAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) throw new Error("Invalid action");
  const serialized = JSON.stringify(canonicalize(action));
  if (Buffer.byteLength(serialized, "utf8") > 32768) throw new Error("Action payload is too large");
  return crypto.createHash("sha256").update(serialized).digest("hex");
}
function safeHashEqual(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" || !/^[a-f0-9]{64}$/i.test(received) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
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
  const received = Buffer.from(receivedSecret), stored = Buffer.from(expected);
  if (received.length !== stored.length) return false;
  return crypto.timingSafeEqual(received, stored);
}
module.exports = { createRequestId, hashAction, safeHashEqual, checkActionPermission, verifyBridgeSecret, validateExecutableAction, validateExecutablePlan };
