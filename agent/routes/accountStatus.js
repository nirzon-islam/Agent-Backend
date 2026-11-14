"use strict";

const express = require("express");
const BotAccountStatus = require("../models/BotAccountStatus");
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
        automatedLogin: false,
        note: "This dashboard does not collect or store Facebook passwords, 2FA codes, or appstate. Complete Facebook security checks manually in the bot's supported login flow."
      }
    });
  } catch (error) {
    console.error("[Account Status]", error.message);
    return res.status(503).json({ success: false, message: "Unable to retrieve bot account status" });
  }
});

module.exports = router;
