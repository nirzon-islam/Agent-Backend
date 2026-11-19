"use strict";

const mongoose = require("mongoose");

const fcaLicenseSchema = new mongoose.Schema({
  licenseId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true, maxlength: 128, index: true },
  installationId: { type: String, required: true, maxlength: 128 },
  licenseKeyHash: { type: String, required: true, select: false },
  features: { type: [String], default: ["messaging"] },
  status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null },
  lastIssuedAt: { type: Date, default: null },
  createdBy: { type: String, required: true, maxlength: 128 }
}, { timestamps: true, collection: "agent_fca_licenses" });

module.exports = mongoose.models.FCALicense || mongoose.model("FCALicense", fcaLicenseSchema);
