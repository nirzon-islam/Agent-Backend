
"use strict";

const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
      match: /^[a-z0-9_-]+$/
    },

    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ["owner", "admin"],
      default: "admin"
    },

    permissions: {
      type: [String],
      default: []
    },

    isActive: {
      type: Boolean,
      default: true
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: "agent_admins"
  }
);

module.exports =
  mongoose.models.AgentAdmin ||
  mongoose.model("AgentAdmin", adminSchema);
