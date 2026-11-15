"use strict";
const express = require("express");
const router = express.Router();
const AISettings = require("../models/AISettings");
const crypto = require("../aiSettingsCrypto");
const { testProvider } = require("../aiProviders");
const SLOT_NAMES = ["main", "fallback", "backup"];
function safeBaseUrl(value) {
  if (!value) return "";
  let url;
  try { url = new URL(value); } catch { throw new Error("Base URL is invalid."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home.arpa") ||
      host.startsWith("[") || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host) ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    throw new Error("Use a public HTTPS provider URL (private/local hosts are blocked).");
  }
  return url.toString().replace(/\/$/, "");
}
function publicSlot(slot) {
  return { enabled: !!slot?.enabled, provider: slot?.provider || "openai-compatible",
    model: slot?.model || "", baseUrl: slot?.baseUrl || "",
    configured: !!slot?.apiKeyEncrypted, keyHint: slot?.keyHint || "" };
}
router.get("/", async (req, res) => {
  try {
    const doc = await AISettings.findOne({ key: "default" }).lean();
    return res.json({ success: true, slots: Object.fromEntries(SLOT_NAMES.map(name => [name, publicSlot(doc?.[name])])) });
  } catch (error) { return res.status(503).json({ success:false, message:error.code === "AI_ENCRYPTION_KEY_MISSING" ? error.message : "Unable to load AI settings." }); }
});
router.put("/", async (req, res) => {
  try {
    const input = req.body?.slots;
    if (!input || typeof input !== "object") return res.status(400).json({ success:false, message:"Invalid AI settings." });
    const doc = await AISettings.findOne({ key:"default" }) || new AISettings({ key:"default" });
    for (const name of SLOT_NAMES) {
      const item = input[name];
      if (!item || typeof item !== "object") continue;
      if (typeof item.enabled !== "boolean" || !["openai-compatible","gemini"].includes(item.provider) ||
          typeof item.model !== "string" || !item.model.trim() || item.model.length > 180 ||
          typeof item.apiKey !== "string" || item.apiKey.length > 500) {
        return res.status(400).json({ success:false, message:"Check provider, model and API key fields for " + name + "." });
      }
      const baseUrl = item.provider === "openai-compatible" ? safeBaseUrl(item.baseUrl) : "";
      const previous = doc[name] || {};
      if (item.enabled && !item.apiKey.trim() && !previous.apiKeyEncrypted) {
        return res.status(400).json({ success:false, message:"API key is required for enabled " + name + " slot." });
      }
      doc[name] = { enabled:item.enabled, provider:item.provider, model:item.model.trim(), baseUrl,
        apiKeyEncrypted:item.apiKey.trim() ? crypto.encrypt(item.apiKey.trim()) : (item.clearApiKey ? "" : previous.apiKeyEncrypted || ""),
        keyHint:item.apiKey.trim() ? item.apiKey.trim().slice(-4) : (item.clearApiKey ? "" : previous.keyHint || "") };
    }
    doc.updatedBy = req.user.username;
    await doc.save();
    return res.json({ success:true, message:"AI slots saved securely.", slots:Object.fromEntries(SLOT_NAMES.map(name => [name,publicSlot(doc[name])])) });
  } catch (error) {
    return res.status(error.code === "AI_ENCRYPTION_KEY_MISSING" ? 503 : 400).json({ success:false, message:error.message || "Unable to save AI settings." });
  }
});
router.post("/test", async (req, res) => {
  try {
    const name = req.body?.slot;
    if (!SLOT_NAMES.includes(name)) return res.status(400).json({ success:false, message:"Select a valid AI slot." });
    const doc = await AISettings.findOne({ key:"default" });
    const slot = doc?.[name];
    if (!slot?.enabled || !slot.apiKeyEncrypted) return res.status(400).json({ success:false, message:"This slot is not configured and enabled." });
    const result = await testProvider({ ...slot.toObject(), apiKey:crypto.decrypt(slot.apiKeyEncrypted) });
    return res.json({ success:true, message:name + " connection successful.", provider:slot.provider, model:slot.model, response:result });
  } catch (error) {
    const status = error.code === "AI_ENCRYPTION_KEY_MISSING" ? 503 : 502;
    return res.status(status).json({ success:false, message:String(error.message || "Provider test failed").slice(0,300) });
  }
});
module.exports = router;
module.exports.safeBaseUrl = safeBaseUrl;
