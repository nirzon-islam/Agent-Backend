"use strict";

// Volatile, single-use credential handoff. Never persisted to MongoDB or logs.
const crypto = require("crypto");
const queue = new Map();
const history = new Map();
const MAX_HISTORY = 100;
const MAX_TTL_MS = 2 * 60 * 1000;
const MAX_COOKIE_BYTES = 64 * 1024;

function normalizeCookie(value) {
  if (typeof value !== "string") throw new Error("Cookie must be text");
  const cookie = value.trim();
  if (!cookie || Buffer.byteLength(cookie, "utf8") > MAX_COOKIE_BYTES) throw new Error("Cookie is empty or exceeds 64 KiB");
  if (!cookie.startsWith("[")) throw new Error("Please paste the full account.txt JSON cookie array");
  let items;
  try { items = JSON.parse(cookie); } catch { throw new Error("Cookie JSON is invalid"); }
  if (!Array.isArray(items) || items.length === 0 || items.length > 500) throw new Error("Cookie must be a non-empty JSON array (maximum 500 cookies)");

  let botId = "", xs = false;
  for (const item of items) {
    const key = item && (item.key || item.name);
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof key !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(key) ||
        typeof item.value !== "string" || !item.value || item.value.length > 16000) {
      throw new Error("Each cookie must contain a valid key and non-empty value");
    }
    if (typeof item.domain !== "string" || !item.domain.trim()) throw new Error("Each cookie must include its Facebook domain");
    const domain = item.domain.trim().toLowerCase().replace(/^\./, "");
    if (domain !== "facebook.com" && !domain.endsWith(".facebook.com")) throw new Error("Cookie contains a non-Facebook domain");
    if (item.path !== undefined && (typeof item.path !== "string" || !item.path.startsWith("/"))) throw new Error("Cookie path is invalid");
    if (key === "c_user") {
      const value = String(item.value).trim();
      if (!/^\d{5,30}$/.test(value)) throw new Error("Cookie c_user does not contain a valid numeric Facebook account ID");
      if (botId && botId !== value) throw new Error("Cookie contains conflicting c_user account IDs");
      botId = value;
    }
    if (key === "xs") xs = true;
  }
  if (!botId || !xs) throw new Error("Cookie must include Facebook c_user and xs session fields");
  return { cookie, botId };
}

function submit({ cookie, ownerId }) {
  const normalized = normalizeCookie(cookie);
  const botId = normalized.botId;
  const id = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  for (const [key, item] of queue) if (item.expiresAt <= now) queue.delete(key);
  // One active handoff per account; a fresh owner submission replaces an older one.
  for (const [key, item] of queue) if (item.botId === botId) queue.delete(key);
  queue.set(id, { id, botId, cookie: normalized.cookie, ownerId: String(ownerId), createdAt: now, expiresAt: now + MAX_TTL_MS, claimed: false });
  history.set(id, { requestId: id, botId, ownerId: String(ownerId), state: "queued", message: "Waiting for the GoatBot worker", createdAt: now, updatedAt: now, expiresAt: now + MAX_TTL_MS, events: [{ state: "queued", message: "Recovery request accepted; Bot ID detected from c_user", at: now }] });
  while (history.size > MAX_HISTORY) history.delete(history.keys().next().value);
  return { requestId: id, botId, expiresAt: new Date(now + MAX_TTL_MS).toISOString() };
}

function addEvent(meta, state, message) {
  const now = Date.now();
  meta.state = state;
  meta.message = String(message || "").replace(/[\r\n\t]/g, " ").slice(0, 240);
  meta.updatedAt = now;
  meta.events.push({ state, message: meta.message, at: now });
  if (meta.events.length > 30) meta.events.shift();
}

function reportProgress({ requestId, botId, state, message }) {
  const allowed = new Set(["claimed", "validating", "login_started", "provider_ready", "authenticated", "mqtt_connecting", "starting", "online", "checkpoint", "error", "expired"]);
  if (!allowed.has(state) || typeof requestId !== "string" || typeof botId !== "string") return false;
  const meta = history.get(requestId);
  if (!meta || meta.botId !== botId) return false;
  if (["online", "checkpoint", "error", "expired"].includes(meta.state)) return false;
  addEvent(meta, state, message);
  return true;
}

function getStatus(requestId, ownerId) {
  const meta = history.get(requestId);
  if (!meta || meta.ownerId !== String(ownerId)) return null;
  return { requestId: meta.requestId, botId: meta.botId, state: meta.state, message: meta.message,
    createdAt: new Date(meta.createdAt).toISOString(), updatedAt: new Date(meta.updatedAt).toISOString(),
    expiresAt: new Date(meta.expiresAt).toISOString(),
    events: meta.events.map(event => ({ state: event.state, message: event.message, at: new Date(event.at).toISOString() })) };
}

function claim(botId) {
  if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId)) return null;
  const now = Date.now();
  for (const [key, item] of queue) {
    if (item.expiresAt <= now) { queue.delete(key); continue; }
    if (item.botId === botId && !item.claimed) {
      item.claimed = true;
      const result = { requestId: item.id, botId: item.botId, cookie: item.cookie };
      const meta = history.get(item.id);
      if (meta) addEvent(meta, "claimed", "Worker securely claimed the appstate");
      queue.delete(key);
      return result;
    }
  }
  return null;
}

function claimNext() {
  const now = Date.now();
  for (const [key, item] of queue) {
    if (item.expiresAt <= now) { queue.delete(key); continue; }
    if (!item.claimed) {
      item.claimed = true;
      const result = { requestId: item.id, botId: item.botId, cookie: item.cookie };
      const meta = history.get(item.id);
      if (meta) addEvent(meta, "claimed", "Worker securely claimed the appstate");
      queue.delete(key);
      return result;
    }
  }
  return null;
}

module.exports = { submit, claim, claimNext, normalizeCookie, reportProgress, getStatus };
