import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { WeekRouter } from './routes/weekData.js'; 
import { LifeRouter } from './routes/lifeData.js';
import { giftsRouter } from './routes/gifts.js';
import { scheduleNextRun } from './bot/bot.js';


const app = express();

app.use(cors());
app.use(express.json());

app.use('/weekChart', WeekRouter); 
app.use('/lifeChart', LifeRouter);
app.use('/gifts', giftsRouter)

dotenv.config();
const dbConnectionString = process.env.DB_CONNECTION_STRING;


scheduleNextRun();


mongoose.connect(dbConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Successfully connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});




app.listen(process.env.PORT || 3001, () => {
    console.log(`Server is running on port ${process.env.PORT || 3001}`);
});
