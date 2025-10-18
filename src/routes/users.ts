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
    const user = await UserModel.findOne({
      telegramId: hashedTelegramId,
    }).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    // 1️⃣ Get gift IDs from user's assets
    const giftIds = user.assets.map((a) => a.giftId);

    // 2️⃣ Fetch corresponding gift names
    const gifts = await GiftModel.find({ _id: { $in: giftIds } })
      .select("name")
      .lean();

    const giftNames = gifts.map((g) => g.name);

    if (giftNames.length === 0) {
      return res.status(200).json({ message: "User has no valid gifts" });
    }

    // 3️⃣ Fetch WeekChart data for those gift names
    const weekData = await WeekChartModel.find({ name: { $in: giftNames } })
      .sort({ createdAt: -1 })
      .limit(48 * giftNames.length)
      .lean();

    if (!weekData.length) {
      return res.status(200).json({ message: "No chart data available" });
    }

    // 4️⃣ Group by date + time
    const grouped: Record<string, any> = {};

    for (const doc of weekData) {
      const key = `${doc.date}_${doc.time}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: doc.date,
          time: doc.time,
          priceTon: 0,
          priceUsd: 0,
        };
      }

      // find asset corresponding to this gift
      const gift = gifts.find((g) => g.name === doc.name);
      if (!gift) continue;

      const asset = user.assets.find((a) => a.giftId === gift._id.toString());
      if (asset) {
        grouped[key].priceTon += doc.priceTon * asset.amount;
        grouped[key].priceUsd += doc.priceUsd * asset.amount;
      }
    }

    // 5️⃣ Sort chronologically
    const chartData = Object.values(grouped).sort((a, b) => {
      const [da, ma, ya] = a.date.split("-").map(Number);
      const [ha, mina] = a.time.split(":").map(Number);
      const [db, mb, yb] = b.date.split("-").map(Number);
      const [hb, minb] = b.time.split(":").map(Number);
      const dateA = new Date(ya, ma - 1, da, ha, mina);
      const dateB = new Date(yb, mb - 1, db, hb, minb);
      return dateA.getTime() - dateB.getTime();
    });

    res.json(chartData.slice(-48));
  } catch (err) {
    console.error("Error generating user chart:", err);
    res
      .status(500)
      .json({ message: "Server error", error: (err as Error).message });
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
