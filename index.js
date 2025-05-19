import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { Telegraf, Markup } from 'telegraf';
import { WeekRouter } from './routes/weekData.js';
import { LifeRouter } from './routes/lifeData.js';
import { GiftsRouter } from './routes/gifts.js';
import { UserRouter } from './routes/users.js';
import { SubscriptionRouter } from './routes/subscription.js';
import { IndexRouter } from './routes/index.js';
import { IndexDataRouter } from './routes/indexData.js';
import { addData } from './bot/bot.js';

process.removeAllListeners('warning');

const app = express();

dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Handle /start command with HTML formatting
bot.start((ctx) => {
    ctx.replyWithHTML(
        `<b>Welcome to Gift Charts!</b>\n\n📊 The best Mini App with charts and other tools for Telegram NFT Gifts\n\nOfficial Channel: @gift_charts`,
        Markup.inlineKeyboard([
            Markup.button.url('Open Mini App', 'https://gift-charts.vercel.app/')
        ])
    );
});

// Launch the bot
bot.launch()
    .then(() => console.log('Telegram bot started'))
    .catch((err) => console.error('Error starting Telegram bot:', err));

// Enable graceful stop for the bot
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.use(cors());
app.use(express.json());

app.use('/weekChart', WeekRouter);
app.use('/lifeChart', LifeRouter);
app.use('/gifts', GiftsRouter);
app.use('/users', UserRouter);
app.use('/subscriptions', SubscriptionRouter);
app.use('/indexes', IndexRouter);
app.use('/indexData', IndexDataRouter);

const dbConnectionString = process.env.DB_CONNECTION_STRING;
const port = process.env.PORT || 3001;

process.env.TZ = 'Europe/London';

app.get('/update-data', async (req, res) => {
    console.log('Data update requested at:', new Date().toISOString());
    try {
        await addData();
        console.log('Data update succeeded');
        res.status(200).json({ message: 'Data update completed' });
    } catch (error) {
        console.error('Error in /update-data:', error.stack);
        res.status(500).json({ message: 'Data update failed', error: error.message, stack: error.stack });
    }
});

cron.schedule('0 * * * *', async () => {
    console.log('Cron job triggered at:', new Date().toISOString());
    try {
        await addData();
        console.log('Cron job completed successfully');
    } catch (error) {
        console.error('Error in cron job:', error.stack);
    }
});

const startServer = async () => {
    try {
        await mongoose.connect(dbConnectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Successfully connected to MongoDB');

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }
};

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', mongodb: mongoose.connection.readyState });
});

startServer();