import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id, Doc } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_PREFIX = "demo_";
const RESULT_FALLBACK_NAMES = [
  "Fox",
  "Cat",
  "Owl",
  "Bee",
  "Wolf",
  "Dolphin",
  "Tiger",
  "Rabbit",
];

const TRAIT_FALLBACK_NAMES = [
  "Social",
  "Conventional",
  "Investigative",
  "Realistic",
  "Enterprising",
  "Artistic",
];

function floorToIntervalUtc(ts: number, intervalMs: number): number {
  return Math.floor(ts / intervalMs) * intervalMs;
}

function floorToDayUtc(ts: number): number {
  return Math.floor(ts / DAY_MS) * DAY_MS;
}

async function requireAdminActorId(ctx: {
  db: any;
  auth: any;
}): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Unauthorized");
  const me = await ctx.db.get(userId);
  if (me?.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return userId;
}

async function requireAuthUserId(ctx: {
  db: any;
  auth: any;
}): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

async function actorIsAdmin(
  ctx: { db: any },
  actorId: Id<"users">,
): Promise<boolean> {
  const me = await ctx.db.get(actorId);
  return me?.role === "admin";
}

/** Creator analytics: all quizzes for admins, only own quizzes for designers. */
async function listQuizzesForCreatorAnalytics(
  ctx: { db: any },
  actorId: Id<"users">,
): Promise<Doc<"quiz">[]> {
  if (await actorIsAdmin(ctx, actorId)) {
    return await ctx.db.query("quiz").order("desc").collect();
  }
  return await ctx.db
    .query("quiz")
    .withIndex("by_userId", (q: any) => q.eq("userId", actorId))
    .order("desc")
    .collect();
}

async function requireQuizOwnedOrAdmin(
  ctx: { db: any },
  quizId: Id<"quiz">,
  actorId: Id<"users">,
): Promise<Doc<"quiz">> {
  const quiz = await ctx.db.get(quizId);
  if (!quiz) throw new Error("Quiz not found");
  if (quiz.userId === actorId) return quiz;
  if (await actorIsAdmin(ctx, actorId)) return quiz;
  throw new Error("Unauthorized");
}

async function listAdminQuizzes(ctx: { db: any }): Promise<Doc<"quiz">[]> {
  return await ctx.db.query("quiz").order("desc").collect();
}

async function requireQuizExists(
  ctx: { db: any },
  quizId: Id<"quiz">,
): Promise<Doc<"quiz">> {
  const quiz = await ctx.db.get(quizId);
  if (!quiz) throw new Error("Quiz not found");
  return quiz;
}

function inRangeInclusive(
  ts: number | undefined | null,
  startMs: number,
  endMs: number,
): boolean {
  if (typeof ts !== "number") return false;
  return ts >= startMs && ts <= endMs;
}

function isDemoSession(sessionId: string): boolean {
  return sessionId.startsWith(DEMO_PREFIX);
}

function readQuizVersion(row: { quizVersion?: unknown }): number {
  return typeof row.quizVersion === "number" && Number.isFinite(row.quizVersion)
    ? row.quizVersion
    : 0;
}

function matchesQuizVersion(
  row: { quizVersion?: unknown },
  quizVersion: number | undefined,
): boolean {
  return quizVersion === undefined || readQuizVersion(row) === quizVersion;
}

/** Admin KPIs ignore demo-seeded sessions/events (sessionId prefix demo_). */
async function adminQuizEventsInRange(
  ctx: { db: any },
  kind:
    | "view"
    | "start"
    | "complete"
    | "answer"
    | "cta_click"
    | "result_page_view"
    | "quiz_create",
  startMs: number,
  endMs: number,
): Promise<Array<Record<string, unknown>>> {
  const rows = await ctx.db
    .query("quizEvents")
    .withIndex("by_type_ts", (q: any) =>
      q.eq("type", kind).gte("ts", startMs).lte("ts", endMs),
    )
    .collect();
  return rows.filter(
    (e: any) =>
      !(typeof e.sessionId === "string" && isDemoSession(e.sessionId)),
  );
}

function adminSessionsOnly(sessions: any[]): any[] {
  return sessions.filter(
    (s: any) => typeof s.sessionId === "string" && !isDemoSession(s.sessionId),
  );
}

function isDesignerUser(
  u: { role?: "admin" | "user" } | null | undefined,
): boolean {
  return u != null;
}

function utcDayStartMs(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Monday 00:00 UTC of the ISO week containing ts */
function utcWeekStartMondayMs(ts: number): number {
  const dayStart = utcDayStartMs(ts);
  const dow = new Date(dayStart).getUTCDay(); // 0 Sun .. 6 Sat
  const monOffset = dow === 0 ? -6 : 1 - dow;
  return dayStart + monOffset * DAY_MS;
}

function utcMonthStartMs(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function previousPeriodRange(
  startMs: number,
  endMs: number,
): { startMs: number; endMs: number } | null {
  if (startMs === 0) return null;
  const len = endMs - startMs;
  if (len <= 0) return null;
  return { startMs: startMs - len, endMs: startMs - 1 };
}

function pctChangeVsPrevious(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current > 0 ? 100 : current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatPctLabel(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return "N/A";
  const pct = Math.round(ratio * 1000) / 10;
  return `${pct}%`;
}

function designerDisplayName(u: Doc<"users"> | undefined): string {
  if (!u) return "Unknown Designer";
  const email = typeof u.email === "string" ? u.email.trim() : "";
  const name = typeof u.name === "string" ? u.name.trim() : "";
  const username = typeof u.username === "string" ? u.username.trim() : "";
  if (name) return name;
  if (email) return email;
  if (username && !/^\d+$/.test(username)) return username;
  return "Unknown Designer";
}

function quizDisplayTitle(q: Doc<"quiz">): string {
  const rawCandidates = [
    typeof q.title === "string" ? q.title : "",
    typeof q.brandName === "string" ? q.brandName : "",
    typeof q.topic === "string" ? q.topic : "",
  ];
  for (const raw of rawCandidates) {
    const t = raw.trim();
    if (t.length === 0) continue;
    const lower = t.toLowerCase();
    if (lower === "untitled" || lower === "untitled quiz") continue;
    return t;
  }
  const short = String(q._id).slice(-6);
  return `Untitled Quiz (${short})`;
}

async function computeEngagementMetrics(
  ctx: { db: any },
  startMs: number,
  endMs: number,
): Promise<{
  /** quizEvents type "view" in range (excludes demo sessions). */
  quizViews: number;
  /** Session starts in range = total "plays" (product definition). */
  totalPlayCount: number;
  quizStarts: number;
  quizCompletions: number;
  completionRate: number | null;
  /** SaaS default: 1 − completion rate (complement of completions/starts). */
  dropOffRate: number | null;
  dropOffNaReason: string | null;
  averageTimeSpentPerQuizMs: number | null;
  /** Session starts ÷ unique participants (userId, else sessionId). */
  averageQuizzesPlayedPerUser: number | null;
  avgQuizzesPerUserNaReason: string | null;
  averageQuizzesPlayedPerUserCaption: string | null;
  hasEngagementData: boolean;
}> {
  const viewEvents = await adminQuizEventsInRange(ctx, "view", startMs, endMs);
  const quizViews = viewEvents.length;

  const sessions = adminSessionsOnly(
    await ctx.db.query("quizSessions").collect(),
  );
  let starts = 0;
  let completions = 0;
  let durationSum = 0;
  let durationCount = 0;
  const participantKeys = new Set<string>();

  for (const s of sessions) {
    if (inRangeInclusive(s.startedAt, startMs, endMs)) {
      starts += 1;
      participantKeys.add(
        s.userId ? `u:${String(s.userId)}` : `s:${String(s.sessionId)}`,
      );
    }

    if (
      s.status === "completed" &&
      inRangeInclusive(s.completedAt, startMs, endMs)
    ) {
      completions += 1;
      if (
        typeof s.startedAt === "number" &&
        typeof s.completedAt === "number"
      ) {
        const d = s.completedAt - s.startedAt;
        if (Number.isFinite(d) && d >= 0) {
          durationSum += d;
          durationCount += 1;
        }
      }
    }
  }

  const totalPlayCount = starts;
  const completionRate = starts > 0 ? completions / starts : null;

  let dropOffRate: number | null = null;
  let dropOffNaReason: string | null = null;
  if (starts === 0) {
    dropOffNaReason = "Requires quiz starts in range";
  } else if (completionRate != null) {
    dropOffRate = Math.max(0, Math.min(1, 1 - completionRate));
  }

  let averageQuizzesPlayedPerUser: number | null = null;
  let avgQuizzesPerUserNaReason: string | null = null;
  let averageQuizzesPlayedPerUserCaption: string | null = null;
  if (starts > 0 && participantKeys.size > 0) {
    averageQuizzesPlayedPerUser = starts / participantKeys.size;
    const hasAnon = [...participantKeys].some((k) => k.startsWith("s:"));
    if (hasAnon) {
      averageQuizzesPlayedPerUserCaption =
        "Anonymous players counted by session ID (one session = one participant).";
    }
  } else {
    avgQuizzesPerUserNaReason =
      "Requires quiz starts with identifiable user or session in range.";
  }

  const hasEngagementData = quizViews > 0 || starts > 0 || completions > 0;

  return {
    quizViews,
    totalPlayCount,
    quizStarts: starts,
    quizCompletions: completions,
    completionRate,
    dropOffRate,
    dropOffNaReason,
    averageTimeSpentPerQuizMs:
      durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    averageQuizzesPlayedPerUser,
    avgQuizzesPerUserNaReason,
    averageQuizzesPlayedPerUserCaption,
    hasEngagementData,
  };
}

function parseAnimalTraitFromName(name: string | undefined | null): {
  animal: string | null;
  trait: string | null;
} {
  if (typeof name !== "string") return { animal: null, trait: null };
  const trimmed = name.trim();
  if (!trimmed) return { animal: null, trait: null };

  // Support common separators: "|", "-", "—", "–", ":", including full-width variants.
  const parts = trimmed
    .split(/\s*(?:\||-|—|–|:|：|｜)\s*/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { animal: parts[0] ?? null, trait: parts[1] ?? null };
  }
  return { animal: trimmed, trait: null };
}

export const getCreatorKpis = query({
  args: {
    quizId: v.optional(v.id("quiz")),
    startMs: v.number(),
    endMs: v.number(),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);

    const quizIds: Id<"quiz">[] = args.quizId
      ? [(await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId))._id]
      : (await listQuizzesForCreatorAnalytics(ctx, actorId)).map((q) => q._id);

    if (quizIds.length === 0) {
      return {
        views: 0,
        startedSessions: 0,
        finishedSessions: 0,
        averageGameTimeMs: null as number | null,
      };
    }

    let views = 0;
    let started = 0;
    let finished = 0;
    let totalDuration = 0;
    let finishedCountForAvg = 0;

    for (const quizId of quizIds) {
      const sessions = await ctx.db
        .query("quizSessions")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quizId))
        .collect();
      const sessionVersionById = new Map<string, number>();
      for (const s of sessions) {
        sessionVersionById.set(s.sessionId, readQuizVersion(s));
      }

      const viewEvents = await ctx.db
        .query("quizEvents")
        .withIndex("by_quizId_type_ts", (q: any) =>
          q.eq("quizId", quizId).eq("type", "view"),
        )
        .collect();
      for (const e of viewEvents) {
        if (typeof e.sessionId === "string" && isDemoSession(e.sessionId)) {
          continue;
        }
        if (
          args.quizVersion !== undefined &&
          (typeof e.sessionId !== "string" ||
            sessionVersionById.get(e.sessionId) !== args.quizVersion)
        ) {
          continue;
        }
        if (inRangeInclusive(e.ts, args.startMs, args.endMs)) views += 1;
      }

      for (const s of sessions) {
        if (isDemoSession(s.sessionId)) continue;
        if (!matchesQuizVersion(s, args.quizVersion)) continue;
        if (inRangeInclusive(s.startedAt, args.startMs, args.endMs)) {
          started += 1;
        }
        if (
          s.status === "completed" &&
          inRangeInclusive(s.completedAt, args.startMs, args.endMs)
        ) {
          finished += 1;
          if (
            typeof s.startedAt === "number" &&
            typeof s.completedAt === "number"
          ) {
            const d = s.completedAt - s.startedAt;
            if (Number.isFinite(d) && d >= 0) {
              totalDuration += d;
              finishedCountForAvg += 1;
            }
          }
        }
      }
    }

    return {
      views,
      startedSessions: started,
      finishedSessions: finished,
      averageGameTimeMs:
        finishedCountForAvg > 0
          ? Math.round(totalDuration / finishedCountForAvg)
          : null,
    };
  },
});

