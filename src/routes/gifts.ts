import express from "express";
import { GiftModel } from "../models/Gift";
import { WeekChartModel } from "../models/WeekChart";
import { getTonPrice } from "../bot/operations/getTonPrice";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const gifts = await GiftModel.find({});
    res.json(gifts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export const getNames = async () => {
  try {
    const gifts = await GiftModel.find().select("name -_id");
    const giftNames = gifts.map((gift) => gift.name);
    console.log(giftNames);

    return giftNames;
  } catch (error) {
    console.log(error);
  }
};

router.get("/get-names", async (req, res) => {
  try {
    const names = await getNames();
    res.json(names);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:giftId", async (req, res) => {
  const { giftId } = req.params;

  try {
    const gift = await GiftModel.findById(giftId);

    if (!gift) {
      return res.status(404).json({ message: "Gift not found" });
    }

    const currentPrice = await WeekChartModel.find({ name: gift.name })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const finalGift = {
      ...gift.toObject(),
      priceTon: currentPrice.length ? currentPrice[0].priceTon : null,
      priceUsd: currentPrice.length ? currentPrice[0].priceUsd : null,
    };

    res.json(finalGift);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export { router as GiftsRouter };
