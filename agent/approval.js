
"use strict";

const mongoose = require("mongoose");
const crypto = require("crypto");

const { hashAction } = require("./security");

const approvalSchema = new mongoose.Schema(
  {
    approvalId: {
      type: String,
      required: true,
      unique: true,
    },

    taskId: {
      type: String,
      required: true
    },

    action: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    actionHash: {
      type: String,
      required: true
    },

    requestedBy: {
      type: String,
      required: true
    },

    approvedBy: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "consumed", "expired"],
      default: "pending",
      index: true
    },

    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    collection: "agent_approvals"
  }
);

approvalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Approval =
  mongoose.models.AgentApproval ||
  mongoose.model("AgentApproval", approvalSchema);

function createId() {
  return crypto.randomBytes(24).toString("hex");
}

async function requestApproval({
  taskId,
  action,
  requestedBy,
  expiresInMs = 15 * 60 * 1000
}) {
  if (!taskId || !action || !requestedBy) {
    throw new Error("Missing approval information");
  }

  if (!Number.isFinite(expiresInMs) || expiresInMs <= 0) {
    throw new Error("Invalid approval expiry");
  }

  const approval = await Approval.create({
    approvalId: createId(),
    taskId,
    action,
    actionHash: hashAction(action),
    requestedBy,
    expiresAt: new Date(Date.now() + expiresInMs)
  });

  return {
    approvalId: approval.approvalId,
    taskId: approval.taskId,
    status: approval.status,
    expiresAt: approval.expiresAt
  };
}

async function approve(approvalId, actorId, isAuthorized) {
  if (typeof isAuthorized !== "function") {
    throw new Error("Authorization check is required");
  }

  if (!await isAuthorized(actorId)) {
    throw new Error("Unauthorized approval attempt");
  }

  const result = await Approval.findOneAndUpdate(
    {
      approvalId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        status: "approved",
        approvedBy: actorId
      }
    },
    { new: true }
  ).lean();

  if (!result) {
    throw new Error("Approval not found, expired, or already processed");
  }

  return {
    approvalId: result.approvalId,
    taskId: result.taskId,
    status: result.status
  };
}

async function reject(approvalId, actorId, isAuthorized) {
  if (typeof isAuthorized !== "function") {
    throw new Error("Authorization check is required");
  }

  if (!await isAuthorized(actorId)) {
    throw new Error("Unauthorized rejection attempt");
  }

  const result = await Approval.findOneAndUpdate(
    {
      approvalId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        status: "rejected",
        approvedBy: actorId
      }
    },
    { new: true }
  ).lean();

  if (!result) {
    throw new Error("Approval not found, expired, or already processed");
  }

  return {
    approvalId: result.approvalId,
    status: result.status
  };
}

async function consume(approvalId, taskId, expectedAction) {
  const expectedHash = hashAction(expectedAction);

  const result = await Approval.findOneAndUpdate(
    {
      approvalId,
      taskId,
      actionHash: expectedHash,
      status: "approved",
      expiresAt: { $gt: new Date() }
    },
    {
      $set: { status: "consumed" }
    },
    { new: true }
  ).lean();

  if (!result) {
    throw new Error("Approval invalid, expired, or already consumed");
  }

  return result.action;
}

async function getPending() {
  return Approval.find({
    status: "pending",
    expiresAt: { $gt: new Date() }
  })
    .select("-action")
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = {
  requestApproval,
  approve,
  reject,
  consume,
  getPending
};
