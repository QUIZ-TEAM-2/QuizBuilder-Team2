import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

function logQuizPlayServer(label: string, payload: Record<string, unknown>) {
  console.log(`[quiz-play] ${label}`, payload);
}

function readTextLabel(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readTextFromProps(props: unknown): string {
  if (typeof props !== "object" || props === null) return "";
  const maybeText = (props as Record<string, unknown>).text;
  return typeof maybeText === "string" ? maybeText.trim() : "";
}

function getGroupLabelFromChildren(children: unknown[]): string {
  const normalizedChildren = children.filter(
    (child): child is Record<string, unknown> =>
      typeof child === "object" && child !== null,
  );

  const readChildLabel = (child: Record<string, unknown>) =>
    readTextLabel(child.data) || readTextFromProps(child.props);

  // Prefer explicit text component content as group button label.
  const textChild = normalizedChildren.find((child) => child.type === "text");
  if (textChild) {
    const label = readChildLabel(textChild);
    if (label) return label;
  }

  // Fallback: first child that has any readable text.
  for (const child of normalizedChildren) {
    const label = readChildLabel(child);
    if (label) return label;
  }

  return "";
}

function getComponentAnswerTextSnapshot(
  response: {
    answerBoxId: string;
    questionType?: string;
    inputValue?: string;
    rankingOrder?: string[];
    sliderValue?: number;
    sliderInterval?: number;
    matchingPairs?: Record<string, string>;
  },
  pageName: string,
  answerLabelById: Map<string, string>,
  rankingLabelsByComponent: Map<string, Map<string, string>>,
  matchingMapsByComponent: Map<
    string,
    { leftById: Map<string, string>; rightById: Map<string, string> }
  >,
): string {
  if (response.questionType === "input") {
    const val = (response.inputValue ?? "").trim();
    return val.length > 0 ? val : "—";
  }

  if (response.questionType === "ranking") {
    const order = Array.isArray(response.rankingOrder)
      ? response.rankingOrder
      : [];
    if (order.length === 0) return "—";
    const labelById = rankingLabelsByComponent.get(response.answerBoxId);
    return order
      .map((itemId, idx) => `${idx + 1}.${labelById?.get(itemId) ?? itemId}`)
      .join("; ");
  }

  if (response.questionType === "matching" && response.matchingPairs) {
    const maps = matchingMapsByComponent.get(response.answerBoxId);
    const parts = Object.entries(response.matchingPairs)
      .filter(
        ([, rightId]) =>
          typeof rightId === "string" && rightId.trim().length > 0,
      )
      .map(([leftId, rightId]) => {
        const left = maps?.leftById.get(leftId) ?? leftId;
        const right = maps?.rightById.get(rightId) ?? rightId;
        return `${right}-${left}`;
      });
    return parts.length > 0 ? parts.join(" | ") : "—";
  }

  if (response.questionType === "slider") {
    if (
      typeof response.sliderInterval === "number" &&
      Number.isFinite(response.sliderInterval)
    ) {
      return `tick ${Math.round(response.sliderInterval)}`;
    }
    if (
      typeof response.sliderValue === "number" &&
      Number.isFinite(response.sliderValue)
    ) {
      return String(Math.round(response.sliderValue * 100) / 100);
    }
    return "—";
  }

  // Default answerBox/multiple/single path
  return (
    answerLabelById.get(response.answerBoxId) ??
    response.answerBoxId ??
    pageName
  );
}

/**
 * Quiz Play System - No Authentication Required
 *
 * This module handles quiz playing functionality that works for:
 * - Anonymous users (no login required)
 * - Authenticated users (optional user tracking)
 *
 * All functions support anonymous access for public quiz playing.
 */

export const getQuizForPlay = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    // Completely public - no auth check needed
    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Get all pages and results for the quiz using explicit ordering
    const pages = (
      await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
    ).filter(Boolean);
    const results = (
      await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
    ).filter(Boolean);

    return {
      ...quiz,
      pages,
      results,
    };
  },
});

