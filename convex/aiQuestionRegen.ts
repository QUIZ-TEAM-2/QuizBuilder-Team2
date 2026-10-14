/**
 * Pure logic for "Regenerate this question with AI": finding the question and
 * answer components on a page, the Gemini prompt and schema, validating the
 * response and working out the component updates. No database or network
 * access, so it can be unit tested.
 */

import {
  asRecord,
  cleanText,
  stripTrailingFullStop,
} from "./aiQuizDraft";

export const REGEN_INSTRUCTION_MAX_LENGTH = 200;

export type RegenQuizType = "personality" | "knowledge";

/** The fields we need from a stored component. */
export type RegenComponent = {
  _id: string;
  type: string;
  data?: string;
  props?: Record<string, unknown>;
  action?: string;
  actionProps?: unknown;
  parentId?: string;
  position: { x: number; y: number; width: number; height: number };
};

export type QuestionParts = {
  question: RegenComponent;
  answers: RegenComponent[];
};

const readingOrder = (a: RegenComponent, b: RegenComponent) =>
  a.position.y - b.position.y || a.position.x - b.position.x;

const fontSizeOf = (component: RegenComponent) => {
  const size = component.props?.fontSize;
  return typeof size === "number" ? size : 16;
};

const hasText = (component: RegenComponent) =>
  typeof component.data === "string" && component.data.trim() !== "";

/**
 * The question is the biggest (then highest) plain text on the page, and the
 * answers are the text answer buttons in reading order. Returns an error
 * message instead when the page can't be regenerated.
 */
export function findQuestionParts(
  components: readonly RegenComponent[],
): QuestionParts | { error: string } {
  const rootLevel = components.filter((component) => !component.parentId);

  const answers = rootLevel
    .filter((component) => component.action === "answerBox")
    .sort(readingOrder);
  if (answers.length < 2) {
    return {
      error:
        "This page needs at least two answer buttons before AI can rewrite it.",
    };
  }
  if (answers.some((answer) => answer.type !== "text")) {
    return {
      error:
        "AI can only rewrite text answers. This page has image or grouped answers.",
    };
  }

  const questionCandidates = rootLevel
    .filter(
      (component) =>
        component.type === "text" &&
        !component.action &&
        component.props?.isButton !== true &&
        hasText(component),
    )
    .sort(
      (a, b) => fontSizeOf(b) - fontSizeOf(a) || readingOrder(a, b),
    );
  const question = questionCandidates[0];
  if (!question) {
    return { error: "Add the question as a text box first." };
  }
  return { question, answers };
}

export type RegenContext = {
  quizTitle: string;
  quizDescription?: string;
  quizType: RegenQuizType;
  resultNames: string[];
  currentQuestion: string;
  currentAnswers: string[];
  otherQuestions: string[];
  instruction?: string;
};

export function buildRegenPrompt(context: RegenContext): string {
  const answerCount = context.currentAnswers.length;
  const lines = [
    `You are improving one question in a ${
      context.quizType === "knowledge" ? "trivia (right or wrong answers)" : "personality"
    } quiz for a mobile quiz app.`,
    `Quiz title: "${context.quizTitle}"`,
  ];
  if (context.quizDescription) {
    lines.push(`Quiz description: "${context.quizDescription}"`);
  }
  lines.push(
    "",
    `Current question: "${context.currentQuestion}"`,
    `Current answers: ${context.currentAnswers.map((a) => `"${a}"`).join(", ")}`,
  );
  if (context.otherQuestions.length > 0) {
    lines.push(
      "",
      "Other questions already in the quiz (do not repeat them):",
      ...context.otherQuestions.map((q) => `- ${q}`),
    );
  }
  lines.push("", "Write a fresh replacement for the current question.", "Rules:");
  lines.push(
    "- The question is short (max 15 words).",
    `- Exactly ${answerCount} answers, each short (max 8 words), with no full stop at the end.`,
  );
  if (context.quizType === "knowledge") {
    lines.push(
      "- Exactly one answer is correct (correct: true). The others are believable but wrong.",
      "- Only use well-known, checkable facts.",
    );
  } else {
    lines.push(
      `- The results players can get are (0-based index): ${context.resultNames
        .map((name, index) => `${index}: "${name}"`)
        .join(", ")}.`,
      `- For every answer, "result" is the index of the result it most points to. "alsoResult" is a second result it slightly points to, or -1.`,
      "- Spread the answers across different results.",
    );
  }
  if (context.instruction) {
    lines.push(`- The creator asked for this change: "${context.instruction}"`);
  }
  lines.push(
    "- Keep it friendly and suitable for all ages. Use Australian English spelling.",
  );
  return lines.join("\n");
}

