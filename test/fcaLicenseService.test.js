"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const service = require("../agent/fcaLicenseService");

test("issues an Ed25519-signed short-lived FCA token", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const license = {
    licenseId: "lic_0123456789abcdef0123456789abcdef",
    ownerId: "owner-demo",
    installationId: "install-demo",
    features: ["messaging", "threads"],
    expiresAt: new Date(Date.now() + 86_400_000)
  };
  const token = service.signLicenseToken(license, privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  const [payloadPart, signaturePart] = token.split(".");
  const payload = Buffer.from(payloadPart, "base64url");
  assert.equal(crypto.verify(null, payload, publicKey, Buffer.from(signaturePart, "base64url")), true);
  const decoded = JSON.parse(payload.toString("utf8"));
  assert.equal(decoded.aud, "OmegA-FCA");
  assert.equal(decoded.licenseId, license.licenseId);
  assert.ok(decoded.exp - decoded.iat <= 900);
});

test("hashes license secrets and compares hashes safely", () => {
  const key = service.createLicenseKey();
  const hash = service.hashLicenseKey(key);
  assert.equal(hash.length, 64);
  assert.equal(service.safeHashEqual(hash, service.hashLicenseKey(key)), true);
  assert.equal(service.safeHashEqual(hash, service.hashLicenseKey("different")), false);
});

test("rejects unsupported license features", () => {
  assert.throws(() => service.validateFeatures(["shell"]));
});