export const startQuizSession = mutation({
  args: {
    quizId: v.id("quiz"),
    sessionId: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("cn"))),
  },
  handler: async (ctx, args) => {
    // No auth required - anyone can play quizzes
    const userId = await getAuthUserId(ctx);
    const quiz = await ctx.db.get(args.quizId);
    const publishVersion =
      quiz &&
      typeof (quiz as { publishVersion?: unknown }).publishVersion === "number"
        ? ((quiz as { publishVersion?: number }).publishVersion ?? 0)
        : 0;

    const now = Date.now();
    const session = await ctx.db.insert("quizSessions", {
      quizId: args.quizId,
      userId: userId || undefined, // Optional - for anonymous users
      sessionId: args.sessionId,
      currentPageIndex: 0,
      startedAt: now,
      language: args.language,
      quizVersion: publishVersion,
      status: "in_progress",
    });

    await ctx.db.insert("quizEvents", {
      quizId: args.quizId,
      type: "start",
      ts: now,
      sessionId: args.sessionId,
      language: args.language,
    });

    return session;
  },
});

export const recordQuizView = mutation({
  args: {
    quizId: v.id("quiz"),
    sessionId: v.optional(v.string()),
    language: v.optional(v.union(v.literal("en"), v.literal("cn"))),
  },
  handler: async (ctx, args) => {
    if (args.sessionId) {
      const existingView = (
        await ctx.db
          .query("quizEvents")
          .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
          .collect()
      ).find(
        (event) => event.type === "view" && event.sessionId === args.sessionId,
      );

      if (existingView) {
        return existingView._id;
      }
    }

    return await ctx.db.insert("quizEvents", {
      quizId: args.quizId,
      type: "view",
      ts: Date.now(),
      sessionId: args.sessionId,
      language: args.language,
    });
  },
});

/** Hyperlink / CTA taps on play UI (Instagram, Website, Product link, etc.). */
export const recordCtaClick = mutation({
  args: {
    quizId: v.id("quiz"),
    sessionId: v.string(),
    ctaKey: v.optional(v.string()),
    pageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("quizEvents", {
      quizId: args.quizId,
      type: "cta_click",
      ts: Date.now(),
      sessionId: args.sessionId,
      pageId: args.pageId,
      ctaKey: args.ctaKey,
    });
    return { ok: true as const };
  },
});

/** Result page shown to the player (deduped per session + result page). */
export const recordResultPageView = mutation({
  args: {
    quizId: v.id("quiz"),
    sessionId: v.string(),
    resultPageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pageKey = args.resultPageId ?? "_default";
    const existing = (
      await ctx.db
        .query("quizEvents")
        .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
        .collect()
    ).find(
      (e) =>
        e.type === "result_page_view" &&
        e.sessionId === args.sessionId &&
        (e.pageId ?? "_default") === pageKey,
    );
    if (existing) {
      return { ok: true as const, deduped: true as const };
    }
    await ctx.db.insert("quizEvents", {
      quizId: args.quizId,
      type: "result_page_view",
      ts: Date.now(),
      sessionId: args.sessionId,
      pageId: args.resultPageId,
    });
    return { ok: true as const, deduped: false as const };
  },
});

/** Lead capture from play flow; call when a form collects contact info. */
export const submitQuizLead = mutation({
  args: {
    quizId: v.id("quiz"),
    sessionId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    resultPageId: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hasContact =
      (args.email && args.email.trim().length > 0) ||
      (args.phone && args.phone.trim().length > 0) ||
      (args.name && args.name.trim().length > 0);
    if (!hasContact) {
      throw new Error("Lead requires at least one of email, phone, or name");
    }
    await ctx.db.insert("quizLeads", {
      quizId: args.quizId,
      sessionId: args.sessionId,
      email: args.email?.trim(),
      name: args.name?.trim(),
      phone: args.phone?.trim(),
      createdAt: Date.now(),
      resultPageId: args.resultPageId,
      source: args.source,
    });
    return { ok: true as const };
  },
});

export const getQuizSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      return null; // Return null instead of throwing error
    }

    return session;
  },
});

