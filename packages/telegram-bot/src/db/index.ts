import mongoose from "mongoose";
import { config } from "../config.js";

export async function connectDB(): Promise<void> {
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI is required. Set it in env vars.");
  }
  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error(
      "❌ MongoDB connection failed:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
}

export { mongoose };
