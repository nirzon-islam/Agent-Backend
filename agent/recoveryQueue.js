"use strict";

// Volatile, single-use credential handoff. Never persisted to MongoDB or logs.
const crypto = require("crypto");
const queue = new Map();
const MAX_TTL_MS = 2 * 60 * 1000;
const MAX_COOKIE_BYTES = 64 * 1024;

function normalizeCookie(value, botId) {
  if (typeof value !== "string") throw new Error("Cookie must be text");
  const cookie = value.trim();
  if (!cookie || Buffer.byteLength(cookie, "utf8") > MAX_COOKIE_BYTES) {
    throw new Error("Cookie is empty or exceeds 64 KiB");
  }
  if (!cookie.startsWith("[")) throw new Error("Please paste the full account.txt JSON cookie array");
  let items;
  try { items = JSON.parse(cookie); } catch { throw new Error("Cookie JSON is invalid"); }
  if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
    throw new Error("Cookie must be a non-empty JSON array (maximum 500 cookies)");
  }
  let cUser = false, xs = false;
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.key !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(item.key) ||
        typeof item.value !== "string" || !item.value || item.value.length > 16000) {
      throw new Error("Each cookie must contain a valid key and non-empty value");
    }
    if (typeof item.domain !== "string" || !item.domain.trim()) {
      throw new Error("Each cookie must include its Facebook domain");
    }
    const domain = item.domain.trim().toLowerCase().replace(/^\./, "");
    if (domain !== "facebook.com" && !domain.endsWith(".facebook.com")) {
      throw new Error("Cookie contains a non-Facebook domain");
    }
    if (item.path !== undefined && (typeof item.path !== "string" || !item.path.startsWith("/"))) {
      throw new Error("Cookie path is invalid");
    }
    if (item.key === "c_user") {
      if (String(item.value).trim() !== String(botId)) throw new Error("Cookie c_user does not match the Dashboard Bot ID");
      cUser = true;
    }
    if (item.key === "xs") xs = true;
  }
  if (!cUser || !xs) throw new Error("Cookie must include Facebook c_user and xs session fields");
  return cookie;
}

function submit({ botId, cookie, ownerId }) {
  if (typeof botId !== "string" || !/^\d{5,30}$/.test(botId.trim())) throw new Error("A valid numeric Bot ID is required");
  const secret = normalizeCookie(cookie, botId.trim());
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
