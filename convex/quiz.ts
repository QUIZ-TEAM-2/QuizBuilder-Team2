import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  componentSchema,
  groupChildSchema,
  pageBackgroundSchema,
  componentPositionSchema,
  pageTypeSchema,
  pageTransitionEffectSchema,
  quizTopicSchema,
} from "./schemas";
import {
  canActorPreviewQuiz,
  canPublicAccessQuiz,
  getPublishedQuizEditBlockMessage,
} from "./quizAccessRules";
import type { Id, Doc } from "./_generated/dataModel";

type PageType = "page" | "result" | "onboarding";
type PageAction =
  | "nextPage"
  | "previousPage"
  | "answerBox"
  | "hyperlink"
  | "startQuiz";
type QuestionMode =
  | "single"
  | "multiple"
  | "ranking"
  | "fill-in-blank"
  | "matching"
  | "slider";
type SpecialQuestionComponentType =
  | "ranking"
  | "input"
  | "matching"
  | "slider";

const DEFAULT_BRAND_NAME = "VisionVerse";
const SPECIAL_QUESTION_COMPONENT_TYPES = new Set<
  SpecialQuestionComponentType
>(["ranking", "input", "matching", "slider"]);

function isSpecialQuestionComponentType(
  type: string,
): type is SpecialQuestionComponentType {
  return SPECIAL_QUESTION_COMPONENT_TYPES.has(type as SpecialQuestionComponentType);
}

function isAnswerBoxQuestionMode(questionMode: QuestionMode | undefined): boolean {
  return questionMode === "single" || questionMode === "multiple";
}

function getExpectedQuestionComponentType(
  questionMode: QuestionMode | undefined,
): SpecialQuestionComponentType | null {
  switch (questionMode) {
    case "ranking":
      return "ranking";
    case "fill-in-blank":
      return "input";
    case "matching":
      return "matching";
    case "slider":
      return "slider";
    default:
      return null;
  }
}

function isComponentCompatibleWithQuestionMode(
  component: Pick<Doc<"components">, "type" | "action">,
  questionMode: QuestionMode | undefined,
): boolean {
  if (component.action === "answerBox") {
    return isAnswerBoxQuestionMode(questionMode);
  }

  if (!isSpecialQuestionComponentType(component.type)) {
    return true;
  }

  return component.type === getExpectedQuestionComponentType(questionMode);
}

