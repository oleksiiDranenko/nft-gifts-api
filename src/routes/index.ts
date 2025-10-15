import express from "express";
import { IndexModel } from "../models/Index";
import { IndexMonthDataModel } from "../models/IndexMonthData";

const router = express.Router();

// Helper: get price/volume stats for index
const getIndexPrices = async (index: any) => {
  const indexId = index._id;
  const monthData = await IndexMonthDataModel.find({ indexId })
    .sort({ createdAt: -1 })
    .limit(96); // fetch up to 96 (48 latest + 48 previous)

  if (monthData.length === 0) {
    return {
      tonPrice: null,
      tonPrice24hAgo: null,
      usdPrice: null,
      usdPrice24hAgo: null,
    };
  }

  // ⚙️ Normal case — just return latest and 24h ago prices
  if (index.shortName !== "VOL") {
    const latest = monthData[0];
    const ago24h = monthData[47] || monthData[monthData.length - 1];

    return {
      tonPrice: latest.priceTon,
      usdPrice: latest.priceUsd,
      tonPrice24hAgo: ago24h.priceTon,
      usdPrice24hAgo: ago24h.priceUsd,
    };
  }

  // 📊 Special case for 'VOL' — use sums
  const latest48 = monthData.slice(0, 48);
  const previous48 = monthData.slice(48, 96);

  const tonPrice = latest48.reduce((sum, doc) => sum + (doc.priceTon || 0), 0);
  const usdPrice = latest48.reduce((sum, doc) => sum + (doc.priceUsd || 0), 0);

  const tonPrice24hAgo = previous48.reduce(
    (sum, doc) => sum + (doc.priceTon || 0),
    0
  );
  const usdPrice24hAgo = previous48.reduce(
    (sum, doc) => sum + (doc.priceUsd || 0),
    0
  );

  return { tonPrice, usdPrice, tonPrice24hAgo, usdPrice24hAgo };
};

// ✅ GET ALL INDEXES
router.get("/get-all", async (req, res) => {
  try {
    const indexes = await IndexModel.find();

    const indexesWithPrices = await Promise.all(
      indexes.map(async (index) => {
        const prices = await getIndexPrices(index);
        return { ...index.toObject(), ...prices };
      })
    );

    res.json(indexesWithPrices);
  } catch (error) {
    console.error("Error fetching indexes:", error);
    res.status(500).json({ error: "Failed to fetch indexes" });
  }
});

// ✅ GET ONE INDEX
router.get("/get-one/:indexId", async (req, res) => {
  const { indexId } = req.params;

  try {
    const index = await IndexModel.findById(indexId);
    if (!index) {
      return res.status(404).json({ message: "Index not found" });
    }

    const prices = await getIndexPrices(index);
    res.json({ ...index.toObject(), ...prices });
  } catch (error) {
    console.error("Error fetching index:", error);
    res.status(500).json({ error: "Failed to fetch index" });
  }
});

export { router as IndexRouter };
