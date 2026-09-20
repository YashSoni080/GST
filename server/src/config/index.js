import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gst_manager",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpires: process.env.JWT_EXPIRES || "12h",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};