"use strict";

const crypto = require("node:crypto");

const ALLOWED_FEATURES = new Set(["messaging", "threads", "groups", "reactions", "events"]);
const TOKEN_TTL_SECONDS = 15 * 60;

function normalizePrivateKey(value) {
  if (typeof value !== "string" || !value.includes("PRIVATE KEY")) throw new Error("FCA license signing key is not configured");
  return value.replace(/\\n/g, "\n");
}

function hashLicenseKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function safeHashEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function signLicenseToken(license, privateKeyValue, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const exp = Math.min(Math.floor(new Date(license.expiresAt).getTime() / 1000), iat + TOKEN_TTL_SECONDS);
  if (exp <= iat) throw new Error("License has expired");
  const payload = {
    iss: "OmegA-License-Service",
    aud: "OmegA-FCA",
    licenseId: license.licenseId,
    ownerId: license.ownerId,
    installationId: license.installationId,
    iat,
    exp,
    features: license.features
  };
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = crypto.sign(null, bytes, normalizePrivateKey(privateKeyValue));
  return bytes.toString("base64url") + "." + signature.toString("base64url");
}

function createLicenseKey() {
  return crypto.randomBytes(32).toString("base64url");
}

function validateFeatures(features) {
  if (features === undefined) return ["messaging"];
  if (!Array.isArray(features) || features.length < 1 || features.length > ALLOWED_FEATURES.size ||
      features.some(item => typeof item !== "string" || !ALLOWED_FEATURES.has(item)) ||
      new Set(features).size !== features.length) {
    throw new Error("Invalid FCA license features");
  }
  return features;
}

module.exports = { ALLOWED_FEATURES, hashLicenseKey, safeHashEqual, signLicenseToken, createLicenseKey, validateFeatures };