function normalizeQuizTitleForUniqueness(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeEntityNameForUniqueness(name: string | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getNextAvailableNumberedName(
  prefix: "Page" | "Result",
  startNumber: number,
  existingNames: Array<string | undefined>,
): string {
  const existing = new Set(
    existingNames.map((name) => normalizeEntityNameForUniqueness(name)),
  );
  let nextNumber = Math.max(1, startNumber);
  let candidate = `${prefix} ${nextNumber}`;

  while (existing.has(normalizeEntityNameForUniqueness(candidate))) {
    nextNumber += 1;
    candidate = `${prefix} ${nextNumber}`;
  }

  return candidate;
}

interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GroupChild {
  id: string;
  type: string;
  data?: string;
  props?: Record<string, unknown>;
  action?: PageAction;
  actionProps?: Record<string, unknown>;
  relativePosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ComponentData {
  id: string;
  type: string;
  data?: string;
  props?: Record<string, unknown>;
  action?: PageAction;
  actionProps?: Record<string, unknown>;
  position: ComponentPosition;
  children?: GroupChild[];
}

async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

async function isAdminActor(
  ctx: QueryCtx | MutationCtx,
  actorId: Id<"users">,
): Promise<boolean> {
  const me = await ctx.db.get(actorId);
  return me?.role === "admin";
}

/** Owner or admin may access another user's quiz resources. */
async function canAccessUserResource(
  ctx: QueryCtx | MutationCtx,
  resourceOwnerId: Id<"users">,
  actorId: Id<"users">,
): Promise<boolean> {
  if (resourceOwnerId === actorId) {
    return true;
  }
  return (await isAdminActor(ctx, actorId)) === true;
}

async function requireOwnership<T extends { userId: Id<"users"> }>(
  ctx: QueryCtx | MutationCtx,
  resource: T | null,
  actorId: Id<"users">,
  _resourceName = "Resource",
): Promise<T> {
  if (!resource) {
    throw new Error("Unauthorized");
  }
  if (await canAccessUserResource(ctx, resource.userId, actorId)) {
    return resource;
  }
  throw new Error("Unauthorized");
}

function assertQuizEditable(quiz: Doc<"quiz">) {
  if (quiz.status === "published") {
    throw new Error(getPublishedQuizEditBlockMessage());
  }
}

async function getComponentsForPage(
  ctx: QueryCtx,
  pageId: string,
): Promise<ComponentData[]> {
  const allComponents = await ctx.db
    .query("components")
    .withIndex("by_pageId", (q) => q.eq("pageId", pageId))
    .collect();

  return allComponents.map((comp) => ({
    id: comp._id,
    type: comp.type,
    data: comp.data,
    props: comp.props,
    action: comp.action as PageAction | undefined,
    actionProps: comp.actionProps as Record<string, unknown> | undefined,
    position: comp.position,
    children: comp.children as GroupChild[] | undefined,
  }));
}

async function saveComponentsForPage(
  ctx: MutationCtx,
  pageId: string,
  pageType: PageType,
  userId: Id<"users">,
  components: ComponentData[],
): Promise<void> {
  for (const comp of components) {
    await ctx.db.insert("components", {
      pageId,
      pageType,
      type: comp.type,
      data: comp.data,
      props: comp.props,
      action: comp.action,
      actionProps: comp.actionProps,
      position: comp.position,
      children: comp.children,
      userId,
    });
  }
}

async function deleteComponentsForPage(
  ctx: MutationCtx,
  pageId: string,
): Promise<void> {
  const components = await ctx.db
    .query("components")
    .withIndex("by_pageId", (q) => q.eq("pageId", pageId))
    .collect();

  for (const comp of components) {
    await ctx.db.delete(comp._id);
  }
}

async function deleteComponentRecursively(
  ctx: MutationCtx,
  componentId: Id<"components">,
): Promise<void> {
  const children = await ctx.db
    .query("components")
    .withIndex("by_parentId", (q) => q.eq("parentId", componentId))
    .collect();

  for (const child of children) {
    await deleteComponentRecursively(ctx, child._id);
    await ctx.db.delete(child._id);
  }
}

async function removeIncompatibleQuestionComponents(
  ctx: MutationCtx,
  pageId: Id<"pages">,
  questionMode: QuestionMode | undefined,
): Promise<number> {
  const components = await ctx.db
    .query("components")
    .withIndex("by_pageId", (q) => q.eq("pageId", pageId))
    .collect();

  let removedCount = 0;
  for (const component of components) {
    if (isComponentCompatibleWithQuestionMode(component, questionMode)) {
      continue;
    }

    await deleteComponentRecursively(ctx, component._id);
    await ctx.db.delete(component._id);
    removedCount += 1;
  }

  return removedCount;
}

async function hydrateQuizForPlay(
  ctx: QueryCtx,
  quiz: Doc<"quiz">,
) {
  // Keep onboarding separate so the play client can show its dedicated start
  // screen before stepping through the ordered quiz pages.
  const allPages = (
    await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
  ).filter(Boolean);
  const pages = allPages.filter((p) => p!.pageType !== "onboarding");
  const results = (
    await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
  ).filter(Boolean);

  const onboarding = quiz.onboardingPageId
    ? await ctx.db.get(quiz.onboardingPageId)
    : null;

  const pagesHydrated = await Promise.all(
    pages.map(async (p) => ({
      ...p!,
      components: await getComponentsForPage(ctx, p!._id),
    })),
  );

  const resultsHydrated = await Promise.all(
    results.map(async (r) => ({
      ...r!,
      components: await getComponentsForPage(ctx, r!._id),
    })),
  );

  const onboardingHydrated = onboarding
    ? {
        ...onboarding,
        components: await getComponentsForPage(ctx, onboarding._id),
      }
    : null;

  return {
    ...quiz,
    pages: pagesHydrated,
    results: resultsHydrated,
    onboardingPage: onboardingHydrated,
  };
}

export const createQuiz = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    topic: v.optional(quizTopicSchema),
    brandName: v.optional(v.string()),
    brandAvatar: v.optional(v.string()),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const title = args.title.trim();

    if (!title) {
      return {
        ok: false,
        message: "Quiz title is required.",
      };
    }

    const normalizedTitle = normalizeQuizTitleForUniqueness(title);
    const userQuizzes = await ctx.db
      .query("quiz")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const duplicate = userQuizzes.find(
      (quiz) => normalizeQuizTitleForUniqueness(quiz.title) === normalizedTitle,
    );

    if (duplicate) {
      return {
        ok: false,
        message: "You already have a quiz with this title.",
      };
    }

    const now = Date.now();
    const quizId = await ctx.db.insert("quiz", {
      title,
      description: args.description,
      tags: args.tags,
      topic: args.topic,
      brandName: args.brandName ?? DEFAULT_BRAND_NAME,
      brandAvatar: args.brandAvatar,
      coverImage: args.coverImage,
      featured: false,
      userId,
      pageIds: [],
      resultIds: [],
      onboardingPageId: undefined,
      nextPageNumber: 1,
      nextResultNumber: 1,

      status: "draft",
      publishVersion: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("quizEvents", {
      quizId,
      type: "quiz_create",
      ts: now,
    });

    // Create onboarding page in the pages table with pageType: "onboarding"
    const onboardingPageId = await ctx.db.insert("pages", {
      quizId,
      pageName: "Onboarding",
      background: { color: "#0f172a" },
      userId,
      pageType: "onboarding",
    });

    await ctx.db.patch(quizId, { onboardingPageId, updatedAt: Date.now() });
    return {
      ok: true,
      id: quizId,
    };
  },
});

export const getUserQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const isAdmin = await isAdminActor(ctx, userId);
    const quizzes = isAdmin
      ? await ctx.db.query("quiz").order("desc").collect()
      : await ctx.db
          .query("quiz")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .order("desc")
          .collect();

    // Get page and result counts for each quiz, plus onboarding background
    const quizzesWithCounts = await Promise.all(
      quizzes.map(async (quiz) => {
        // Get onboarding page background if exists
        let onboardingBackground: { color?: string; image?: string } | null =
          null;
        if (quiz.onboardingPageId) {
          const onboardingPage = await ctx.db.get(quiz.onboardingPageId);
          if (onboardingPage?.background) {
            onboardingBackground = onboardingPage.background;
            // If there's an image storageId, get the URL
            if (
              onboardingBackground.image &&
              !onboardingBackground.image.startsWith("http")
            ) {
              try {
                const imageUrl = await ctx.storage.getUrl(
                  onboardingBackground.image as Id<"_storage">,
                );
                if (imageUrl) {
                  onboardingBackground = {
                    ...onboardingBackground,
                    image: imageUrl,
                  };
                }
              } catch {
                // If storage lookup fails, keep the original value
              }
            }
          }
        }

        let ownerDisplayName: string | undefined;
        if (isAdmin) {
          const owner = await ctx.db.get(quiz.userId);
          ownerDisplayName =
            owner?.username ??
            owner?.name ??
            owner?.email ??
            "unknown";
        }

        return {
          ...quiz,
          pageCount: quiz.pageIds.length,
          resultCount: quiz.resultIds.length,
          onboardingBackground,
          ...(isAdmin ? { ownerDisplayName } : {}),
        };
      }),
    );

    return quizzesWithCounts;
  },
});

