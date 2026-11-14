
"use strict";

const mongoose = require("mongoose");
const config = require("./config");

let connected = false;

async function connectDatabase() {
  if (connected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!config.database.uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(config.database.uri, {
    dbName: config.database.name,
    serverSelectionTimeoutMS: 10000
  });

  connected = true;

  mongoose.connection.on("disconnected", () => {
    connected = false;
    console.error("[Database] Disconnected");
  });

  mongoose.connection.on("connected", () => {
    connected = true;
    console.log("[Database] Connected");
  });

  console.log("[Database] MongoDB connection established");

  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  connected = false;
}

module.exports = {
  connectDatabase,
  disconnectDatabase
};
