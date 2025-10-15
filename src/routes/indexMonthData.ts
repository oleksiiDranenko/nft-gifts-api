import express from "express";
import { IndexMonthDataModel } from "../models/IndexMonthData";
import { IndexModel } from "../models/Index";

const router = express.Router();

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