export const getPublishedQuizzes = query({
  args: {},

  handler: async (ctx) => {

    /**
     * Fetch published quizzes for the Discover page.
     *
     * We also load:
     * - onboarding page background
     * - components belonging to that page
     *
     * This data is required for PhonePreview rendering.
     */

    const quizzes = await ctx.db
      .query("quiz")
      .withIndex("by_status", (q) =>
        q.eq("status", "published")
      )
      .order("desc")
      .collect();

    const results = await Promise.all(
      quizzes.map(async (quiz) => {

        let background = undefined;
        let components: any[] = [];

        if (quiz.onboardingPageId) {

          /**
           * Step 1: get onboarding page
           */

          const page = await ctx.db.get(
            quiz.onboardingPageId
          );

          if (page) {

            background = page.background;

            /**
             * Step 2: fetch components for this page
             */

            const pageComponents =
            await ctx.db
              .query("components")
              .withIndex("by_pageId", (q) =>
                q.eq(
                  "pageId",
                  quiz.onboardingPageId!.toString()
                )
              )
              .collect();

            components = pageComponents.map((component) => ({
              id: component._id,
              type: component.type,
              data: component.data,
              props: component.props,
              action: component.action as PageAction | undefined,
              actionProps:
                component.actionProps as Record<string, unknown> | undefined,
              position: component.position,
              children: component.children as GroupChild[] | undefined,
            }));
          }
        }

        return {
          _id: quiz._id,

          title: quiz.title,
          description: quiz.description,
          tags: quiz.tags ?? [],
          topic: quiz.topic ?? "general",
          featured: quiz.featured ?? false,
          featuredAt: quiz.featuredAt,
          brandName: quiz.brandName ?? DEFAULT_BRAND_NAME,
          brandAvatar: quiz.brandAvatar,
          coverImage: quiz.coverImage,

          _creationTime: quiz._creationTime,
          publishedAt: quiz.publishedAt,
          viewCount: (
            await ctx.db
              .query("quizEvents")
              .withIndex("by_quizId", (q) =>
                q.eq("quizId", quiz._id)
              )
              .collect()
          ).filter((event) => event.type === "view").length,

          /**
           * Required for PhonePreview
           */

          background,
          components,

          status: quiz.status,
        };
      })
    );

    return results;
  },
});
// Get a quiz for public viewing/playing (no auth required)

export const getPublicQuiz = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    if (!canPublicAccessQuiz(quiz.status)) {
      throw new Error("Quiz not available");
    }
    return await hydrateQuizForPlay(ctx, quiz);
  },
});

export const getPreviewQuiz = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      return null;
    }

    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      return null;
    }

    const isAdmin = await isAdminActor(ctx, actorId);
    if (
      !canActorPreviewQuiz({
        actorId,
        ownerId: quiz.userId,
        isAdmin,
      })
    ) {
      return null;
    }

    return await hydrateQuizForPlay(ctx, quiz);
  },
});

export const getQuiz = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );

    // Filter out onboarding pages from pageIds (they have pageType: "onboarding")
    const allPages = (
      await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
    ).filter(Boolean);
    const pages = allPages.filter((p) => p!.pageType !== "onboarding");
    const results = (
      await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
    ).filter(Boolean);

    // Get onboarding page from pages table
    const onboarding = quiz.onboardingPageId
      ? await ctx.db.get(quiz.onboardingPageId)
      : null;

    const pagesHydrated = await Promise.all(
      pages.map(async (p) => ({
        ...p!,
        components: await getComponentsForPage(ctx, p!._id),
      })),
    );

    const resultsHydrated = await Promise.all(
      results.map(async (r) => ({
        ...r!,
        components: await getComponentsForPage(ctx, r!._id),
      })),
    );

    const onboardingHydrated = onboarding
      ? {
          ...onboarding,
          components: await getComponentsForPage(ctx, onboarding._id),
        }
      : null;

    return {
      ...quiz,
      pages: pagesHydrated,
      results: resultsHydrated,
      onboardingPage: onboardingHydrated,
    };
  },
});

export const updateQuiz = mutation({
  args: {
    id: v.id("quiz"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    topic: v.optional(quizTopicSchema),
    brandName: v.optional(v.string()),
    brandAvatar: v.optional(v.string()),
    coverImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const updateData: Partial<{
      title: string;
      description: string | undefined;
      tags: string[] | undefined;
      topic:
        | "general"
        | "personality"
        | "beauty"
        | "fashion"
        | "wellness"
        | "education"
        | "entertainment"
        | "marketing"
        | "lifestyle"
        | "others"
        | undefined;
      brandName: string | undefined;
      brandAvatar: string | undefined;
      coverImage: string | undefined;
    }> = {};

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) {
        return {
          ok: false,
          message: "Quiz title is required.",
        };
      }

      const normalizedTitle = normalizeQuizTitleForUniqueness(title);
      const ownerQuizzes = await ctx.db
        .query("quiz")
        .withIndex("by_userId", (q) => q.eq("userId", quiz.userId))
        .collect();
      const duplicate = ownerQuizzes.find(
        (candidate) =>
          candidate._id !== args.id &&
          normalizeQuizTitleForUniqueness(candidate.title) === normalizedTitle,
      );

      if (duplicate) {
        return {
          ok: false,
          message: "You already have a quiz with this title.",
        };
      }

      updateData.title = title;
    }
    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.tags !== undefined) updateData.tags = args.tags;
    if (args.topic !== undefined) updateData.topic = args.topic;
    if (args.brandName !== undefined) updateData.brandName = args.brandName;
    if (args.brandAvatar !== undefined)
      updateData.brandAvatar = args.brandAvatar;
    if (args.coverImage !== undefined) updateData.coverImage = args.coverImage;

    await ctx.db.patch(args.id, { ...updateData, updatedAt: Date.now() });
    return {
      ok: true,
      quiz: await ctx.db.get(args.id),
    };
  },
});

