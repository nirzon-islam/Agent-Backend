
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

  ai: {
    providers: {
      gemini: {
        enabled: true,
        apiKey: process.env.GEMINI_API_KEY || "",
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
      },

      groq: {
        enabled: true,
        apiKey: process.env.GROQ_API_KEY || "",
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b"
      },

      cloudflare: {
        enabled: true,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
        apiToken: process.env.CLOUDFLARE_API_TOKEN || "",
        model: process.env.CLOUDFLARE_MODEL || ""
      }
    }
  },

  bridge: {
    enabled: false,
    secret: process.env.BRIDGE_SECRET || ""
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

  website: {
    enabled: true
  }
};

if (
  !Number.isInteger(config.app.port) ||
  config.app.port < 1 ||
  config.app.port > 65535
) {
  throw new Error("Invalid PORT configuration");
}

module.exports = Object.freeze(config);