export const getAdminDashboardSummary = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const quizzes = await listAdminQuizzes(ctx);
    const totalQuizzes = quizzes.length;

    let views = 0;
    let started = 0;
    let finished = 0;
    let totalDuration = 0;
    let finishedCountForAvg = 0;
    let activeQuizzes = 0;

    for (const quiz of quizzes) {
      let isActive = false;

      const viewEvents = await ctx.db
        .query("quizEvents")
        .withIndex("by_quizId_type_ts", (q: any) =>
          q.eq("quizId", quiz._id).eq("type", "view"),
        )
        .collect();
      for (const e of viewEvents) {
        if (typeof e.sessionId === "string" && isDemoSession(e.sessionId)) {
          continue;
        }
        if (!inRangeInclusive(e.ts, args.startMs, args.endMs)) continue;
        views += 1;
        isActive = true;
      }

      const sessions = await ctx.db
        .query("quizSessions")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quiz._id))
        .collect();

      for (const s of sessions) {
        if (isDemoSession(s.sessionId)) continue;
        if (inRangeInclusive(s.startedAt, args.startMs, args.endMs)) {
          started += 1;
          isActive = true;
        }
        if (
          s.status === "completed" &&
          inRangeInclusive(s.completedAt, args.startMs, args.endMs)
        ) {
          finished += 1;
          isActive = true;
          if (
            typeof s.startedAt === "number" &&
            typeof s.completedAt === "number"
          ) {
            const d = s.completedAt - s.startedAt;
            if (Number.isFinite(d) && d >= 0) {
              totalDuration += d;
              finishedCountForAvg += 1;
            }
          }
        }
      }

      if (isActive) {
        activeQuizzes += 1;
      }
    }

    const completionRate =
      started > 0 ? Math.max(0, Math.min(1, finished / started)) : null;

    return {
      views,
      completedSessions: finished,
      averageCompletionTimeMs:
        finishedCountForAvg > 0
          ? Math.round(totalDuration / finishedCountForAvg)
          : null,
      completionRate,
      totalQuizzes,
      activeQuizzes,
    };
  },
});

/**
 * Active designer approximation: count distinct non-admin users who touched at least one quiz
 * (create/update/publish/close timestamp in window). Not tied to login/last_seen.
 */
function countActiveDesignersInWindow(
  quizzes: Doc<"quiz">[],
  designers: Doc<"users">[],
  windowStart: number,
  windowEnd: number,
): number {
  const activeDesignerIds = new Set<string>();
  for (const q of quizzes) {
    const ca = q.createdAt ?? q._creationTime;
    const pubAt = q.publishedAt;
    const cloAt = q.closedAt;
    const ua = typeof q.updatedAt === "number" ? q.updatedAt : null;
    const touched =
      inRangeInclusive(ca, windowStart, windowEnd) ||
      (ua !== null && inRangeInclusive(ua, windowStart, windowEnd)) ||
      (typeof pubAt === "number" &&
        inRangeInclusive(pubAt, windowStart, windowEnd)) ||
      (typeof cloAt === "number" &&
        inRangeInclusive(cloAt, windowStart, windowEnd));
    if (touched && q.userId) activeDesignerIds.add(String(q.userId));
  }

  const totalDesigners = designers.filter(
    (u: any) => isDesignerUser(u) && u._creationTime <= windowEnd,
  ).length;

  let activeDesigners = 0;
  for (const id of activeDesignerIds) {
    const u = designers.find((x: any) => String(x._id) === id);
    if (u && isDesignerUser(u) && u._creationTime <= windowEnd)
      activeDesigners += 1;
  }
  return Math.min(activeDesigners, totalDesigners);
}

async function computePlatformOverview(
  ctx: { db: any },
  args: { startMs: number; endMs: number },
): Promise<{
  totalDesigners: number;
  activeDesignersRolling7d: number;
  activeDesignersRolling30d: number;
  newDesignersInRange: number;
  newDesignersToday: number;
  newDesignersThisWeek: number;
  newDesignersThisMonth: number;
  totalQuizzes: number;
  publishedQuizzes: number;
  draftQuizzes: number;
  closedQuizzes: number;
  activityCaption: string;
}> {
  const allUsers = await ctx.db.query("users").collect();
  const designers = allUsers.filter((u: any) => isDesignerUser(u));

  const totalDesigners = designers.filter(
    (u: any) => u._creationTime <= args.endMs,
  ).length;

  const quizzes = await ctx.db.query("quiz").collect();

  const end = args.endMs;
  const quizzesThroughEnd = quizzes.filter((q: any) => q._creationTime <= end);
  const activeDesignersRolling7d = countActiveDesignersInWindow(
    quizzesThroughEnd,
    designers,
    end - 7 * DAY_MS,
    end,
  );
  const activeDesignersRolling30d = countActiveDesignersInWindow(
    quizzesThroughEnd,
    designers,
    end - 30 * DAY_MS,
    end,
  );

  const newDesignersInRange = designers.filter((u: any) =>
    inRangeInclusive(u._creationTime, args.startMs, args.endMs),
  ).length;

  const dayStart = utcDayStartMs(args.endMs);
  const weekStart = utcWeekStartMondayMs(args.endMs);
  const monthStart = utcMonthStartMs(args.endMs);

  const newDesignersToday = designers.filter(
    (u: any) => u._creationTime >= dayStart && u._creationTime <= args.endMs,
  ).length;
  const newDesignersThisWeek = designers.filter(
    (u: any) => u._creationTime >= weekStart && u._creationTime <= args.endMs,
  ).length;
  const newDesignersThisMonth = designers.filter(
    (u: any) => u._creationTime >= monthStart && u._creationTime <= args.endMs,
  ).length;

  const totalQuizzes = quizzesThroughEnd.length;
  const publishedQuizzes = quizzesThroughEnd.filter(
    (q: any) => q.status === "published",
  ).length;
  const draftQuizzes = quizzesThroughEnd.filter(
    (q: any) => q.status === "draft",
  ).length;
  const closedQuizzes = quizzesThroughEnd.filter(
    (q: any) => q.status === "closed",
  ).length;

  return {
    totalDesigners,
    activeDesignersRolling7d,
    activeDesignersRolling30d,
    newDesignersInRange,
    newDesignersToday,
    newDesignersThisWeek,
    newDesignersThisMonth,
    totalQuizzes,
    publishedQuizzes,
    draftQuizzes,
    closedQuizzes,
    activityCaption:
      "Designers with quiz create / publish / close activity in the rolling window",
  };
}

export const getAdminPlatformOverview = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const current = await computePlatformOverview(ctx, args);
    const prevRange = previousPeriodRange(args.startMs, args.endMs);
    const previous = prevRange
      ? await computePlatformOverview(ctx, prevRange)
      : null;

    return {
      ...current,
      newDesigners: current.newDesignersInRange,
      previousSnapshot:
        previous === null
          ? null
          : {
              totalDesigners: previous.totalDesigners,
              newDesignersInRange: previous.newDesignersInRange,
              totalQuizzes: previous.totalQuizzes,
            },
      deltasVsPreviousPeriod:
        previous === null || prevRange === null
          ? null
          : {
              totalDesignersPct: pctChangeVsPrevious(
                current.totalDesigners,
                previous.totalDesigners,
              ),
              newDesignersInRangePct: pctChangeVsPrevious(
                current.newDesignersInRange,
                previous.newDesignersInRange,
              ),
              totalQuizzesPct: pctChangeVsPrevious(
                current.totalQuizzes,
                previous.totalQuizzes,
              ),
            },
    };
  },
});

export const getAdminEngagementMetrics = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const current = await computeEngagementMetrics(
      ctx,
      args.startMs,
      args.endMs,
    );
    const prevRange = previousPeriodRange(args.startMs, args.endMs);
    const previous = prevRange
      ? await computeEngagementMetrics(ctx, prevRange.startMs, prevRange.endMs)
      : null;

    const completionRateNaReason =
      current.quizStarts === 0 ? "Requires quiz starts in range" : null;

    return {
      ...current,
      completionRateNaReason,
      previousEngagement: previous
        ? {
            quizViews: previous.quizViews,
            totalPlayCount: previous.totalPlayCount,
            quizStarts: previous.quizStarts,
            quizCompletions: previous.quizCompletions,
            completionRate: previous.completionRate,
            dropOffRate: previous.dropOffRate,
          }
        : null,
      deltasVsPreviousPeriod:
        previous === null
          ? null
          : {
              quizViewsPct: pctChangeVsPrevious(
                current.quizViews,
                previous.quizViews,
              ),
              totalPlayCountPct: pctChangeVsPrevious(
                current.totalPlayCount,
                previous.totalPlayCount,
              ),
              quizStartsPct: pctChangeVsPrevious(
                current.quizStarts,
                previous.quizStarts,
              ),
              quizCompletionsPct: pctChangeVsPrevious(
                current.quizCompletions,
                previous.quizCompletions,
              ),
              completionRatePts:
                current.completionRate != null &&
                previous.completionRate != null
                  ? Math.round(
                      ((current.completionRate - previous.completionRate) *
                        1000) /
                        10,
                    ) / 10
                  : null,
            },
    };
  },
});

