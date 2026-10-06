/**
 * Pure logic for the AI quiz generator: the prompt, the JSON schema sent to
 * Gemini, validation of the model's output, and the page layouts built from
 * it. No database or network access here, so it can be unit tested.
 */

export const AI_QUIZ_LIMITS = {
  questions: { min: 3, max: 10, default: 5 },
  results: { min: 2, max: 5, default: 3 },
  answers: { min: 2, max: 4, default: 4 },
  topicMaxLength: 300,
} as const;

export const DEFAULT_ACCENT_COLOR = "#10b981";
const PRIMARY_POINTS = 2;
const SECONDARY_POINTS = 1;

export type AiQuizCounts = {
  questions: number;
  results: number;
  answers: number;
};

export type AiQuizAnswer = {
  text: string;
  /** Index into `results` this answer mainly points to. */
  result: number;
  /** Optional second result that also gets a point, or -1. */
  alsoResult: number;
};

export type AiQuizDraft = {
  title: string;
  description: string;
  accentColor: string;
  results: Array<{ name: string; description: string }>;
  questions: Array<{ question: string; answers: AiQuizAnswer[] }>;
};

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

export function normalizeCounts(input: Partial<AiQuizCounts>): AiQuizCounts {
  const { questions, results, answers } = AI_QUIZ_LIMITS;
  const pick = (
    value: unknown,
    limits: { min: number; max: number; default: number },
  ) =>
    typeof value === "number" && Number.isFinite(value)
      ? clampInt(value, limits.min, limits.max)
      : limits.default;
  return {
    questions: pick(input.questions, questions),
    results: pick(input.results, results),
    answers: pick(input.answers, answers),
  };
}

export function buildPrompt(topic: string, counts: AiQuizCounts): string {
  return [
    "You are writing a fun, engaging personality-style quiz for a mobile quiz app.",
    `Quiz idea from the creator: "${topic}"`,
    "",
    "Rules:",
    `- Write exactly ${counts.results} distinct results (outcomes a player can get). Each needs a short, catchy name (max 5 words) and a 1-2 sentence description written to the player ("You...").`,
    `- Write exactly ${counts.questions} questions. Each question is short (max 15 words).`,
    `- Each question has exactly ${counts.answers} answers. Each answer is short (max 8 words).`,
    `- For every answer, "result" is the 0-based index of the result it most points to. "alsoResult" is the index of a second result it slightly points to, or -1 if none.`,
    "- Spread answers across all results so every result is reachable and none dominates.",
    "- Title: max 8 words. Description: one inviting sentence (max 25 words).",
    "- accentColor: a hex colour like #10b981 that suits the theme and reads well with white text on a dark background.",
    "- Keep it friendly and suitable for all ages. Use Australian English spelling.",
  ].join("\n");
}

