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
export const DEFAULT_BACKGROUND_COLOR = "#0f172a";
export const DEFAULT_QUIZ_EMOJI = "✨";
export const DEFAULT_RESULT_EMOJI = "🌟";
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
  backgroundColor: string;
  emoji: string;
  results: Array<{ name: string; description: string; emoji: string }>;
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
    "- Theme: backgroundColor is a dark hex colour that suits the topic (e.g. deep navy, forest green, plum, charcoal), and accentColor is a bright hex colour that pops against it.",
    "- emoji: one emoji that represents the quiz. Each result also gets one emoji that fits it.",
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
      backgroundColor: { type: "STRING" },
      emoji: { type: "STRING" },
      results: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            description: { type: "STRING" },
            emoji: { type: "STRING" },
          },
          required: ["name", "description", "emoji"],
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
    required: [
      "title",
      "description",
      "accentColor",
      "backgroundColor",
      "emoji",
      "results",
      "questions",
    ],
  };
}

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Answer buttons read better without a trailing full stop ("Talk to a mate"). */
export const stripTrailingFullStop = (text: string): string =>
  text.endsWith("...") || text.endsWith("…") ? text : text.replace(/\.$/, "");

export const cleanText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  // Cut at a word boundary so we never end mid-word.
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

/** Keeps a short emoji from the model, or falls back. */
function cleanEmoji(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 &&
    trimmed.length <= 16 &&
    EMOJI_PATTERN.test(trimmed)
    ? trimmed
    : fallback;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Blends `a` towards `b` by `amount` (0 to 1). */
export function mixColors(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * amount,
    ca[1] + (cb[1] - ca[1]) * amount,
    ca[2] + (cb[2] - ca[2]) * amount,
  ]);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The pages always use white text, so the background must be dark and the
 * accent must stand out against it. Anything that fails falls back to the
 * defaults rather than producing an unreadable quiz.
 */
export function resolveTheme(
  backgroundValue: unknown,
  accentValue: unknown,
): { backgroundColor: string; accentColor: string } {
  const bg = typeof backgroundValue === "string" ? backgroundValue.trim() : "";
  const backgroundColor =
    HEX_PATTERN.test(bg) && contrastRatio(bg, "#ffffff") >= 7
      ? bg.toLowerCase()
      : DEFAULT_BACKGROUND_COLOR;
  const ac = typeof accentValue === "string" ? accentValue.trim() : "";
  const accentColor =
    HEX_PATTERN.test(ac) && contrastRatio(ac, backgroundColor) >= 3
      ? ac.toLowerCase()
      : DEFAULT_ACCENT_COLOR;
  return { backgroundColor, accentColor };
}

