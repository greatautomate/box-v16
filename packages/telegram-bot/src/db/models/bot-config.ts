import { Schema, model, type Document } from "mongoose";

export interface IBotConfig extends Document {
  key: string;
  value: string;
  updatedAt: Date;
}

const botConfigSchema = new Schema<IBotConfig>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
  },
  { timestamps: true },
);

export const BotConfig = model<IBotConfig>("BotConfig", botConfigSchema);

/** Read a config value from DB, falling back to the provided default. */
export async function getConfigValue(
  key: string,
  fallback: string,
): Promise<string> {
  const doc = await BotConfig.findOne({ key });
  return doc?.value ?? fallback;
}

/** Upsert a config value. */
export async function setConfigValue(
  key: string,
  value: string,
): Promise<void> {
  await BotConfig.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true },
  );
}
