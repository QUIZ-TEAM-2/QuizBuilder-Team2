import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  componentSchema,
  pageBackgroundSchema,
  componentPositionSchema,
  pageTypeSchema,
  pageTransitionEffectSchema,
  questionModeSchema,
} from "./schemas";

export default defineSchema({
  ...authTables,
  // Extend auth `users` with a handle chosen at email/password sign-up (Convex Auth pattern).
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("username", ["username"])
    .index("by_role", ["role"]),

  // Application tables
  quiz: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    brandName: v.optional(v.string()),
    brandAvatar: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    topic: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    featured: v.optional(v.boolean()),
    featuredAt: v.optional(v.number()),
    userId: v.id("users"),
    // Explicit references to pages/results for ordering
    pageIds: v.array(v.id("pages")),
    resultIds: v.array(v.id("results")),
    onboardingPageId: v.optional(v.id("pages")),
    nextPageNumber: v.optional(v.number()),
    nextResultNumber: v.optional(v.number()),

    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("closed"),
    ),
    createdAt: v.number(),
    /** Server-maintained: bump on quiz metadata / structure edits for admin "active designer" windows. */
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    //Added status field to the quiz table to track the lifecycle state of each quiz.
    customSlug: v.optional(v.string()),
    publishVersion: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_customSlug", ["customSlug"]),

  // Pages table - stores individual quiz pages and onboarding pages (without embedded components)
  pages: defineTable({
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    transitionEffect: v.optional(pageTransitionEffectSchema),
    userId: v.id("users"),
    // Page type: "page" for quiz pages, "onboarding" for onboarding page
    pageType: v.optional(v.union(v.literal("page"), v.literal("onboarding"))),
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
  })
    .index("by_quizId", ["quizId"])
    .index("by_userId", ["userId"]),

  // Results table - stores quiz result pages (without embedded components)
  results: defineTable({
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    transitionEffect: v.optional(pageTransitionEffectSchema),
    userId: v.id("users"),
  })
    .index("by_quizId", ["quizId"])
    .index("by_userId", ["userId"]),

  // Components table - stores individual components with position data
  components: defineTable({
    // Reference to the page this component belongs to
    pageId: v.string(), // Can be pages, results, or onboardingPages ID
    pageType: pageTypeSchema, // "page", "result", or "onboarding"

    // Parent component ID (null for root-level components)
    parentId: v.optional(v.string()),

    // Component data
    type: v.string(), // "image" | "text" | "shape" | "group"
    data: v.optional(v.string()),
    props: v.optional(v.record(v.string(), v.any())),
    action: v.optional(v.string()),
    actionProps: v.optional(v.any()),

    // For group components: array of child components with relative positions
    children: v.optional(v.array(v.any())),

    // Position relative to parent container (percentages 0-100)
    position: componentPositionSchema,

    // Owner
    userId: v.id("users"),
  })
    .index("by_pageId", ["pageId"])
    .index("by_parentId", ["parentId"])
    .index("by_userId", ["userId"]),

  images: defineTable({
    name: v.string(),
    userId: v.id("users"),
    storageId: v.id("_storage"), // Convex file storage reference
    format: v.optional(v.string()),
    size: v.optional(v.number()),
    hiddenFromPicker: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  audios: defineTable({
    name: v.string(),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    format: v.optional(v.string()),
    size: v.optional(v.number()),
    hiddenFromPicker: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  // Quiz sessions table - track user progress through quizzes
  quizSessions: defineTable({
    quizId: v.id("quiz"),
    userId: v.optional(v.id("users")), // Optional for anonymous users
    sessionId: v.string(), // Unique session identifier
    currentPageIndex: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    language: v.optional(v.union(v.literal("en"), v.literal("cn"))),
    quizVersion: v.optional(v.number()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_quizId", ["quizId"])
    .index("by_userId", ["userId"]),

  // Quiz responses table - individual answer selections
  quizResponses: defineTable({
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
    inputValue: v.optional(v.string()), // Text input for input components
    sliderValue: v.optional(v.number()),
    sliderInterval: v.optional(v.number()),
    quizVersion: v.optional(v.number()),
    pageNameSnapshot: v.optional(v.string()),
    answerTextSnapshot: v.optional(v.string()),
    /** For `questionType === "matching"`: left node id → right node id (user connections). */
    matchingPairs: v.optional(v.record(v.string(), v.string())),
    resultMapping: v.record(v.string(), v.number()), // The scoring applied
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_quizId", ["quizId"]),

  // Quiz results table - final calculated results
  quizResults: defineTable({
    sessionId: v.string(),
    quizId: v.id("quiz"),
    resultPageId: v.string(),
    quizVersion: v.optional(v.number()),
    resultNameSnapshot: v.optional(v.string()),
    totalScores: v.record(v.string(), v.number()), // Final scores per result page
    completedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_quizId", ["quizId"]),

  /** Append-only quiz analytics events (public play + admin aggregates). Demo sessions should use sessionId prefix "demo_" to exclude from admin KPIs. */
  quizEvents: defineTable({
    quizId: v.id("quiz"),
    type: v.union(
      v.literal("view"),
      v.literal("start"),
      v.literal("complete"),
      v.literal("answer"),
      v.literal("cta_click"),
      v.literal("result_page_view"),
      v.literal("quiz_create"),
    ),
    ts: v.number(),
    sessionId: v.optional(v.string()),
    language: v.optional(v.union(v.literal("en"), v.literal("cn"))),
    pageId: v.optional(v.string()),
    ctaKey: v.optional(v.string()),
  })
    .index("by_quizId", ["quizId"])
    .index("by_type_ts", ["type", "ts"])
    .index("by_quizId_type_ts", ["quizId", "type", "ts"]),

  /** Lead submissions from play flow (explicit submitQuizLead mutation). */
  quizLeads: defineTable({
    quizId: v.id("quiz"),
    sessionId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    createdAt: v.number(),
    resultPageId: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index("by_quizId", ["quizId"])
    .index("by_quiz_createdAt", ["quizId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  // Templates table - stores page templates for quiz, result, and onboarding pages
  templates: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    transitionEffect: v.optional(pageTransitionEffectSchema),
    components: v.array(componentSchema),
    questionMode: v.optional(questionModeSchema),
    templateType: v.union(
      v.literal("quiz"),
      v.literal("result"),
      v.literal("onboarding"),
    ),
    userId: v.id("users"),
  })
    .index("by_templateType", ["templateType"])
    .index("by_userId", ["userId"])
    .index("by_userId_templateType", ["userId", "templateType"]),
});
