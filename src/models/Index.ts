import mongoose from "mongoose";

const IndexSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        shortName: { type: String, required: true },
        description: { type: String, required: true },
        valueType: {type: String, required: true}
    },
    {versionKey: false}
);

export const IndexModel = mongoose.model('indexes', IndexSchema)