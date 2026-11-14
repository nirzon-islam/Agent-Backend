
"use strict";

const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    requestedBy: {
      type: String,
      required: true
    },

    source: {
      type: String,
      enum: ["website", "messenger", "system"],
      required: true
    },

    type: {
      type: String,
      enum: ["read", "create", "edit", "delete", "install", "test", "update"],
      required: true
    },

    description: {
      type: String,
      required: true,
      maxlength: 5000
    },

    status: {
      type: String,
      enum: [
        "pending",
        "analyzing",
        "awaiting_approval",
        "approved",
        "running",
        "completed",
        "failed",
        "rejected",
        "cancelled"
      ],
      default: "pending",
      index: true
    },

    approvalId: {
      type: String,
      default: null
    },

    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    error: {
      type: String,
      default: null
    },

    startedAt: Date,
    completedAt: Date
  },
  {
    timestamps: true,
    collection: "agent_tasks"
  }
);

module.exports =
  mongoose.models.AgentTask ||
  mongoose.model("AgentTask", taskSchema);
