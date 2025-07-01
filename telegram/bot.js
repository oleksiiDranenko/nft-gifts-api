import mongoose from 'mongoose';
import { Telegraf, Markup } from 'telegraf';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';

// Gift Data Provider Interface
class GiftDataProvider {
  async getGiftsList() {
    throw new Error('Method getGiftsList must be implemented');
  }

  async getGiftPriceData(giftName) {
    throw new Error('Method getGiftPriceData must be implemented');
  }
}

// MongoDB-based Gift Data Provider
class MongoGiftDataProvider extends GiftDataProvider {
  #GiftModel;
  #WeekChartModel;

  constructor() {
    super();
    this.#GiftModel = GiftModel;
    this.#WeekChartModel = WeekChartModel;

    if (!this.#GiftModel || !this.#WeekChartModel) {
      throw new Error('GiftModel and WeekChartModel must be provided');
    }
  }

  async getGiftPriceData(giftName) {
    try {
      const [last24hData, currentPriceData] = await Promise.all([
        this.#WeekChartModel.find({ name: giftName })
          .sort({ createdAt: -1 })
          .skip(47)
          .limit(1)
          .lean(),
        this.#WeekChartModel.find({ name: giftName })
          .sort({ createdAt: -1 })
          .limit(1)
          .lean(),
      ]);

      return {
        tonPrice24hAgo: last24hData[0]?.priceTon ?? null,
        priceTon: currentPriceData[0]?.priceTon ?? null,
        priceUsd: currentPriceData[0]?.priceUsd ?? null,
      };
    } catch (error) {
      throw new Error(`Failed to fetch price data for ${giftName}: ${error.message}`);
    }
  }

  async getGiftsList() {
    try {
      const gifts = await this.#GiftModel.find();
      const enrichedGifts = [];

      for (const gift of gifts) {
        const priceData = await this.getGiftPriceData(gift.name);
        enrichedGifts.push({
          ...gift.toObject(),
          ...priceData,
        });
      }

      return enrichedGifts;
    } catch (error) {
      throw new Error(`Failed to fetch gifts list: ${error.message}`);
    }
  }
}

// Telegram Message Formatter
class TelegramMessageFormatter {
  #sanitizeHtml;

  constructor(sanitizeHtmlFn = (text) =>
    text.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))
  ) {
    this.#sanitizeHtml = sanitizeHtmlFn;
  }

  formatGiftsMessage(gifts) {
    const sorted = [...gifts].sort((a, b) => {
      const changeA = a.tonPrice24hAgo
        ? Math.abs((a.priceTon - a.tonPrice24hAgo) / a.tonPrice24hAgo * 100)
        : -Infinity;
      const changeB = b.tonPrice24hAgo
        ? Math.abs((b.priceTon - b.tonPrice24hAgo) / b.tonPrice24hAgo * 100)
        : -Infinity;
      return changeB - changeA;
    });

    const messages = [];
    let currentMsg = '';

    for (const gift of sorted) {
      const name = this.#sanitizeHtml(gift.name);
      let percentageChange = 'N/A';
      let emoji = '🟢';

      if (gift.priceTon && gift.tonPrice24hAgo && gift.tonPrice24hAgo !== 0) {
        const change = ((gift.priceTon - gift.tonPrice24hAgo) / gift.tonPrice24hAgo) * 100;
        percentageChange = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
        emoji = change >= 0 ? '🟢' : '🔴';
      }

      const line = `${emoji} <b>${name}</b> ${percentageChange}\n`;

      if (currentMsg.length + line.length > 4000) {
        messages.push(currentMsg);
        currentMsg = line;
      } else {
        currentMsg += line;
      }
    }

    if (currentMsg) messages.push(currentMsg);
    return messages;
  }
}

// Bot Service
class BotService {
  #bot;
  #giftDataProvider;
  #messageFormatter;

  constructor(botToken) {
    if (!botToken) {
      throw new Error('Bot token must be provided');
    }
    if (botToken.split(':').length !== 2) {
      throw new Error('Invalid Telegram bot token format: must contain a colon');
    }
    this.#bot = new Telegraf(botToken);
    this.#giftDataProvider = new MongoGiftDataProvider();
    this.#messageFormatter = new TelegramMessageFormatter();
  }

  getBot() {
    return this.#bot;
  }

  async initialize() {
    // Clear any existing webhook to ensure polling
    try {
      await this.#bot.telegram.deleteWebhook();
      console.log('Webhook removed, using polling');
    } catch (err) {
      console.error('Error removing webhook:', err);
    }

    // Register commands with Telegram
    try {
      await this.#bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'list', description: 'Get a list of 24h changes' },
      ]);
      console.log('Commands registered with Telegram');
    } catch (err) {
      console.error('Error registering commands:', err);
    }

    // Global error handler
    this.#bot.on('error', (err) => {
      console.error('Global bot error:', err);
    });

    // /start command
    this.#bot.start(async (ctx) => {
      try {
        console.log(`Received /start from user ${ctx.chat.id}`);
        await ctx.replyWithHTML(
          `<b>Welcome to Gift Charts!</b>\n\n📊 The best Mini App with charts and other tools for Telegram NFT Gifts\n\nOfficial Channel: @gift_charts\n\nUse /list to get a list of 24h changes\n\n`,
          Markup.inlineKeyboard([
            Markup.button.url('Open Mini App', 'https://t.me/gift_charts_bot?startapp=launch'),
          ])
        );
      } catch (error) {
        if (error.response?.error_code === 403) {
          console.warn(`Skipped: Bot was blocked by user ${ctx.chat.id}`);
        } else {
          console.error('Error in /start command:', error);
        }
      }
    });

    // /list command
    this.#bot.command('list', async (ctx) => {
      try {
        console.log(`Received /list from user ${ctx.chat.id}`);
        const gifts = await this.#giftDataProvider.getGiftsList();
        if (!gifts.length) {
          return await ctx.replyWithHTML('No gifts found. Please wait for data to be updated.');
        }

        const messages = this.#messageFormatter.formatGiftsMessage(gifts);
        for (const message of messages) {
          try {
            await ctx.replyWithHTML(message);
          } catch (error) {
            if (error.response?.error_code === 403) {
              console.warn(`Skipped: Bot was blocked by user ${ctx.chat.id}`);
            } else {
              console.error('Error sending /list message:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error in /list command:', error);
        try {
          await ctx.replyWithHTML('Failed to fetch gifts. Please try again later.');
        } catch (err) {
          if (err.response?.error_code === 403) {
            console.warn(`Skipped: Bot was blocked by user ${ctx.chat.id}`);
          } else {
            console.error('Error replying with fallback /list message:', err);
          }
        }
      }
    });

    // Start the bot
    try {
      await this.#bot.launch();
      console.log('Telegram bot started');
    } catch (err) {
      console.error('Error starting Telegram bot:', err);
      throw err;
    }

    // Handle graceful shutdown
    process.once('SIGINT', () => {
      console.log('Stopping bot due to SIGINT');
      this.#bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      console.log('Stopping bot due to SIGTERM');
      this.#bot.stop('SIGTERM');
    });
  }
}

// Initialize Bot Function
export const initializeBot = async (botToken) => {
  if (!botToken) {
    throw new Error('Bot token must be provided');
  }
  if (botToken.split(':').length !== 2) {
    throw new Error('Invalid Telegram bot token format: must contain a colon');
  }
  const botService = new BotService(botToken);
  await botService.initialize();
  return botService.getBot();
};