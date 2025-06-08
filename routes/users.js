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

router.patch('/update-account/:telegramId', async (req, res) => {
    const hashedTelegramId = hashValue(req.params.telegramId);
    const { username, savedList, assets, ton, usd } = req.body;

    try {
        const user = await UserModel.findOne({ telegramId: hashedTelegramId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields
        user.username = username || user.username;
        user.savedList = savedList || user.savedList;
        user.assets = assets || user.assets;
        user.ton = ton !== undefined ? ton : user.ton;
        user.usd = usd !== undefined ? usd : user.usd;

        await user.save();

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});




export { router as UserRouter };  