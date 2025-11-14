import mongoose from "mongoose";

const GiftSchema = new mongoose.Schema<GiftInterface>(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    supply: { type: Number, required: true },
    initSupply: { type: Number, required: true },
    releaseDate: { type: String, required: true },
    starsPrice: { type: Number, required: true },
    upgradePrice: { type: Number, required: true },
    initTonPrice: { type: Number, required: true },
    initUsdPrice: { type: Number, required: true },
    staked: { type: Boolean, required: false },
    preSale: { type: Boolean, required: false },
    upgradedSupply: { type: Number, required: false },

    // ----------------------------
    // PRECOMPUTED SNAPSHOT FIELDS
    // ----------------------------

    // current prices
    priceTon: { type: Number, required: false },
    priceUsd: { type: Number, required: false },

    // price snapshots
    tonPrice24hAgo: { type: Number, required: false },
    usdPrice24hAgo: { type: Number, required: false },

    tonPriceWeekAgo: { type: Number, required: false },
    usdPriceWeekAgo: { type: Number, required: false },

    tonPriceMonthAgo: { type: Number, required: false },
    usdPriceMonthAgo: { type: Number, required: false },

    // volumes
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
  upgradePrice: number;
  initTonPrice: number;
  initUsdPrice: number;
  staked?: boolean;
  preSale?: boolean;
  upgradedSupply?: number;

  // ⭐ New fields
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
