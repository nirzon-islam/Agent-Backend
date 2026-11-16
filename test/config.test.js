"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const configPath = path.resolve(__dirname, "../agent/config.js");

function loadConfig(extraEnv = {}) {
  const script = "const c=require(" + JSON.stringify(configPath) + "); process.stdout.write(JSON.stringify({enabled:c.bridge.enabled, secretLength:c.bridge.secret.length}));";
  return spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    env: { ...process.env, ADMIN_USERNAME: "", ADMIN_PASSWORD: "", BRIDGE_ENABLED: "", BRIDGE_SECRET: "", ...extraEnv }
  });
}

test("Bridge is disabled by default", () => {
  const result = loadConfig();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { enabled: false, secretLength: 0 });
});

test("Admin password accepts 8 characters and rejects fewer than 8", () => {
  const tooShort = loadConfig({ ADMIN_USERNAME: "testadmin", ADMIN_PASSWORD: "1234567" });
  assert.notEqual(tooShort.status, 0);
  assert.match(tooShort.stderr, /ADMIN_PASSWORD must be 8-128 characters/);

  const minimum = loadConfig({ ADMIN_USERNAME: "testadmin", ADMIN_PASSWORD: "12345678" });
  assert.equal(minimum.status, 0, minimum.stderr);
});

test("Bridge requires a sufficiently long secret when enabled", () => {
  const missing = loadConfig({ BRIDGE_ENABLED: "true" });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /BRIDGE_SECRET must contain at least 32 characters/);

  const valid = loadConfig({ BRIDGE_ENABLED: "true", BRIDGE_SECRET: "x".repeat(48) });
  assert.equal(valid.status, 0, valid.stderr);
  assert.deepEqual(JSON.parse(valid.stdout), { enabled: true, secretLength: 48 });
});

test("Bridge remains disabled unless the flag is exactly true", () => {
  const result = loadConfig({ BRIDGE_ENABLED: "1", BRIDGE_SECRET: "x".repeat(48) });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).enabled, false);
});
