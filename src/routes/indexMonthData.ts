import express from "express";
import { IndexMonthDataModel } from "../models/IndexMonthData";
import { IndexModel } from "../models/Index";

const router = express.Router();

router.get("/market-cap/latest", async (req, res) => {
  const MARKET_CAP_INDEX_ID = "68493d064b37eed02b7ae5af";
  const LIMIT = 336;

  try {
    const indexExists = await IndexModel.findById(MARKET_CAP_INDEX_ID);
    if (!indexExists) {
      return res.status(404).json({ error: "Market cap index not found" });
    }

    const data = await IndexMonthDataModel.find({
      indexId: MARKET_CAP_INDEX_ID,
    })
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .select("-indexId -_id");

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error });
  }
});

router.get("/:indexId", async (req, res) => {
  const { indexId } = req.params;

  try {
    const indexExists = await IndexModel.findById(indexId);
    if (!indexExists) {
      return res.status(404).json({ error: `Index ${indexId} not found` });
    }
    const monthList = await IndexMonthDataModel.find({ indexId });

    res.status(200).json(monthList);
  } catch (error) {
    res.status(500).json({
      error: error,
    });
  }
});

export { router as IndexMonthRouter };
