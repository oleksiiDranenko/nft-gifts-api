import { Telegraf, Markup } from 'telegraf';
import { GiftModel } from '../models/Gift.js';
import { WeekChartModel } from '../models/WeekChart.js';

// Utility: Sanitize gift names for Telegram HTML
const sanitizeHtml = (text) =>
    text.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]));

// Get gift price data (current + 24h ago)
const getGiftPriceData = async (giftName) => {
    const [last24hData, currentPriceData] = await Promise.all([
        WeekChartModel.find({ name: giftName }).sort({ createdAt: -1 }).skip(23).limit(1).lean(),
        WeekChartModel.find({ name: giftName }).sort({ createdAt: -1 }).limit(1).lean(),
    ]);

    return {
        tonPrice24hAgo: last24hData[0]?.priceTon ?? null,
        priceTon: currentPriceData[0]?.priceTon ?? null,
        priceUsd: currentPriceData[0]?.priceUsd ?? null,
    };
};

// Fetch and enrich gift list with price data
const getGiftsList = async () => {
    try {
        const gifts = await GiftModel.find();
        const enrichedGifts = [];

        for (const gift of gifts) {
            const priceData = await getGiftPriceData(gift.name);
            enrichedGifts.push({
                ...gift.toObject(),
                ...priceData,
            });
        }

        return enrichedGifts;
    } catch (error) {
        throw new Error(`Failed to fetch gifts list: ${error.message}`);
    }
};

// Format gift info into a Telegram message
const formatGiftsMessage = (gifts) => {
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
        const name = sanitizeHtml(gift.name);
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
};

// Initialize Telegram bot
const initializeBot = (botToken) => {
    const bot = new Telegraf(botToken);

    // /start command
    bot.start((ctx) => {
        ctx.replyWithHTML(
            `<b>Welcome to Gift Charts!</b>\n\n📊 The best Mini App with charts and other tools for Telegram NFT Gifts\n\nOfficial Channel: @gift_charts\n\nUse /list to get a list of 24h changes\n\n`,
            Markup.inlineKeyboard([
                Markup.button.url('Open Mini App', 'https://t.me/gift_charts_bot?startapp=launch'),
            ])
        );
    });

    // /list command
    bot.command('list', async (ctx) => {
        try {
            const gifts = await getGiftsList();
            if (!gifts.length) return ctx.replyWithHTML('No gifts found.');

            const messages = formatGiftsMessage(gifts);
            for (const message of messages) {
                await ctx.replyWithHTML(message);
            }
        } catch (error) {
            console.error('Error in /list command:', error);
            await ctx.replyWithHTML('Failed to fetch gifts. Please try again later.');
        }
    });

    // Log all incoming messages
    bot.on('text', (ctx) => {
        console.log(`Received message: ${ctx.message.text}`);
    });

    // Launch the bot
    bot.launch()
        .then(() => console.log('Telegram bot started'))
        .catch((err) => console.error('Error starting Telegram bot:', err));

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
};

export { initializeBot };
