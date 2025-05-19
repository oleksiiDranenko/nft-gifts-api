import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';
import { WeekRouter } from './routes/weekData.js';
import { LifeRouter } from './routes/lifeData.js';
import { GiftsRouter } from './routes/gifts.js';
import { UserRouter } from './routes/users.js';
import { SubscriptionRouter } from './routes/subscription.js';
import { IndexRouter } from './routes/index.js';
import { addIndexData, IndexDataRouter } from './routes/indexData.js';
import { addData } from './bot/bot.js';

process.removeAllListeners('warning');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/weekChart', WeekRouter);
app.use('/lifeChart', LifeRouter);
app.use('/gifts', GiftsRouter);
app.use('/users', UserRouter);
app.use('/subscriptions', SubscriptionRouter);
app.use('/indexes', IndexRouter);
app.use('/indexData', IndexDataRouter);

// Load environment variables
dotenv.config();
const dbConnectionString = process.env.DB_CONNECTION_STRING;
const port = process.env.PORT || 3001;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

// Set timezone
process.env.TZ = 'Europe/London';

// Initialize Telegram Bot
let bot;
if (telegramToken) {
    bot = new TelegramBot(telegramToken, { polling: true });
    console.log('Telegram bot initialized');

    // Handle /start command
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const welcomeMessage = 'Welcome to Gift Charts! 📊 Explore the mini app to view Telegram NFT Gift charts and other tools!';
        
        // Inline button to open the mini app
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Open Gift Charts Mini App',
                            web_app: { url: 'https://gift-charts.vercel.app/' } // Replace with your mini app URL
                        }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, welcomeMessage, opts)
            .then(() => console.log(`Sent welcome message to chat ${chatId}`))
            .catch((error) => console.error(`Error sending message to chat ${chatId}:`, error));
    });

    // Log any bot errors
    bot.on('polling_error', (error) => {
        console.error('Telegram bot polling error:', error.stack);
    });
} else {
    console.warn('TELEGRAM_BOT_TOKEN not found in .env. Telegram bot will not be initialized.');
}

// Update data endpoint
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

// Cron job for periodic data updates
cron.schedule('0 * * * *', async () => {
    console.log('Cron job triggered at:', new Date().toISOString());
    try {
        await addData();
        console.log('Cron job completed successfully');
    } catch (error) {
        console.error('Error in cron job:', error.stack);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', mongodb: mongoose.connection.readyState });
});

// Start server and connect to MongoDB
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

startServer();