export const getAdminLeadConversionMetrics = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const engagement = await computeEngagementMetrics(
      ctx,
      args.startMs,
      args.endMs,
    );
    const completions = engagement.quizCompletions;

    const leadRows = (
      await ctx.db
        .query("quizLeads")
        .withIndex("by_createdAt", (q: any) =>
          q.gte("createdAt", args.startMs).lte("createdAt", args.endMs),
        )
        .collect()
    ).filter((row: any) => !isDemoSession(row.sessionId));

    const totalLeadsCollected = leadRows.length;

    const ctaClickCount = (
      await adminQuizEventsInRange(ctx, "cta_click", args.startMs, args.endMs)
    ).length;

    const resultViewCount = (
      await adminQuizEventsInRange(
        ctx,
        "result_page_view",
        args.startMs,
        args.endMs,
      )
    ).length;

    /** Leads ÷ completions (preferred SaaS definition). */
    const leadConversionRate =
      completions > 0 ? totalLeadsCollected / completions : null;

    /** CTR: CTA clicks ÷ result page views; if no views tracked, fall back to ÷ completions. */
    const ctrDenominator = resultViewCount > 0 ? resultViewCount : completions;
    const ctr = ctrDenominator > 0 ? ctaClickCount / ctrDenominator : null;

    return {
      totalLeadsCollected,
      leadConversionRate,
      ctaClickCount,
      ctr,
      ctrDenominatorViews: resultViewCount,
      ctrDenominatorApprox: resultViewCount === 0 && completions > 0,
      leadTrackingEnabled: true as boolean,
      sectionCaption: "Scoped to selected time range",
      moduleSubtitle:
        "Lead rows from quizLeads; CTR uses result page views when available.",
      moduleNaReason: null as string | null,
      leadCountNaReason:
        totalLeadsCollected === 0 ? "No lead submissions in this range" : null,
      leadRateNaReason:
        completions === 0
          ? "Requires quiz completions in range for rate"
          : leadConversionRate === null
            ? null
            : null,
      ctaCountNaReason:
        ctaClickCount === 0 ? "No CTA clicks in this range" : null,
      ctrNaReason:
        ctr === null
          ? "Needs result views or completions as denominator"
          : null,
    };
  },
});

export const getAdminTrendCharts = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const sessions = adminSessionsOnly(
      await ctx.db.query("quizSessions").collect(),
    );
    const allQuizzes = await ctx.db.query("quiz").collect();
    const allUsers = await ctx.db.query("users").collect();

    const viewQueryStart = args.startMs === 0 ? 0 : args.startMs;
    const viewEvents = (
      await ctx.db
        .query("quizEvents")
        .withIndex("by_type_ts", (q: any) =>
          q.eq("type", "view").gte("ts", viewQueryStart).lte("ts", args.endMs),
        )
        .collect()
    ).filter(
      (e: any) =>
        !(typeof e.sessionId === "string" && isDemoSession(e.sessionId)),
    );
    const quizCreateEvents = await adminQuizEventsInRange(
      ctx,
      "quiz_create",
      viewQueryStart,
      args.endMs,
    );

    function bumpEarliest(
      ts: number | undefined | null,
      earliest: number | null,
    ): number | null {
      if (typeof ts !== "number" || !Number.isFinite(ts)) return earliest;
      if (ts < 0 || ts > args.endMs) return earliest;
      if (earliest === null || ts < earliest) return ts;
      return earliest;
    }

    let chartStartMs = args.startMs;
    if (args.startMs === 0) {
      let earliestMs: number | null = null;
      for (const e of viewEvents)
        earliestMs = bumpEarliest((e as any).ts, earliestMs);
      for (const s of sessions) {
        earliestMs = bumpEarliest(s.startedAt, earliestMs);
        earliestMs = bumpEarliest(s.completedAt, earliestMs);
      }
      for (const q of allQuizzes) {
        earliestMs = bumpEarliest(q.createdAt ?? q._creationTime, earliestMs);
      }
      for (const e of quizCreateEvents)
        earliestMs = bumpEarliest((e as any).ts, earliestMs);
      for (const u of allUsers) {
        if (!isDesignerUser(u)) continue;
        earliestMs = bumpEarliest(u._creationTime, earliestMs);
      }

      if (earliestMs === null) {
        return {
          intervalMs: DAY_MS,
          buckets: [] as {
            bucketStartMs: number;
            views: number;
            starts: number;
            completions: number;
            newDesigners: number;
            newQuizzes: number;
            leads: number;
            ctaClicks: number;
            resultPageViews: number;
            completionRate: number | null;
            leadConversionRate: number | null;
            ctr: number | null;
          }[],
          hasEngagementActivity: false,
          hasTimelineData: false,
        };
      }
      chartStartMs = earliestMs;
    }

    const rangeMs = Math.max(0, args.endMs - chartStartMs);
    const intervalMs = rangeMs > 120 * DAY_MS ? 7 * DAY_MS : DAY_MS;

    const buckets = new Map<
      number,
      {
        bucketStartMs: number;
        views: number;
        starts: number;
        completions: number;
        newDesigners: number;
        newQuizzes: number;
        leads: number;
        ctaClicks: number;
        resultPageViews: number;
      }
    >();

    const startBucket = floorToIntervalUtc(chartStartMs, intervalMs);
    const endBucket = floorToIntervalUtc(args.endMs, intervalMs);
    for (let t = startBucket; t <= endBucket; t += intervalMs) {
      buckets.set(t, {
        bucketStartMs: t,
        views: 0,
        starts: 0,
        completions: 0,
        newDesigners: 0,
        newQuizzes: 0,
        leads: 0,
        ctaClicks: 0,
        resultPageViews: 0,
      });
    }

    for (const e of viewEvents) {
      const ts = (e as any).ts as number;
      if (!inRangeInclusive(ts, chartStartMs, args.endMs)) continue;
      const b = buckets.get(floorToIntervalUtc(ts, intervalMs));
      if (b) b.views += 1;
    }

    for (const s of sessions) {
      if (inRangeInclusive(s.startedAt, chartStartMs, args.endMs)) {
        const b = buckets.get(floorToIntervalUtc(s.startedAt, intervalMs));
        if (b) b.starts += 1;
      }
      const completedAt = s.completedAt;
      if (
        s.status === "completed" &&
        inRangeInclusive(completedAt, chartStartMs, args.endMs)
      ) {
        const b = buckets.get(
          floorToIntervalUtc(completedAt as number, intervalMs),
        );
        if (b) b.completions += 1;
      }
    }

    for (const u of allUsers) {
      if (!isDesignerUser(u)) continue;
      if (!inRangeInclusive(u._creationTime, chartStartMs, args.endMs))
        continue;
      const b = buckets.get(floorToIntervalUtc(u._creationTime, intervalMs));
      if (b) b.newDesigners += 1;
    }

    const quizIdsCountedFromCreateEvents = new Set<string>();
    for (const e of quizCreateEvents) {
      const ts = (e as any).ts as number;
      if (!inRangeInclusive(ts, chartStartMs, args.endMs)) continue;
      const b = buckets.get(floorToIntervalUtc(ts, intervalMs));
      if (b) b.newQuizzes += 1;
      const quizId = (e as any).quizId;
      if (quizId) quizIdsCountedFromCreateEvents.add(String(quizId));
    }

    for (const q of allQuizzes) {
      if (quizIdsCountedFromCreateEvents.has(String(q._id))) continue;
      const ca = q.createdAt ?? q._creationTime;
      if (!inRangeInclusive(ca, chartStartMs, args.endMs)) continue;
      const b = buckets.get(floorToIntervalUtc(ca, intervalMs));
      if (b) b.newQuizzes += 1;
    }

    const ctaForChart = await adminQuizEventsInRange(
      ctx,
      "cta_click",
      chartStartMs,
      args.endMs,
    );
    for (const e of ctaForChart) {
      const ts = (e as any).ts as number;
      if (!inRangeInclusive(ts, chartStartMs, args.endMs)) continue;
      const b = buckets.get(floorToIntervalUtc(ts, intervalMs));
      if (b) b.ctaClicks += 1;
    }

    const resultViewsForChart = await adminQuizEventsInRange(
      ctx,
      "result_page_view",
      chartStartMs,
      args.endMs,
    );
    for (const e of resultViewsForChart) {
      const ts = (e as any).ts as number;
      if (!inRangeInclusive(ts, chartStartMs, args.endMs)) continue;
      const b = buckets.get(floorToIntervalUtc(ts, intervalMs));
      if (b) {
        b.resultPageViews += 1;
      }
    }

    const leadsForChart = (
      await ctx.db
        .query("quizLeads")
        .withIndex("by_createdAt", (q: any) =>
          q.gte("createdAt", chartStartMs).lte("createdAt", args.endMs),
        )
        .collect()
    ).filter((row: any) => !isDemoSession(row.sessionId));

    for (const L of leadsForChart) {
      const ts = (L as any).createdAt as number;
      if (!inRangeInclusive(ts, chartStartMs, args.endMs)) continue;
      const b = buckets.get(floorToIntervalUtc(ts, intervalMs));
      if (b) b.leads += 1;
    }

    const sorted = Array.from(buckets.values()).sort(
      (a, b) => a.bucketStartMs - b.bucketStartMs,
    );

    let hasEngagementActivity = false;
    for (const row of sorted) {
      if (
        row.views > 0 ||
        row.starts > 0 ||
        row.completions > 0 ||
        row.leads > 0 ||
        row.ctaClicks > 0
      ) {
        hasEngagementActivity = true;
        break;
      }
    }

    const bucketsOut = sorted.map((row) => ({
      bucketStartMs: row.bucketStartMs,
      views: row.views,
      starts: row.starts,
      completions: row.completions,
      newDesigners: row.newDesigners,
      newQuizzes: row.newQuizzes,
      leads: row.leads,
      ctaClicks: row.ctaClicks,
      resultPageViews: row.resultPageViews,
      completionRate: row.starts > 0 ? row.completions / row.starts : null,
      leadConversionRate:
        row.completions > 0 ? row.leads / row.completions : null,
      ctr:
        row.resultPageViews > 0
          ? row.ctaClicks / row.resultPageViews
          : row.completions > 0
            ? row.ctaClicks / row.completions
            : null,
    }));

    return {
      intervalMs,
      buckets: bucketsOut,
      hasEngagementActivity,
      hasTimelineData: true as boolean,
    };
  },
});

