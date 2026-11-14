"use strict";

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const Approval = require("../models/Approval");
const Task = require("../models/Task");

const APPROVAL_ID_PATTERN = /^[a-f0-9]{48}$/i;

// List pending, unexpired approvals. Never expose the executable action here.
router.get("/", async (req, res) => {
  try {
    const approvals = await Approval.find({
      status: "pending",
      expiresAt: { $gt: new Date() }
    })
      .select("-action -actionHash -__v")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, approvals });
  } catch (error) {
    console.error("[Approval List]", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve approvals"
    });
  }
});

async function processApproval(req, res, status) {
  const { approvalId } = req.params;

  if (typeof approvalId !== "string" || !APPROVAL_ID_PATTERN.test(approvalId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid approval ID"
    });
  }

  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const approval = await Approval.findOneAndUpdate(
        {
          approvalId,
          status: "pending",
          expiresAt: { $gt: new Date() }
        },
        {
          $set: {
            status,
            approvedBy: req.user.id
          }
        },
        {
          new: true,
          session
        }
      ).select("approvalId taskId status").lean();

      if (!approval) {
        const error = new Error("APPROVAL_NOT_AVAILABLE");
        throw error;
      }

      const task = await Task.findOneAndUpdate(
        {
          taskId: approval.taskId,
          status: { $in: ["pending", "awaiting_approval"] }
        },
        {
          $set: { status: status === "approved" ? "approved" : "rejected" }
        },
        {
          new: true,
          session
        }
      ).select("taskId status").lean();

      if (!task) {
        throw new Error("TASK_STATE_CONFLICT");
      }

      response = {
        approvalId: approval.approvalId,
        taskId: task.taskId,
        status: approval.status,
        taskStatus: task.status
      };
    });

    return res.json({ success: true, approval: response });
  } catch (error) {
    if (
      error.message === "APPROVAL_NOT_AVAILABLE" ||
      error.message === "TASK_STATE_CONFLICT"
    ) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    console.error("[Approval Process]", error.message);
    return res.status(503).json({
      success: false,
      message: "Unable to process approval"
    });
  } finally {
    await session.endSession();
  }
}

router.post("/:approvalId/approve", (req, res) =>
  processApproval(req, res, "approved")
);

router.post("/:approvalId/reject", (req, res) =>
  processApproval(req, res, "rejected")
);

module.exports = router;
