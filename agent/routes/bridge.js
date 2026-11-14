
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Task = require("../models/Task");
const security = require("../security");

// Register the Approval model.
require("../approval");

const Approval = mongoose.model("AgentApproval");

// Railway Bridge claims an approved task.
router.post("/claim", async (req, res) => {
  const { taskId } = req.body;

  if (
    typeof taskId !== "string" ||
    taskId.length < 1 ||
    taskId.length > 128
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
  }

  let session;
  let claimedTask = null;

  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const task = await Task.findOne({
        taskId,
        status: "approved",
        approvalId: { $ne: null }
      }).session(session);

      if (!task) {
        throw new Error("TASK_NOT_AVAILABLE");
      }

      const approval = await Approval.findOne({
        approvalId: task.approvalId,
        taskId,
        status: "approved",
        expiresAt: { $gt: new Date() }
      }).session(session);

      if (!approval) {
        throw new Error("APPROVAL_NOT_VALID");
      }

      const actualHash = security.hashAction(approval.action);

      if (!security.safeHashEqual(actualHash, approval.actionHash)) {
        throw new Error("ACTION_HASH_MISMATCH");
      }

      const consumed = await Approval.findOneAndUpdate(
        {
          _id: approval._id,
          status: "approved",
          expiresAt: { $gt: new Date() }
        },
        {
          $set: { status: "consumed" }
        },
        {
          new: true,
          session
        }
      );

      if (!consumed) {
        throw new Error("APPROVAL_ALREADY_USED");
      }

      const updatedTask = await Task.findOneAndUpdate(
        {
          _id: task._id,
          status: "approved",
          approvalId: approval.approvalId
        },
        {
          $set: {
            status: "running",
            startedAt: new Date()
          }
        },
        {
          new: true,
          session
        }
      );

      if (!updatedTask) {
        throw new Error("TASK_STATE_CHANGED");
      }

      claimedTask = {
        taskId: updatedTask.taskId,
        type: updatedTask.type,
        description: updatedTask.description,
        action: consumed.action
      };
    });
    
    if (!claimedTask) {
      throw new Error("CLAIM_FAILED");
    }

    return res.json({
      success: true,
      task: claimedTask
    });

  } catch (error) {
    const knownErrors = [
      "TASK_NOT_AVAILABLE",
      "APPROVAL_NOT_VALID",
      "ACTION_HASH_MISMATCH",
      "APPROVAL_ALREADY_USED",
      "TASK_STATE_CHANGED",
      "CLAIM_FAILED"
    ];

    if (knownErrors.includes(error.message)) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    console.error("[Bridge Claim]", error.message);

    return res.status(503).json({
      success: false,
      message: "Unable to claim task"
    });

  } finally {
    if (session) await session.endSession();
  }
});

// Railway Bridge reports execution result.
router.post("/result", async (req, res) => {
  try {
    const { taskId, success, result, error } = req.body;

    if (
      typeof taskId !== "string" ||
      taskId.length < 1 ||
      taskId.length > 128 ||
      typeof success !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid result payload"
      });
    }

    if (
      result !== undefined &&
      result !== null &&
      typeof result !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Result must be text"
      });
    }

    if (
      error !== undefined &&
      error !== null &&
      typeof error !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Error must be text"
      });
    }

    const task = await Task.findOneAndUpdate(
      {
        taskId,
        status: "running"
      },
      {
        $set: {
          status: success ? "completed" : "failed",
          result: result ? result.slice(0, 10000) : null,
          error: success ? null : (error || "Execution failed").slice(0, 2000),
          completedAt: new Date()
        }
      },
      {
        new: true
      }
    ).select("taskId status").lean();

    if (!task) {
      return res.status(409).json({
        success: false,
        message: "Task is not running or result was already submitted"
      });
    }

    return res.json({
      success: true,
      taskId: task.taskId,
      status: task.status
    });

  } catch (error) {
    console.error("[Bridge Result]", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save task result"
    });
  }
});

module.exports = router;
