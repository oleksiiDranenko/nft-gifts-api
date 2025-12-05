import { Telegraf, Markup } from "telegraf";
import { WeekChartModel } from "../models/WeekChart";
import { GiftModel } from "../models/Gift";
import { getTopMovers } from "./helper";

// Fetch gift price data from MongoDB
const getGiftPriceData = async (giftName: string) => {
  try {
    const [last24hData, currentPriceData] = await Promise.all([
      WeekChartModel.find({ name: giftName })
        .sort({ createdAt: -1 })
        .skip(47)
        .limit(1)
        .lean(),
      WeekChartModel.find({ name: giftName })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean(),
    ]);

    return {
      tonPrice24hAgo: last24hData[0]?.priceTon ?? null,
      priceTon: currentPriceData[0]?.priceTon ?? null,
      priceUsd: currentPriceData[0]?.priceUsd ?? null,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to fetch price data for ${giftName}: ${error.message}`
    );
  }
};

// Fetch and enrich gifts list
const getGiftsList = async () => {
  try {
    const gifts = await GiftModel.find().lean();
    const enrichedGifts = await Promise.all(
      gifts.map(async (gift) => ({
        ...gift,
        ...(await getGiftPriceData(gift.name)),
      }))
    );
    return enrichedGifts;
  } catch (error: any) {
    throw new Error(`Failed to fetch gifts list: ${error.message}`);
  }
};

// Sanitize HTML characters
const sanitizeHtml = (text: string) =>
  text.replace(
    /[<>&]/g,
    (char: string) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char] as string)
  );

// Initialize Telegram bot
export const initializeBot = async (botToken: string) => {
  if (!botToken) {
    throw new Error(
      "Bot token must be provided. Ensure TELEGRAM_BOT_TOKEN is set in environment variables."
    );
  }
  if (botToken.split(":").length !== 2) {
    throw new Error("Invalid Telegram bot token format: must contain a colon");
  }

  const bot = new Telegraf(botToken);

  // Set webhook
  const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot`;
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }); // Clear any existing webhook
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Webhook set to ${webhookUrl}`);
  } catch (err) {
    console.error("Error setting webhook:", err);
    throw err;
  }

  // Register commands
  try {
    await bot.telegram.setMyCommands([
      { command: "start", description: "Start the bot" },
      { command: "stats", description: "Get top gifts by 24h changes" },
    ]);
    console.log("Commands registered with Telegram");
  } catch (err) {
    console.error("Error registering commands:", err);
  }

  // Global error handler
  bot.on("error" as any, (err) => {
    console.error("Global bot error:", err);
  });

  // /start command
  bot.start(async (ctx) => {
    try {
      console.log(`Received /start from user ${ctx.chat.id}`);
      await ctx.replyWithHTML(
        `<b>Welcome to Gift Charts!</b>\n\n📊 The best Mini App with charts and other tools for Telegram NFT Gifts\n\nOfficial Channel: @gift_charts\n\nUse /stats to get top gifts by 24h changes\n\n`,
        Markup.inlineKeyboard([
          Markup.button.url(
            "Open Mini App",
            "https://t.me/gift_charts_bot?startapp=launch"
          ),
        ])
      );
    } catch (error: any) {
      if (error.response?.error_code === 403) {
        console.warn(`Skipped: Bot was blocked by user ${ctx.chat.id}`);
      } else {
        console.error("Error in /start command:", error);
      }
    }
  });

  bot.command("stats", async (ctx) => {
    try {
      const gifts = await getGiftsList();

      if (!gifts.length) {
        return await ctx.replyWithHTML(
          "No gifts found. Please wait for data to be updated."
        );
      }

      const { gainers, losers } = getTopMovers(gifts);

      const formatItem = (g: any) => {
        const name = sanitizeHtml(g.name);
        const pct =
          g.change >= 0
            ? `+${g.change.toFixed(2)}%`
            : `${g.change.toFixed(2)}%`;
        return `<b>${name}</b> ${pct}`;
      };

      const msg =
        `<b>📈 Top 5 Gainers (24h):</b>\n\n` +
        gainers.map(formatItem).join("\n") +
        `\n\n<b>📉 Top 5 Losers (24h):</b>\n\n` +
        losers.map(formatItem).join("\n");

      await ctx.replyWithHTML(msg);
    } catch (error) {
      console.error("Error in /stats command:", error);
      try {
        await ctx.replyWithHTML(
          "Failed to fetch stats. Please try again later."
        );
      } catch (err: any) {
        if (err.response?.error_code === 403) {
          console.warn(`Skipped: Bot was blocked by user ${ctx.chat.id}`);
        } else {
          console.error("Error sending fallback /stats message:", err);
        }
      }
    }
  });

  return bot;
};
