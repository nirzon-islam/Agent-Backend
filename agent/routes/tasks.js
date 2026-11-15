"use strict";

const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const Task = require("../models/Task");
const { reconcileExpiredTasks } = require("../approval");
const { planTask } = require("../planner");

const ALLOWED_TYPES = new Set([
  "read",
  "list",
  "readMany",
  "create",
  "edit",
  "delete",
  "restore",
  "move",
  "mkdir",
  "rmdir",
  "install",
  "restart",
  "test",
  "update"
]);

// List recent tasks for the authenticated Owner dashboard.
router.get("/", async (req, res) => {
  try {
    await reconcileExpiredTasks();
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;
    const tasks = await Task.find({})
      .select("taskId requestedBy source type description status approvalId result error createdAt updatedAt completedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const summarizedTasks = tasks.map(task => {
      if (typeof task.result !== "string") return task;
      let parsed;
      try { parsed = JSON.parse(task.result); } catch {
        return { ...task, result: task.result.slice(0, 12000) };
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ...task, result: JSON.stringify(parsed).slice(0, 12000) };
      }
      const files = Array.isArray(parsed.downloadableFiles)
        ? parsed.downloadableFiles
            .filter(file => file && typeof file.path === "string")
            .slice(0, 20)
            .map(file => ({ path: file.path }))
        : [];
      let output = parsed.output !== undefined ? parsed.output : parsed;
      const serializedOutput = typeof output === "string" ? output : JSON.stringify(output);
      if (Buffer.byteLength(serializedOutput || "", "utf8") > 12000) {
        output = String(serializedOutput).slice(0, 12000) + "… [preview truncated]";
      }
      return { ...task, result: JSON.stringify({ output, downloadableFiles: files }) };
    });
    return res.json({ success: true, tasks: summarizedTasks });
  } catch (error) {
    console.error("[Task List]", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve tasks" });
  }
});

// Submit a website request. The AI plans it, but never executes it here.
router.post("/", async (req, res) => {
  try {
    const { description } = req.body || {};
    if (typeof description !== "string" || description.trim().length < 3 || description.length > 2000) {
      return res.status(400).json({ success: false, message: "Request must be 3-2000 characters" });
    }
    const task = await Task.create({
      taskId: crypto.randomUUID(), requestedBy: String(req.user.id), source: "website",
      type: "read", description: description.trim(), status: "pending"
    });
    try {
      const planning = await planTask(task.taskId);
      return res.status(201).json({ success: true, task: {
        taskId: task.taskId, description: task.description, status: planning.status,
        actionType: planning.actionType, approvalId: planning.approvalId,
        message: "AI plan created. Owner approval is required before execution."
      }});
    } catch (planningError) {
      return res.status(202).json({ success: true, task: { taskId: task.taskId, description: task.description, status: "failed" },
        message: "Request saved, but AI could not create a safe plan. Check task details and AI provider configuration." });
    }
  } catch (error) {
    console.error("[Task Submit]", error.message);
    return res.status(500).json({ success: false, message: "Unable to submit task" });
  }
});

// Download a text file created or restored by the GoatBot server worker.
router.get("/:taskId/files/:fileIndex", async (req, res) => {
  try {
    const task = await Task.findOne({
      taskId: req.params.taskId,
      status: "completed",
      $or: [
        { requestedBy: String(req.user.id), source: "website" },
        { source: "messenger", requestedBy: /^messenger:/ }
      ]
    }).select("result").lean();
    if (!task || typeof task.result !== "string") return res.status(404).json({ success: false, message: "Download not found" });
    let payload;
    try { payload = JSON.parse(task.result); } catch { payload = null; }
    const files = payload && Array.isArray(payload.downloadableFiles) ? payload.downloadableFiles : [];
    const index = Number(req.params.fileIndex);
    if (!Number.isInteger(index) || index < 0 || index >= files.length) return res.status(404).json({ success: false, message: "Download not found" });
    const file = files[index];
    if (!file || typeof file.content !== "string" || typeof file.path !== "string" || Buffer.byteLength(file.content, "utf8") > 262144) return res.status(404).json({ success: false, message: "Download not found" });
    const baseName = file.path.split("/").pop().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "agent-file.txt";
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + baseName + "\"");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(file.content);
  } catch (error) {
    console.error("[Task Download]", error.message);
    return res.status(500).json({ success: false, message: "Unable to download task file" });
  }
});
// Get the status of the signed-in user's task.
router.get("/:taskId", async (req, res) => {
  try {
    await reconcileExpiredTasks();
    const task = await Task.findOne({
      taskId: req.params.taskId,
      requestedBy: String(req.user.id)
    }).select("-__v").lean();

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    return res.json({ success: true, task });
  } catch (error) {
    console.error("[Task Status]", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve task" });
  }
});

module.exports = router;