// Delete a quiz and all its pages and results
export const deleteQuiz = mutation({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnership(ctx, await ctx.db.get(args.id), userId, "Quiz");

    // Delete all pages (including onboarding pages) and results for this quiz
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.id))
      .collect();

    const results = await ctx.db
      .query("results")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.id))
      .collect();

    // Delete all pages (including onboarding) and their components
    for (const page of pages) {
      await deleteComponentsForPage(ctx, page._id);
      await ctx.db.delete(page._id);
    }

    // Delete all results and their components
    for (const result of results) {
      await deleteComponentsForPage(ctx, result._id);
      await ctx.db.delete(result._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const createPage = mutation({
  args: {
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const existingPages = (
      await Promise.all(quiz.pageIds.map((pageId) => ctx.db.get(pageId)))
    ).filter(Boolean);
    const trimmedPageName = args.pageName?.trim();
    const nextPageNumber = quiz.nextPageNumber ?? (quiz.pageIds.length + 1);
    const pageName =
      trimmedPageName && trimmedPageName.length > 0
        ? trimmedPageName
        : getNextAvailableNumberedName(
            "Page",
            nextPageNumber,
            existingPages.map((page) => page?.pageName),
          );

    const pageId = await ctx.db.insert("pages", {
      quizId: args.quizId,
      pageName,
      background: args.background ?? { color: "#1e293b" },
      userId: quiz.userId,

      // default to "single" question mode for new pages
      questionMode: "single",
    });

    // Append to quiz.pageIds for explicit ordering
    await ctx.db.patch(args.quizId, {
      pageIds: [...quiz.pageIds, pageId],
      nextPageNumber: nextPageNumber + 1,
      updatedAt: Date.now(),
    });
    return pageId;
  },
});

export const updatePage = mutation({
  args: {
    id: v.id("pages"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    transitionEffect: v.optional(pageTransitionEffectSchema),

    questionMode: v.optional(
      v.union(
        v.literal("single"),
        v.literal("multiple"),
        v.literal("ranking"),
        v.literal("fill-in-blank"),
        v.literal("matching"),
        v.literal("slider"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(page.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const updateData: Partial<{
      pageName: string | undefined;
      background: typeof args.background;
      transitionEffect: typeof args.transitionEffect;
      questionMode:
        | "single"
        | "multiple"
        | "ranking"
        | "fill-in-blank"
        | "matching"
        | "slider"
        | undefined;
    }> = {};

    if (args.pageName !== undefined) updateData.pageName = args.pageName;
    if (args.background !== undefined) updateData.background = args.background;
    if (args.transitionEffect !== undefined) {
      updateData.transitionEffect = args.transitionEffect;
    }
    if (args.questionMode !== undefined) {
      updateData.questionMode = args.questionMode;
    }

    console.log("[quiz:updatePage] request", {
      pageId: args.id,
      pageName: page.pageName,
      existingQuestionMode: page.questionMode,
      nextQuestionMode: args.questionMode,
      updateData,
    });

    await ctx.db.patch(args.id, updateData);

    if (
      args.questionMode !== undefined &&
      args.questionMode !== page.questionMode
    ) {
      await removeIncompatibleQuestionComponents(ctx, args.id, args.questionMode);
    }

    await ctx.db.patch(page.quizId, { updatedAt: Date.now() });
    return await ctx.db.get(args.id);
  },
});

export const deletePage = mutation({
  args: { id: v.id("pages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await ctx.db.get(args.id);
    if (!page) {
      throw new Error("Page not found");
    }

    // Ensure the page still belongs to a quiz owned by the user
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(page.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    // Legacy pages may not have a userId set; ensure row owner matches quiz (or admin)
    if (
      page.userId &&
      !(await canAccessUserResource(ctx, page.userId, userId))
    ) {
      throw new Error("Unauthorized");
    }

    // Remove from quiz.pageIds to keep ordering state in sync
    const filtered = quiz.pageIds.filter((pid) => pid !== args.id);
    if (filtered.length !== quiz.pageIds.length) {
      await ctx.db.patch(page.quizId, {
        pageIds: filtered,
        updatedAt: Date.now(),
      });
    }

    await deleteComponentsForPage(ctx, args.id);

    await ctx.db.delete(args.id);
  },
});

export const getPage = query({
  args: { id: v.id("pages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );
    const components = await getComponentsForPage(ctx, args.id);
    return { ...page, components };
  },
});

export const createResult = mutation({
  args: {
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    const existingResults = (
      await Promise.all(quiz.resultIds.map((resultId) => ctx.db.get(resultId)))
    ).filter(Boolean);
    const trimmedPageName = args.pageName?.trim();
    const nextResultNumber = quiz.nextResultNumber ?? (quiz.resultIds.length + 1);
    const pageName =
      trimmedPageName && trimmedPageName.length > 0
        ? trimmedPageName
        : getNextAvailableNumberedName(
            "Result",
            nextResultNumber,
            existingResults.map((result) => result?.pageName),
          );

    const resultId = await ctx.db.insert("results", {
      quizId: args.quizId,
      pageName,
      background: args.background ?? { color: "#0f172a" },
      userId: quiz.userId,
    });

    // Append to quiz.resultIds for explicit ordering
    await ctx.db.patch(args.quizId, {
      resultIds: [...quiz.resultIds, resultId],
      nextResultNumber: nextResultNumber + 1,
      updatedAt: Date.now(),
    });
    return resultId;
  },
});

export const updateResult = mutation({
  args: {
    id: v.id("results"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    transitionEffect: v.optional(pageTransitionEffectSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(result.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const updateData: Partial<{
      pageName: string | undefined;
      background: typeof args.background;
      transitionEffect: typeof args.transitionEffect;
    }> = {};

    if (args.pageName !== undefined) updateData.pageName = args.pageName;
    if (args.background !== undefined) updateData.background = args.background;
    if (args.transitionEffect !== undefined) {
      updateData.transitionEffect = args.transitionEffect;
    }

    await ctx.db.patch(args.id, updateData);
    await ctx.db.patch(result.quizId, { updatedAt: Date.now() });
    return await ctx.db.get(args.id);
  },
});

export const deleteResult = mutation({
  args: { id: v.id("results") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(result.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    await deleteComponentsForPage(ctx, args.id);

    await ctx.db.delete(args.id);
    await ctx.db.patch(result.quizId, {
      resultIds: quiz.resultIds.filter((resultId) => resultId !== args.id),
      updatedAt: Date.now(),
    });
  },
});

export const getResult = query({
  args: { id: v.id("results") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );
    const components = await getComponentsForPage(ctx, args.id);
    return { ...result, components };
  },
});

export const reorderPages = mutation({
  args: {
    quizId: v.id("quiz"),
    pageIds: v.array(v.id("pages")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    // Verify all pages belong to this quiz and actor may edit them
    for (const pageId of args.pageIds) {
      const page = await ctx.db.get(pageId);
      if (!page || page.quizId !== args.quizId) {
        throw new Error("Invalid page ID in reorder list");
      }
      if (!(await canAccessUserResource(ctx, page.userId, userId))) {
        throw new Error("Invalid page ID in reorder list");
      }
    }

    // Update the explicit order list
    await ctx.db.patch(args.quizId, {
      pageIds: args.pageIds,
      updatedAt: Date.now(),
    });
  },
});

export const reorderResults = mutation({
  args: {
    quizId: v.id("quiz"),
    resultIds: v.array(v.id("results")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    // Verify all results belong to this quiz and actor may edit them
    for (const resultId of args.resultIds) {
      const result = await ctx.db.get(resultId);
      if (!result || result.quizId !== args.quizId) {
        throw new Error("Invalid result ID in reorder list");
      }
      if (!(await canAccessUserResource(ctx, result.userId, userId))) {
        throw new Error("Invalid result ID in reorder list");
      }
    }

    // Update the explicit order list
    await ctx.db.patch(args.quizId, {
      resultIds: args.resultIds,
      updatedAt: Date.now(),
    });
  },
});

export const setPageComponents = mutation({
  args: { id: v.id("pages"), components: v.array(componentSchema) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(page.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    await deleteComponentsForPage(ctx, args.id);

    // Save new components with default positions if not provided
    const componentsWithPositions = args.components.map((comp, index) => ({
      ...comp,
      position: comp.position ?? {
        x: 0,
        y: 5 + index * 18,
        width: 90,
        height: 15,
      },
    }));

    await saveComponentsForPage(
      ctx,
      args.id,
      "page",
      page.userId,
      componentsWithPositions as ComponentData[],
    );
    await ctx.db.patch(page.quizId, { updatedAt: Date.now() });
  },
});

export const setResultComponents = mutation({
  args: { id: v.id("results"), components: v.array(componentSchema) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );

    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(result.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    await deleteComponentsForPage(ctx, args.id);

    // Save new components with default positions if not provided
    const componentsWithPositions = args.components.map((comp, index) => ({
      ...comp,
      position: comp.position ?? {
        x: 0,
        y: 5 + index * 18,
        width: 90,
        height: 15,
      },
    }));

    await saveComponentsForPage(
      ctx,
      args.id,
      "result",
      result.userId,
      componentsWithPositions as ComponentData[],
    );
    await ctx.db.patch(result.quizId, { updatedAt: Date.now() });
  },
});

export const updateOnboardingPage = mutation({
  args: {
    id: v.id("pages"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    transitionEffect: v.optional(pageTransitionEffectSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    // Verify this is an onboarding page
    if (page.pageType !== "onboarding") {
      throw new Error("This page is not an onboarding page");
    }

    const updateData: Partial<{
      pageName: string | undefined;
      background: typeof args.background;
      transitionEffect: typeof args.transitionEffect;
    }> = {};

    if (args.pageName !== undefined) updateData.pageName = args.pageName;
    if (args.background !== undefined) updateData.background = args.background;
    if (args.transitionEffect !== undefined) {
      updateData.transitionEffect = args.transitionEffect;
    }

    await ctx.db.patch(args.id, updateData);
    await ctx.db.patch(page.quizId, { updatedAt: Date.now() });
    return await ctx.db.get(args.id);
  },
});

export const getOnboardingPage = query({
  args: { id: v.id("pages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    // Verify this is an onboarding page
    if (page.pageType !== "onboarding") {
      throw new Error("This page is not an onboarding page");
    }

    const components = await getComponentsForPage(ctx, args.id);
    return { ...page, components };
  },
});

export const setOnboardingComponents = mutation({
  args: { id: v.id("pages"), components: v.array(componentSchema) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    // Verify this is an onboarding page
    if (page.pageType !== "onboarding") {
      throw new Error("This page is not an onboarding page");
    }

    await deleteComponentsForPage(ctx, args.id);

    // Save new components with default positions if not provided
    const componentsWithPositions = args.components.map((comp, index) => ({
      ...comp,
      position: comp.position ?? {
        x: 0,
        y: 5 + index * 18,
        width: 90,
        height: 15,
      },
    }));

    await saveComponentsForPage(
      ctx,
      args.id,
      "onboarding",
      page.userId,
      componentsWithPositions as ComponentData[],
    );
    await ctx.db.patch(page.quizId, { updatedAt: Date.now() });
  },
});

// Create an onboarding page for a quiz (used when quiz doesn't have one)
export const createOnboardingPage = mutation({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );

    // If quiz already has an onboarding page, return it
    if (quiz.onboardingPageId) {
      return quiz.onboardingPageId;
    }

    const onboardingPageId = await ctx.db.insert("pages", {
      quizId: args.quizId,
      pageName: "Onboarding",
      background: { color: "#0f172a" },
      userId: quiz.userId,
      pageType: "onboarding",
    });

    // Update quiz with the new onboarding page ID
    await ctx.db.patch(args.quizId, {
      onboardingPageId,
      updatedAt: Date.now(),
    });

    return onboardingPageId;
  },
});

export const updateComponentPosition = mutation({
  args: {
    componentId: v.id("components"),
    position: componentPositionSchema,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    // This handles race conditions where position update fires after deletion
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.componentId, { position: args.position });
    return await ctx.db.get(args.componentId);
  },
});

export const updateComponentProps = mutation({
  args: {
    componentId: v.id("components"),
    props: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    // This handles race conditions where props update fires after deletion
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    const mergedProps = { ...(component.props ?? {}), ...args.props };
    await ctx.db.patch(args.componentId, { props: mergedProps });
    return await ctx.db.get(args.componentId);
  },
});

export const updateComponentData = mutation({
  args: {
    componentId: v.id("components"),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    // This handles race conditions where data update fires after deletion
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.componentId, { data: args.data });
    return await ctx.db.get(args.componentId);
  },
});

export const updateComponentAction = mutation({
  args: {
    componentId: v.id("components"),
    action: v.optional(
      v.union(
        v.literal("nextPage"),
        v.literal("previousPage"),
        v.literal("answerBox"),
        v.literal("hyperlink"),
        v.literal("startQuiz"),
      ),
    ),
    actionProps: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    if (component.pageType === "page" && args.action === "answerBox") {
      const page = await ctx.db.get(component.pageId as Id<"pages">);
      if (!page) {
        throw new Error("Page not found");
      }
      if (!isAnswerBoxQuestionMode(page.questionMode as QuestionMode | undefined)) {
        throw new Error(
          "Answer boxes are only allowed on single-choice or multiple-choice pages.",
        );
      }
    }

    const nextActionProps =
      args.action === "answerBox" &&
      typeof args.actionProps === "object" &&
      args.actionProps !== null &&
      typeof (args.actionProps as { resultMapping?: unknown }).resultMapping ===
        "object" &&
      (args.actionProps as { resultMapping?: unknown }).resultMapping !== null
        ? {
            ...(typeof component.actionProps === "object" &&
            component.actionProps !== null
              ? component.actionProps
              : {}),
            resultMapping: {
              ...((typeof component.actionProps === "object" &&
              component.actionProps !== null &&
              typeof (component.actionProps as { resultMapping?: unknown })
                .resultMapping === "object" &&
              (component.actionProps as { resultMapping?: unknown })
                .resultMapping !== null
                ? (component.actionProps as {
                    resultMapping?: Record<string, number>;
                  }).resultMapping
                : {}) ?? {}),
              ...((args.actionProps as {
                resultMapping?: Record<string, number>;
              }).resultMapping ?? {}),
            },
          }
        : args.actionProps;

    await ctx.db.patch(args.componentId, {
      action: args.action,
      actionProps: nextActionProps,
    });
    return await ctx.db.get(args.componentId);
  },
});

export const createMergeGroup = mutation({
  args: {
    componentIds: v.array(v.id("components")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    if (args.componentIds.length < 2) {
      throw new Error("Need at least 2 components to merge");
    }

    // Fetch all components and verify ownership
    const components: Doc<"components">[] = [];
    for (const componentId of args.componentIds) {
      const component = await ctx.db.get(componentId);
      if (!component) {
        throw new Error("Component not found");
      }
      if (!(await canAccessUserResource(ctx, component.userId, userId))) {
        throw new Error("Unauthorized");
      }
      // Don't allow merging groups (no nested groups)
      if (component.type === "group") {
        throw new Error("Cannot merge group components");
      }
      components.push(component);
    }

    // All components must be on the same page
    const pageId = components[0]!.pageId;
    const pageType = components[0]!.pageType;
    for (const comp of components) {
      if (comp.pageId !== pageId) {
        throw new Error("All components must be on the same page");
      }
    }

    // Calculate bounding box in absolute coordinates
    // Position x is center-based: -50 to 50 where 0 is center
    // To get left edge: 50 + x - width/2
    // To get right edge: 50 + x + width/2
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    for (const comp of components) {
      const pos = comp.position;
      const left = 50 + pos.x - pos.width / 2;
      const right = 50 + pos.x + pos.width / 2;
      const top = pos.y;
      const bottom = pos.y + pos.height;

      minLeft = Math.min(minLeft, left);
      maxRight = Math.max(maxRight, right);
      minTop = Math.min(minTop, top);
      maxBottom = Math.max(maxBottom, bottom);
    }

    // Group bounds
    const groupWidth = maxRight - minLeft;
    const groupHeight = maxBottom - minTop;
    // Group center x in absolute terms: minLeft + groupWidth/2
    // Convert back to center-based: (minLeft + groupWidth/2) - 50
    const groupCenterX = minLeft + groupWidth / 2 - 50;
    const groupY = minTop;

    // Create children with positions relative to the group
    const children = components.map((comp) => {
      const pos = comp.position;
      // Component left edge in absolute terms
      const compLeft = 50 + pos.x - pos.width / 2;
      const compTop = pos.y;

      // Convert to relative position within group
      // relativeX: offset from group center as percentage of group width
      // Component center relative to group: (compLeft + pos.width/2) - (minLeft + groupWidth/2)
      const compCenterAbs = compLeft + pos.width / 2;
      const groupCenterAbs = minLeft + groupWidth / 2;
      const relativeX =
        groupWidth > 0
          ? ((compCenterAbs - groupCenterAbs) / groupWidth) * 100
          : 0;

      // relativeY: percentage from top of group
      const relativeY =
        groupHeight > 0 ? ((compTop - minTop) / groupHeight) * 100 : 0;

      // Width and height as percentage of group dimensions
      const relativeWidth =
        groupWidth > 0 ? (pos.width / groupWidth) * 100 : 100;
      const relativeHeight =
        groupHeight > 0 ? (pos.height / groupHeight) * 100 : 100;

      return {
        id: comp._id,
        type: comp.type,
        data: comp.data,
        props: comp.props,
        action: comp.action,
        actionProps: comp.actionProps,
        relativePosition: {
          x: relativeX,
          y: relativeY,
          width: relativeWidth,
          height: relativeHeight,
        },
      };
    });

    const groupId = await ctx.db.insert("components", {
      pageId,
      pageType,
      type: "group",
      children,
      position: {
        x: groupCenterX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
      },
      userId: components[0]!.userId,
    });

    for (const componentId of args.componentIds) {
      await ctx.db.delete(componentId);
    }

    return await ctx.db.get(groupId);
  },
});

export const unmergeGroup = mutation({
  args: {
    groupId: v.id("components"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    if (!(await canAccessUserResource(ctx, group.userId, userId))) {
      throw new Error("Unauthorized");
    }
    if (group.type !== "group") {
      throw new Error("Component is not a group");
    }
    if (!group.children || group.children.length === 0) {
      throw new Error("Group has no children");
    }

    const groupPos = group.position;
    // Group left edge in absolute terms
    const groupLeft = 50 + groupPos.x - groupPos.width / 2;
    const groupTop = groupPos.y;

    // Create individual components from children
    const createdIds: Id<"components">[] = [];
    for (const child of group.children) {
      const relPos = child.relativePosition;

      // Convert relative position back to absolute
      // Child width in absolute terms
      const childWidth = (relPos.width / 100) * groupPos.width;
      const childHeight = (relPos.height / 100) * groupPos.height;

      // Child center relative to group center, then convert to absolute
      // relativeX is percentage offset from group center
      const childCenterOffset = (relPos.x / 100) * groupPos.width;
      const childCenterAbs = groupLeft + groupPos.width / 2 + childCenterOffset;
      // Convert to center-based x: childCenterAbs - 50
      const childX = childCenterAbs - 50;

      // Child top in absolute terms
      const childY = groupTop + (relPos.y / 100) * groupPos.height;

      const newId = await ctx.db.insert("components", {
        pageId: group.pageId,
        pageType: group.pageType,
        type: child.type,
        data: child.data,
        props: child.props,
        action: child.action,
        actionProps: child.actionProps,
        position: {
          x: childX,
          y: childY,
          width: childWidth,
          height: childHeight,
        },
        userId: group.userId,
      });
      createdIds.push(newId);
    }

    await ctx.db.delete(args.groupId);

    return { success: true, componentIds: createdIds };
  },
});

export const deleteComponent = mutation({
  args: {
    componentId: v.id("components"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    let component = await ctx.db.get(args.componentId);

    if (!component) {
      const components = await ctx.db.query("components").collect();

      for (const candidate of components) {
        if (
          candidate.type !== "group" ||
          !(await canAccessUserResource(ctx, candidate.userId, userId))
        ) {
          continue;
        }

        const children = Array.isArray(candidate.children)
          ? candidate.children
          : [];
        const containsDeletedChild = children.some(
          (child) =>
            typeof child === "object" &&
            child !== null &&
            "id" in child &&
            (child as { id?: unknown }).id === args.componentId,
        );

        if (containsDeletedChild) {
          component = candidate;
          break;
        }
      }

      if (!component) {
        return { success: true };
      }
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    // Delete all children recursively
    const deleteRecursively = async (parentId: string) => {
      const children = await ctx.db
        .query("components")
        .withIndex("by_parentId", (q) => q.eq("parentId", parentId))
        .collect();

      for (const child of children) {
        await deleteRecursively(child._id);
        await ctx.db.delete(child._id);
      }
    };

    await deleteRecursively(component._id);
    await ctx.db.delete(component._id);

    return { success: true };
  },
});

export const createComponent = mutation({
  args: {
    pageId: v.string(),
    pageType: pageTypeSchema,
    parentId: v.optional(v.string()),
    type: v.string(),
    data: v.optional(v.string()),
    props: v.optional(v.record(v.string(), v.any())),
    action: v.optional(v.string()),
    actionProps: v.optional(v.any()),
    position: componentPositionSchema,
    children: v.optional(v.array(groupChildSchema)),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    let contentOwnerId: Id<"users">;
    if (args.pageType === "result") {
      const result = await ctx.db.get(args.pageId as Id<"results">);
      const authorized = await requireOwnership(
        ctx,
        result,
        userId,
        "Result",
      );
      contentOwnerId = authorized.userId;
    } else {
      const page = await ctx.db.get(args.pageId as Id<"pages">);
      const authorized = await requireOwnership(
        ctx,
        page,
        userId,
        "Page",
      );
      contentOwnerId = authorized.userId;

      const questionMode = page?.questionMode as QuestionMode | undefined;
      if (isSpecialQuestionComponentType(args.type)) {
        const expectedType = getExpectedQuestionComponentType(questionMode);
        if (expectedType !== args.type) {
          throw new Error(
            "This page only allows components for its current question type.",
          );
        }
      }

      if (args.action === "answerBox" && !isAnswerBoxQuestionMode(questionMode)) {
        throw new Error(
          "Answer boxes are only allowed on single-choice or multiple-choice pages.",
        );
      }
    }

    const componentId = await ctx.db.insert("components", {
      pageId: args.pageId,
      pageType: args.pageType,
      parentId: args.parentId,
      type: args.type,
      data: args.data,
      props: args.props,
      action: args.action,
      actionProps: args.actionProps,
      position: args.position,
      children: args.children,
      userId: contentOwnerId,
    });

    return await ctx.db.get(componentId);
  },
});

export const publishQuiz = mutation({
  args: {
    id: v.id("quiz"),
  },

  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );

    const currentVersion =
      typeof (quiz as { publishVersion?: unknown }).publishVersion === "number"
        ? ((quiz as { publishVersion?: number }).publishVersion ?? 0)
        : 0;

    // Keep publish idempotent for already-published state.
    if (quiz.status === "published") {
      return {
        ok: true,
        quiz,
      };
    }

    const missingRequirements: string[] = [];
    if (quiz.resultIds.length === 0) {
      missingRequirements.push("at least one result page");
    }
    if (!quiz.coverImage?.trim()) {
      missingRequirements.push("cover image");
    }
    if (!quiz.description?.trim()) {
      missingRequirements.push("description");
    }

    if (missingRequirements.length > 0) {
      return {
        ok: false,
        message: `Cannot publish quiz. Please add ${missingRequirements.join(", ")} before publishing.`,
      };
    }

    await ctx.db.patch(args.id, {
      status: "published",
      publishVersion: currentVersion + 1,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      ok: true,
      quiz: await ctx.db.get(args.id),
    };
  },
});
// Check the logged-in user,confirm that this quiz belongs to him,change the status to "published",record the publication time

export const closeQuiz = mutation({
  args: {
    id: v.id("quiz"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );
    if (quiz.status === "closed") {
      return quiz;
    }
    await ctx.db.patch(args.id, {
      status: "closed",
      closedAt: Date.now(),
      featured: false,
      featuredAt: undefined,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.id);
  },
});
//add closeQuiz mutation to set quiz status to "closed" and record closedAt time.

export const setQuizFeatured = mutation({
  args: {
    id: v.id("quiz"),
    featured: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    if (!(await isAdminActor(ctx, userId))) {
      throw new Error("Only admins can update featured quizzes.");
    }

    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      throw new Error("Quiz not found.");
    }

    if (args.featured && quiz.status !== "published") {
      throw new Error("Only published quizzes can be marked as featured.");
    }

    await ctx.db.patch(args.id, {
      featured: args.featured,
      featuredAt: args.featured ? Date.now() : undefined,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

// =============================================================================
// CUSTOM LINK FUNCTIONS (For /quiz/[uuid]/custom-link page)
// =============================================================================

/**
 * Check if a custom slug is available (not taken and not reserved).
 * This is used for real-time validation in the frontend.
 */
export const checkSlugAvailability = query({
  args: { slug: v.string(), quizId: v.optional(v.id("quiz")) },
  handler: async (ctx, args) => {
    await requireUserId(ctx);

    const slug = args.slug.trim().toLowerCase();
    
    // 1. Reserved words check
    const RESERVED_WORDS = new Set([
      "quiz", "play", "template", "discover", "admin", "api",
      "login", "register", "new", "undefined", "null", "false", "true",
      "custom", "static", "public", "dashboard", "settings"
    ]);

    if (RESERVED_WORDS.has(slug)) {
      return { available: false, reason: "reserved" } as const;
    }

    // 2. Format check: a-z, 0-9, - only
    const SLUG_PATTERN = /^[a-z0-9-]+$/;
    if (!SLUG_PATTERN.test(slug)) {
      return { available: false, reason: "invalid_chars" } as const;
    }

    // 3. Length check
    if (slug.length < 3 || slug.length > 50) {
      return { available: false, reason: "invalid_length" } as const;
    }

    // 4. Hyphen rules
    if (slug.startsWith("-") || slug.endsWith("-")) {
      return { available: false, reason: "hyphen_at_edge" } as const;
    }
    if (slug.includes("--")) {
      return { available: false, reason: "consecutive_hyphens" } as const;
    }
    if (/^-+$/.test(slug)) {
      return { available: false, reason: "all_hyphens" } as const;
    }

    // 5. Uniqueness check
    const existing = await ctx.db
      .query("quiz")
      .withIndex("by_customSlug", (q) => q.eq("customSlug", slug))
      .unique();

    if (existing && existing._id !== args.quizId) {
      return { available: false, reason: "taken" } as const;
    }

    return { available: true } as const;
  },
});

/**
 * Update the custom slug for a specific quiz.
 * Validates ownership and uniqueness.
 */
export const updateCustomSlug = mutation({
  args: {
    quizId: v.id("quiz"),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnership(ctx, await ctx.db.get(args.quizId), userId, "Quiz");

    const slug = args.slug.trim().toLowerCase();
    
    // Re-run validation for safety
    const RESERVED_WORDS = new Set([
      "quiz", "play", "template", "discover", "admin", "api",
      "login", "register", "new", "undefined", "null", "false", "true",
      "custom", "static", "public", "dashboard", "settings"
    ]);

    if (slug.length < 3 || slug.length > 50) {
      throw new Error("Link must be between 3 and 50 characters long.");
    }

    const SLUG_PATTERN = /^[a-z0-9-]+$/;
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error("Use lowercase letters, numbers, and hyphens only.");
    }

    if (slug.startsWith("-") || slug.endsWith("-")) {
      throw new Error("Link cannot start or end with a hyphen.");
    }

    if (slug.includes("--")) {
      throw new Error("Link cannot contain consecutive hyphens.");
    }

    if (RESERVED_WORDS.has(slug)) {
      throw new Error("This link is reserved.");
    }

    const existingQuiz = await ctx.db
      .query("quiz")
      .withIndex("by_customSlug", (q) => q.eq("customSlug", slug))
      .unique();

    if (existingQuiz && existingQuiz._id !== args.quizId) {
      throw new Error("This link is already taken.");
    }

    await ctx.db.patch(args.quizId, {
      customSlug: slug,
      updatedAt: Date.now(),
    });

    return { success: true, slug };
  },
});

export const clearCustomSlug = mutation({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnership(ctx, await ctx.db.get(args.quizId), userId, "Quiz");

    await ctx.db.patch(args.quizId, {
      customSlug: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase();
    const quiz = await ctx.db
      .query("quiz")
      .withIndex("by_customSlug", (q) => q.eq("customSlug", slug))
      .unique();
    return quiz; 
  },
});
