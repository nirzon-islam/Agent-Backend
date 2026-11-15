"use strict";

// Volatile, single-use credential handoff. Never persisted to MongoDB or logs.
const crypto = require("crypto");
const queue = new Map();
const MAX_TTL_MS = 2 * 60 * 1000;
const MAX_COOKIE_BYTES = 64 * 1024;

function normalizeCookie(value) {
  if (typeof value !== "string") throw new Error("Cookie must be text");
  const cookie = value.trim();
  if (!cookie || Buffer.byteLength(cookie, "utf8") > MAX_COOKIE_BYTES) {
    throw new Error("Cookie is empty or exceeds 64 KiB");
  }
  return cookie;
}

function submit({ botId, cookie, ownerId }) {
  if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId.trim())) throw new Error("A valid numeric Bot ID is required");
  const secret = normalizeCookie(cookie);
  const id = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  for (const [key, item] of queue) if (item.expiresAt <= now) queue.delete(key);
  // One active handoff per bot; a fresh owner submission replaces an older one.
  for (const [key, item] of queue) if (item.botId === botId.trim()) queue.delete(key);
  queue.set(id, { id, botId: botId.trim(), cookie: secret, ownerId: String(ownerId), createdAt: now, expiresAt: now + MAX_TTL_MS, claimed: false });
  return { requestId: id, expiresAt: new Date(now + MAX_TTL_MS).toISOString() };
}

function claim(botId) {
  if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId)) return null;
  const now = Date.now();
  for (const [key, item] of queue) {
    if (item.expiresAt <= now) { queue.delete(key); continue; }
    if (item.botId === botId && !item.claimed) {
      item.claimed = true;
      const result = { requestId: item.id, cookie: item.cookie };
      queue.delete(key); // single-use; cookie exists only in this response after claim
      return result;
    }
  }
  return null;
}

module.exports = { submit, claim, normalizeCookie };
