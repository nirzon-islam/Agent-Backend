
"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const config = require("./agent/config");
const { connectDatabase, disconnectDatabase } = require("./agent/db");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

const allowedOrigins = (process.env.WEBSITE_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({
    name: config.app.name,
    status: "online",
    message: "Agent Backend is running"
  });
});

app.get("/api/health", (req, res) => {
  const databaseConnected =
    require("mongoose").connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "healthy" : "degraded",
    database: databaseConnected ? "connected" : "disconnected"
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);

  res.status(err.message === "Origin not allowed" ? 403 : 500).json({
    success: false,
    message: "Request could not be processed"
  });
});

let server;

async function startServer() {
  await connectDatabase();

  server = app.listen(config.app.port, "0.0.0.0", () => {
    console.log(`[Agent Backend] Running on port ${config.app.port}`);
  });
}

async function shutdown(signal) {
  console.log(`[Server] ${signal} received`);

  if (server) {
    await new Promise(resolve => server.close(resolve));
  }

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
