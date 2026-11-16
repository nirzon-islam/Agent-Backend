
"use strict";

const config = require("../config");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Task = require("../models/Task");
const security = require("../security");
const { reconcileExpiredTasks, decideApproval } = require("../approval");
const { schedulePlanTask } = require("../planner");
const BotAccountStatus = require("../models/BotAccountStatus");

// Register the Approval model.
require("../approval");

const Approval = mongoose.model("AgentApproval");


// Owner sender IDs are implicitly allowed to submit and inspect their own Messenger tasks.
function isAllowedMessengerSender(senderId) {
  return typeof senderId === "string" && senderId.length > 0 &&
    (config.bridge.allowedSenderIds.includes(senderId) || config.bridge.ownerSenderIds.includes(senderId));
}

// Messenger requests are planned into a validated action and sent to Owner approval.
// This endpoint never executes an action.
router.post("/requests", async (req, res) => {
  try {
    const senderId = typeof req.body.senderId === "string" ? req.body.senderId.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";

    if (!senderId || senderId.length > 128 || !isAllowedMessengerSender(senderId)) {
      return res.status(403).json({ success: false, message: "Sender is not allowed" });
    }
    if (description.length < 3 || description.length > 2000) {
      return res.status(400).json({ success: false, message: "Request must be 3-2000 characters" });
    }

    const task = await Task.create({
      taskId: require("crypto").randomUUID(),
      requestedBy: `messenger:${senderId}`,
      source: "messenger",
      type: "read",
      description: `[Messenger request; planning required] ${description}`,
      status: "pending"
    });

    schedulePlanTask(task.taskId, "messenger");
    return res.status(202).json({
      success: true,
      task: { taskId: task.taskId, status: "pending", source: task.source },
      message: "Request queued for AI planning. Check task status shortly; Owner approval is required before execution."
    });
  } catch (error) {
    console.error("[Bridge Request]", error.message);
    return res.status(503).json({ success: false, message: "Unable to submit Messenger request" });
  }
});

// Sender-scoped task status for the Messenger command.
router.post("/status", async (req, res) => {
  try {
    const senderId = typeof req.body.senderId === "string" ? req.body.senderId.trim() : "";
    const taskId = typeof req.body.taskId === "string" ? req.body.taskId.trim() : "";
    if (!senderId || !isAllowedMessengerSender(senderId) ||
        !taskId || taskId.length > 128) {
      return res.status(400).json({ success: false, message: "Invalid status request" });
    }
    await reconcileExpiredTasks();
    const task = await Task.findOne({
      taskId,
      requestedBy: "messenger:" + senderId,
      source: "messenger"
    }).select("taskId type status error result createdAt updatedAt completedAt").lean();
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    return res.json({ success: true, task });
  } catch (error) {
    console.error("[Bridge Status]", error.message);
    return res.status(503).json({ success: false, message: "Unable to retrieve task status" });
  }
});

// Messenger Owner controls: only explicitly configured Owner sender IDs may list or decide approvals.
function isMessengerOwner(senderId) {
  return typeof senderId === "string" &&
    senderId.length > 0 &&
    config.bridge.ownerSenderIds.includes(senderId);
}

router.post("/approvals/pending", async (req, res) => {
  try {
    const senderId = typeof req.body.senderId === "string" ? req.body.senderId.trim() : "";
    if (!isMessengerOwner(senderId)) return res.status(403).json({ success: false, message: "Owner permission required" });
    await reconcileExpiredTasks();
    const approvals = await Approval.find({ status: "pending", expiresAt: { $gt: new Date() } })
      .select("approvalId taskId status expiresAt createdAt requestedBy")
      .sort({ createdAt: -1 }).limit(10).lean();
    const messengerApprovals = [];
    for (const approval of approvals) {
      const task = await Task.findOne({
        taskId: approval.taskId,
        approvalId: approval.approvalId,
        source: "messenger",
        status: "awaiting_approval"
      }).select("taskId description type").lean();
      if (task) messengerApprovals.push({
        approvalId: approval.approvalId,
        taskId: task.taskId,
        description: task.description.replace(/^\\[Messenger request; planning required\\]\\s*/, "").slice(0, 500),
        actionType: task.type,
        status: approval.status,
        expiresAt: approval.expiresAt
      });
    }
    return res.json({ success: true, approvals: messengerApprovals });
  } catch (error) {
    console.error("[Bridge Pending Approvals]", error.message);
    return res.status(503).json({ success: false, message: "Unable to retrieve pending approvals" });
  }
});

async function decideMessengerApproval(req, res, status) {
  try {
    const senderId = typeof req.body.senderId === "string" ? req.body.senderId.trim() : "";
    const reference = typeof req.body.reference === "string" ? req.body.reference.trim() : "";
    if (!isMessengerOwner(senderId)) return res.status(403).json({ success: false, message: "Owner permission required" });
    if (!reference || reference.length > 128) return res.status(400).json({ success: false, message: "Invalid task reference" });
    const task = await Task.findOne({
      $or: [{ taskId: reference }, { approvalId: reference }],
      source: "messenger",
      status: "awaiting_approval"
    }).select("taskId approvalId requestedBy").lean();
    if (!task || !task.approvalId) {
      return res.status(404).json({ success: false, message: "Pending Messenger approval not found" });
    }
    const approval = await Approval.findOne({
      approvalId: task.approvalId,
      taskId: task.taskId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    }).select("approvalId").lean();
    if (!approval) return res.status(409).json({ success: false, message: "Approval is no longer pending" });
    const result = await decideApproval(approval.approvalId, "messenger:" + senderId, status);
    return res.json({ success: true, approval: result });
  } catch (error) {
    if (["APPROVAL_NOT_AVAILABLE", "TASK_STATE_CONFLICT"].includes(error.message)) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error("[Bridge Messenger Approval]", error.message);
    return res.status(503).json({ success: false, message: "Unable to process Messenger approval" });
  }
}

