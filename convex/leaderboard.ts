import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  LEADERBOARD_SIZE,
  cleanLeaderboardName,
  computeRankKey,
  isLeaderboardOn,
  rankSortedKeys,
} from "./leaderboardRules";

/** Preview runs use "demo_" session IDs and never go on the board. */
const isDemoSession = (sessionId: string) => sessionId.startsWith("demo_");

type FinishedRun = {
  score: number;
  total: number;
  durationMs: number;
};

/** The server-calculated score for a finished public session, if any. */
async function getFinishedRun(
  ctx: QueryCtx,
  quizId: Id<"quiz">,
  sessionId: string,
): Promise<FinishedRun | null> {
  if (isDemoSession(sessionId)) return null;
  const session = await ctx.db
    .query("quizSessions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .first();
  if (!session || session.quizId !== quizId) return null;
  const result = await ctx.db
    .query("quizResults")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .order("desc")
    .first();
  if (
    !result ||
    result.quizId !== quizId ||
    typeof result.knowledgeScore !== "number" ||
    typeof result.knowledgeTotal !== "number" ||
    result.knowledgeTotal <= 0
  ) {
    return null;
  }
  return {
    score: result.knowledgeScore,
    total: result.knowledgeTotal,
    durationMs: Math.max(0, result.completedAt - session.startedAt),
  };
}

type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  total: number;
  durationMs: number;
  isYou: boolean;
};

const toRow = (
  entry: Doc<"leaderboardEntries">,
  rank: number,
  sessionId: string | undefined,
): LeaderboardRow => ({
  rank,
  name: entry.name,
  score: entry.score,
  total: entry.total,
  durationMs: entry.durationMs,
  isYou: sessionId !== undefined && entry.sessionId === sessionId,
});

export const getLeaderboard = query({
  args: { quizId: v.id("quiz"), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || !isLeaderboardOn(quiz)) {
      return { enabled: false as const };
    }

    const top = await ctx.db
      .query("leaderboardEntries")
      .withIndex("by_quizId_rankKey", (q) => q.eq("quizId", args.quizId))
      .order("desc")
      .take(LEADERBOARD_SIZE);
    const ranks = rankSortedKeys(top.map((entry) => entry.rankKey));
    const entries = top.map((entry, index) =>
      toRow(entry, ranks[index]!, args.sessionId),
    );

    let you: LeaderboardRow | null = null;
    let finishedRun: FinishedRun | null = null;
    if (args.sessionId) {
      const sessionId = args.sessionId;
      const mine = await ctx.db
        .query("leaderboardEntries")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .first();
      if (mine && mine.quizId === args.quizId) {
        const better = await ctx.db
          .query("leaderboardEntries")
          .withIndex("by_quizId_rankKey", (q) =>
            q.eq("quizId", args.quizId).gt("rankKey", mine.rankKey),
          )
          .collect();
        you = toRow(mine, better.length + 1, sessionId);
      } else {
        finishedRun = await getFinishedRun(ctx, args.quizId, sessionId);
      }
    }

    return {
      enabled: true as const,
      entries,
      you,
      /** Set when this session finished but hasn't joined yet. */
      canJoin: finishedRun,
      isPublished: quiz.status === "published",
    };
  },
});

export const joinLeaderboard = mutation({
  args: { quizId: v.id("quiz"), sessionId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || !isLeaderboardOn(quiz)) {
      throw new ConvexError("This quiz doesn't have a leaderboard.");
    }
    if (quiz.status !== "published") {
      throw new ConvexError("Only published quizzes have a leaderboard.");
    }
    const name = cleanLeaderboardName(args.name);
    if (!name) throw new ConvexError("Enter a name for the leaderboard.");

    const run = await getFinishedRun(ctx, args.quizId, args.sessionId);
    if (!run) {
      throw new ConvexError("Finish the quiz first to join the leaderboard.");
    }

    const existing = await ctx.db
      .query("leaderboardEntries")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      // Joining again only changes the name; the score can't be resubmitted.
      await ctx.db.patch(existing._id, { name });
      return { ok: true };
    }

    await ctx.db.insert("leaderboardEntries", {
      quizId: args.quizId,
      sessionId: args.sessionId,
      name,
      score: run.score,
      total: run.total,
      durationMs: run.durationMs,
      rankKey: computeRankKey(run.score, run.total, run.durationMs),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
