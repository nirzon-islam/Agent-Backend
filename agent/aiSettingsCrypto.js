"use strict";
const crypto = require("crypto");
function getKey() {
  const value = process.env.AI_SETTINGS_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    const error = new Error("Set AI_SETTINGS_ENCRYPTION_KEY to a random 64-character hex value in Render Environment.");
    error.code = "AI_ENCRYPTION_KEY_MISSING";
    throw error;
  }
  return Buffer.from(value, "hex");
}
function encrypt(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}
function decrypt(value) {
  if (!value) return "";
  const [iv, tag, data] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
module.exports = { encrypt, decrypt };
