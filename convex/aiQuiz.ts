import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import {
  REGEN_INSTRUCTION_MAX_LENGTH,
  buildComponentUpdates,
  buildRegenPrompt,
  buildRegenSchema,
  findQuestionParts,
  parseRegeneratedQuestion,
  type RegenComponent,
  type RegeneratedQuestion,
} from "./aiQuestionRegen";
import {
  AI_QUIZ_LIMITS,
  buildOnboardingLayout,
  buildPrompt,
  buildQuestionLayout,
  buildResponseSchema,
  buildResultLayout,
  normalizeCounts,
  parseAiQuizDraft,
  type AiQuizCounts,
  type AiQuizDraft,
  type ComponentSpec,
} from "./aiQuizDraft";

/** Any current Flash model works; override with GEMINI_MODEL if needed. */
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
/** Used for the last attempt if the main model keeps failing (e.g. overloaded). */
const DEFAULT_FALLBACK_MODEL = "gemini-flash-lite-latest";
const MAX_ATTEMPTS = 3;

/** Temporary failures on Google's side (overloaded, timeouts) worth retrying. */
class RetryableAiError extends Error {}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
/** GEMINI_API_BASE_URL lets you point at a proxy (or a fake server in tests). */
const geminiEndpoint = () =>
  (
    process.env.GEMINI_API_BASE_URL?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta/models"
  ).replace(/\/+$/, "");

async function requestDraft(
  apiKey: string,
  model: string,
  topic: string,
  counts: AiQuizCounts,
): Promise<unknown> {
  return requestGemini(apiKey, model, {
    prompt: buildPrompt(topic, counts),
    schema: buildResponseSchema(),
    temperature: 0.9,
    blockedMessage:
      "The AI couldn't write a quiz about that topic. Try rewording it.",
  });
}