router.post("/approvals/approve", (req, res) => decideMessengerApproval(req, res, "approved"));
router.post("/approvals/reject", (req, res) => decideMessengerApproval(req, res, "rejected"));

// Railway Bridge polls for approved task IDs. Action payloads remain hidden
// until the single-use /claim endpoint validates and consumes the approval.
router.post("/queue", async (req, res) => {
  try {
    await reconcileExpiredTasks();

    const requestedLimit = Number(req.body && req.body.limit);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 10)
      : 5;

    const approved = await Task.find({
      status: "approved",
      approvalId: { $ne: null }
    })
      .select("taskId approvalId type createdAt")
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    if (!approved.length) {
      return res.json({ success: true, tasks: [] });
    }

    const approvalIds = approved.map(task => task.approvalId);
    const validApprovals = await Approval.find({
      approvalId: { $in: approvalIds },
      status: "approved",
      expiresAt: { $gt: new Date() }
    }).select("approvalId taskId").lean();

    const validSet = new Set(
      validApprovals.map(item => `${item.approvalId}:${item.taskId}`)
    );

    const tasks = approved
      .filter(task => validSet.has(`${task.approvalId}:${task.taskId}`))
      .map(task => ({
        taskId: task.taskId,
        type: task.type,
        createdAt: task.createdAt
      }));

    return res.json({ success: true, tasks });
  } catch (error) {
    console.error("[Bridge Queue]", error.message);
    return res.status(503).json({
      success: false,
      message: "Unable to retrieve approved tasks"
    });
  }
});

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
    await reconcileExpiredTasks();
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

    if (result !== undefined && result !== null && Buffer.byteLength(result, "utf8") > 700 * 1024) {
      return res.status(413).json({
        success: false,
        message: "Task result exceeds the storage limit"
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
          result: result || null,
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

// Railway bot reports account/session health using the signed service bridge.
router.post("/account-status", async (req, res) => {
  try {
    const legacyState = typeof req.body.state === "string" ? req.body.state : "";
    const sessionState = typeof req.body.sessionState === "string" ? req.body.sessionState : legacyState;
    const workerState = typeof req.body.workerState === "string" ? req.body.workerState : "unknown";
    const allowedSessions = new Set(["online", "logged_out", "checkpoint", "error", "unknown"]);
    const allowedWorkers = new Set(["online", "offline", "unknown"]);
    const accountId = typeof req.body.accountId === "string" ? req.body.accountId.trim().slice(0, 128) : "";
    const message = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 500) : "";
    if (!allowedSessions.has(sessionState) || !allowedWorkers.has(workerState)) return res.status(400).json({ success: false, message: "Invalid worker or Facebook session state" });
    const now = new Date();
    const record = await BotAccountStatus.findOneAndUpdate(
      { key: "primary" },
      { $set: { state: sessionState, sessionState, workerState, accountId: accountId || null, message: message || null, lastHeartbeatAt: now },
        $setOnInsert: { key: "primary" } },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    return res.json({ success: true, receivedAt: record.lastHeartbeatAt });
  } catch (error) {
    console.error("[Bridge Account Status]", error.message);
    return res.status(503).json({ success: false, message: "Unable to save account status" });
  }
});

 
// One-time recovery handoff. Credentials are held only in process memory and
// delivered once to the Railway worker over the signed HTTPS bridge.
router.post("/recovery/claim", async (req, res) => {
  try {
    const recoveryQueue = require("../recoveryQueue");
    const recovery = recoveryQueue.claimNext();
    return res.json({ success: true, recovery });
  } catch (error) {
    console.error("[Bridge Recovery Claim]", error.message);
    return res.status(503).json({ success: false, message: "Unable to check recovery queue" });
  }
});

router.post("/recovery/progress", (req, res) => {
  try {
    const { requestId, botId, state, message } = req.body || {};
    if (typeof requestId !== "string" || !/^[a-f0-9]{48}$/.test(requestId) ||
        typeof botId !== "string" || !/^\d{5,30}$/.test(botId) ||
        typeof state !== "string" || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "Invalid recovery progress payload" });
    }
    const recoveryQueue = require("../recoveryQueue");
    const saved = recoveryQueue.reportProgress({ requestId, botId, state, message });
    return saved ? res.json({ success: true }) : res.status(409).json({ success: false, message: "Recovery request is no longer active" });
  } catch (error) {
    console.error("[Bridge Recovery Progress]", error.message);
    return res.status(503).json({ success: false, message: "Unable to save recovery progress" });
  }
});

router.post("/recovery/result", async (req, res) => {
  try {
    const state = req.body && req.body.state;
    const allowed = new Set(["online", "logged_out", "checkpoint", "error"]);
    const botId = typeof req.body.botId === "string" ? req.body.botId.trim() : "";
    const message = typeof req.body.message === "string" ? req.body.message.slice(0, 300) : "";
    if (!/^\d{5,30}$/.test(botId) || !allowed.has(state)) {
      return res.status(400).json({ success: false, message: "Invalid recovery result" });
    }
    // A failed candidate must not mark the still-running previous account offline.
    // Only a fully verified online handover changes the monitored account identity.
    if (state === "online") {
      await BotAccountStatus.findOneAndUpdate({ key: "primary" }, {
        $set: { state: "online", accountId: botId, message: message || null, lastHeartbeatAt: new Date(), changedAt: new Date() },
        $setOnInsert: { key: "primary" }
      }, { new: true, upsert: true, runValidators: true });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("[Bridge Recovery Result]", error.message);
    return res.status(503).json({ success: false, message: "Unable to save recovery result" });
  }
});

module.exports = router;