export const getAdminContentPerformanceTop10 = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
    sortBy: v.union(
      v.literal("playCount"),
      v.literal("completionRate"),
      v.literal("leadConversionRate"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const quizzes = await ctx.db.query("quiz").collect();
    const users = await ctx.db.query("users").collect();
    const userById = new Map<string, Doc<"users">>();
    for (const u of users) {
      userById.set(String((u as any)._id), u as Doc<"users">);
    }

    const viewsByQuiz = new Map<string, number>();
    const viewEvents = await adminQuizEventsInRange(
      ctx,
      "view",
      args.startMs,
      args.endMs,
    );
    for (const e of viewEvents) {
      const key = String((e as any).quizId);
      viewsByQuiz.set(key, (viewsByQuiz.get(key) ?? 0) + 1);
    }

    const startsByQuiz = new Map<string, number>();
    const completionsByQuiz = new Map<string, number>();
    const sessions = adminSessionsOnly(
      await ctx.db.query("quizSessions").collect(),
    );
    for (const s of sessions) {
      const key = String(s.quizId);
      if (inRangeInclusive(s.startedAt, args.startMs, args.endMs)) {
        startsByQuiz.set(key, (startsByQuiz.get(key) ?? 0) + 1);
      }
      if (
        s.status === "completed" &&
        inRangeInclusive(s.completedAt, args.startMs, args.endMs)
      ) {
        completionsByQuiz.set(key, (completionsByQuiz.get(key) ?? 0) + 1);
      }
    }

    const leadsByQuiz = new Map<string, number>();
    const leadRows = (
      await ctx.db
        .query("quizLeads")
        .withIndex("by_createdAt", (q: any) =>
          q.gte("createdAt", args.startMs).lte("createdAt", args.endMs),
        )
        .collect()
    ).filter((row: any) => !isDemoSession(row.sessionId));
    for (const L of leadRows) {
      const key = String((L as any).quizId);
      leadsByQuiz.set(key, (leadsByQuiz.get(key) ?? 0) + 1);
    }

    const ctaByQuiz = new Map<string, number>();
    for (const e of await adminQuizEventsInRange(
      ctx,
      "cta_click",
      args.startMs,
      args.endMs,
    )) {
      const key = String((e as any).quizId);
      ctaByQuiz.set(key, (ctaByQuiz.get(key) ?? 0) + 1);
    }
    const resultViewsByQuiz = new Map<string, number>();
    for (const e of await adminQuizEventsInRange(
      ctx,
      "result_page_view",
      args.startMs,
      args.endMs,
    )) {
      const key = String((e as any).quizId);
      resultViewsByQuiz.set(key, (resultViewsByQuiz.get(key) ?? 0) + 1);
    }

    const rows = quizzes.map((q: Doc<"quiz">) => {
      const quizId = String(q._id);
      const views = viewsByQuiz.get(quizId) ?? 0;
      const starts = startsByQuiz.get(quizId) ?? 0;
      const completions = completionsByQuiz.get(quizId) ?? 0;
      const leads = leadsByQuiz.get(quizId) ?? 0;
      const ctaClicks = ctaByQuiz.get(quizId) ?? 0;
      const resultViews = resultViewsByQuiz.get(quizId) ?? 0;
      const completionRate = starts > 0 ? completions / starts : null;
      const leadConversionRate = completions > 0 ? leads / completions : null;
      const ctrDenom = resultViews > 0 ? resultViews : completions;
      const ctr = ctrDenom > 0 ? ctaClicks / ctrDenom : null;
      const designer = designerDisplayName(userById.get(String(q.userId)));
      return {
        quizId,
        quizName: quizDisplayTitle(q),
        status: q.status as "draft" | "published" | "closed",
        designer,
        // Plays / “play count” = session starts in range (view counts are quizViews).
        playCount: starts,
        quizViews: views,
        starts,
        completions,
        completionRate,
        completionRateNaReason:
          starts === 0 ? "Requires quiz starts in range" : null,
        leads,
        leadConversionRate,
        leadConversionRateNaReason:
          completions === 0 ? "Requires completions in range" : null,
        ctaClicks,
        ctr,
        ctrNaReason:
          ctrDenom === 0 ? "Needs result views or completions" : null,
      };
    });

    let hasQuizPerformanceData = false;
    for (const r of rows) {
      if (
        r.quizViews > 0 ||
        r.playCount > 0 ||
        r.starts > 0 ||
        r.completions > 0
      ) {
        hasQuizPerformanceData = true;
        break;
      }
    }

    const sorted =
      args.sortBy === "playCount"
        ? [...rows].sort((a, b) => b.playCount - a.playCount)
        : args.sortBy === "completionRate"
          ? [...rows].sort((a, b) => {
              const ar = a.completionRate ?? -1;
              const br = b.completionRate ?? -1;
              return br - ar;
            })
          : [...rows].sort((a, b) => {
              const ar = a.leadConversionRate ?? -1;
              const br = b.leadConversionRate ?? -1;
              return br - ar;
            });

    return {
      rows: sorted.slice(0, 10),
      hasQuizPerformanceData,
      leadTrackingEnabled: true as boolean,
    };
  },
});

export const getAdminPlatformFunnel = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const views = (
      await adminQuizEventsInRange(ctx, "view", args.startMs, args.endMs)
    ).length;

    let starts = 0;
    let completions = 0;
    const sessions = adminSessionsOnly(
      await ctx.db.query("quizSessions").collect(),
    );
    for (const s of sessions) {
      if (inRangeInclusive(s.startedAt, args.startMs, args.endMs)) starts += 1;
      if (
        s.status === "completed" &&
        inRangeInclusive(s.completedAt, args.startMs, args.endMs)
      ) {
        completions += 1;
      }
    }

    const leads = (
      await ctx.db
        .query("quizLeads")
        .withIndex("by_createdAt", (q: any) =>
          q.gte("createdAt", args.startMs).lte("createdAt", args.endMs),
        )
        .collect()
    ).filter((row: any) => !isDemoSession(row.sessionId)).length;

    const ctaClicks = (
      await adminQuizEventsInRange(ctx, "cta_click", args.startMs, args.endMs)
    ).length;

    const pctOfViews = (n: number) => (views > 0 ? n / views : null);
    const pctOfStarts = (n: number) => (starts > 0 ? n / starts : null);
    const pctOfCompletions = (n: number) =>
      completions > 0 ? n / completions : null;
    const pctOfLeads = (n: number) => (leads > 0 ? n / leads : null);

    const steps = [
      {
        key: "views" as const,
        label: "Views",
        value: views,
        widthBasis: views,
        fromPreviousLabel: null as string | null,
        fromPreviousRate: null as number | null,
        fromViewsLabel: "100% of Views",
        fromViewsRate: 1,
      },
      {
        key: "starts" as const,
        label: "Starts",
        value: starts,
        widthBasis: starts,
        fromPreviousLabel: views > 0 ? "from Views" : null,
        fromPreviousRate: pctOfViews(starts),
        fromViewsLabel:
          views > 0 ? `${formatPctLabel(pctOfViews(starts))} of Views` : null,
        fromViewsRate: pctOfViews(starts),
      },
      {
        key: "completions" as const,
        label: "Completions",
        value: completions,
        widthBasis: completions,
        fromPreviousLabel: starts > 0 ? "from Starts" : null,
        fromPreviousRate: pctOfStarts(completions),
        fromViewsLabel:
          views > 0
            ? `${formatPctLabel(pctOfViews(completions))} of Views`
            : null,
        fromViewsRate: pctOfViews(completions),
      },
      {
        key: "leads" as const,
        label: "Leads",
        value: leads,
        widthBasis: leads,
        fromPreviousLabel: completions > 0 ? "from Completions" : null,
        fromPreviousRate: pctOfCompletions(leads),
        fromViewsLabel:
          views > 0 ? `${formatPctLabel(pctOfViews(leads))} of Views` : null,
        fromViewsRate: pctOfViews(leads),
      },
      {
        key: "cta" as const,
        label: "CTA Clicks",
        value: ctaClicks,
        widthBasis: ctaClicks,
        fromPreviousLabel:
          leads > 0
            ? "from Leads"
            : completions > 0
              ? "from Completions"
              : null,
        fromPreviousRate:
          leads > 0
            ? pctOfLeads(ctaClicks)
            : completions > 0
              ? ctaClicks / completions
              : null,
        fromViewsLabel:
          views > 0
            ? `${formatPctLabel(pctOfViews(ctaClicks))} of Views`
            : null,
        fromViewsRate: pctOfViews(ctaClicks),
      },
    ];

    const barDenominator = Math.max(views, 1);

    const overallFromViews = views > 0 ? ctaClicks / views : null;

    return {
      views,
      starts,
      completions,
      leads,
      ctaClicks,
      leadsNaReason: null as string | null,
      steps,
      barDenominator,
      overallLeadsPerViews: overallFromViews,
      overallCaption: `CTA clicks / views: ${formatPctLabel(overallFromViews)}`,
    };
  },
});

export const getAdminQuizFunnel = query({
  args: {
    quizId: v.id("quiz"),
  },
  handler: async (ctx, args) => {
    await requireAdminActorId(ctx);

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      return null;
    }

    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();

    const startedSessionIds = new Set<string>();
    const completedSessionIds = new Set<string>();
    for (const s of sessions) {
      if (typeof s.sessionId === "string") {
        startedSessionIds.add(s.sessionId);
        if (s.status === "completed") {
          completedSessionIds.add(s.sessionId);
        }
      }
    }

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();

    const perPageSessionIds = new Map<string, Set<string>>();
    for (const r of responses) {
      if (typeof r.pageId !== "string") continue;
      if (typeof r.sessionId !== "string") continue;
      const set = perPageSessionIds.get(r.pageId) ?? new Set<string>();
      set.add(r.sessionId);
      perPageSessionIds.set(r.pageId, set);
    }

    const questionSteps = (quiz.pageIds ?? []).map((pid, idx) => {
      const key = String(pid);
      const reached = perPageSessionIds.get(key);
      return {
        pageId: key,
        index: idx,
        label: `Question ${idx + 1}`,
        count: reached ? reached.size : 0,
      };
    });

    const started = startedSessionIds.size;
    const completed = completedSessionIds.size;

    return {
      quizId: String(args.quizId),
      quizTitle: quiz.title,
      started,
      completed,
      questions: questionSteps,
    };
  },
});