async function requestGemini(
  apiKey: string,
  model: string,
  request: {
    prompt: string;
    schema: unknown;
    temperature: number;
    blockedMessage: string;
  },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(
      `${geminiEndpoint()}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: request.schema,
            temperature: request.temperature,
          },
        }),
      },
    );
  } catch (error) {
    // Network error or timeout reaching Google.
    throw new RetryableAiError(
      `Could not reach Gemini: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  if (response.status === 429) {
    throw new ConvexError(
      "The AI is busy right now (free tier limit reached). Please wait a minute and try again.",
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      "Gemini request failed",
      model,
      response.status,
      body.slice(0, 500),
    );
    if (response.status >= 500) {
      throw new RetryableAiError(`Gemini ${model} returned ${response.status}`);
    }
    throw new ConvexError(
      response.status === 400 ||
      response.status === 403 ||
      response.status === 404
        ? "The AI service rejected the request. Check the GEMINI_API_KEY and GEMINI_MODEL settings."
        : "The AI service is unavailable right now. Please try again.",
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (payload.promptFeedback?.blockReason) {
    throw new ConvexError(request.blockedMessage);
  }
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
  return JSON.parse(text) as unknown;
}

/**
 * Generates a complete draft quiz (onboarding, question pages with scored
 * answer buttons, and result pages) from a short description.
 */
export const generateQuiz = action({
  args: {
    topic: v.string(),
    questions: v.optional(v.number()),
    results: v.optional(v.number()),
    answers: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ quizId: Id<"quiz"> }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in to generate a quiz.");

    const topic = args.topic.replace(/\s+/g, " ").trim();
    if (topic.length < 3) {
      throw new ConvexError("Describe your quiz in a few words first.");
    }
    if (topic.length > AI_QUIZ_LIMITS.topicMaxLength) {
      throw new ConvexError(
        `Keep the description under ${AI_QUIZ_LIMITS.topicMaxLength} characters.`,
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ConvexError(
        "AI generation isn't set up yet: add GEMINI_API_KEY to the Convex environment variables.",
      );
    }
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const counts = normalizeCounts(args);

    const fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;

    // Retries cover Google being briefly overloaded (5xx) and the occasional
    // malformed response. The last attempt uses a lighter fallback model.
    let draft: AiQuizDraft | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !draft; attempt += 1) {
      const attemptModel = attempt === MAX_ATTEMPTS - 1 ? fallbackModel : model;
      try {
        draft = parseAiQuizDraft(
          await requestDraft(apiKey, attemptModel, topic, counts),
          counts,
        );
      } catch (error) {
        if (error instanceof ConvexError) throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(1500 * (attempt + 1));
      }
    }
    if (!draft) {
      console.error("AI quiz generation failed", lastError);
      throw new ConvexError(
        lastError instanceof RetryableAiError
          ? "Google's AI is overloaded right now. Please try again in a minute."
          : lastError instanceof Error && !(lastError instanceof SyntaxError)
            ? lastError.message
            : "The AI returned something we couldn't use. Please try again.",
      );
    }

    const quizId: Id<"quiz"> = await ctx.runMutation(
      internal.aiQuiz.createQuizFromDraft,
      { userId, draft },
    );
    return { quizId };
  },
});

const normalizeTitle = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, " ");

export const createQuizFromDraft = internalMutation({
  args: { userId: v.id("users"), draft: v.any() },
  handler: async (ctx, args): Promise<Id<"quiz">> => {
    const draft = args.draft as AiQuizDraft;
    const { userId } = args;
    const now = Date.now();

    // Quiz titles must be unique per user.
    const existingTitles = new Set(
      (
        await ctx.db
          .query("quiz")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect()
      ).map((quiz) => normalizeTitle(quiz.title)),
    );
    let title = draft.title;
    for (let n = 2; existingTitles.has(normalizeTitle(title)); n += 1) {
      title = `${draft.title} (${n})`;
    }

    const quizId = await ctx.db.insert("quiz", {
      title,
      description: draft.description,
      brandName: "VisionVerse",
      featured: false,
      userId,
      pageIds: [],
      resultIds: [],
      nextPageNumber: draft.questions.length + 1,
      nextResultNumber: draft.results.length + 1,
      status: "draft",
      publishVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("quizEvents", { quizId, type: "quiz_create", ts: now });

    const insertComponents = async (
      pageId: string,
      pageType: "page" | "result" | "onboarding",
      specs: ComponentSpec[],
      resultIds: Array<Id<"results">>,
    ) => {
      for (const spec of specs) {
        const resultMapping = spec.scores
          ? Object.fromEntries(
              spec.scores.map((score) => [
                String(resultIds[score.resultIndex]),
                score.points,
              ]),
            )
          : undefined;
        await ctx.db.insert("components", {
          pageId,
          pageType,
          type: spec.type,
          data: spec.data,
          props: spec.props,
          action: spec.action,
          actionProps: resultMapping ? { resultMapping } : undefined,
          position: spec.position,
          userId,
        });
      }
    };

    const resultIds: Array<Id<"results">> = [];
    for (let i = 0; i < draft.results.length; i += 1) {
      const resultId = await ctx.db.insert("results", {
        quizId,
        pageName: draft.results[i]!.name,
        background: { color: draft.backgroundColor },
        userId,
      });
      resultIds.push(resultId);
      await insertComponents(
        String(resultId),
        "result",
        buildResultLayout(draft, i),
        resultIds,
      );
    }

    const onboardingPageId = await ctx.db.insert("pages", {
      quizId,
      pageName: "Onboarding",
      background: { color: draft.backgroundColor },
      userId,
      pageType: "onboarding",
    });
    await insertComponents(
      String(onboardingPageId),
      "onboarding",
      buildOnboardingLayout(draft),
      resultIds,
    );

    const pageIds: Array<Id<"pages">> = [];
    for (let i = 0; i < draft.questions.length; i += 1) {
      const pageId = await ctx.db.insert("pages", {
        quizId,
        pageName: `Question ${i + 1}`,
        background: { color: draft.backgroundColor },
        userId,
        questionMode: "single",
      });
      pageIds.push(pageId);
      await insertComponents(
        String(pageId),
        "page",
        buildQuestionLayout(draft, i),
        resultIds,
      );
    }

    await ctx.db.patch(quizId, {
      onboardingPageId,
      pageIds,
      resultIds,
      updatedAt: Date.now(),
    });
    return quizId;
  },
});

// ---------------------------------------------------------------------------
// Regenerate one question
// ---------------------------------------------------------------------------

type RegenPageContext = {
  quizTitle: string;
  quizDescription?: string;
  quizType: "personality" | "knowledge";
  results: Array<{ id: string; name: string }>;
  components: RegenComponent[];
  otherQuestions: string[];
};

/** Everything the AI needs about one question page. Owner or admin only. */
export const getRegenContext = internalQuery({
  args: { pageId: v.id("pages"), userId: v.id("users") },
  handler: async (ctx, args): Promise<RegenPageContext | { error: string }> => {
    const page = await ctx.db.get(args.pageId);
    const quiz = page ? await ctx.db.get(page.quizId) : null;
    if (!page || !quiz) return { error: "That question page no longer exists." };
    const user = await ctx.db.get(args.userId);
    if (quiz.userId !== args.userId && user?.role !== "admin") {
      return { error: "You can only edit your own quizzes." };
    }
    if (quiz.status === "published") {
      return { error: "Pause the quiz before editing its questions." };
    }

    const componentsFor = async (pageId: string) =>
      (await ctx.db
        .query("components")
        .withIndex("by_pageId", (q) => q.eq("pageId", pageId))
        .collect()) as unknown as RegenComponent[];

    const results: Array<{ id: string; name: string }> = [];
    for (const [index, resultId] of quiz.resultIds.entries()) {
      const result = await ctx.db.get(resultId);
      if (result) {
        results.push({
          id: String(resultId),
          name: result.pageName?.trim() || `Result ${index + 1}`,
        });
      }
    }

    const otherQuestions: string[] = [];
    for (const otherId of quiz.pageIds) {
      if (otherId === args.pageId) continue;
      const parts = findQuestionParts(await componentsFor(String(otherId)));
      if (!("error" in parts) && parts.question.data) {
        otherQuestions.push(parts.question.data.trim());
      }
    }

    return {
      quizTitle: quiz.title,
      quizDescription: quiz.description,
      quizType: quiz.quizType === "knowledge" ? "knowledge" : "personality",
      results,
      components: await componentsFor(String(args.pageId)),
      otherQuestions,
    };
  },
});

export const applyQuestionUpdates = internalMutation({
  args: {
    pageId: v.id("pages"),
    updates: v.array(
      v.object({
        id: v.id("components"),
        data: v.string(),
        actionProps: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      const component = await ctx.db.get(update.id);
      // Skip anything deleted or moved off the page while the AI was working.
      if (!component || component.pageId !== String(args.pageId)) continue;
      await ctx.db.patch(update.id, {
        data: update.data,
        ...(update.actionProps !== undefined
          ? { actionProps: update.actionProps as unknown }
          : {}),
      });
    }
    const page = await ctx.db.get(args.pageId);
    if (page) {
      await ctx.db.patch(page.quizId, { updatedAt: Date.now() });
    }
  },
});

/**
 * Rewrites one question page's question and answers with Gemini, keeping the
 * layout and styling. An optional instruction steers it ("make it funnier").
 */
export const regenerateQuestion = action({
  args: { pageId: v.id("pages"), instruction: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ question: string; answers: string[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in to use AI.");

    const instruction = args.instruction?.replace(/\s+/g, " ").trim();
    if (instruction && instruction.length > REGEN_INSTRUCTION_MAX_LENGTH) {
      throw new ConvexError(
        `Keep the instruction under ${REGEN_INSTRUCTION_MAX_LENGTH} characters.`,
      );
    }

    const context = await ctx.runQuery(internal.aiQuiz.getRegenContext, {
      pageId: args.pageId,
      userId,
    });
    if ("error" in context) throw new ConvexError(context.error);

    const parts = findQuestionParts(context.components);
    if ("error" in parts) throw new ConvexError(parts.error);
    if (context.quizType === "personality" && context.results.length === 0) {
      throw new ConvexError("Add at least one result page first.");
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ConvexError(
        "AI generation isn't set up yet: add GEMINI_API_KEY to the Convex environment variables.",
      );
    }
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;

    const prompt = buildRegenPrompt({
      quizTitle: context.quizTitle,
      quizDescription: context.quizDescription,
      quizType: context.quizType,
      resultNames: context.results.map((result) => result.name),
      currentQuestion: parts.question.data?.trim() ?? "",
      currentAnswers: parts.answers.map((answer) => answer.data?.trim() ?? ""),
      otherQuestions: context.otherQuestions,
      instruction: instruction || undefined,
    });

    let regenerated: RegeneratedQuestion | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !regenerated; attempt += 1) {
      const attemptModel = attempt === MAX_ATTEMPTS - 1 ? fallbackModel : model;
      try {
        regenerated = parseRegeneratedQuestion(
          await requestGemini(apiKey, attemptModel, {
            prompt,
            schema: buildRegenSchema(context.quizType),
            temperature: 1,
            blockedMessage:
              "The AI couldn't rewrite that question. Try a different instruction.",
          }),
          {
            quizType: context.quizType,
            answerCount: parts.answers.length,
            resultCount: context.results.length,
          },
        );
      } catch (error) {
        if (error instanceof ConvexError) throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(1500 * (attempt + 1));
      }
    }
    if (!regenerated) {
      console.error("AI question regeneration failed", lastError);
      throw new ConvexError(
        lastError instanceof RetryableAiError
          ? "Google's AI is overloaded right now. Please try again in a minute."
          : lastError instanceof Error && !(lastError instanceof SyntaxError)
            ? lastError.message
            : "The AI returned something we couldn't use. Please try again.",
      );
    }

    const updates = buildComponentUpdates(parts, regenerated, {
      quizType: context.quizType,
      resultIds: context.results.map((result) => result.id),
    });
    await ctx.runMutation(internal.aiQuiz.applyQuestionUpdates, {
      pageId: args.pageId,
      updates: updates.map((update) => ({
        ...update,
        id: update.id as Id<"components">,
      })),
    });

    return {
      question: regenerated.question,
      answers: regenerated.answers.map((answer) => answer.text),
    };
  },
});
