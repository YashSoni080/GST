import mongoose from "mongoose";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function connectDB() {
  if (mongoose.connection && mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const isLocal =
    config.mongodbUri.includes("127.0.0.1") ||
    config.mongodbUri.includes("localhost");

  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: isLocal ? 2500 : 10000,
    });
    return conn.connection;
  } catch (err) {
    if (!isLocal) {
      console.error("Failed to connect to MongoDB Atlas / remote cluster:", err.message);
      throw err;
    }

    console.log("Local mongod not responding, attempting auto-launch on port 27019...");
    const workspaceRoot = path.resolve(__dirname, "../../../");
    const dbDir = path.resolve(workspaceRoot, "data/db");
    const logFile = path.resolve(workspaceRoot, "data/mongod.log");

    fs.mkdirSync(dbDir, { recursive: true });
    try {
      execSync(`mongod --port 27019 --dbpath "${dbDir}" --nounixsocket --logpath "${logFile}" --fork`, {
        stdio: "ignore",
      });
    } catch (_) {}

    // Retry connection with standard timeout
    const conn = await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 3000 });
    return conn.connection;
  }
}