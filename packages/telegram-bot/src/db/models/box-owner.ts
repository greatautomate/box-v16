import { Schema, model, type Document } from "mongoose";

export interface IBoxOwner extends Document {
  boxId: string;
  telegramId: string;
  createdAt: Date;
}

const boxOwnerSchema = new Schema<IBoxOwner>(
  {
    boxId: { type: String, required: true, unique: true, index: true },
    telegramId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

export const BoxOwner = model<IBoxOwner>("BoxOwner", boxOwnerSchema);
