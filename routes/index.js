import express from 'express'
import { IndexModel } from '../models/Index.js'

const router = express.Router()


// GET

router.get('/get-all', async (req, res) => {
    try {

        const indexArray = await IndexModel.find()

        res.json(indexArray)

    } catch (error) {
        res.json(error)
    }
})

router.get('/get-one/:indexId', async (req, res) => {

    const {indexId} = req.params

    try {

        const index = await IndexModel.findById(indexId)

        if(!index) {
            return res.status(404).json({
                message: "Index not found"
            })
        }

        res.json(index)

    } catch (error) {
        res.status(500).json(error)
    }
})


// POST

router.post('/add-index', async (req, res) => {
    const { name, shortName, description, image } = req.body

    try {
        
        const index = await IndexModel.findOne({shortName})

        if(index) {
            return res.json({
                message: 'This index already exists'
            })
        }

        const newIndex = new IndexModel({
            name,
            shortName,
            description,
            image
        })

        await newIndex.save()

        res.json(newIndex)

    } catch (error) {
        res.status(500).json(error)
    }
})

export { router as IndexRouter }; 