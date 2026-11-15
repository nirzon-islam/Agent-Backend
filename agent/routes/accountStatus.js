"use strict";

const express = require("express");
const BotAccountStatus = require("../models/BotAccountStatus");
const recoveryQueue = require("../recoveryQueue");
const router = express.Router();

// Read-only status for the authenticated dashboard Owner.
router.get("/", async (req, res) => {
  try {
    const record = await BotAccountStatus.findOne({ key: "primary" }).lean();
    const lastHeartbeatAt = record?.lastHeartbeatAt || null;
    const stale = !lastHeartbeatAt || Date.now() - new Date(lastHeartbeatAt).getTime() > 90 * 1000;
    return res.json({
      success: true,
      account: {
        state: stale ? "unknown" : record.state,
        accountId: record?.accountId || null,
        message: stale ? "Bot heartbeat is missing or stale. Bot-side status reporting must be connected." : (record.message || null),
        lastHeartbeatAt,
        changedAt: record?.changedAt || null
      },
      recovery: {
        automatedLogin: true,
        pendingHandoff: false,
        note: "Submit a fresh appstate cookie for any Bot ID; the cookie c_user must match the ID entered. It is held temporarily in memory and delivered once to the connected GoatBot worker. Facebook checkpoints still require manual completion."
      }
    });
  } catch (error) {
    console.error("[Account Status]", error.message);
    return res.status(503).json({ success: false, message: "Unable to retrieve bot account status" });
  }
});

 
// Owner-only: read progress for a recovery request. Never returns credentials.
router.get("/recovery/:requestId", (req, res) => {
  const status = recoveryQueue.getStatus(req.params.requestId, req.user.id);
  if (!status) return res.status(404).json({ success: false, message: "Recovery request not found" });
  return res.json({ success: true, recovery: status });
});

// Owner-only: queue a fresh appstate for the currently logged-out account.
// The credential is never written to MongoDB, task history, or application logs.
router.post("/recovery", async (req, res) => {
  try {
    const botId = typeof req.body.botId === "string" ? req.body.botId.trim() : "";
    const cookie = req.body.cookie;
    if (!/^\d{5,30}$/.test(botId)) return res.status(400).json({ success: false, message: "Invalid Bot ID." });
    const queued = recoveryQueue.submit({ botId, cookie, ownerId: req.user.id });
    return res.status(202).json({ success: true, requestId: queued.requestId, expiresAt: queued.expiresAt,
      message: "Cookie accepted for one-time delivery. It expires in 2 minutes if the worker does not claim it." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to queue recovery" });
  }
});

module.exports = router;
