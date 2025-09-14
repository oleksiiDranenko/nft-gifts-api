import mongoose from "mongoose";

const FearAndGreedSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    time: { type: String, required: true },
    value: { type: Number, required: true },
  },
  {
    collection: "fearAndGreed",
    versionKey: false,
  }
);

export const FearAndGreedModel = mongoose.model(
  "fearAndGreed",
  FearAndGreedSchema
);
