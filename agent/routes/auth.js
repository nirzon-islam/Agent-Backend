"use strict";

const express = require("express");
const crypto = require("crypto");

const Admin = require("../models/Admin");
const Session = require("../models/Session");
const { verifyPassword } = require("../auth/password");

const router = express.Router();

const SESSION_DURATION = 12 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 100 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid login details."
      });
    }

    const admin = await Admin.findOne({
      username: username.trim().toLowerCase(),
      isActive: true
    }).select("+passwordHash");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const valid = await verifyPassword(
      password,
      admin.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const token = crypto.randomBytes(32).toString("base64url");

    await Session.create({
      tokenHash: hashToken(token),
      userId: admin._id,
      expiresAt: new Date(Date.now() + SESSION_DURATION),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300)
    });

    admin.lastLoginAt = new Date();
    await admin.save();

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      expiresIn: SESSION_DURATION
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