export const getCreatorQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const actorId = await requireAuthUserId(ctx);
    const quizzes = await listQuizzesForCreatorAnalytics(ctx, actorId);

    return quizzes.map((q: Doc<"quiz">) => ({
      _id: q._id,
      title: q.title,
      status: q.status,
      _creationTime: q._creationTime,
    }));
  },
});

export const canAccessCreatorQuiz = query({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return false;
    if (quiz.userId === actorId) return true;
    return (await actorIsAdmin(ctx, actorId)) === true;
  },
});

export const getCreatorQuizVersions = query({
  args: {
    quizId: v.id("quiz"),
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);
    await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId);

    const versions = new Set<number>();
    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();

    for (const s of sessions) {
      if (isDemoSession(s.sessionId)) continue;
      const inWindow =
        inRangeInclusive(s.startedAt, args.startMs, args.endMs) ||
        inRangeInclusive(s.completedAt, args.startMs, args.endMs);
      if (inWindow) versions.add(readQuizVersion(s));
    }

    return Array.from(versions)
      .sort((a, b) => b - a)
      .map((version) => ({
        version,
        label: `Version ${version}`,
      }));
  },
});

export const getCreatorTrend = query({
  args: {
    quizId: v.optional(v.id("quiz")),
    startMs: v.number(),
    endMs: v.number(),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);

    const quizIds: Id<"quiz">[] = args.quizId
      ? [(await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId))._id]
      : (await listQuizzesForCreatorAnalytics(ctx, actorId)).map((q) => q._id);

    const buckets = new Map<number, { dayStartMs: number; views: number }>();
    for (let d = floorToDayUtc(args.startMs); d <= args.endMs; d += DAY_MS) {
      buckets.set(d, { dayStartMs: d, views: 0 });
    }

    for (const quizId of quizIds) {
      const sessions = await ctx.db
        .query("quizSessions")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quizId))
        .collect();
      const sessionVersionById = new Map<string, number>();
      for (const s of sessions) {
        sessionVersionById.set(s.sessionId, readQuizVersion(s));
      }

      const events = await ctx.db
        .query("quizEvents")
        .withIndex("by_quizId_type_ts", (q: any) =>
          q.eq("quizId", quizId).eq("type", "view"),
        )
        .collect();
      for (const e of events) {
        if (typeof e.sessionId === "string" && isDemoSession(e.sessionId)) {
          continue;
        }
        if (
          args.quizVersion !== undefined &&
          (typeof e.sessionId !== "string" ||
            sessionVersionById.get(e.sessionId) !== args.quizVersion)
        ) {
          continue;
        }
        if (!inRangeInclusive(e.ts, args.startMs, args.endMs)) continue;
        const day = floorToDayUtc(e.ts);
        const b = buckets.get(day);
        if (b) b.views += 1;
      }
    }

    return Array.from(buckets.values()).sort(
      (a, b) => a.dayStartMs - b.dayStartMs,
    );
  },
});

export const getCreatorLanguageDistribution = query({
  args: {
    quizId: v.optional(v.id("quiz")),
    startMs: v.number(),
    endMs: v.number(),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);

    const quizIds: Id<"quiz">[] = args.quizId
      ? [(await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId))._id]
      : (await listQuizzesForCreatorAnalytics(ctx, actorId)).map((q) => q._id);

    const counts = new Map<"en" | "cn" | "unknown", number>([
      ["en", 0],
      ["cn", 0],
      ["unknown", 0],
    ]);

    for (const quizId of quizIds) {
      const sessions = await ctx.db
        .query("quizSessions")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quizId))
        .collect();

      for (const s of sessions) {
        if (isDemoSession(s.sessionId)) continue;
        if (!matchesQuizVersion(s, args.quizVersion)) continue;
        if (s.status !== "completed") continue;
        if (!inRangeInclusive(s.completedAt, args.startMs, args.endMs))
          continue;
        const lang =
          s.language === "en" || s.language === "cn" ? s.language : "unknown";
        counts.set(lang, (counts.get(lang) ?? 0) + 1);
      }
    }

    return [
      {
        language: "en" as const,
        label: "English",
        count: counts.get("en") ?? 0,
      },
      {
        language: "cn" as const,
        label: "Chinese",
        count: counts.get("cn") ?? 0,
      },
      {
        language: "unknown" as const,
        label: "Unknown",
        count: counts.get("unknown") ?? 0,
      },
    ].filter((x) => x.count > 0);
  },
});

export const getCreatorResultDistribution = query({
  args: {
    quizId: v.optional(v.id("quiz")),
    startMs: v.number(),
    endMs: v.number(),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);

    const quizzes: Doc<"quiz">[] = args.quizId
      ? [await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId)]
      : await listQuizzesForCreatorAnalytics(ctx, actorId);

    const resultIdToMeta = new Map<
      string,
      { name: string; animal: string | null; trait: string | null }
    >();
    for (const quiz of quizzes) {
      const results = (
        await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
      ).filter(Boolean) as Doc<"results">[];
      results.forEach((r, idx) => {
        const displayName =
          r.pageName ?? RESULT_FALLBACK_NAMES[idx] ?? `Result ${idx + 1}`;
        const parsed = parseAnimalTraitFromName(r.pageName);
        resultIdToMeta.set(String(r._id), {
          name: displayName,
          animal: parsed.animal,
          trait: parsed.trait,
        });
      });
    }

    const counts = new Map<
      string,
      { count: number; resultNameSnapshot?: string }
    >();
    for (const quiz of quizzes) {
      const results = await ctx.db
        .query("quizResults")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quiz._id))
        .collect();

      for (const r of results) {
        if (isDemoSession(r.sessionId)) continue;
        if (!matchesQuizVersion(r, args.quizVersion)) continue;
        if (!inRangeInclusive(r.completedAt, args.startMs, args.endMs))
          continue;
        const key = r.resultPageId;
        const current = counts.get(key) ?? { count: 0 };
        const snapshot =
          typeof (r as { resultNameSnapshot?: unknown }).resultNameSnapshot ===
          "string"
            ? (
                (r as { resultNameSnapshot?: string }).resultNameSnapshot ?? ""
              ).trim()
            : "";
        counts.set(key, {
          count: current.count + 1,
          resultNameSnapshot:
            current.resultNameSnapshot ?? (snapshot || undefined),
        });
      }
    }

    return Array.from(counts.entries())
      .map(([resultPageId, row]) => {
        const snapshotMeta = parseAnimalTraitFromName(row.resultNameSnapshot);
        const currentMeta = resultIdToMeta.get(resultPageId);
        return {
          resultPageId,
          name: currentMeta?.name ?? row.resultNameSnapshot ?? resultPageId,
          animal: currentMeta?.animal ?? snapshotMeta.animal,
          trait: currentMeta?.trait ?? snapshotMeta.trait,
          count: row.count,
        };
      })
      .sort((a, b) => b.count - a.count);
  },
});

export const getCreatorTraitDistribution = query({
  args: {
    quizId: v.optional(v.id("quiz")),
    startMs: v.number(),
    endMs: v.number(),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);

    const quizzes: Doc<"quiz">[] = args.quizId
      ? [await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId)]
      : await listQuizzesForCreatorAnalytics(ctx, actorId);

    const resultIdToTrait = new Map<string, string | null>();
    for (const quiz of quizzes) {
      const results = (
        await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
      ).filter(Boolean) as Doc<"results">[];
      results.forEach((r, idx) => {
        const parsed = parseAnimalTraitFromName(r.pageName);
        const fallbackTrait =
          TRAIT_FALLBACK_NAMES[idx % TRAIT_FALLBACK_NAMES.length] ?? null;
        resultIdToTrait.set(String(r._id), parsed.trait ?? fallbackTrait);
      });
    }

    const counts = new Map<string, number>();
    for (const quiz of quizzes) {
      const quizResults = await ctx.db
        .query("quizResults")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quiz._id))
        .collect();

      for (const r of quizResults) {
        if (isDemoSession(r.sessionId)) continue;
        if (!matchesQuizVersion(r, args.quizVersion)) continue;
        if (!inRangeInclusive(r.completedAt, args.startMs, args.endMs))
          continue;
        const snapshot =
          typeof (r as { resultNameSnapshot?: unknown }).resultNameSnapshot ===
          "string"
            ? (r as { resultNameSnapshot?: string }).resultNameSnapshot
            : undefined;
        const trait =
          resultIdToTrait.get(r.resultPageId) ??
          parseAnimalTraitFromName(snapshot).trait ??
          "Unknown";
        counts.set(trait, (counts.get(trait) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([trait, count]) => ({ trait, count }))
      .sort((a, b) => b.count - a.count);
  },
});

