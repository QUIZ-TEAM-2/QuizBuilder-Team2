import { v } from "convex/values";

// ==========================================
// COMPONENT SCHEMAS
// ==========================================

/**
 * Shared props object for all component types.
 * We intentionally keep this untyped so new UI flags can be stored without schema churn.
 */
export const componentPropsSchema = v.record(v.string(), v.any());

export const componentActionSchema = v.union(
  v.literal("nextPage"),
  v.literal("previousPage"),
  v.literal("answerBox"),
  v.literal("hyperlink"),
  v.literal("startQuiz"),
);

/** Supported component types (non-group) */
const baseComponentTypeUnion = v.union(
  v.literal("image"),
  v.literal("text"),
  v.literal("shape"),
  v.literal("progressBar"),
  v.literal("ranking"),
  v.literal("input"),
  v.literal("matching"),
  v.literal("slider"),
  v.literal("bgm"),
);

/** All component types including group */
export const componentTypeUnion = v.union(
  v.literal("image"),
  v.literal("text"),
  v.literal("shape"),
  v.literal("progressBar"),
  v.literal("ranking"),
  v.literal("input"),
  v.literal("matching"),
  v.literal("slider"),
  v.literal("bgm"),
  v.literal("group"),
);

/**
 * Position schema for component placement relative to parent container.
 * All values are percentages (0-100) of the parent container dimensions.
 */
export const componentPositionSchema = v.object({
  x: v.number(), // Left position as percentage (0-100)
  y: v.number(), // Top position as percentage (0-100)
  width: v.number(), // Width as percentage (0-100)
  height: v.number(), // Height as percentage (0-100)
  rotation: v.optional(v.number()), // Rotation in degrees
});

/**
 * Relative position for child components within a group
 */
export const relativePositionSchema = v.object({
  x: v.number(), // Percentage offset from group center (-50 to 50)
  y: v.number(), // Percentage from top of group (0-100)
  width: v.number(), // Percentage of group width
  height: v.number(), // Percentage of group height
});

/**
 * Child component schema for group children
 */
export const groupChildSchema = v.object({
  id: v.string(),
  type: baseComponentTypeUnion, // Children cannot be groups (no nested groups)
  data: v.optional(v.string()),
  props: v.optional(componentPropsSchema),
  action: v.optional(componentActionSchema),
  actionProps: v.optional(v.any()),
  relativePosition: relativePositionSchema,
});

/**
 * Page type for component reference
 */
export const pageTypeSchema = v.union(
  v.literal("page"),
  v.literal("result"),
  v.literal("onboarding"),
);

export const componentSchema = v.object({
  id: v.string(),
  type: componentTypeUnion,
  data: v.optional(v.string()),
  props: v.optional(componentPropsSchema),
  action: v.optional(componentActionSchema),
  actionProps: v.optional(v.any()),
  // For group components: the child components with relative positions
  children: v.optional(v.array(groupChildSchema)),
  // Position fields for relative positioning
  position: v.optional(componentPositionSchema),
});

// ==========================================
// PAGE SCHEMA
// ==========================================

/**
 * Page background schema
 */
export const pageBackgroundSchema = v.object({
  color: v.optional(v.string()),
  image: v.optional(v.string()),
  imageOpacity: v.optional(v.number()),
});

export const pageTransitionEffectSchema = v.union(
  v.literal("none"),
  v.literal("push"),
  v.literal("uncover"),
  v.literal("peelOff"),
  v.literal("curtains"),
  v.literal("drape"),
  v.literal("wind"),
  v.literal("prestige"),
  v.literal("fade"),
  v.literal("coverflow"),
  v.literal("flip"),
  v.literal("cards"),
);

export const questionModeSchema = v.union(
  v.literal("single"),
  v.literal("multiple"),
  v.literal("ranking"),
  v.literal("fill-in-blank"),
  v.literal("matching"),
  v.literal("slider"),
);

export const quizTopicSchema = v.union(
  v.literal("general"),
  v.literal("personality"),
  v.literal("beauty"),
  v.literal("fashion"),
  v.literal("wellness"),
  v.literal("education"),
  v.literal("entertainment"),
  v.literal("marketing"),
  v.literal("lifestyle"),
  v.literal("others"),
);

/**
 * Page schema for quiz questions and results
 */
export const pageSchema = v.object({
  id: v.string(),
  pageName: v.optional(v.string()),
  components: v.array(componentSchema),
  background: v.optional(pageBackgroundSchema),
  transitionEffect: v.optional(pageTransitionEffectSchema),
});

// ==========================================
// QUIZ SESSION SCHEMAS
// ==========================================

/**
 * Quiz session schema for tracking user progress through a quiz
 */
export const quizSessionSchema = v.object({
  id: v.string(),
  quizId: v.id("quiz"),
  userId: v.optional(v.id("users")), // Optional for anonymous users
  sessionId: v.string(), // Unique session identifier for anonymous users
  currentPageIndex: v.number(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  status: v.union(
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("abandoned"),
  ),
});

/**
 * Quiz response schema for individual answer selections
 */
export const quizResponseSchema = v.object({
  id: v.string(),
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
  resultMapping: v.record(v.string(), v.number()), // The scoring applied
  timestamp: v.number(),
});

/**
 * Quiz result schema for final calculated results
 */
export const quizResultSchema = v.object({
  sessionId: v.string(),
  quizId: v.id("quiz"),
  resultPageId: v.string(),
  quizVersion: v.optional(v.number()),
  resultNameSnapshot: v.optional(v.string()),
  totalScores: v.record(v.string(), v.number()), // Final scores per result page
  completedAt: v.number(),
});
