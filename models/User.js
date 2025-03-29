import mongoose from "mongoose";

const AssetSchema = new mongoose.Schema({
    giftId: { type: String, required: true },
    amount: { type: Number, required: true }
})

const UserSchema = new mongoose.Schema({
    walletId: { type: String, required: true },
    savedList: { type: [String], required: true },
    assets: { type: [AssetSchema], required: true }
})

export const UserModel = mongoose.model('users', UserSchema)