export const getCreatorQuizDistribution = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);
    const quizzes = await listQuizzesForCreatorAnalytics(ctx, actorId);

    const counts = new Map<string, { title: string; count: number }>();
    for (const quiz of quizzes) {
      const quizResults = await ctx.db
        .query("quizResults")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quiz._id))
        .collect();

      for (const r of quizResults) {
        if (isDemoSession(r.sessionId)) continue;
        if (!inRangeInclusive(r.completedAt, args.startMs, args.endMs))
          continue;
        const key = String(quiz._id);
        const current = counts.get(key);
        if (current) {
          current.count += 1;
        } else {
          counts.set(key, { title: quiz.title || "Untitled", count: 1 });
        }
      }
    }

    return Array.from(counts.entries())
      .map(([quizId, value]) => ({
        quizId,
        title: value.title,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count);
  },
});
export const getCreatorSessionsTable = query({
  args: {
    quizId: v.optional(v.id("quiz")),
    startMs: v.number(),
    endMs: v.number(),
    page: v.number(), // 0-based
    pageSize: v.number(),
    resultPageId: v.optional(v.string()),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);

    const quizzes: Doc<"quiz">[] = args.quizId
      ? [await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId)]
      : await listQuizzesForCreatorAnalytics(ctx, actorId);

    const quizIdToTitle = new Map<string, string>();
    quizzes.forEach((q) => quizIdToTitle.set(String(q._id), q.title));

    const resultIdToMeta = new Map<
      string,
      { name: string; animal: string | null; trait: string | null }
    >();
    for (const quiz of quizzes) {
      const results = (
        await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
      ).filter(Boolean) as Doc<"results">[];
      results.forEach((r, idx) => {
        const displayName =
          r.pageName ?? RESULT_FALLBACK_NAMES[idx] ?? `Result ${idx + 1}`;
        const parsed = parseAnimalTraitFromName(r.pageName);
        const fallbackTrait =
          TRAIT_FALLBACK_NAMES[idx % TRAIT_FALLBACK_NAMES.length] ?? null;
        resultIdToMeta.set(String(r._id), {
          name: displayName,
          animal: parsed.animal ?? displayName,
          trait: parsed.trait ?? fallbackTrait,
        });
      });
    }

    const resultsBySessionId = new Map<
      string,
      { resultPageId: string; completedAt: number; resultNameSnapshot?: string }
    >();
    for (const quiz of quizzes) {
      const results = await ctx.db
        .query("quizResults")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quiz._id))
        .collect();
      for (const r of results) {
        if (isDemoSession(r.sessionId)) continue;
        if (!matchesQuizVersion(r, args.quizVersion)) continue;
        if (!inRangeInclusive(r.completedAt, args.startMs, args.endMs))
          continue;
        resultsBySessionId.set(r.sessionId, {
          resultPageId: r.resultPageId,
          completedAt: r.completedAt,
          resultNameSnapshot:
            typeof (r as { resultNameSnapshot?: unknown })
              .resultNameSnapshot === "string"
              ? (r as { resultNameSnapshot?: string }).resultNameSnapshot
              : undefined,
        });
      }
    }

    const allRows: Array<{
      quizId: Id<"quiz">;
      quizTitle: string;
      sessionId: string;
      quizVersion: number;
      startedAt: number;
      durationMs: number | null;
      resultName: string | null;
      resultAnimal: string | null;
      resultTrait: string | null;
      language: "en" | "cn" | null;
    }> = [];

    for (const quiz of quizzes) {
      const sessions = await ctx.db
        .query("quizSessions")
        .withIndex("by_quizId", (q: any) => q.eq("quizId", quiz._id))
        .collect();

      for (const s of sessions) {
        if (isDemoSession(s.sessionId)) continue;
        if (!matchesQuizVersion(s, args.quizVersion)) continue;
        if (!inRangeInclusive(s.startedAt, args.startMs, args.endMs)) continue;

        const r = resultsBySessionId.get(s.sessionId);
        if (args.resultPageId && (!r || r.resultPageId !== args.resultPageId))
          continue;
        const durationMs =
          s.status === "completed" &&
          typeof s.completedAt === "number" &&
          typeof s.startedAt === "number"
            ? Math.max(0, s.completedAt - s.startedAt)
            : null;

        allRows.push({
          quizId: s.quizId,
          quizTitle: quizIdToTitle.get(String(s.quizId)) ?? "Untitled",
          sessionId: s.sessionId,
          quizVersion: readQuizVersion(s),
          startedAt: s.startedAt,
          durationMs,
          resultName: r
            ? (r.resultNameSnapshot ??
              resultIdToMeta.get(r.resultPageId)?.name ??
              r.resultPageId)
            : null,
          resultAnimal: r
            ? (resultIdToMeta.get(r.resultPageId)?.animal ??
              parseAnimalTraitFromName(r.resultNameSnapshot).animal)
            : null,
          resultTrait: r
            ? (resultIdToMeta.get(r.resultPageId)?.trait ??
              parseAnimalTraitFromName(r.resultNameSnapshot).trait)
            : null,
          language:
            s.language === "en" || s.language === "cn" ? s.language : null,
        });
      }
    }

    allRows.sort((a, b) => b.startedAt - a.startedAt);

    const total = allRows.length;
    const start = Math.max(0, args.page) * Math.max(1, args.pageSize);
    const end = start + Math.max(1, args.pageSize);

    return {
      total,
      items: allRows.slice(start, end),
    };
  },
});

export const getCreatorSessionsCsvData = query({
  args: {
    quizId: v.id("quiz"),
    startMs: v.number(),
    endMs: v.number(),
    resultPageId: v.optional(v.string()),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);
    const quiz = await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId);

    const pages = (
      await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
    ).filter(Boolean) as Doc<"pages">[];
    const pageOrder = new Map<string, number>();
    const pageNames = pages.map((p, idx) => p.pageName ?? `Page ${idx + 1}`);
    pages.forEach((p, idx) => pageOrder.set(String(p._id), idx));

    const answerLabelByPageAndBox = new Map<string, string>();
    const matchingMapsByComponentId = new Map<string, MatchingNodeMaps>();
    const rankingItemLabelByComponentId = new Map<
      string,
      Map<string, string>
    >();
    const getTextLabel = (value: unknown): string => {
      const textFromData = typeof value === "string" ? value.trim() : "";
      return textFromData;
    };
    const getTextFromProps = (props: unknown): string => {
      if (typeof props !== "object" || props === null) return "";
      const maybeText = (props as Record<string, unknown>).text;
      return typeof maybeText === "string" ? maybeText.trim() : "";
    };
    const getGroupLabelFromChildren = (children: unknown[]): string => {
      const normalizedChildren = children.filter(
        (child): child is Record<string, unknown> =>
          typeof child === "object" && child !== null,
      );

      const readChildLabel = (child: Record<string, unknown>) =>
        getTextLabel(child.data) || getTextFromProps(child.props);

      const textChild = normalizedChildren.find(
        (child) => child.type === "text",
      );
      if (textChild) {
        const textLabel = readChildLabel(textChild);
        if (textLabel) return textLabel;
      }

      for (const child of normalizedChildren) {
        const label = readChildLabel(child);
        if (label) return label;
      }
      return "";
    };
    for (const page of pages) {
      const pageId = String(page._id);
      const components = await ctx.db
        .query("components")
        .withIndex("by_pageId", (q: any) => q.eq("pageId", pageId))
        .collect();
      for (const c of components) {
        if (c.action === "answerBox") {
          let label = getTextLabel(c.data) || getTextFromProps(c.props);
          if (!label && c.type === "group") {
            const children = Array.isArray(
              (c as { children?: unknown }).children,
            )
              ? ((c as { children?: unknown[] }).children ?? [])
              : [];
            label = getGroupLabelFromChildren(children);
          }
          if (label) {
            answerLabelByPageAndBox.set(`${pageId}::${String(c._id)}`, label);
          }
        }
        if (c.type !== "group") continue;
        const children = Array.isArray((c as { children?: unknown }).children)
          ? ((c as { children?: unknown[] }).children ?? [])
          : [];
        for (const child of children) {
          if (typeof child !== "object" || child === null) continue;
          const groupChild = child as {
            id?: unknown;
            action?: unknown;
            data?: unknown;
            props?: unknown;
          };
          if (
            groupChild.action !== "answerBox" ||
            typeof groupChild.id !== "string"
          )
            continue;
          const childLabel =
            getTextLabel(groupChild.data) || getTextFromProps(groupChild.props);
          if (!childLabel) continue;
          answerLabelByPageAndBox.set(
            `${pageId}::${groupChild.id}`,
            childLabel,
          );
        }
      }
      for (const c of components) {
        if ((c as { type?: unknown }).type !== "matching") continue;
        matchingMapsByComponentId.set(
          String(c._id),
          readMatchingNodeMapsFromProps(c.props),
        );
      }
      for (const c of components) {
        if ((c as { type?: unknown }).type !== "ranking") continue;
        const itemsRaw = (c as { props?: { items?: unknown } }).props?.items;
        if (!Array.isArray(itemsRaw)) continue;
        const labelById = new Map<string, string>();
        for (const item of itemsRaw) {
          if (typeof item !== "object" || item === null) continue;
          const obj = item as { id?: unknown; label?: unknown };
          if (typeof obj.id !== "string") continue;
          const label =
            typeof obj.label === "string" && obj.label.trim().length > 0
              ? obj.label.trim()
              : obj.id;
          labelById.set(obj.id, label);
        }
        if (labelById.size > 0) {
          rankingItemLabelByComponentId.set(String(c._id), labelById);
        }
      }
    }

    const resultIdToAnimal = new Map<string, string>();
    const resultIdToName = new Map<string, string>();
    const resultPages = (
      await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
    ).filter(Boolean) as Doc<"results">[];
    resultPages.forEach((r, idx) => {
      const parsed = parseAnimalTraitFromName(r.pageName);
      resultIdToName.set(
        String(r._id),
        r.pageName ?? RESULT_FALLBACK_NAMES[idx] ?? `Result ${idx + 1}`,
      );
      resultIdToAnimal.set(
        String(r._id),
        parsed.animal ??
          r.pageName ??
          RESULT_FALLBACK_NAMES[idx] ??
          `Result ${idx + 1}`,
      );
    });

    const resultBySessionId = new Map<
      string,
      { resultPageId: string; completedAt: number; resultNameSnapshot?: string }
    >();
    const quizResults = await ctx.db
      .query("quizResults")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();
    for (const r of quizResults) {
      if (isDemoSession(r.sessionId)) continue;
      if (!matchesQuizVersion(r, args.quizVersion)) continue;
      if (!inRangeInclusive(r.completedAt, args.startMs, args.endMs)) continue;
      resultBySessionId.set(r.sessionId, {
        resultPageId: r.resultPageId,
        completedAt: r.completedAt,
        resultNameSnapshot:
          typeof (r as { resultNameSnapshot?: unknown }).resultNameSnapshot ===
          "string"
            ? (r as { resultNameSnapshot?: string }).resultNameSnapshot
            : undefined,
      });
    }

    const responsesBySessionPage = new Map<string, string[]>();
    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();
    for (const r of responses) {
      if (isDemoSession(r.sessionId)) continue;
      if (!matchesQuizVersion(r, args.quizVersion)) continue;
      if (!inRangeInclusive(r.timestamp, args.startMs, args.endMs)) continue;
      const pageId = String(r.pageId);
      const pageIdx = pageOrder.get(pageId);
      if (pageIdx === undefined) continue;
      const qType = (r as { questionType?: string }).questionType;
      const persistedAnswer =
        typeof (r as { answerTextSnapshot?: unknown }).answerTextSnapshot ===
        "string"
          ? ((
              r as { answerTextSnapshot?: string }
            ).answerTextSnapshot?.trim() ?? "")
          : "";
      let answer =
        persistedAnswer.length > 0
          ? persistedAnswer
          : (answerLabelByPageAndBox.get(
              `${pageId}::${String(r.answerBoxId)}`,
            ) ?? String(r.answerBoxId));
      if (qType === "input") {
        const inputValue = (r as { inputValue?: unknown }).inputValue;
        if (typeof inputValue === "string" && inputValue.trim().length > 0) {
          answer = inputValue.trim();
        } else {
          answer = "—";
        }
      }
      const matchingPairs = (r as { matchingPairs?: Record<string, unknown> })
        .matchingPairs;
      if (
        matchingPairs &&
        typeof matchingPairs === "object" &&
        !Array.isArray(matchingPairs)
      ) {
        const maps = matchingMapsByComponentId.get(String(r.answerBoxId));
        const parts = Object.entries(matchingPairs)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => formatMatchingPairLabel(k, String(v), maps));
        answer = parts.length > 0 ? parts.join(" | ") : answer;
      } else if (qType === "slider") {
        const sliderValue = (r as { sliderValue?: unknown }).sliderValue;
        const sliderInterval = (r as { sliderInterval?: unknown })
          .sliderInterval;
        if (
          typeof sliderInterval === "number" &&
          Number.isFinite(sliderInterval)
        ) {
          answer = `tick ${Math.round(sliderInterval)}`;
        } else if (
          typeof sliderValue === "number" &&
          Number.isFinite(sliderValue)
        ) {
          answer = String(Math.round(sliderValue * 100) / 100);
        }
      } else if (qType === "ranking") {
        const rankingOrder = (r as { rankingOrder?: unknown }).rankingOrder;
        if (Array.isArray(rankingOrder) && rankingOrder.length > 0) {
          const labelById = rankingItemLabelByComponentId.get(
            String(r.answerBoxId),
          );
          const parts = rankingOrder
            .filter(
              (itemId): itemId is string =>
                typeof itemId === "string" && itemId.trim().length > 0,
            )
            .map(
              (itemId, idx) => `${idx + 1}.${labelById?.get(itemId) ?? itemId}`,
            );
          answer = parts.length > 0 ? parts.join("; ") : answer;
        }
      }

      const key = `${r.sessionId}::${pageIdx}`;
      const arr = responsesBySessionPage.get(key) ?? [];
      arr.push(answer);
      responsesBySessionPage.set(key, arr);

      if (
        pageNames[pageIdx] == null ||
        pageNames[pageIdx]?.trim().length === 0
      ) {
        const persistedPageName =
          typeof (r as { pageNameSnapshot?: unknown }).pageNameSnapshot ===
          "string"
            ? ((r as { pageNameSnapshot?: string }).pageNameSnapshot?.trim() ??
              "")
            : "";
        if (persistedPageName.length > 0) {
          pageNames[pageIdx] = persistedPageName;
        }
      }
    }

    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();

    const rows = sessions
      .filter((s) => !isDemoSession(s.sessionId))
      .filter((s) => matchesQuizVersion(s, args.quizVersion))
      .filter((s) => inRangeInclusive(s.startedAt, args.startMs, args.endMs))
      .filter((s) => {
        const r = resultBySessionId.get(s.sessionId);
        if (!args.resultPageId) return true;
        return !!r && r.resultPageId === args.resultPageId;
      })
      .map((s) => {
        const r = resultBySessionId.get(s.sessionId);
        const durationMs =
          s.status === "completed" &&
          typeof s.completedAt === "number" &&
          typeof s.startedAt === "number"
            ? Math.max(0, s.completedAt - s.startedAt)
            : null;
        const answers = Array.from({ length: pages.length }, (_, idx) => {
          const key = `${s.sessionId}::${idx}`;
          const vals = responsesBySessionPage.get(key) ?? [];
          const normalized = vals
            .flatMap((v) => String(v).split("|"))
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
          return normalized.length > 0
            ? Array.from(new Set(normalized)).join(";")
            : "—";
        });
        return {
          quizVersion: readQuizVersion(s),
          startedAt: s.startedAt,
          durationMs,
          resultName: r
            ? (r.resultNameSnapshot ??
              resultIdToName.get(r.resultPageId) ??
              "—")
            : "—",
          resultAnimal: r ? (resultIdToAnimal.get(r.resultPageId) ?? "—") : "—",
          answers,
        };
      })
      .sort((a, b) => b.startedAt - a.startedAt);

    return {
      questionCount: pages.length,
      pageNames,
      rows,
    };
  },
});

