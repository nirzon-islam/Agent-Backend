
"use strict";

const crypto = require("crypto");
const Session = require("../models/Session");
const Admin = require("../models/Admin");

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

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(401).json({
        success: false,
        message: "Invalid session."
      });
    }

    const session = await Session.findOne({
      tokenHash: hashToken(token),
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

    const admin = await Admin.findOne({
      _id: session.userId,
      isActive: true
    })
      .select("_id username role permissions")
      .lean();

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account is inactive or unavailable."
      });
    }

    req.user = {
      id: String(admin._id),
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions
    };

    return next();

  } catch (error) {
    return next(error);
  }
}

module.exports = authenticate;
