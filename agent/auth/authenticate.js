"use strict";

const crypto = require("crypto");
const Session = require("../models/Session");

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const token = authorization.slice(7).trim();

    // 32-byte base64url token validation
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(401).json({
        success: false,
        message: "Invalid session."
      });
    }

    const tokenHash = hashToken(token);

    const session = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
      revokedAt: null
    })
      .select("userId")
      .lean();

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid."
      });
    }

    req.user = {
      id: String(session.userId)
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
