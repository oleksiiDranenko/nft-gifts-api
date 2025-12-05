import mongoose from "mongoose";

const GiftSchema = new mongoose.Schema<GiftInterface>(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    supply: { type: Number, required: true },
    initSupply: { type: Number, required: true },
    releaseDate: { type: String, required: true },
    starsPrice: { type: Number, required: true },
    upgradedSupply: { type: Number, required: false },
    priceTon: { type: Number, required: false },
    priceUsd: { type: Number, required: false },
    tonPrice24hAgo: { type: Number, required: false },
    usdPrice24hAgo: { type: Number, required: false },
    tonPriceWeekAgo: { type: Number, required: false },
    usdPriceWeekAgo: { type: Number, required: false },
    tonPriceMonthAgo: { type: Number, required: false },
    usdPriceMonthAgo: { type: Number, required: false },
    volumeTon: { type: Number, required: false },
    volumeUsd: { type: Number, required: false },
  },
  {
    collection: "gifts",
    versionKey: false,
  }
);

export interface GiftInterface extends Document {
  name: string;
  image: string;
  supply: number;
  initSupply: number;
  releaseDate: string;
  starsPrice: number;
  upgradedSupply?: number;

  priceTon?: number;
  priceUsd?: number;

  tonPrice24hAgo?: number;
  usdPrice24hAgo?: number;

  tonPriceWeekAgo?: number;
  usdPriceWeekAgo?: number;

  tonPriceMonthAgo?: number;
  usdPriceMonthAgo?: number;

  volumeTon?: number;
  volumeUsd?: number;
}

GiftSchema.index({ name: 1 }, { unique: true });

export const GiftModel = mongoose.model("gifts", GiftSchema);
