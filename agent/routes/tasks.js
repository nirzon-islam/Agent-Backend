
"use strict";

const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const Task = require("../models/Task");
const { reconcileExpiredTasks } = require("../approval");

const ALLOWED_TYPES = new Set([
  "read",
  "create",
  "edit",
  "delete",
  "install",
  "test",
  "update"
]);

// Submit a new task.
router.post("/", async (req, res) => {
  try {
    const { type, description } = req.body;

    if (
      typeof type !== "string" ||
      !ALLOWED_TYPES.has(type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task type"
      });
    }

    if (
      typeof description !== "string" ||
      description.trim().length < 3 ||
      description.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be 3-5000 characters"
      });
    }

    const task = await Task.create({
      taskId: crypto.randomUUID(),
      requestedBy: String(req.user.id),
      source: "website",
      type,
      description: description.trim(),
      status: "pending"
    });

    return res.status(201).json({
      success: true,
      task: {
        taskId: task.taskId,
        type: task.type,
        status: task.status,
        description: task.description,
        createdAt: task.createdAt
      }
    });
  } catch (error) {
    console.error("[Task Submit]", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit task"
    });
  }
});

// Get the status of the signed-in user's task.
router.get("/:taskId", async (req, res) => {
  try {
    await reconcileExpiredTasks();
    const task = await Task.findOne({
      taskId: req.params.taskId,
      requestedBy: String(req.user.id)
    })
      .select("-__v")
      .lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    return res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error("[Task Status]", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve task"
    });
  }
});

module.exports = router;
