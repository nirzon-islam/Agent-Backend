"use strict";

const config = {
  app: {
    name: "Agent Backend",
    environment: process.env.NODE_ENV || "production",
    port: Number(process.env.PORT || 3000)
  },
  database: {
    uri: process.env.MONGODB_URI || "",
    name: "agent_backend"
  },
  adminBootstrap: {
    username: (process.env.ADMIN_USERNAME || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || ""
  },
  ai: {
    providers: {
      gemini: { enabled: true, apiKey: process.env.GEMINI_API_KEY || "", model: process.env.GEMINI_MODEL || "gemini-2.5-flash" },
      groq: { enabled: true, apiKey: process.env.GROQ_API_KEY || "", model: process.env.GROQ_MODEL || "openai/gpt-oss-120b" },
      cloudflare: { enabled: true, accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "", apiToken: process.env.CLOUDFLARE_API_TOKEN || "", model: process.env.CLOUDFLARE_MODEL || "" }
    }
  },
  bridge: {
    enabled: process.env.BRIDGE_ENABLED === "true",
    secret: process.env.BRIDGE_SECRET || "",
    allowedSenderIds: (process.env.AGENT_ALLOWED_SENDER_IDS || "").split(",").map(value => value.trim()).filter(Boolean)
  },
  security: {
    requireApproval: true,
    backupBeforeChanges: true,
    testBeforeApply: true,
    allowAutomaticInstall: false,
    allowAutomaticDelete: false,
    allowShellExecution: false,
    maxPendingApprovals: 5
  },
  website: { enabled: true }
};

if (!Number.isInteger(config.app.port) || config.app.port < 1 || config.app.port > 65535) {
  throw new Error("Invalid PORT configuration");
}

const hasUsername = Boolean(config.adminBootstrap.username);
const hasPassword = Boolean(config.adminBootstrap.password);
if (hasUsername !== hasPassword) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be configured together.");
}
if (hasUsername) {
  if (!/^[a-z0-9_-]{3,40}$/.test(config.adminBootstrap.username)) throw new Error("Invalid ADMIN_USERNAME format.");
  if (config.adminBootstrap.password.length < 12 || config.adminBootstrap.password.length > 128) throw new Error("ADMIN_PASSWORD must be 12-128 characters.");
}

if (config.bridge.enabled && config.bridge.secret.length < 32) {
  throw new Error("BRIDGE_SECRET must contain at least 32 characters when BRIDGE_ENABLED=true.");
}

module.exports = Object.freeze(config);