const DEFAULT_MATCHING_LEFT_NODES = [
  { id: "left-1", label: "a" },
  { id: "left-2", label: "b" },
];
const DEFAULT_MATCHING_RIGHT_NODES = [
  { id: "right-1", label: "A" },
  { id: "right-2", label: "B" },
];

type MatchingNodeMaps = {
  leftById: Map<string, string>;
  rightById: Map<string, string>;
};

function readMatchingNodeMapsFromProps(props: unknown): MatchingNodeMaps {
  const leftById = new Map<string, string>();
  const rightById = new Map<string, string>();
  const p =
    typeof props === "object" && props !== null
      ? (props as Record<string, unknown>)
      : {};
  const leftRaw = Array.isArray(p.leftNodes) ? p.leftNodes : null;
  const rightRaw = Array.isArray(p.rightNodes) ? p.rightNodes : null;
  const leftNodes =
    leftRaw && leftRaw.length > 0 ? leftRaw : DEFAULT_MATCHING_LEFT_NODES;
  const rightNodes =
    rightRaw && rightRaw.length > 0 ? rightRaw : DEFAULT_MATCHING_RIGHT_NODES;
  for (const n of leftNodes as unknown[]) {
    if (typeof n !== "object" || n === null) continue;
    const o = n as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    const label =
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : o.id;
    leftById.set(o.id, label);
  }
  for (const n of rightNodes as unknown[]) {
    if (typeof n !== "object" || n === null) continue;
    const o = n as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    const label =
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : o.id;
    rightById.set(o.id, label);
  }
  return { leftById, rightById };
}

/** Display as "rightLabel-leftLabel" (e.g. A-a) for bar charts. */
function formatMatchingPairLabel(
  leftId: string,
  rightId: string,
  maps: MatchingNodeMaps | undefined,
): string {
  const leftL = maps?.leftById.get(leftId) ?? leftId;
  const rightL = maps?.rightById.get(rightId) ?? rightId;
  return `${rightL}-${leftL}`;
}

/** Mirrors `normalizeSliderConfig` / `getSliderIntervalIndex` from play UI (Slider/types.ts). */
const SLIDER_DEFAULT_MIN = 0;
const SLIDER_DEFAULT_MAX = 5;

function normalizeSliderMetaFromProps(rawProps: unknown): {
  min: number;
  max: number;
  divisions: number;
} {
  const p =
    typeof rawProps === "object" && rawProps !== null
      ? (rawProps as Record<string, unknown>)
      : {};
  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;
  const rawMin = Math.floor(num(p.min, SLIDER_DEFAULT_MIN));
  const rawMax = Math.floor(num(p.max, SLIDER_DEFAULT_MAX));
  const min = Math.max(0, Math.min(rawMin, rawMax - 1));
  const max = Math.max(rawMax, min + 1);
  const divisions = max - min;
  return { min, max, divisions };
}

/** Same nearest tick as play `getSliderIntervalIndex` (Slider/types.ts). */
function sliderIntervalFromValue(
  value: number,
  min: number,
  max: number,
  divisions: number,
): number {
  const clamped = Math.min(Math.max(value, min), max);
  const range = max - min;
  if (range <= 0) return 0;
  const step = range / Math.max(1, divisions);
  const tickIndex = Math.round((clamped - min) / step);
  return Math.min(Math.max(tickIndex, 0), divisions);
}

