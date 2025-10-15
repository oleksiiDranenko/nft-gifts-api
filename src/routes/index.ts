import express from "express";
import { IndexModel } from "../models/Index.js";
import { IndexMonthDataModel } from "../models/IndexMonthData.js";

const router = express.Router();

// Helper function to get latest + 24h ago data for an index
const getIndexPrices = async (indexId: any) => {
  const monthData = await IndexMonthDataModel.find({ indexId })
    .sort({ createdAt: -1 })
    .limit(48); // get up to 48 recent records (24h worth)

  if (monthData.length === 0) {
    return {
      tonPrice: null,
      tonPrice24hAgo: null,
      usdPrice: null,
      usdPrice24hAgo: null,
    };
  }

  const latest = monthData[0];
  const ago24h = monthData[47] || monthData[monthData.length - 1]; // fallback if less than 48

  return {
    tonPrice: latest.priceTon,
    usdPrice: latest.priceUsd,
    tonPrice24hAgo: ago24h.priceTon,
    usdPrice24hAgo: ago24h.priceUsd,
  };
};

// GET ALL INDEXES
router.get("/get-all", async (req, res) => {
  try {
    const indexes = await IndexModel.find();

    // Attach price data to each index
    const indexesWithPrices = await Promise.all(
      indexes.map(async (index) => {
        const prices = await getIndexPrices(index._id);
        return { ...index.toObject(), ...prices };
      })
    );

    res.json(indexesWithPrices);
  } catch (error) {
    console.error("Error fetching indexes:", error);
    res.status(500).json({ error: "Failed to fetch indexes" });
  }
});

// GET ONE INDEX
router.get("/get-one/:indexId", async (req, res) => {
  const { indexId } = req.params;

  try {
    const index = await IndexModel.findById(indexId);

    if (!index) {
      return res.status(404).json({ message: "Index not found" });
    }

    const prices = await getIndexPrices(indexId);

    res.json({ ...index.toObject(), ...prices });
  } catch (error) {
    console.error("Error fetching index:", error);
    res.status(500).json({ error: "Failed to fetch index" });
  }
});

export { router as IndexRouter };