export const updateQuizSession = mutation({
  args: {
    sessionId: v.string(),
    currentPageIndex: v.number(),
    status: v.optional(
      v.union(
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("abandoned"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Quiz session not found");
    }

    const updateData: {
      currentPageIndex: number;
      status?: typeof args.status;
      completedAt?: number;
    } = {
      currentPageIndex: args.currentPageIndex,
    };

    const now = Date.now();
    if (args.status) {
      updateData.status = args.status;
      if (args.status === "completed") {
        updateData.completedAt = now;
      }
    }

    const becomesCompleted =
      args.status === "completed" && session.status !== "completed";

    await ctx.db.patch(session._id, updateData);

    if (becomesCompleted) {
      await ctx.db.insert("quizEvents", {
        quizId: session.quizId,
        type: "complete",
        ts: now,
        sessionId: args.sessionId,
      });
    }

    return await ctx.db.get(session._id);
  },
});

export const recordQuizResponse = mutation({
  args: {
    sessionId: v.string(),
    quizId: v.id("quiz"),
    pageId: v.string(),
    answerBoxId: v.string(),
    questionType: v.optional(
      v.union(
        v.literal("answerBox"),
        v.literal("ranking"),
        v.literal("input"),
        v.literal("matching"),
        v.literal("slider"),
      ),
    ),
    rankingOrder: v.optional(v.array(v.string())),
    inputValue: v.optional(v.string()),
    sliderValue: v.optional(v.number()),
    sliderInterval: v.optional(v.number()),
    matchingPairs: v.optional(v.record(v.string(), v.string())),
    resultMapping: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const quizVersion =
      session &&
      typeof (session as { quizVersion?: unknown }).quizVersion === "number"
        ? ((session as { quizVersion?: number }).quizVersion ?? 0)
        : 0;
    const responseId = await ctx.db.insert("quizResponses", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      pageId: args.pageId,
      answerBoxId: args.answerBoxId,
      questionType: args.questionType,
      rankingOrder: args.rankingOrder,
      inputValue: args.inputValue,
      sliderValue: args.sliderValue,
      sliderInterval: args.sliderInterval,
      quizVersion,
      answerTextSnapshot: args.inputValue?.trim() || args.answerBoxId,
      matchingPairs: args.matchingPairs,
      resultMapping: args.resultMapping,
      timestamp: Date.now(),
    });

    return responseId;
  },
});

export const setQuizPageResponses = mutation({
  args: {
    sessionId: v.string(),
    quizId: v.id("quiz"),
    pageId: v.string(),
    responses: v.array(
      v.object({
        answerBoxId: v.string(),
        questionType: v.optional(
          v.union(
            v.literal("answerBox"),
            v.literal("ranking"),
            v.literal("input"),
            v.literal("matching"),
            v.literal("slider"),
          ),
        ),
        rankingOrder: v.optional(v.array(v.string())),
        inputValue: v.optional(v.string()),
        sliderValue: v.optional(v.number()),
        sliderInterval: v.optional(v.number()),
        matchingPairs: v.optional(v.record(v.string(), v.string())),
        resultMapping: v.record(v.string(), v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const quizVersion =
      session &&
      typeof (session as { quizVersion?: unknown }).quizVersion === "number"
        ? ((session as { quizVersion?: number }).quizVersion ?? 0)
        : 0;

    const pageDoc = await ctx.db.get(args.pageId as any);
    const pageNameSnapshot =
      pageDoc &&
      typeof (pageDoc as { pageName?: unknown }).pageName === "string"
        ? ((pageDoc as { pageName?: string }).pageName ?? "").trim()
        : "";

    const pageComponents = await ctx.db
      .query("components")
      .withIndex("by_pageId", (q: any) => q.eq("pageId", args.pageId))
      .collect();

    const answerLabelById = new Map<string, string>();
    const rankingLabelsByComponent = new Map<string, Map<string, string>>();
    const matchingMapsByComponent = new Map<
      string,
      { leftById: Map<string, string>; rightById: Map<string, string> }
    >();

    for (const c of pageComponents) {
      const cid = String(c._id);
      let directLabel = readTextLabel(c.data) || readTextFromProps(c.props);
      if (c.action === "answerBox") {
        if (!directLabel && c.type === "group") {
          const children = Array.isArray((c as { children?: unknown }).children)
            ? ((c as { children?: unknown[] }).children ?? [])
            : [];
          directLabel = getGroupLabelFromChildren(children);
        }
        if (directLabel) {
          answerLabelById.set(cid, directLabel);
        }
      }
      if (c.type === "group") {
        const children = Array.isArray((c as { children?: unknown }).children)
          ? ((c as { children?: unknown[] }).children ?? [])
          : [];
        for (const child of children) {
          if (typeof child !== "object" || child === null) continue;
          const gc = child as {
            id?: unknown;
            action?: unknown;
            data?: unknown;
            props?: unknown;
          };
          if (typeof gc.id !== "string") continue;
          if (gc.action !== "answerBox") continue;
          const childLabel =
            readTextLabel(gc.data) || readTextFromProps(gc.props);
          if (childLabel) answerLabelById.set(gc.id, childLabel);
        }
      }
      if (c.type === "ranking") {
        const itemsRaw = (c as { props?: { items?: unknown } }).props?.items;
        if (!Array.isArray(itemsRaw)) continue;
        const labels = new Map<string, string>();
        for (const item of itemsRaw) {
          if (typeof item !== "object" || item === null) continue;
          const obj = item as { id?: unknown; label?: unknown };
          if (typeof obj.id !== "string") continue;
          labels.set(
            obj.id,
            typeof obj.label === "string" && obj.label.trim().length > 0
              ? obj.label.trim()
              : obj.id,
          );
        }
        if (labels.size > 0) rankingLabelsByComponent.set(cid, labels);
      }
      if (c.type === "matching") {
        const leftById = new Map<string, string>();
        const rightById = new Map<string, string>();
        const props =
          typeof c.props === "object" && c.props !== null
            ? (c.props as Record<string, unknown>)
            : {};
        const leftNodes = Array.isArray(props.leftNodes) ? props.leftNodes : [];
        const rightNodes = Array.isArray(props.rightNodes)
          ? props.rightNodes
          : [];
        for (const node of leftNodes) {
          if (typeof node !== "object" || node === null) continue;
          const n = node as { id?: unknown; label?: unknown };
          if (typeof n.id !== "string") continue;
          leftById.set(
            n.id,
            typeof n.label === "string" && n.label.trim().length > 0
              ? n.label.trim()
              : n.id,
          );
        }
        for (const node of rightNodes) {
          if (typeof node !== "object" || node === null) continue;
          const n = node as { id?: unknown; label?: unknown };
          if (typeof n.id !== "string") continue;
          rightById.set(
            n.id,
            typeof n.label === "string" && n.label.trim().length > 0
              ? n.label.trim()
              : n.id,
          );
        }
        matchingMapsByComponent.set(cid, { leftById, rightById });
      }
    }

    const existingResponses = await ctx.db
      .query("quizResponses")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const pageResponses = existingResponses.filter(
      (response) =>
        response.quizId === args.quizId && response.pageId === args.pageId,
    );

    logQuizPlayServer("set-page-responses:start", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      pageId: args.pageId,
      previousResponses: pageResponses.map((response) => ({
        responseId: response._id,
        answerBoxId: response.answerBoxId,
        resultMapping: response.resultMapping,
      })),
      nextResponses: args.responses,
    });

    for (const response of pageResponses) {
      await ctx.db.delete(response._id);
    }

    const insertedIds = [];
    const ts = Date.now();
    for (const response of args.responses) {
      const answerTextSnapshot = getComponentAnswerTextSnapshot(
        response,
        pageNameSnapshot || String(args.pageId),
        answerLabelById,
        rankingLabelsByComponent,
        matchingMapsByComponent,
      );
      const responseId = await ctx.db.insert("quizResponses", {
        sessionId: args.sessionId,
        quizId: args.quizId,
        pageId: args.pageId,
        answerBoxId: response.answerBoxId,
        questionType: response.questionType,
        rankingOrder: response.rankingOrder,
        inputValue: response.inputValue,
        sliderValue: response.sliderValue,
        sliderInterval: response.sliderInterval,
        quizVersion,
        pageNameSnapshot: pageNameSnapshot || undefined,
        answerTextSnapshot,
        matchingPairs: response.matchingPairs,
        resultMapping: response.resultMapping,
        timestamp: ts,
      });
      insertedIds.push(responseId);
      await ctx.db.insert("quizEvents", {
        quizId: args.quizId,
        type: "answer",
        ts,
        sessionId: args.sessionId,
        pageId: args.pageId,
        ctaKey: response.answerBoxId,
      });
    }

    logQuizPlayServer("set-page-responses:done", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      pageId: args.pageId,
      insertedIds,
    });

    return insertedIds;
  },
});

export const getSessionResponses = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return responses;
  },
});

