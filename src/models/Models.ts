import mongoose from "mongoose";

const GiftModelsSchema = new mongoose.Schema(
  {
    giftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "gift",
      required: true,
    },
    models: [
      {
        name: { type: String, required: true },
        rarity: { type: Number, required: true },
        image: { type: String, required: true },
      },
    ],
  },
  {
    collection: "giftModels",
    versionKey: false,
  }
);

export const GiftModelsModel = mongoose.model("giftModels", GiftModelsSchema);
