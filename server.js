 
"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

const config = require("./agent/config");
const { connectDatabase, disconnectDatabase } = require("./agent/db");

const Admin = require("./agent/models/Admin");
const { hashPassword } = require("./agent/auth/password");

const authRoutes = require("./agent/routes/auth");
const serviceAuth = require("./agent/middleware/serviceAuth");
const authenticate = require("./agent/auth/authenticate");
const requireOwner = require("./agent/middleware/requireOwner");
const bridgeRoutes = require("./agent/routes/bridge");
const taskRoutes = require("./agent/routes/tasks");
const approvalRoutes = require("./agent/routes/approvals");
const accountStatusRoutes = require("./agent/routes/accountStatus");
const aiSettingsRoutes = require("./agent/routes/aiSettings");
const fcaLicenseRoutes = require("./agent/routes/fcaLicenses");
const { resumePendingPlans } = require("./agent/planner");

const app = express();

app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = (process.env.WEBSITE_ORIGINS || "")
  .split(",").map(origin => origin.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Agent-Timestamp", "X-Agent-Nonce", "X-Agent-Signature"]
}));

app.use(express.json({
  limit: "1mb",
  verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); }
}));

// Same-origin Owner dashboard.
app.use(express.static(path.join(__dirname, "public"), {
  index: "index.html",
  etag: true,
  maxAge: "5 minutes"
}));

app.use("/api/auth", authRoutes);
app.use("/api/tasks", authenticate, requireOwner, taskRoutes);
app.use("/api/approvals", authenticate, requireOwner, approvalRoutes);
app.use("/api/account/status", authenticate, requireOwner, accountStatusRoutes);
app.use("/api/ai-settings", authenticate, requireOwner, aiSettingsRoutes);
app.use("/api/fca-licenses", authenticate, requireOwner, fcaLicenseRoutes.ownerRouter);
const fcaLicenseRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many license refresh attempts. Try again later." }
});
const fcaLicenseRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many automatic license requests. Try again later." }
});
app.use("/api/fca-license/request", fcaLicenseRequestLimiter);
app.use("/api/fca-license", fcaLicenseRefreshLimiter, fcaLicenseRoutes.publicRouter);
app.use("/api/bridge", serviceAuth, bridgeRoutes);

async function bootstrapOwner() {
  await Admin.init();
  await Admin.collection.createIndex(
    { role: 1 },
    { unique: true, partialFilterExpression: { role: "owner" }, name: "unique_owner_role" }
  );

  const existingOwner = await Admin.findOne({ role: "owner" });
  const { username, password } = config.adminBootstrap;

  // Explicit one-time credential sync for an existing staging Owner.
  // This is disabled by default and must be removed from the environment after use.
  if (existingOwner && process.env.ADMIN_BOOTSTRAP_SYNC === "true") {
    if (!username || !password) {
      throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required for Owner credential sync.");
    }
    const usernameInUse = await Admin.findOne({
      username,
      _id: { $ne: existingOwner._id }
    });
    if (usernameInUse) {
      throw new Error("ADMIN_USERNAME is already assigned to another account.");
    }
    existingOwner.username = username;
    existingOwner.passwordHash = await hashPassword(password);
    existingOwner.isActive = true;
    await existingOwner.save();
    console.log("[Bootstrap] Existing Owner credentials synchronized.");
    return;
  }

  if (existingOwner) {
    console.log("[Bootstrap] Owner already exists. Skipping.");
    return;
  }
  if (!username || !password) {
    throw new Error("No Owner exists. Configure ADMIN_USERNAME and ADMIN_PASSWORD.");
  }

  const passwordHash = await hashPassword(password);
  try {
    await Admin.create({
      username, passwordHash, role: "owner",
      permissions: ["*"], isActive: true
    });
    console.log("[Bootstrap] Initial Owner created successfully.");
  } catch (error) {
    if (error.code === 11000 && await Admin.findOne({ role: "owner" })) {
      console.log("[Bootstrap] Owner created by another instance.");
      return;
    }
    throw error;
  }
}

function showDeploymentBanner() {
  console.log(`
╔══════════════════════════════════════════════════╗
║              AGENT BACKEND                       ║
║              DEPLOYMENT SUCCESSFUL               ║
║              OWNER : NIRZON                      ║
║              STATUS: ONLINE                      ║
║              DATABASE: CONNECTED                 ║
║              SECURITY: APPROVAL REQUIRED         ║
╚══════════════════════════════════════════════════╝
  `);
}

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "healthy" : "degraded",
    database: databaseConnected ? "connected" : "disconnected"
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(err.message === "Origin not allowed" ? 403 : 500).json({
    success: false, message: "Request could not be processed"
  });
});

let server;
async function startServer() {
  await connectDatabase();
  await bootstrapOwner();
  const resumedPlans = await resumePendingPlans();
  if (resumedPlans) console.log(`[Planner] Resumed ${resumedPlans} pending task(s)`);
  server = app.listen(config.app.port, "0.0.0.0", () => {
    console.log(`[Agent Backend] Running on port ${config.app.port}`);
    showDeploymentBanner();
  });
}

async function shutdown(signal) {
  console.log(`[Server] ${signal} received`);
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectDatabase();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer().catch(error => {
  console.error("[Startup Error]", error.message);
  process.exit(1);
});

module.exports = app;
