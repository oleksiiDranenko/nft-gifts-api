import express from 'express'
import { UserModel } from '../models/User.js';
import {hashValue} from '../utils/hash.js'

const router = express.Router();

router.get('/check-account/:telegramId', async (req, res) => {
    const hashedTelegramId = hashValue(req.params.telegramId);

    try {
        const user = await UserModel.findOne({ telegramId: hashedTelegramId });

        if (user) {
            res.json(user);
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        res.json({ message: error });
    }
});

router.post('/create-account', async (req, res) => {
    const hashedTelegramId = hashValue(req.body.telegramId);
    const username = req.body.username; // optional: hashValue(username)

    try {
        const existing = await UserModel.findOne({ telegramId: hashedTelegramId });

        if (existing) {
            return res.json({ message: 'Account already exists' });
        }

        const newUser = new UserModel({
            telegramId: hashedTelegramId,
            username, // consider hashing if needed
            savedList: [],
            assets: [],
            ton: 0,
            usd: 0
        });

        await newUser.save();

        res.json({ message: 'Account created successfully' });
    } catch (error) {
        res.json({ message: 'Server error', error: error.message });
    }
});


router.post('/create-account', async (req, res) => {
    const hashedTelegramId = hashValue(req.body.telegramId);
    const username = req.body.username; // optional: hashValue(username)

    try {
        const existing = await UserModel.findOne({ telegramId: hashedTelegramId });

        if (existing) {
            return res.json({ message: 'Account already exists' });
        }

        const newUser = new UserModel({
            telegramId: hashedTelegramId,
            username, // consider hashing if needed
            savedList: [],
            assets: [],
            ton: 0,
            usd: 0
        });

        await newUser.save();

        res.json({ message: 'Account created successfully' });
    } catch (error) {
        res.json({ message: 'Server error', error: error.message });
    }
});




export { router as UserRouter };  