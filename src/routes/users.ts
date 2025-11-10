import express from "express";
import { UserModel } from "../models/User";
import { hashValue } from "../utils/hash";
import jwt from "jsonwebtoken";
import { WeekChartModel } from "../models/WeekChart";
import { GiftModel } from "../models/Gift";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

router.get("/check-account/:telegramId", async (req, res) => {
  const hashedTelegramId = hashValue(req.params.telegramId);

  try {
    const user = await UserModel.findOne({ telegramId: hashedTelegramId });

    if (user) {
      // sign JWT with user id
      const token = jwt.sign(
        { sub: user._id.toString() },
        JWT_SECRET as string,
        { expiresIn: "30d" }
      );

      // Convert Mongoose document to plain object and include unhashed telegramId
      const userObj = user.toObject();
      return res.status(200).json({
        ...userObj,
        telegramId: req.params.telegramId,
        token,
      });
    }

    return res.status(200).json({ exists: false });
  } catch (error: any) {
    console.error("Error checking account:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

router.get("/get-user-chart/:telegramId", async (req, res) => {
  try {
    const hashedTelegramId = hashValue(req.params.telegramId);

    // 1️⃣ Fetch user once (only required fields)
    const user = await UserModel.findOne({ telegramId: hashedTelegramId })
      .select("assets.giftId assets.amount")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.assets?.length)
      return res.status(200).json({ message: "User has no assets" });

    // 2️⃣ Collect gift IDs
    const giftIds = user.assets.map((a) => a.giftId);

    // 3️⃣ Fetch all gift names in one query
    const gifts = await GiftModel.find(
      { _id: { $in: giftIds } },
      { _id: 1, name: 1 }
    ).lean();

    if (!gifts.length)
      return res.status(200).json({ message: "User has no valid gifts" });

    // Build quick lookup maps (O(1) access)
    const giftIdToGift = new Map(gifts.map((g) => [g._id.toString(), g]));
    const giftNameSet = new Set(gifts.map((g) => g.name));
    const giftIdToAmount = new Map(
      user.assets.map((a) => [a.giftId, a.amount])
    );

    // 4️⃣ Fetch week data efficiently
    const weekData = await WeekChartModel.find(
      { name: { $in: Array.from(giftNameSet) } },
      { name: 1, date: 1, time: 1, priceTon: 1, priceUsd: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(48 * giftNameSet.size) // same logic
      .lean();

    if (!weekData.length)
      return res.status(200).json({ message: "No chart data available" });

    // 5️⃣ Group efficiently by date + time
    const grouped = new Map();

    for (const doc of weekData) {
      const gift = gifts.find((g) => g.name === doc.name);
      if (!gift) continue;

      const amount = giftIdToAmount.get(gift._id.toString());
      if (!amount) continue;

      const key = `${doc.date}_${doc.time}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = { date: doc.date, time: doc.time, priceTon: 0, priceUsd: 0 };
        grouped.set(key, entry);
      }

      entry.priceTon += doc.priceTon * amount;
      entry.priceUsd += doc.priceUsd * amount;
    }

    // 6️⃣ Chronological sort (identical logic)
    const chartData = Array.from(grouped.values()).sort((a, b) => {
      const [da, ma, ya] = a.date.split("-").map(Number);
      const [ha, mina] = a.time.split(":").map(Number);
      const [db, mb, yb] = b.date.split("-").map(Number);
      const [hb, minb] = b.time.split(":").map(Number);
      return (
        (new Date(ya, ma - 1, da, ha, mina) as any) -
        (new Date(yb, mb - 1, db, hb, minb) as any)
      );
    });

    res.json(chartData.slice(-48));
  } catch (err) {
    console.error("Error generating user chart:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});

router.post("/create-account", async (req, res) => {
  const hashedTelegramId = hashValue(req.body.telegramId);
  const { username } = req.body;

  try {
    const existing = await UserModel.findOne({ telegramId: hashedTelegramId });
    if (existing) {
      return res.status(400).json({ message: "Account already exists" });
    }

    const newUser = new UserModel({
      telegramId: hashedTelegramId,
      username: username || "Anonymous",
      savedList: [],
      assets: [],
      ton: 0,
      usd: 0,
    });

    await newUser.save();

    // sign JWT with user id
    const token = jwt.sign(
      { sub: newUser._id.toString() }, // user identifier
      JWT_SECRET as string,
      { expiresIn: "30d" } // adjust to your needs
    );

    const userObj = newUser.toObject();
    return res.status(201).json({
      message: "Account created successfully",
      token, // send token back
      user: { ...userObj, telegramId: req.body.telegramId },
    });
  } catch (error: any) {
    console.error("Error creating account:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

router.patch("/update-account/:telegramId", async (req, res) => {
  const hashedTelegramId = hashValue(req.params.telegramId);
  const { username, savedList, assets, ton, usd } = req.body;

  try {
    const user = await UserModel.findOne({ telegramId: hashedTelegramId });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.username = username || user.username;
    user.savedList = savedList || user.savedList;
    user.assets = assets || user.assets;
    user.ton = ton !== undefined ? ton : user.ton;
    user.usd = usd !== undefined ? usd : user.usd;

    await user.save();

    const userObj = user.toObject();
    return res.status(200).json({
      message: "User updated successfully",
      user: { ...userObj, telegramId: req.params.telegramId },
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

export { router as UserRouter };
