"use strict";
const mongoose = require("mongoose");
const slotSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  provider: { type: String, enum: ["openai-compatible", "gemini"], default: "openai-compatible" },
  model: { type: String, default: "" },
  baseUrl: { type: String, default: "" },
  apiKeyEncrypted: { type: String, default: "" },
  keyHint: { type: String, default: "" }
}, { _id: false });
const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: "default" },
  main: { type: slotSchema, default: () => ({}) },
  fallback: { type: slotSchema, default: () => ({}) },
  backup: { type: slotSchema, default: () => ({}) },
  updatedBy: String
}, { timestamps: true, collection: "agent_ai_settings" });
module.exports = mongoose.models.AgentAISettings || mongoose.model("AgentAISettings", schema);
