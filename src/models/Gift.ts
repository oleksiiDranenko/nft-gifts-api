import mongoose from "mongoose";

const GiftSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        image: { type: String, required: true},
        supply: { type: Number, required: true },
        initSupply: { type: Number, required: true },
        releaseDate: { type: String, required: true },
        starsPrice: { type: Number, required: true },
        upgradePrice: {type: Number, required: true},
        initTonPrice: { type: Number, required: true },
        initUsdPrice: { type: Number, required: true },
        staked: { type: Boolean, required: false },
        preSale: {type: Boolean, required: false},
        upgradedSupply: { type: Number, required: false },
    },
    { 
        collection: 'gifts',
        versionKey: false
    } 
);

export const GiftModel = mongoose.model('gifts', GiftSchema)