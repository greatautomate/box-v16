import { Schema, model, type Document } from "mongoose";

export interface ISession extends Document {
  telegramId: string;
  activeBoxId: string | null;
  defaultModel: string;
  defaultHarness: string;
  defaultRuntime: string;
  uploadDestination: string | null;
  wizardSize: string;
  wizardApiKeyType: string;
  /** Persisted keep-alive preference; seeds the create wizard. */
  defaultKeepAlive: boolean;
  /** Per-creation keep-alive choice, set during the wizard. */
  wizardKeepAlive: boolean;
  lastActivityAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    activeBoxId: { type: String, default: null },
    defaultModel: { type: String, default: "anthropic/claude-sonnet-4-5" },
    defaultHarness: { type: String, default: "claude-code" },
    defaultRuntime: { type: String, default: "node" },
    uploadDestination: { type: String, default: null },
    wizardSize: { type: String, default: "small" },
    wizardApiKeyType: { type: String, default: "upstash" },
    defaultKeepAlive: { type: Boolean, default: true },
    wizardKeepAlive: { type: Boolean, default: true },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Session = model<ISession>("Session", sessionSchema);
