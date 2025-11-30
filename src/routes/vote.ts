import express from "express";
import {
  requireAuth,
  AuthRequest,
  softAuth,
} from "../middleware/authMiddleware";
import { VoteModel } from "../models/Vote";

const router = express.Router();

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { score, poll } = req.body;
    if (typeof score !== "number" || !poll) {
      return res
        .status(400)
        .json({ message: "Score (number) and poll (string) are required" });
    }

    const vote = new VoteModel({
      userId: req.user!.id,
      score,
      poll,
    });

    await vote.save();
    return res.status(201).json({ message: "Vote created successfully", vote });
  } catch (error: any) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "User has already voted in this poll" });
    }
    console.error("Error creating vote:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

router.get("/:pollId", softAuth, async (req: AuthRequest, res) => {
  const { pollId } = req.params;

  try {
    let userVote: number | null = null;

    if (req.user?.id) {
      const userVoteDoc = await VoteModel.findOne({
        poll: pollId,
        userId: req.user.id,
      });

      userVote = userVoteDoc ? userVoteDoc.score : null;
    }

    // Aggregate stats
    const stats = await VoteModel.aggregate([
      { $match: { poll: pollId } },
      {
        $group: {
          _id: "$score",
          count: { $sum: 1 },
          avgScore: { $avg: "$score" },
        },
      },
    ]);

    const totalVotes = stats.reduce((sum, s) => sum + s.count, 0);
    const avgScore = totalVotes
      ? stats.reduce((sum, s) => sum + s.avgScore * s.count, 0) / totalVotes
      : 0;

    const scoreCounts: Record<string, number> = {};
    stats.forEach((s) => (scoreCounts[s._id] = s.count));

    return res.status(200).json({
      poll: pollId,
      totalVotes,
      userVote,
      isAuthenticated: Boolean(req.user),
      avgScore,
      scoreCounts,
    });
  } catch (error: any) {
    console.error("Error fetching poll stats:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

export { router as VoteRouter };
