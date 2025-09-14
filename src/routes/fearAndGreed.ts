import express from "express";
import { FearAndGreedModel } from "../models/FearAndGreed";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const indexValue = await FearAndGreedModel.findOne().sort({ _id: -1 });

    res.json(indexValue);
  } catch (error) {
    res.json(error);
  }
});

export { router as FearAndGreedRouter };
