import { Telegraf, Markup } from 'telegraf';
import {GiftModel} from '../models/Gift.js'; 
import {WeekChartModel} from '../models/WeekChart.js';

const getGiftsList = async () => {
    try {
        const giftsList = await GiftModel.find();
        const finalGiftsList = [];

        for (let gift of giftsList) {
            const last24hData = await WeekChartModel.find({ name: gift.name })
                .sort({ createdAt: -1 })
                .skip(23)
                .limit(1)
                .lean();

            const currentPrice = await WeekChartModel.find({ name: gift.name })
                .sort({ createdAt: -1 })
                .limit(1)
                .lean();

            finalGiftsList.push({
                ...gift.toObject(),
                tonPrice24hAgo: last24hData.length ? last24hData[0].priceTon : null,
                priceTon: currentPrice.length ? currentPrice[0].priceTon : null,
                priceUsd: currentPrice.length ? currentPrice[0].priceUsd : null
            });
        }

        return finalGiftsList;
    } catch (error) {
        throw new Error(`Failed to fetch gifts list: ${error.message}`);
    }
};

const initializeBot = (botToken) => {
    const bot = new Telegraf(botToken);

    // Handle /start command
    bot.start((ctx) => {
        ctx.replyWithHTML(
            `<b>Welcome to Gift Charts!</b>\n\n📊 The best Mini App with charts and other tools for Telegram NFT Gifts\n\nOfficial Channel: @gift_charts\n\nUse /list to get a list of 24h changes\n\n`,
            Markup.inlineKeyboard([
                Markup.button.url('Open Mini App', 'https://t.me/gift_charts_bot?startapp=launch')
            ])
        );
    });

    // Handle /gifts command
    bot.command('list', async (ctx) => {
        try {
            const giftsList = await getGiftsList();
            if (!giftsList?.length) {
                return ctx.replyWithHTML('No gifts found.');
            }

            // Sort by absolute percentage change (descending)
            giftsList.sort((a, b) => {
                const aChange = (a.priceTon && a.tonPrice24hAgo && a.tonPrice24hAgo !== 0)
                    ? Math.abs((a.priceTon - a.tonPrice24hAgo) / a.tonPrice24hAgo * 100)
                    : -Infinity;
                const bChange = (b.priceTon && b.tonPrice24hAgo && b.tonPrice24hAgo !== 0)
                    ? Math.abs((b.priceTon - b.tonPrice24hAgo) / b.tonPrice24hAgo * 100)
                    : -Infinity;
                return bChange - aChange;
            });

            // Build messages
            const messages = [];
            let currentMessage = '';

            for (const gift of giftsList) {
                // Escape special characters in gift name
                const giftName = gift.name.replace(/[<>&]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char]);

                // Calculate percentage change and emoji
                let percentageChange = 'N/A';
                let emoji = '🟢';
                if (gift.priceTon && gift.tonPrice24hAgo && gift.tonPrice24hAgo !== 0) {
                    const change = ((gift.priceTon - gift.tonPrice24hAgo) / gift.tonPrice24hAgo) * 100;
                    percentageChange = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
                    emoji = change >= 0 ? '🟢' : '🔴';
                }

                // Format gift line
                const giftLine = `${emoji} <b>${giftName}</b> ${percentageChange}\n`;

                // Handle Telegram's 4096-character limit
                if (currentMessage.length + giftLine.length > 4000) {
                    messages.push(currentMessage);
                    currentMessage = giftLine;
                } else {
                    currentMessage += giftLine;
                }
            }

            // Add final message
            if (currentMessage) {
                messages.push(currentMessage);
            }

            // Send messages
            for (const message of messages) {
                await ctx.replyWithHTML(message);
            }
        } catch (error) {
            console.error('Error in /list command:', error);
            await ctx.replyWithHTML('Failed to fetch gifts. Please try again later.');
    }
});


    // Debug: Log all incoming messages to confirm command receipt
    bot.on('text', (ctx) => {
        console.log(`Received message: ${ctx.message.text}`);
    });

    // Launch the bot
    bot.launch()
        .then(() => console.log('Telegram bot started'))
        .catch((err) => console.error('Error starting Telegram bot:', err));

    // Enable graceful stop for the bot
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
};

export { initializeBot };