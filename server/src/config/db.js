import mongoose from "mongoose";
import { config } from "./index.js";

export async function connectDB() {
  const conn = await mongoose.connect(config.mongodbUri);
  return conn.connection;
}