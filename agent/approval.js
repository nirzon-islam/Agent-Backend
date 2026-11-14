"use strict";

const mongoose = require("mongoose");
const crypto = require("crypto");
const { hashAction, checkActionPermission, validateExecutableAction } = require("./security");
const Task = require("./models/Task");

const approvalSchema = new mongoose.Schema({
  approvalId: { type: String, required: true, unique: true },
  taskId: { type: String, required: true },
  action: { type: mongoose.Schema.Types.Mixed, required: true },
  actionHash: { type: String, required: true },
  requestedBy: { type: String, required: true },
  decidedBy: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "consumed", "expired"],
    default: "pending",
    index: true
  },
  expiresAt: { type: Date, required: true }
}, {
  timestamps: true,
  collection: "agent_approvals"
});

// Keep the TTL index for automatic cleanup. Expired tasks are rejected by the
// claim endpoint even if MongoDB has already removed their approval document.
approvalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Approval = mongoose.models.AgentApproval ||
  mongoose.model("AgentApproval", approvalSchema);

function createId() {
  return crypto.randomBytes(24).toString("hex");
}

async function requestApproval({ taskId, action, requestedBy, expiresInMs = 15 * 60 * 1000 }) {
  if (typeof taskId !== "string" || !taskId ||
      typeof requestedBy !== "string" || !requestedBy ||
      !action || typeof action !== "object" || Array.isArray(action) ||
      typeof action.type !== "string") {
    throw new Error("Missing or invalid approval information");
  }

  validateExecutableAction(action);
  if (!["create", "edit"].includes(action.type)) {
    throw new Error("Only create/edit actions may enter approval workflow");
  }

  const permission = checkActionPermission(action.type);
  if (!permission.requiresApproval) {
    throw new Error("This action does not require approval");
  }
  if (!Number.isFinite(expiresInMs) || expiresInMs < 60 * 1000 || expiresInMs > 24 * 60 * 60 * 1000) {
    throw new Error("Approval expiry must be between 1 minute and 24 hours");
  }

  const actionHash = hashAction(action);
  const approvalId = createId();
  let session;

  try {
    session = await mongoose.startSession();
    let response;
    await session.withTransaction(async () => {
      const task = await Task.findOne({
        taskId, requestedBy,
        type: action.type,
        status: { $in: ["pending", "analyzing"] },
        approvalId: null
      }).session(session);

      if (!task) throw new Error("TASK_NOT_ELIGIBLE_FOR_APPROVAL");

      const [approval] = await Approval.create([{
        approvalId, taskId, action, actionHash, requestedBy,
        expiresAt: new Date(Date.now() + expiresInMs)
      }], { session });

      const updatedTask = await Task.findOneAndUpdate({
        _id: task._id,
        status: { $in: ["pending", "analyzing"] },
        approvalId: null
      }, {
        $set: { status: "awaiting_approval", approvalId }
      }, { new: true, session });

      if (!updatedTask) throw new Error("TASK_STATE_CHANGED");
      response = {
        approvalId: approval.approvalId,
        taskId: approval.taskId,
        status: approval.status,
        expiresAt: approval.expiresAt
      };
    });
    return response;
  } finally {
    if (session) await session.endSession();
  }
}

async function decideApproval(approvalId, actorId, status) {
  if (!["approved", "rejected"].includes(status)) throw new Error("Invalid approval decision");
  if (typeof actorId !== "string" || !actorId) throw new Error("Invalid decision actor");
  let session;

  try {
    session = await mongoose.startSession();
    let response;
    await session.withTransaction(async () => {
      const approval = await Approval.findOneAndUpdate({
        approvalId, status: "pending", expiresAt: { $gt: new Date() }
      }, {
        $set: { status, decidedBy: actorId }
      }, { new: true, session }).select("approvalId taskId status").lean();

      if (!approval) throw new Error("APPROVAL_NOT_AVAILABLE");

      const task = await Task.findOneAndUpdate({
        taskId: approval.taskId,
        status: "awaiting_approval",
        approvalId: approval.approvalId
      }, {
        $set: { status, error: status === "rejected" ? "Rejected by Owner" : null }
      }, { new: true, session }).select("taskId status").lean();

      if (!task) throw new Error("TASK_STATE_CONFLICT");
      response = {
        approvalId: approval.approvalId,
        taskId: task.taskId,
        status: approval.status,
        taskStatus: task.status
      };
    });
    return response;
  } finally {
    if (session) await session.endSession();
  }
}

async function approve(approvalId, actorId, isAuthorized) {
  if (typeof isAuthorized !== "function" || !await isAuthorized(actorId)) {
    throw new Error("Unauthorized approval attempt");
  }
  return decideApproval(approvalId, actorId, "approved");
}

async function reject(approvalId, actorId, isAuthorized) {
  if (typeof isAuthorized !== "function" || !await isAuthorized(actorId)) {
    throw new Error("Unauthorized rejection attempt");
  }
  return decideApproval(approvalId, actorId, "rejected");
}

async function consume(approvalId, taskId, expectedAction) {
  const expectedHash = hashAction(expectedAction);
  const result = await Approval.findOneAndUpdate({
    approvalId, taskId, actionHash: expectedHash,
    status: "approved", expiresAt: { $gt: new Date() }
  }, { $set: { status: "consumed" } }, { new: true }).lean();
  if (!result) throw new Error("Approval invalid, expired, or already consumed");
  return result.action;
}

async function reconcileExpiredTasks() {
  const now = new Date();
  const candidates = await Task.find({
    status: { $in: ["awaiting_approval", "approved"] },
    approvalId: { $ne: null }
  }).select("taskId approvalId status").limit(200).lean();

  for (const task of candidates) {
    const validApproval = await Approval.exists({
      approvalId: task.approvalId,
      taskId: task.taskId,
      status: { $in: ["pending", "approved"] },
      expiresAt: { $gt: now }
    });

    if (!validApproval) {
      await Task.findOneAndUpdate({
        taskId: task.taskId,
        approvalId: task.approvalId,
        status: task.status
      }, {
        $set: {
          status: "cancelled",
          error: "Approval expired or is no longer available"
        }
      });
    }
  }
}

async function getPending() {
  await reconcileExpiredTasks();
  return Approval.find({ status: "pending", expiresAt: { $gt: new Date() } })
    .select("-action -actionHash -__v").sort({ createdAt: -1 }).lean();
}

module.exports = {
  requestApproval, decideApproval, approve, reject, consume,
  getPending, reconcileExpiredTasks
};
