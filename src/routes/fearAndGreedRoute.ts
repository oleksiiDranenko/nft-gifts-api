import express from "express";
import { FearAndGreedModel } from "../models/FearAndGreed";

const router = express.Router();

router.get("/fear-and-greed", async (req, res) => {
  try {
    const indexValue = await FearAndGreedModel.findOne().sort({ _id: -1 });

    res.json(indexValue);
  } catch (error) {}
});
