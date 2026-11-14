"use strict";

const express = require("express");
const router = express.Router();
const { getPending, decideApproval } = require("../approval");

const APPROVAL_ID_PATTERN = /^[a-f0-9]{48}$/i;

router.get("/", async (req, res) => {
  try {
    const approvals = await getPending();
    return res.json({ success: true, approvals });
  } catch (error) {
    console.error("[Approval List]", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve approvals" });
  }
});

async function processApproval(req, res, status) {
  const { approvalId } = req.params;
  if (typeof approvalId !== "string" || !APPROVAL_ID_PATTERN.test(approvalId)) {
    return res.status(400).json({ success: false, message: "Invalid approval ID" });
  }

  try {
    const approval = await decideApproval(approvalId, req.user.id, status);
    return res.json({ success: true, approval });
  } catch (error) {
    if (["APPROVAL_NOT_AVAILABLE", "TASK_STATE_CONFLICT"].includes(error.message)) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error("[Approval Process]", error.message);
    return res.status(503).json({ success: false, message: "Unable to process approval" });
  }
}

router.post("/:approvalId/approve", (req, res) => processApproval(req, res, "approved"));
router.post("/:approvalId/reject", (req, res) => processApproval(req, res, "rejected"));

module.exports = router;
