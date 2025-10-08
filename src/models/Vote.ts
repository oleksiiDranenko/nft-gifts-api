import mongoose from "mongoose";

const VoteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    score: { type: Number, required: true },
    poll: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: "2d" },
  },
  {
    collection: "votes",
    versionKey: false,
  }
);

VoteSchema.index({ userId: 1, poll: 1 }, { unique: true });

export const VoteModel = mongoose.model("votes", VoteSchema);