/** Gemini `responseSchema` (OpenAPI subset) describing an AiQuizDraft. */
export function buildResponseSchema() {
  return {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      description: { type: "STRING" },
      accentColor: { type: "STRING" },
      results: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            description: { type: "STRING" },
          },
          required: ["name", "description"],
        },
      },
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            answers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  text: { type: "STRING" },
                  result: { type: "INTEGER" },
                  alsoResult: { type: "INTEGER" },
                },
                required: ["text", "result"],
              },
            },
          },
          required: ["question", "answers"],
        },
      },
    },
    required: ["title", "description", "accentColor", "results", "questions"],
  };
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const cleanText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1).trimEnd()}…`
    : text;
};

/**
 * Validates and tidies the model's JSON. Throws an Error with a user-facing
 * message if the output can't be turned into a playable quiz.
 */
export function parseAiQuizDraft(
  raw: unknown,
  counts: AiQuizCounts,
): AiQuizDraft {
  const root = asRecord(raw);
  if (!root) throw new Error("The AI returned an unexpected response.");

  const results = (Array.isArray(root.results) ? root.results : [])
    .map((item) => {
      const record = asRecord(item);
      return {
        name: cleanText(record?.name, 40),
        description: cleanText(record?.description, 220),
      };
    })
    .filter((result) => result.name !== "")
    .slice(0, counts.results);

  if (results.length < AI_QUIZ_LIMITS.results.min) {
    throw new Error("The AI didn't produce enough results. Please try again.");
  }

  const resultCount = results.length;
  const validIndex = (value: unknown): number | null =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < resultCount
      ? value
      : null;

  const questions = (Array.isArray(root.questions) ? root.questions : [])
    .map((item, questionIndex) => {
      const record = asRecord(item);
      const answers = (Array.isArray(record?.answers) ? record.answers : [])
        .map((answerItem, answerIndex) => {
          const answer = asRecord(answerItem);
          const result =
            validIndex(answer?.result) ??
            (questionIndex + answerIndex) % resultCount;
          const also = validIndex(answer?.alsoResult);
          return {
            text: cleanText(answer?.text, 60),
            result,
            alsoResult: also !== null && also !== result ? also : -1,
          };
        })
        .filter((answer) => answer.text !== "")
        .slice(0, counts.answers);
      return { question: cleanText(record?.question, 140), answers };
    })
    .filter(
      (question) =>
        question.question !== "" &&
        question.answers.length >= AI_QUIZ_LIMITS.answers.min,
    )
    .slice(0, counts.questions);

  if (questions.length === 0) {
    throw new Error(
      "The AI didn't produce any usable questions. Please try again.",
    );
  }

  // Make sure every result can actually be won: any result that is never an
  // answer's main result takes over one answer.
  const used = new Set(
    questions.flatMap((q) => q.answers.map((a) => a.result)),
  );
  for (let r = 0; r < resultCount; r += 1) {
    if (used.has(r)) continue;
    const question = questions[r % questions.length]!;
    const answer = question.answers[question.answers.length - 1]!;
    answer.result = r;
    if (answer.alsoResult === r) answer.alsoResult = -1;
    used.add(r);
  }

  const accent =
    typeof root.accentColor === "string" ? root.accentColor.trim() : "";

  return {
    title: cleanText(root.title, 80) || "AI generated quiz",
    description: cleanText(root.description, 200),
    accentColor: /^#[0-9a-f]{6}$/i.test(accent) ? accent : DEFAULT_ACCENT_COLOR,
    results,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Layout: positions are percentages of the phone frame.
// ---------------------------------------------------------------------------

export type ComponentSpec = {
  type: "text" | "shape";
  data?: string;
  props: Record<string, unknown>;
  position: { x: number; y: number; width: number; height: number };
  action?: "answerBox" | "startQuiz";
  /** For answer buttons: result indexes and points, resolved to IDs later. */
  scores?: Array<{ resultIndex: number; points: number }>;
};

const text = (
  data: string,
  position: ComponentSpec["position"],
  props: Record<string, unknown>,
): ComponentSpec => ({
  type: "text",
  data,
  position,
  props: { align: "center", color: "#FFFFFF", ...props },
});

const button = (
  label: string,
  position: ComponentSpec["position"],
  accentColor: string,
  action: NonNullable<ComponentSpec["action"]>,
  scores?: ComponentSpec["scores"],
): ComponentSpec[] => [
  {
    type: "shape",
    position,
    props: {
      variant: "rectangle",
      fillColor: accentColor,
      strokeColor: null,
      strokeWidth: 0,
      opacity: 100,
      rotation: 0,
    },
  },
  {
    ...text(label, position, { fontSize: 16, bold: true, isButton: true }),
    action,
    scores,
  },
];

export function buildOnboardingLayout(draft: AiQuizDraft): ComponentSpec[] {
  return [
    text(
      draft.title,
      { x: 8, y: 22, width: 84, height: 20 },
      { fontSize: 30, bold: true },
    ),
    text(
      draft.description,
      { x: 10, y: 45, width: 80, height: 16 },
      { fontSize: 16, color: "#cbd5e1" },
    ),
    ...button(
      "Start quiz",
      { x: 20, y: 72, width: 60, height: 9 },
      draft.accentColor,
      "startQuiz",
    ),
  ];
}

export function buildQuestionLayout(
  draft: AiQuizDraft,
  questionIndex: number,
): ComponentSpec[] {
  const question = draft.questions[questionIndex]!;
  const specs: ComponentSpec[] = [
    text(
      `Question ${questionIndex + 1} of ${draft.questions.length}`,
      { x: 10, y: 8, width: 80, height: 5 },
      { fontSize: 13, color: "#94a3b8" },
    ),
    text(
      question.question,
      { x: 8, y: 15, width: 84, height: 20 },
      { fontSize: 22, bold: true },
    ),
  ];
  question.answers.forEach((answer, index) => {
    const scores = [{ resultIndex: answer.result, points: PRIMARY_POINTS }];
    if (answer.alsoResult >= 0) {
      scores.push({ resultIndex: answer.alsoResult, points: SECONDARY_POINTS });
    }
    specs.push(
      ...button(
        answer.text,
        { x: 8, y: 40 + index * 12.5, width: 84, height: 10 },
        draft.accentColor,
        "answerBox",
        scores,
      ),
    );
  });
  return specs;
}

export function buildResultLayout(
  draft: AiQuizDraft,
  resultIndex: number,
): ComponentSpec[] {
  const result = draft.results[resultIndex]!;
  return [
    text(
      "You got",
      { x: 10, y: 18, width: 80, height: 5 },
      { fontSize: 15, bold: true, color: draft.accentColor },
    ),
    text(
      result.name,
      { x: 8, y: 25, width: 84, height: 15 },
      { fontSize: 30, bold: true },
    ),
    text(
      result.description,
      { x: 10, y: 44, width: 80, height: 28 },
      { fontSize: 16, color: "#cbd5e1" },
    ),
  ];
}
