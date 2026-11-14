
"use strict";

const express = require("express");
const crypto = require("crypto");

const Admin = require("../models/Admin");
const Session = require("../models/Session");
const { verifyPassword } = require("../auth/password");

const router = express.Router();

const SESSION_DURATION = 12 * 60 * 60 * 1000;

// LOGIN RATE LIMIT CONFIG
const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_WINDOW = 15 * 60 * 1000;
const MAX_TRACKED_IPS = 10000;

const loginAttempts = new Map();

function getClientIP(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function cleanupAttempts() {
  const now = Date.now();

  for (const [ip, data] of loginAttempts) {
    if (now >= data.resetAt) {
      loginAttempts.delete(ip);
    }
  }

  while (loginAttempts.size > MAX_TRACKED_IPS) {
    const oldestIP = loginAttempts.keys().next().value;
    loginAttempts.delete(oldestIP);
  }
}

function isRateLimited(ip) {
  cleanupAttempts();

  const data = loginAttempts.get(ip);

  if (!data) return false;

  if (Date.now() >= data.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }

  return data.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  let data = loginAttempts.get(ip);

  if (!data || now >= data.resetAt) {
    data = {
      count: 0,
      resetAt: now + LOGIN_WINDOW
    };
  }

  data.count += 1;
  loginAttempts.set(ip, data);
}

function resetFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

router.post("/login", async (req, res, next) => {
  try {
    const ip = getClientIP(req);

    if (isRateLimited(ip)) {
      const data = loginAttempts.get(ip);
      const retryAfter = Math.max(
        1,
        Math.ceil((data.resetAt - Date.now()) / 1000)
      );

      res.set("Retry-After", String(retryAfter));

      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Try again later.",
        retryAfter
      });
    }

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
      recordFailedAttempt(ip);

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
      recordFailedAttempt(ip);

      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    resetFailedAttempts(ip);

    const token = crypto.randomBytes(32).toString("base64url");

    await Session.create({
      tokenHash: hashToken(token),
      userId: admin._id,
      expiresAt: new Date(Date.now() + SESSION_DURATION),
      userAgent: String(
        req.headers["user-agent"] || ""
      ).slice(0, 300)
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
