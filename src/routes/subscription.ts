import express from 'express';
import { SubscriptionModel } from '../models/Subscription';

const router = express.Router();

router.get('/check-subscription/:walletId', async (req, res) => {
    const {walletId} = req.params

    try {
        
        const subscription = await SubscriptionModel.findOne({walletId})

        if (subscription) {
            res.json(subscription)
        } else {
            return res.status(404).json({ 
                message: 'No subscription found' 
            });
        }

    } catch (error) {
        res.status(500).json({ error })
    }
})

router.post('/subscribe', async (req, res) => {
    const {walletId} = req.body;

    try {

        const subscription = await SubscriptionModel.findOne({walletId})

        if (subscription) {
            res.status(400).json({
                message: 'already subscribed'
            })
        } else {
            const newSubscription = new SubscriptionModel({
                walletId
            })

            await newSubscription.save()

            res.status(201).json(newSubscription)
        }
        
    } catch (error) {
        res.status(500).json({ error })
    }
})




export { router as SubscriptionRouter };  