export function buildRegenSchema(quizType: RegenQuizType) {
  const answerProperties =
    quizType === "knowledge"
      ? { text: { type: "STRING" }, correct: { type: "BOOLEAN" } }
      : {
          text: { type: "STRING" },
          result: { type: "INTEGER" },
          alsoResult: { type: "INTEGER" },
        };
  return {
    type: "OBJECT",
    properties: {
      question: { type: "STRING" },
      answers: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: answerProperties,
          required: quizType === "knowledge" ? ["text", "correct"] : ["text", "result"],
        },
      },
    },
    required: ["question", "answers"],
  };
}

export type RegeneratedQuestion = {
  question: string;
  answers: Array<{
    text: string;
    /** Personality quizzes only. */
    result?: number;
    alsoResult?: number;
    /** Knowledge quizzes only. */
    correct?: boolean;
  }>;
};

/**
 * Validates the model's JSON for one question. Throws an Error with a
 * user-facing message when it can't be used.
 */
export function parseRegeneratedQuestion(
  raw: unknown,
  options: { quizType: RegenQuizType; answerCount: number; resultCount: number },
): RegeneratedQuestion {
  const root = asRecord(raw);
  const question = cleanText(root?.question, 140);
  if (!root || question === "") {
    throw new Error("The AI returned an unexpected response.");
  }
  const rawAnswers = (Array.isArray(root.answers) ? root.answers : [])
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      record: item,
      text: stripTrailingFullStop(cleanText(item.text, 64)),
    }))
    .filter((item) => item.text !== "")
    .slice(0, options.answerCount);

  if (rawAnswers.length !== options.answerCount) {
    throw new Error("The AI wrote the wrong number of answers. Please try again.");
  }

  if (options.quizType === "knowledge") {
    const correctIndex = rawAnswers.findIndex((item) => item.record.correct === true);
    if (correctIndex === -1) {
      throw new Error("The AI didn't mark a correct answer. Please try again.");
    }
    // Exactly one correct answer: keep the first one the model marked.
    return {
      question,
      answers: rawAnswers.map((item, index) => ({
        text: item.text,
        correct: index === correctIndex,
      })),
    };
  }

  const resultCount = options.resultCount;
  const validIndex = (value: unknown): number | null =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < resultCount
      ? value
      : null;
  return {
    question,
    answers: rawAnswers.map((item, index) => {
      const result = validIndex(item.record.result) ?? index % Math.max(1, resultCount);
      const also = validIndex(item.record.alsoResult);
      return {
        text: item.text,
        result,
        alsoResult: also !== null && also !== result ? also : -1,
      };
    }),
  };
}

export const PRIMARY_POINTS = 2;
export const SECONDARY_POINTS = 1;

export type ComponentUpdate = {
  id: string;
  data: string;
  /** Replaces actionProps when set. */
  actionProps?: Record<string, unknown>;
};

/**
 * Turns the regenerated question into component updates. Layout, colours and
 * fonts are untouched: only the text and the scoring change.
 */
export function buildComponentUpdates(
  parts: QuestionParts,
  regenerated: RegeneratedQuestion,
  options: { quizType: RegenQuizType; resultIds: readonly string[] },
): ComponentUpdate[] {
  const updates: ComponentUpdate[] = [
    { id: parts.question._id, data: regenerated.question },
  ];
  parts.answers.forEach((answer, index) => {
    const next = regenerated.answers[index];
    if (!next) return;
    const existing = asRecord(answer.actionProps) ?? {};
    let actionProps: Record<string, unknown>;
    if (options.quizType === "knowledge") {
      actionProps = { ...existing, isCorrect: next.correct === true };
    } else {
      const resultMapping: Record<string, number> = {};
      const primary = options.resultIds[next.result ?? -1];
      if (primary) resultMapping[primary] = PRIMARY_POINTS;
      const secondary = options.resultIds[next.alsoResult ?? -1];
      if (secondary && secondary !== primary) {
        resultMapping[secondary] = SECONDARY_POINTS;
      }
      actionProps = { ...existing, resultMapping };
    }
    updates.push({ id: answer._id, data: next.text, actionProps });
  });
  return updates;
}