export const getCreatorQuestionStats = query({
  args: {
    quizId: v.id("quiz"),
    startMs: v.number(),
    endMs: v.number(),
    quizVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUserId(ctx);
    const quiz = await requireQuizOwnedOrAdmin(ctx, args.quizId, actorId);

    const pages = (
      await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
    ).filter(Boolean) as Doc<"pages">[];
    const pageNameById = new Map<string, string>();
    pages.forEach((p, idx) =>
      pageNameById.set(String(p._id), p.pageName ?? `Page ${idx + 1}`),
    );
    const answerLabelByPageAndBox = new Map<string, string>();
    /** `answerBoxId` on responses is the component Convex `_id` (see getComponentsForPage). */
    const matchingMapsByComponentId = new Map<string, MatchingNodeMaps>();
    const rankingComponentIds = new Set<string>();
    const rankingItemLabelsByComponentId = new Map<string, Map<string, string>>();
    const sliderLabelByComponentId = new Map<string, string>();
    const sliderMetaByComponentId = new Map<
      string,
      { min: number; max: number; divisions: number }
    >();
    /** pageId → componentId → tick index 0…divisions → count */
    const sliderCountsByPage = new Map<
      string,
      Map<string, Map<number, number>>
    >();
    const bumpSliderSegment = (
      pageId: string,
      boxId: string,
      segment: number,
    ) => {
      const inner =
        sliderCountsByPage.get(pageId) ??
        new Map<string, Map<number, number>>();
      const bySeg = inner.get(boxId) ?? new Map<number, number>();
      bySeg.set(segment, (bySeg.get(segment) ?? 0) + 1);
      inner.set(boxId, bySeg);
      sliderCountsByPage.set(pageId, inner);
    };

    const getTextLabel = (value: unknown): string => {
      const textFromData = typeof value === "string" ? value.trim() : "";
      return textFromData;
    };

    const getTextFromProps = (props: unknown): string => {
      if (typeof props !== "object" || props === null) return "";
      const maybeText = (props as Record<string, unknown>).text;
      return typeof maybeText === "string" ? maybeText.trim() : "";
    };

    const getGroupLabelFromChildren = (children: unknown[]): string => {
      const normalizedChildren = children.filter(
        (child): child is Record<string, unknown> =>
          typeof child === "object" && child !== null,
      );

      const readChildLabel = (child: Record<string, unknown>) =>
        getTextLabel(child.data) || getTextFromProps(child.props);

      // Prefer explicit text component content as group button label.
      const textChild = normalizedChildren.find(
        (child) => child.type === "text",
      );
      if (textChild) {
        const textLabel = readChildLabel(textChild);
        if (textLabel) return textLabel;
      }

      // Fallback: first child that has any readable text.
      for (const child of normalizedChildren) {
        const label = readChildLabel(child);
        if (label) return label;
      }

      return "";
    };

    for (const page of pages) {
      const pageComponents = await ctx.db
        .query("components")
        .withIndex("by_pageId", (q: any) => q.eq("pageId", String(page._id)))
        .collect();

      for (const c of pageComponents) {
        if (c.action === "answerBox") {
          let label = getTextLabel(c.data) || getTextFromProps(c.props);
          if (!label && c.type === "group") {
            const children = Array.isArray(
              (c as { children?: unknown }).children,
            )
              ? ((c as { children?: unknown[] }).children ?? [])
              : [];
            label = getGroupLabelFromChildren(children);
          }
          if (label) {
            answerLabelByPageAndBox.set(
              `${String(page._id)}::${String(c._id)}`,
              label,
            );
          }
        }

        if (c.type !== "group") continue;
        const children = Array.isArray((c as { children?: unknown }).children)
          ? ((c as { children?: unknown[] }).children ?? [])
          : [];
        for (const child of children) {
          if (typeof child !== "object" || child === null) continue;
          const groupChild = child as {
            id?: unknown;
            action?: unknown;
            data?: unknown;
            props?: unknown;
          };
          if (
            groupChild.action !== "answerBox" ||
            typeof groupChild.id !== "string"
          )
            continue;
          const childLabel =
            getTextLabel(groupChild.data) || getTextFromProps(groupChild.props);
          if (!childLabel) continue;
          answerLabelByPageAndBox.set(
            `${String(page._id)}::${groupChild.id}`,
            childLabel,
          );
        }
      }

      for (const c of pageComponents) {
        if ((c as { type?: unknown }).type !== "matching") continue;
        const cid = String((c as { _id: unknown })._id);
        const maps = readMatchingNodeMapsFromProps(
          (c as { props?: unknown }).props,
        );
        matchingMapsByComponentId.set(cid, maps);
        answerLabelByPageAndBox.set(`${String(page._id)}::${cid}`, "Matching");
      }

      for (const c of pageComponents) {
        if ((c as { type?: unknown }).type !== "ranking") continue;
        const componentId = String((c as { _id: unknown })._id);
        rankingComponentIds.add(componentId);
        const itemsRaw = (c as { props?: { items?: unknown } }).props?.items;
        if (!Array.isArray(itemsRaw)) continue;
        const labelsByItemId = new Map<string, string>();
        for (const item of itemsRaw) {
          if (typeof item !== "object" || item === null) continue;
          const row = item as { id?: unknown; label?: unknown };
          if (typeof row.id !== "string") continue;
          const label =
            typeof row.label === "string" && row.label.trim().length > 0
              ? row.label.trim()
              : row.id;
          labelsByItemId.set(row.id, label);
        }
        rankingItemLabelsByComponentId.set(componentId, labelsByItemId);
      }

      for (const c of pageComponents) {
        if ((c as { type?: unknown }).type !== "slider") continue;
        const cid = String((c as { _id: unknown })._id);
        const props =
          typeof (c as { props?: unknown }).props === "object" &&
          (c as { props?: unknown }).props !== null
            ? ((c as { props?: unknown }).props as Record<string, unknown>)
            : {};
        const title =
          typeof props.title === "string" && props.title.trim()
            ? props.title.trim()
            : typeof props.label === "string" && props.label.trim()
              ? props.label.trim()
              : "Slider";
        sliderLabelByComponentId.set(cid, title);
        sliderMetaByComponentId.set(cid, normalizeSliderMetaFromProps(props));
      }
    }

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_quizId", (q: any) => q.eq("quizId", args.quizId))
      .collect();

    type AggRow = { count: number; label: string };
    const byPage = new Map<string, Map<string, AggRow>>();
    /** pageId -> componentId -> itemId -> positionIndex -> count */
    const rankingCountsByPage = new Map<
      string,
      Map<string, Map<string, Map<number, number>>>
    >();
    /** pageId -> componentId -> max observed position index (0-based) */
    const rankingMaxPositionByPage = new Map<string, Map<string, number>>();
    const bump = (pageId: string, aggKey: string, label: string) => {
      const pm = byPage.get(pageId) ?? new Map<string, AggRow>();
      const row = pm.get(aggKey);
      if (row) row.count += 1;
      else pm.set(aggKey, { count: 1, label });
      byPage.set(pageId, pm);
    };
    const bumpRankingPosition = (
      pageId: string,
      componentId: string,
      itemId: string,
      positionIndex: number,
    ) => {
      const byComponent =
        rankingCountsByPage.get(pageId) ??
        new Map<string, Map<string, Map<number, number>>>();
      const byItem =
        byComponent.get(componentId) ?? new Map<string, Map<number, number>>();
      const byPosition = byItem.get(itemId) ?? new Map<number, number>();
      byPosition.set(positionIndex, (byPosition.get(positionIndex) ?? 0) + 1);
      byItem.set(itemId, byPosition);
      byComponent.set(componentId, byItem);
      rankingCountsByPage.set(pageId, byComponent);

      const maxByComponent =
        rankingMaxPositionByPage.get(pageId) ?? new Map<string, number>();
      const currentMax = maxByComponent.get(componentId) ?? -1;
      if (positionIndex > currentMax) {
        maxByComponent.set(componentId, positionIndex);
        rankingMaxPositionByPage.set(pageId, maxByComponent);
      }
    };

    for (const r of responses) {
      if (isDemoSession(r.sessionId)) continue;
      if (!inRangeInclusive(r.timestamp, args.startMs, args.endMs)) continue;
      if (!matchesQuizVersion(r, args.quizVersion)) continue;

      const rawPairs = (r as { matchingPairs?: Record<string, unknown> })
        .matchingPairs;

      const pairEntries: [string, string][] = [];
      if (
        rawPairs &&
        typeof rawPairs === "object" &&
        !Array.isArray(rawPairs)
      ) {
        for (const [k, v] of Object.entries(rawPairs)) {
          if (typeof k !== "string") continue;
          if (v === undefined || v === null) continue;
          const rightId = String(v);
          if (!rightId) continue;
          pairEntries.push([k, rightId]);
        }
      }

      if (pairEntries.length > 0) {
        const maps = matchingMapsByComponentId.get(String(r.answerBoxId));
        for (const [leftId, rightId] of pairEntries) {
          const aggKey = `matching:${String(r.answerBoxId)}:${leftId}:${rightId}`;
          const label = formatMatchingPairLabel(leftId, rightId, maps);
          bump(String(r.pageId), aggKey, label);
        }
        continue;
      }

      const pageKey = String(r.pageId);
      const boxKey = String(r.answerBoxId);
      const qType = (r as { questionType?: string }).questionType;
      if (qType === "ranking" || rankingComponentIds.has(boxKey)) {
        const rankingOrder = (r as { rankingOrder?: unknown }).rankingOrder;
        if (Array.isArray(rankingOrder) && rankingOrder.length > 0) {
          const cleanedOrder = rankingOrder.filter(
            (itemId): itemId is string =>
              typeof itemId === "string" && itemId.trim().length > 0,
          );
          cleanedOrder.forEach((itemId, positionIndex) => {
            bumpRankingPosition(pageKey, boxKey, itemId, positionIndex);
          });
        }
        continue;
      }
      if (qType === "input") {
        continue;
      }
      const sliderVal = (r as { sliderValue?: unknown }).sliderValue;
      const sliderIntervalStored = (r as { sliderInterval?: unknown })
        .sliderInterval;
      if (qType === "slider") {
        const meta =
          sliderMetaByComponentId.get(boxKey) ??
          normalizeSliderMetaFromProps(undefined);
        let segment: number | null = null;
        if (
          typeof sliderIntervalStored === "number" &&
          Number.isFinite(sliderIntervalStored)
        ) {
          segment = Math.round(sliderIntervalStored);
        } else if (
          typeof sliderVal === "number" &&
          Number.isFinite(sliderVal)
        ) {
          const clamped = Math.min(Math.max(sliderVal, meta.min), meta.max);
          segment = sliderIntervalFromValue(
            clamped,
            meta.min,
            meta.max,
            meta.divisions,
          );
        }
        if (segment !== null) {
          const clampedSeg = Math.min(Math.max(segment, 0), meta.divisions);
          bumpSliderSegment(pageKey, boxKey, clampedSeg);
        }
        continue;
      }

      const persistedAnswer =
        typeof (r as { answerTextSnapshot?: unknown }).answerTextSnapshot ===
        "string"
          ? ((
              r as { answerTextSnapshot?: string }
            ).answerTextSnapshot?.trim() ?? "")
          : "";
      if (persistedAnswer.length > 0) {
        bump(pageKey, `snap:${boxKey}:${persistedAnswer}`, persistedAnswer);
        continue;
      }

      const fallbackLabel =
        answerLabelByPageAndBox.get(`${pageKey}::${boxKey}`) ?? boxKey;
      bump(pageKey, boxKey, fallbackLabel);
    }

    const pageIds = new Set<string>();
    for (const k of byPage.keys()) pageIds.add(k);
    for (const k of sliderCountsByPage.keys()) pageIds.add(k);
    for (const k of rankingCountsByPage.keys()) pageIds.add(k);

    return Array.from(pageIds)
      .map((pageId) => {
        const answerCounts = byPage.get(pageId) ?? new Map<string, AggRow>();
        const answers = Array.from(answerCounts.entries())
          .map(([answerBoxId, row]) => ({
            answerBoxId,
            answerLabel: row.label,
            count: row.count,
          }))
          .sort((a, b) => b.count - a.count);

        const inner =
          sliderCountsByPage.get(pageId) ??
          new Map<string, Map<number, number>>();
        const sliders = Array.from(inner.entries()).map(
          ([answerBoxId, countsBySeg]) => ({
            answerBoxId,
            label: sliderLabelByComponentId.get(answerBoxId) ?? "Slider",
            points: Array.from(countsBySeg.entries())
              .map(([segmentIndex, count]) => ({ segmentIndex, count }))
              .sort((a, b) => a.segmentIndex - b.segmentIndex),
          }),
        );

        const rankingByComponent =
          rankingCountsByPage.get(pageId) ??
          new Map<string, Map<string, Map<number, number>>>();
        const rankingMaxByComponent =
          rankingMaxPositionByPage.get(pageId) ?? new Map<string, number>();
        const rankings = Array.from(rankingByComponent.entries()).map(
          ([answerBoxId, countsByItem]) => {
            const maxPosition = Math.max(
              rankingMaxByComponent.get(answerBoxId) ?? -1,
              0,
            );
            const positionCount = maxPosition + 1;
            const itemLabels =
              rankingItemLabelsByComponentId.get(answerBoxId) ?? new Map();
            const items = Array.from(countsByItem.entries())
              .map(([itemId, countsByPosition]) => {
                const positions = Array.from(
                  { length: positionCount },
                  (_, idx) => {
                    const count = countsByPosition.get(idx) ?? 0;
                    return { positionIndex: idx, count };
                  },
                );
                const total = positions.reduce((sum, p) => sum + p.count, 0);
                return {
                  itemId,
                  label: itemLabels.get(itemId) ?? itemId,
                  total,
                  positions,
                };
              })
              .sort((a, b) => b.total - a.total);

            return {
              answerBoxId,
              positionCount,
              items,
            };
          },
        );

        return {
          pageId,
          pageName:
            pageNameById.get(pageId) ??
            (
              responses.find((r) => String(r.pageId) === pageId) as
                | { pageNameSnapshot?: string }
                | undefined
            )?.pageNameSnapshot ??
            pageId,
          answers,
          sliders,
          rankings,
        };
      })
      .sort((a, b) => a.pageName.localeCompare(b.pageName));
  },
});