/** Dark or white text, whichever reads better on the accent colour. */
export const textOnAccent = (accent: string) =>
  contrastRatio(accent, "#0f172a") > contrastRatio(accent, "#ffffff")
    ? "#0f172a"
    : "#ffffff";

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
        emoji: cleanEmoji(record?.emoji, DEFAULT_RESULT_EMOJI),
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
            text: stripTrailingFullStop(cleanText(answer?.text, 64)),
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

  const theme = resolveTheme(root.backgroundColor, root.accentColor);

  return {
    title: cleanText(root.title, 80) || "AI generated quiz",
    description: cleanText(root.description, 200),
    accentColor: theme.accentColor,
    backgroundColor: theme.backgroundColor,
    emoji: cleanEmoji(root.emoji, DEFAULT_QUIZ_EMOJI),
    results,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Layout. Positions are percentages of the phone frame (390 x 844). `x` is the
// horizontal offset of the component's CENTRE from the middle of the screen,
// so x = 0 is centred. `y` is the top edge.
// ---------------------------------------------------------------------------

/** Phone width / height: converts a width % into the matching height %. */
const PHONE_ASPECT = 390 / 844;

export type ComponentSpec = {
  type: "text" | "shape" | "progressBar";
  data?: string;
  props: Record<string, unknown>;
  position: { x: number; y: number; width: number; height: number };
  action?: "answerBox" | "startQuiz";
  /** For answer buttons: result indexes and points, resolved to IDs later. */
  scores?: Array<{ resultIndex: number; points: number }>;
  /** Background decoration that may sit partly off-screen. Not saved. */
  decorative?: boolean;
};

type Theme = {
  accent: string;
  surface: string;
  muted: string;
  onAccent: string;
};

const themeOf = (draft: AiQuizDraft): Theme => ({
  accent: draft.accentColor,
  surface: mixColors(draft.backgroundColor, draft.accentColor, 0.16),
  muted: mixColors("#ffffff", draft.backgroundColor, 0.22),
  onAccent: textOnAccent(draft.accentColor),
});

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

const roundedBox = (
  position: ComponentSpec["position"],
  fillColor: string,
  options: {
    cornerRadius?: number;
    strokeColor?: string | null;
    strokeWidth?: number;
  } = {},
): ComponentSpec => ({
  type: "shape",
  position,
  props: {
    variant: "rectangle",
    fillColor,
    strokeColor: options.strokeColor ?? null,
    strokeWidth: options.strokeWidth ?? 0,
    cornerRadius: options.cornerRadius ?? 18,
    opacity: 100,
    rotation: 0,
  },
});

/** Soft accent-coloured circle in the background. `size` is a width %. */
const blob = (
  accent: string,
  centreX: number,
  top: number,
  size: number,
  opacity: number,
): ComponentSpec => ({
  type: "shape",
  decorative: true,
  position: { x: centreX, y: top, width: size, height: size * PHONE_ASPECT },
  props: {
    variant: "circle",
    fillColor: accent,
    strokeColor: null,
    strokeWidth: 0,
    opacity,
    rotation: 0,
  },
});

export function buildOnboardingLayout(draft: AiQuizDraft): ComponentSpec[] {
  const t = themeOf(draft);
  const count = draft.questions.length;
  const start = { x: 0, y: 66, width: 64, height: 7.5 };
  return [
    blob(t.accent, 42, -12, 90, 18),
    blob(t.accent, -45, 80, 70, 10),
    text(draft.emoji, { x: 0, y: 17, width: 40, height: 11 }, { fontSize: 64 }),
    text(
      draft.title,
      { x: 0, y: 29, width: 86, height: 13 },
      {
        fontSize: 30,
        bold: true,
      },
    ),
    text(
      draft.description,
      { x: 0, y: 43, width: 78, height: 10 },
      {
        fontSize: 16,
        color: t.muted,
      },
    ),
    text(
      `${count} questions · about ${Math.max(1, Math.round(count / 4))} min`,
      { x: 0, y: 55, width: 70, height: 4 },
      { fontSize: 13, bold: true, color: t.accent },
    ),
    roundedBox(start, t.accent, { cornerRadius: 28 }),
    {
      ...text("Start quiz", start, {
        fontSize: 17,
        bold: true,
        color: t.onAccent,
        isButton: true,
      }),
      action: "startQuiz",
    },
  ];
}

/** Space for the question and answers: below the progress dots, above the bottom edge. */
export const QUESTION_AREA = { top: 12, bottom: 92 } as const;

/** Moves the result page content down so it sits in the middle of the screen. */
const RESULT_OFFSET = 7;

export function buildQuestionLayout(
  draft: AiQuizDraft,
  questionIndex: number,
): ComponentSpec[] {
  const t = themeOf(draft);
  const question = draft.questions[questionIndex]!;
  const specs: ComponentSpec[] = [
    blob(t.accent, 40, -9, 55, 12),
    {
      type: "progressBar",
      position: { x: 0, y: 6, width: 70, height: 4 },
      props: { variant: "dots", currentColor: t.accent, totalColor: "#ffffff" },
    },
  ];

  // Fewer answers get taller cards, and the question plus answers sit in the
  // middle of the space under the progress dots instead of leaving the bottom
  // of the screen empty.
  const count = question.answers.length;
  const cardHeight = count <= 2 ? 13 : count === 3 ? 11 : 10;
  const gap = 3;
  const questionHeight = 17;
  const questionGap = 6;
  const blockHeight =
    questionHeight + questionGap + count * cardHeight + (count - 1) * gap;
  const top = Math.max(
    QUESTION_AREA.top,
    QUESTION_AREA.top + (QUESTION_AREA.bottom - QUESTION_AREA.top - blockHeight) / 2,
  );
  const answersTop = top + questionHeight + questionGap;

  specs.push(
    text(
      question.question,
      { x: 0, y: top, width: 86, height: questionHeight },
      {
        fontSize: 24,
        bold: true,
      },
    ),
  );

  question.answers.forEach((answer, index) => {
    const scores = [{ resultIndex: answer.result, points: PRIMARY_POINTS }];
    if (answer.alsoResult >= 0) {
      scores.push({ resultIndex: answer.alsoResult, points: SECONDARY_POINTS });
    }
    const y = answersTop + index * (cardHeight + gap);
    specs.push(
      roundedBox({ x: 0, y, width: 88, height: cardHeight }, t.surface, {
        cornerRadius: 18,
        strokeColor: t.accent,
        strokeWidth: 2,
      }),
      {
        // Narrower than its card so long answers wrap inside the padding.
        ...text(
          answer.text,
          { x: 0, y, width: 78, height: cardHeight },
          {
            fontSize: 15,
            bold: true,
            isButton: true,
          },
        ),
        action: "answerBox",
        scores,
      },
    );
  });
  return specs;
}

export function buildResultLayout(
  draft: AiQuizDraft,
  resultIndex: number,
): ComponentSpec[] {
  const t = themeOf(draft);
  const result = draft.results[resultIndex]!;
  return [
    blob(t.accent, -40, -10, 85, 16),
    blob(t.accent, 45, 82, 60, 10),
    text(
      "You got",
      { x: 0, y: 12 + RESULT_OFFSET, width: 60, height: 4 },
      {
        fontSize: 15,
        bold: true,
        color: t.accent,
      },
    ),
    text(
      result.emoji,
      { x: 0, y: 18 + RESULT_OFFSET, width: 40, height: 12 },
      { fontSize: 64 },
    ),
    text(
      result.name,
      { x: 0, y: 31 + RESULT_OFFSET, width: 86, height: 14 },
      {
        fontSize: 32,
        bold: true,
      },
    ),
    roundedBox({ x: 0, y: 48 + RESULT_OFFSET, width: 88, height: 26 }, t.surface, {
      cornerRadius: 22,
    }),
    text(
      result.description,
      { x: 0, y: 49 + RESULT_OFFSET, width: 76, height: 24 },
      {
        fontSize: 16,
        color: t.muted,
      },
    ),
  ];
}
