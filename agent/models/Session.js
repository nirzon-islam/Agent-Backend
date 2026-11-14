
"use strict";

const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },

    userId: {
      type: String,
      required: true,
      index: true
    },

    expiresAt: {
      type: Date,
      required: true
    },

    revokedAt: {
      type: Date,
      default: null
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 500
    }
  },
  {
    timestamps: true,
    collection: "agent_sessions"
  }
);

// Automatically expire old sessions.
sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports =
  mongoose.models.AgentSession ||
  mongoose.model("AgentSession", sessionSchema);
