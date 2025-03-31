import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { WeekRouter } from './routes/weekData.js';
import { LifeRouter } from './routes/lifeData.js';
import { GiftsRouter } from './routes/gifts.js';
import { UserRouter } from './routes/users.js';
import { addData } from './bot/bot.js';

process.removeAllListeners('warning');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/weekChart', WeekRouter);
app.use('/lifeChart', LifeRouter);
app.use('/gifts', GiftsRouter);
app.use('/users', UserRouter);

dotenv.config();
const dbConnectionString = process.env.DB_CONNECTION_STRING;
const port = process.env.PORT || 3001;

process.env.TZ = 'Europe/Berlin';

app.get('/update-data', async (req, res) => {
    console.log('Data update requested');
    try {
        await addData();
        res.status(200).json({ message: 'Data update completed' });
    } catch (error) {
        console.error('Error in /update-data:', error.message);
        res.status(500).json({ message: 'Data update failed', error: error.message });
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