import express from 'express';
import { IndexModel } from '../models/Index';
import { IndexDataModel } from '../models/IndexData';


const router = express.Router();

router.get('/get-all/:indexId', async (req, res) => {
    const { indexId } = req.params;
    try {
        const indexExists = await IndexModel.findById(indexId)
        if (!indexExists) {
            return res.status(404).json({ error: `Index ${indexId} not found` })
        }

        const dataList = await IndexDataModel.find({ indexId })
        res.json(dataList);
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
});

export { router as IndexDataRouter };