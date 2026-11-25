"use strict";
const mongoose = require("mongoose");
const botAccountStatusSchema = new mongoose.Schema({
  key: { type: String, default: "primary", unique: true },
  state: { type: String, enum: ["online", "logged_out", "checkpoint", "error", "unknown"], default: "unknown" },
  workerState: { type: String, enum: ["online", "offline", "unknown", "disabled"], default: "unknown" },
  sessionState: { type: String, enum: ["online", "logged_out", "checkpoint", "error", "unknown"], default: "unknown" },
  accountId: { type: String, default: null, maxlength: 128 },
  message: { type: String, default: null, maxlength: 500 },
  lastHeartbeatAt: { type: Date, default: null },
  changedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: "agent_bot_account_status" });
module.exports = mongoose.models.AgentBotAccountStatus || mongoose.model("AgentBotAccountStatus", botAccountStatusSchema);
