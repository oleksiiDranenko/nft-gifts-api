import express from 'express'
import { UserModel } from '../models/User.js';

const router = express.Router();

router.get('/check-account/:telegramId', async (req, res) => {
    
    const { telegramId } = req.params;

    try {

        const user = await UserModel.findOne({ telegramId })
        
        if (user) {
            res.json(user)
        } else {
            res.json({
                exists: false
            })
        }

    } catch (error) {
        res.json({
            message: error
        })
    }
})

router.post('/create-account', async (req, res) => {
    const { telegramId, username } = req.body;

    try {
        const user = await UserModel.findOne({ telegramId });

        if (user) {
            return res.json({ message: 'Account for this wallet already exists' });
        }

        const newUser = new UserModel({
            telegramId,
            username,
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
    const { telegramId } = req.params;
    const { username, savedList, assets, ton, usd } = req.body;

    try {
        const updatedUser = await UserModel.findOneAndUpdate(
            { telegramId },
            { $set: { username, savedList, assets, ton, usd } },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Account updated successfully', user: updatedUser });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});



export { router as UserRouter };  