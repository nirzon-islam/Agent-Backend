
"use strict";

const express = require("express");
const router = express.Router();

const Task = require("../models/Task");

// Load the approval module so its Mongoose model is registered.
require("../approval");

const Approval = require("mongoose").model("AgentApproval");

// Railway Bridge claims an approved task.
router.post("/claim", async (req, res) => {
  try {
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

    const task = await Task.findOne({
      taskId,
      status: "approved",
      approvalId: { $ne: null }
    }).lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "No approved task found"
      });
    }

    const approval = await Approval.findOneAndUpdate(
      {
        approvalId: task.approvalId,
        taskId,
        status: "approved",
        expiresAt: { $gt: new Date() }
      },
      {
        $set: { status: "consumed" }
      },
      { new: true }
    ).lean();

    if (!approval) {
      return res.status(403).json({
        success: false,
        message: "Valid approval not found"
      });
    }

    const updatedTask = await Task.findOneAndUpdate(
      {
        taskId,
        status: "approved",
        approvalId: approval.approvalId
      },
      {
        $set: {
          status: "running",
          startedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    if (!updatedTask) {
      return res.status(409).json({
        success: false,
        message: "Task state changed; manual review required"
      });
    }

    return res.json({
      success: true,
      task: {
        taskId: updatedTask.taskId,
        type: updatedTask.type,
        description: updatedTask.description,
        action: approval.action
      }
    });
  } catch (error) {
    console.error("[Bridge Claim]", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to claim task"
    });
  }
});

// Railway Bridge reports the execution result.
router.post("/result", async (req, res) => {
  try {
    const { taskId, success, result, error } = req.body;

    if (
      typeof taskId !== "string" ||
      typeof success !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid result payload"
      });
    }

    const safeResult =
      typeof result === "string"
        ? result.slice(0, 10000)
        : null;

    const safeError =
      typeof error === "string"
        ? error.slice(0, 2000)
        : null;

    const task = await Task.findOneAndUpdate(
      {
        taskId,
        status: "running"
      },
      {
        $set: {
          status: success ? "completed" : "failed",
          result: safeResult,
          error: success ? null : safeError,
          completedAt: new Date()
        }
      },
      { new: true }
    ).select("-__v").lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Running task not found"
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
