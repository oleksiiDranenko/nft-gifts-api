import express from 'express';
import { UserModel } from '../models/User';
import { hashValue } from '../utils/hash';

const router = express.Router();

router.get('/check-account/:telegramId', async (req, res) => {
    const hashedTelegramId = hashValue(req.params.telegramId);

    try {
        const user = await UserModel.findOne({ telegramId: hashedTelegramId });

        if (user) {
            // Convert Mongoose document to plain object and include unhashed telegramId
            const userObj = user.toObject();
            return res.status(200).json({ ...userObj, telegramId: req.params.telegramId });
        }
        return res.status(200).json({ exists: false });
    } catch (error: any) {
        console.error('Error checking account:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/create-account', async (req, res) => {
    const hashedTelegramId = hashValue(req.body.telegramId);
    const { username } = req.body;

    try {
        const existing = await UserModel.findOne({ telegramId: hashedTelegramId });

        if (existing) {
            return res.status(400).json({ message: 'Account already exists' });
        }

        const newUser = new UserModel({
            telegramId: hashedTelegramId,
            username: username || 'Anonymous',
            savedList: [],
            assets: [],
            ton: 0,
            usd: 0,
        });

        await newUser.save();

        // Convert Mongoose document to plain object and include unhashed telegramId
        const userObj = newUser.toObject();
        return res.status(201).json({ 
            message: 'Account created successfully', 
            user: { ...userObj, telegramId: req.body.telegramId }
        });
    } catch (error: any) {
        console.error('Error creating account:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
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

        user.username = username || user.username;
        user.savedList = savedList || user.savedList;
        user.assets = assets || user.assets;
        user.ton = ton !== undefined ? ton : user.ton;
        user.usd = usd !== undefined ? usd : user.usd;

        await user.save();

        const userObj = user.toObject();
        return res.status(200).json({ 
            message: 'User updated successfully', 
            user: { ...userObj, telegramId: req.params.telegramId }
        });
    } catch (error: any) {
        console.error('Error updating user:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export { router as UserRouter };