export const calculateQuizResults = mutation({
  args: {
    sessionId: v.string(),
    quizId: v.id("quiz"),
  },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Calculate total scores per result page
    const totalScores: Record<string, number> = {};

    // Initialize scores in the quiz's explicit result order.
    quiz.resultIds.forEach((resultPageId) => {
      totalScores[resultPageId] = 0;
    });

    logQuizPlayServer("calculate-results:responses", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      responses: responses.map((response) => ({
        responseId: response._id,
        pageId: response.pageId,
        answerBoxId: response.answerBoxId,
        resultMapping: response.resultMapping,
      })),
      resultIds: quiz.resultIds,
    });

    // Sum up scores from all responses
    responses.forEach((response) => {
      Object.entries(response.resultMapping).forEach(
        ([resultPageId, score]) => {
          if (totalScores[resultPageId] !== undefined) {
            totalScores[resultPageId] += score;
          }
        },
      );
    });

    // Determine the winning result page.
    // On ties, the earlier resultId in quiz.resultIds wins.
    let winningResultPageId = "";
    let highestScore = -Infinity;

    quiz.resultIds.forEach((resultPageId) => {
      const score = totalScores[resultPageId] ?? 0;
      if (score > highestScore) {
        highestScore = score;
        winningResultPageId = resultPageId;
      }
    });

    logQuizPlayServer("calculate-results:totals", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      totalScores,
      winningResultPageId,
      highestScore,
    });

    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const quizVersion =
      session &&
      typeof (session as { quizVersion?: unknown }).quizVersion === "number"
        ? ((session as { quizVersion?: number }).quizVersion ?? 0)
        : 0;
    const winningResultIndex = quiz.resultIds.findIndex(
      (resultId) => String(resultId) === winningResultPageId,
    );
    const winningResultDoc = winningResultPageId
      ? await ctx.db.get(winningResultPageId as any)
      : null;
    const resultPageName =
      winningResultDoc &&
      typeof (winningResultDoc as { pageName?: unknown }).pageName === "string"
        ? ((winningResultDoc as { pageName?: string }).pageName ?? "").trim()
        : undefined;
    const resultNameSnapshot =
      resultPageName ||
      (winningResultIndex >= 0
        ? `Result ${winningResultIndex + 1}`
        : winningResultPageId || undefined);

    const resultId = await ctx.db.insert("quizResults", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      resultPageId: winningResultPageId,
      quizVersion,
      resultNameSnapshot,
      totalScores,
      completedAt: Date.now(),
    });

    return {
      resultId,
      winningResultPageId,
      totalScores,
    };
  },
});

export const getQuizResults = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("quizResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    return result || null;
  },
});

export const getQuizAnalytics = query({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.userId !== userId) {
      throw new Error("Unauthorized or quiz not found");
    }

    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    const results = await ctx.db
      .query("quizResults")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    return {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s) => s.status === "completed")
        .length,
      abandonedSessions: sessions.filter((s) => s.status === "abandoned")
        .length,
      results,
      responses,
      sessions,
    };
  },
});
