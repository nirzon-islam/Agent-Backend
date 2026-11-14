
"use strict";

const crypto = require("crypto");
const config = require("../config");
const BridgeNonce = require("../models/BridgeNonce");

const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000;

function safeCompare(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") {
    return false;
  }

  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");

  return (
    a.length === 32 &&
    b.length === 32 &&
    crypto.timingSafeEqual(a, b)
  );
}

async function serviceAuth(req, res, next) {
  try {
    const secret = config.bridge.secret;
    const timestamp = req.get("x-agent-timestamp");
    const nonce = req.get("x-agent-nonce");
    const signature = req.get("x-agent-signature");

    if (!config.bridge.enabled || !secret) {
      return res.status(503).json({
        success: false,
        message: "Bridge authentication not configured"
      });
    }

    if (!timestamp || !nonce || !signature) {
      return res.status(401).json({
        success: false,
        message: "Missing authentication headers"
      });
    }

    if (!/^\d{10,13}$/.test(timestamp)) {
      return res.status(401).json({
        success: false,
        message: "Invalid timestamp"
      });
    }

    if (!/^[a-f0-9]{32,128}$/i.test(nonce)) {
      return res.status(401).json({
        success: false,
        message: "Invalid nonce"
      });
    }

    const time = Number(timestamp);
    const timestampMs = timestamp.length === 10
      ? time * 1000
      : time;

    if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_DRIFT_MS) {
      return res.status(401).json({
        success: false,
        message: "Request timestamp expired"
      });
    }

    if (!Buffer.isBuffer(req.rawBody)) {
      return res.status(500).json({
        success: false,
        message: "Raw request body is unavailable"
      });
    }

    const bodyHash = crypto
      .createHash("sha256")
      .update(req.rawBody)
      .digest("hex");

    const signedPayload = [
      timestamp,
      nonce,
      req.method.toUpperCase(),
      req.originalUrl,
      bodyHash
    ].join("\n");

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    if (!safeCompare(signature, expectedSignature)) {
      return res.status(401).json({
        success: false,
        message: "Invalid request signature"
      });
    }

    await BridgeNonce.create({
      nonce,
      requestId: crypto.randomUUID()
    });

    next();
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate request nonce"
      });
    }

    console.error("[Bridge Auth]", error.message);

    return res.status(503).json({
      success: false,
      message: "Bridge authentication unavailable"
    });
  }
}

module.exports = serviceAuth;
