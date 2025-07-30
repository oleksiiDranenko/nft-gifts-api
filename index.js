import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initializeBot } from './telegram/bot.js';
import { WeekRouter } from './routes/weekData.js';
import { LifeRouter } from './routes/lifeData.js';
import { GiftsRouter } from './routes/gifts.js';
import { UserRouter } from './routes/users.js';
import { SubscriptionRouter } from './routes/subscription.js';
import { IndexRouter } from './routes/index.js';
import { IndexDataRouter } from './routes/indexData.js';
import { addData, addDailyDataForDate, updateDailyDataForPreviousDay } from './bot/bot.js';
import { migrateTelegramIds } from './utils/migrateUsers.js';


process.removeAllListeners('warning');

const app = express();
const port = process.env.PORT || 3001;

dotenv.config();

app.use(cors());
app.use(express.json());

// Set up routes
app.use('/weekChart', WeekRouter);
app.use('/lifeChart', LifeRouter);
app.use('/gifts', GiftsRouter);
app.use('/users', UserRouter);
app.use('/subscriptions', SubscriptionRouter);
app.use('/indexes', IndexRouter);
app.use('/indexData', IndexDataRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', mongodb: mongoose.connection.readyState });
});

(async () => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Error: TELEGRAM_BOT_TOKEN environment variable is not set. Bot functionality will be disabled.');
      return;
    }
    const bot = await initializeBot(process.env.TELEGRAM_BOT_TOKEN);
    app.post('/bot', bot.webhookCallback('/bot'));
    console.log('Webhook route configured for Telegram bot');
  } catch (err) {
    console.error('Failed to initialize Telegram bot, continuing without bot:', err);
  }
})();

process.env.TZ = 'Europe/London';

cron.schedule('0 0,30 * * * *', async () => {
    console.log('Cron job triggered at:', new Date().toISOString());
    try {
        await addData();
        console.log('Cron job completed successfully');
    } catch (error) {
        console.error('Error in cron job:', error.stack);
    }
});

cron.schedule('0 0 0 * * *', async () => {
    console.log('Daily data update cron job triggered at:', new Date().toISOString());
    try {
        await updateDailyDataForPreviousDay();
        console.log('Daily data update cron job completed successfully');
    } catch (error) {
        console.error('Error in daily data update cron job:', error.stack);
    }
});

app.get('/add-data', async (req, res) => {
  await addData();
  res.json('done')
})

const startServer = async () => {
  try {
    const dbConnectionString = process.env.DB_CONNECTION_STRING;
    if (!dbConnectionString) {
      console.error('Error: DB_CONNECTION_STRING environment variable is not set');
      process.exit(1);
    }

    // addDailyDataForDate('26-07-2025')

    // Retry MongoDB connection
    let retries = 3;
    while (retries > 0) {
      try {
        await mongoose.connect(dbConnectionString, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log('Successfully connected to MongoDB');
        break;
      } catch (err) {
        console.error(`MongoDB connection attempt failed (${retries} retries left):`, err);
        retries--;
        if (retries === 0) {
          console.error('Error connecting to MongoDB after retries:', err);
          process.exit(1);
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
      }
    }

    // Uncomment if you need to migrate Telegram IDs
    // await migrateTelegramIds();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.once('SIGINT', async () => {
  console.log('Stopping server due to SIGINT');
  await mongoose.connection.close();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  console.log('Stopping server due to SIGTERM');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();