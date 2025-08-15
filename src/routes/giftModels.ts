import express from 'express'
import { GiftModelsModel } from '../models/Models';

const router = express.Router();

// router.post('/', async (req, res) => {
//     const {giftId, models} = req.body;

//     try {
//         const newGiftModels = new GiftModelsModel({
//             giftId,
//             models
//         })

//         await newGiftModels.save()
//         res.json(newGiftModels)
//     } catch (error) {
//         res.status(500).json(error)
//     }
// })

router.get('/:giftId', async (req, res) => {
    const {giftId} = req.params
    try {
        const giftModels = await GiftModelsModel.find({giftId})

        res.json(giftModels)
    } catch (error) {
        res.status(500).json(error)
    }
})

export { router as GiftModelsRouter };  