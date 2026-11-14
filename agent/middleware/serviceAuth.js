
"use strict";

const crypto = require("crypto");
const config = require("../config");

function safeCompare(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") {
    return false;
  }

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function serviceAuth(req, res, next) {
  const expected = config.bridge.secret;
  const received = req.get("x-agent-bridge-secret");

  if (!expected) {
    return res.status(503).json({
      success: false,
      message: "Bridge authentication is not configured"
    });
  }

  if (!safeCompare(received, expected)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized service request"
    });
  }

  next();
}

module.exports = serviceAuth;
