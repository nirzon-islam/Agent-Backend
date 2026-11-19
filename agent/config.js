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
  bridge: {
    enabled: process.env.BRIDGE_ENABLED === "true",
    secret: process.env.BRIDGE_SECRET || "",
    allowedSenderIds: (process.env.AGENT_ALLOWED_SENDER_IDS || process.env.BRIDGE_ALLOWED_SENDER_IDS || "").split(",").map(value => value.trim()).filter(Boolean),
    ownerSenderIds: (process.env.AGENT_OWNER_SENDER_IDS || process.env.BRIDGE_OWNER_SENDER_IDS || "").split(",").map(value => value.trim()).filter(Boolean)
  },
  fcaLicense: {
    privateKey: (process.env.FCA_LICENSE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ownerFacebookId: (process.env.FCA_OWNER_FACEBOOK_ID || "").trim()
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
  if (config.adminBootstrap.password.length < 8 || config.adminBootstrap.password.length > 128) throw new Error("ADMIN_PASSWORD must be 8-128 characters.");
}

if (config.fcaLicense.ownerFacebookId && !/^\\d{5,30}$/.test(config.fcaLicense.ownerFacebookId)) {
  throw new Error("FCA_OWNER_FACEBOOK_ID must be a numeric Facebook ID (5-30 digits).");
}

if (config.bridge.enabled && config.bridge.secret.length < 32) {
  throw new Error("BRIDGE_SECRET must contain at least 32 characters when BRIDGE_ENABLED=true.");
}

module.exports = Object.freeze(config);
