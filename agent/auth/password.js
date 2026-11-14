"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

const OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024
};

async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const salt = crypto.randomBytes(16);

  const hash = await scrypt(
    password,
    salt,
    OPTIONS.keyLength,
    {
      N: OPTIONS.N,
      r: OPTIONS.r,
      p: OPTIONS.p,
      maxmem: OPTIONS.maxmem
    }
  );

  return [
    "scrypt",
    OPTIONS.N,
    OPTIONS.r,
    OPTIONS.p,
    salt.toString("hex"),
    hash.toString("hex")
  ].join("$");
}

async function verifyPassword(password, storedHash) {
  try {
    if (typeof password !== "string" ||
        typeof storedHash !== "string") return false;

    const parts = storedHash.split("$");

    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }

    const [_, N, r, p, saltHex, hashHex] = parts;

    if (
      Number(N) !== OPTIONS.N ||
      Number(r) !== OPTIONS.r ||
      Number(p) !== OPTIONS.p ||
      !/^[a-f0-9]{32}$/i.test(saltHex) ||
      !/^[a-f0-9]{128}$/i.test(hashHex)
    ) return false;

    const salt = Buffer.from(saltHex, "hex");
    const originalHash = Buffer.from(hashHex, "hex");

    const newHash = await scrypt(
      password,
      salt,
      OPTIONS.keyLength,
      {
        N: OPTIONS.N,
        r: OPTIONS.r,
        p: OPTIONS.p,
        maxmem: OPTIONS.maxmem
      }
    );

    return crypto.timingSafeEqual(newHash, originalHash);
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
