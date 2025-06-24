import mongoose from "mongoose";

const AssetSchema = new mongoose.Schema({
    giftId: { type: String, required: true },
    amount: { type: Number, required: true },
    avgPrice: { type: Number, required: true }
})

const UserSchema = new mongoose.Schema({
    telegramId: { type: String, required: true },
    username: { type: String, required: true },
    savedList: { type: [String], required: true },
    assets: { type: [AssetSchema], required: true },
    ton: { type: Number, required: true },
    usd: { type: Number, required: true }
})

export const UserModel = mongoose.model('users', UserSchema)