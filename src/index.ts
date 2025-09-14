import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import { initializeBot } from "./telegram/bot";
import { WeekRouter } from "./routes/weekData";
import { LifeRouter } from "./routes/lifeData";
import { GiftsRouter } from "./routes/gifts";
import { UserRouter } from "./routes/users";
import { SubscriptionRouter } from "./routes/subscription";
import { IndexRouter } from "./routes/index";
import { IndexDataRouter } from "./routes/indexData";
import {
  addData,
  addDailyDataForDate,
  updateDailyDataForPreviousDay,
} from "./bot/bot";
import { GiftModel } from "./models/Gift";
import { addIndexData } from "./functions/index/addIndexData";
import { getUpgradedSupply } from "./utils/getUpgradedSupply";
import { GiftModelsRouter } from "./routes/giftModels";
import { TelegramRouter } from "./routes/telegram";
import { updateUpgradedSupply } from "./utils/updateUpgradedSupply";
import { fetchVolume } from "./bot/operations/fetchVolume";
import { addFearGreedIndex } from "./bot/fear-and-greed/addFearAndGreed";
import { FearAndGreedRouter } from "./routes/fearAndGreed";

process.removeAllListeners("warning");

const app = express();
const port = process.env.PORT || 3001;

dotenv.config();

app.use(cors());
app.use(express.json());

// Set up routes
app.use("/weekChart", WeekRouter);
app.use("/lifeChart", LifeRouter);
app.use("/gifts", GiftsRouter);
app.use("/users", UserRouter);
app.use("/subscriptions", SubscriptionRouter);
app.use("/indexes", IndexRouter);
app.use("/indexData", IndexDataRouter);
app.use("/giftModels", GiftModelsRouter);
app.use("/fearAndGreed", FearAndGreedRouter);
app.use("/telegram", TelegramRouter);

app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", mongodb: mongoose.connection.readyState });
});

const inDev = false;

if (!inDev) {
  (async () => {
    try {
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error(
          "Error: TELEGRAM_BOT_TOKEN environment variable is not set. Bot functionality will be disabled."
        );
        return;
      }
      const bot = await initializeBot(process.env.TELEGRAM_BOT_TOKEN);
      app.post("/bot", bot.webhookCallback("/bot"));
      console.log("Webhook route configured for Telegram bot");
    } catch (err) {
      console.error(
        "Failed to initialize Telegram bot, continuing without bot:",
        err
      );
    }
  })();
}

process.env.TZ = "Europe/London";

if (!inDev) {
  cron.schedule("0 0,30 * * * *", async () => {
    console.log("Cron job triggered at:", new Date().toISOString());
    try {
      await addData();
      await addFearGreedIndex();
      await updateUpgradedSupply();
      console.log("Cron job completed successfully");
    } catch (error: any) {
      console.error("Error in cron job:", error.stack);
    }
  });

  cron.schedule("0 0 0 * * *", async () => {
    console.log(
      "Daily data update cron job triggered at:",
      new Date().toISOString()
    );
    try {
      await updateDailyDataForPreviousDay();
      console.log("Daily data update cron job completed successfully");
    } catch (error: any) {
      console.error("Error in daily data update cron job:", error.stack);
    }
  });
}

app.get("/add-data", async (req, res) => {
  await addData();
  res.json("done");
});

const startServer = async () => {
  try {
    const dbConnectionString = process.env.DB_CONNECTION_STRING;
    if (!dbConnectionString) {
      console.error(
        "Error: DB_CONNECTION_STRING environment variable is not set"
      );
      process.exit(1);
    }

    // Retry MongoDB connection
    let retries = 3;
    while (retries > 0) {
      try {
        await mongoose.connect(dbConnectionString);
        console.log("Successfully connected to MongoDB");
        break;
      } catch (err) {
        console.error(
          `MongoDB connection attempt failed (${retries} retries left):`,
          err
        );
        retries--;
        if (retries === 0) {
          console.error("Error connecting to MongoDB after retries:", err);
          process.exit(1);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

startServer();
