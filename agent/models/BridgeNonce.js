
"use strict";

const mongoose = require("mongoose");

const bridgeNonceSchema = new mongoose.Schema(
  {
    nonce: {
      type: String,
      required: true,
      unique: true
    },

    requestId: {
      type: String,
      required: true
    },

    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300
    }
  },
  {
    collection: "agent_bridge_nonces",
    versionKey: false
  }
);

module.exports =
  mongoose.models.BridgeNonce ||
  mongoose.model("BridgeNonce", bridgeNonceSchema);
