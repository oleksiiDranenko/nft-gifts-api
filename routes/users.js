import express from 'express'
import { UserModel } from '../models/User.js';

const router = express.Router();

router.get('/check-account/:walletId', async (req, res) => {
    
    const { walletId } = req.params;

    try {

        const user = await UserModel.findOne({ walletId: walletId })
        
        if (user) {
            res.json({
                exists: true
            })
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
    const { walletId } = req.body;

    try {
        const user = await UserModel.findOne({ walletId: walletId });

        if (user) {
            return res.json({ message: 'Account for this wallet already exists' });
        }

        const newUser = new UserModel({
            walletId,
            savedList: [],
            assets: []
        });

        await newUser.save();

        res.json({ message: 'Account created successfully' });

    } catch (error) {
        res.json({ message: 'Server error', error: error.message });
    }
});

router.patch('/update-account/:walletId', async (req, res) => {
    const { walletId } = req.params;
    const { savedList, assets } = req.body;

    try {
        const updatedUser = await UserModel.findOneAndUpdate(
            { walletId },
            { $set: { savedList, assets } },
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