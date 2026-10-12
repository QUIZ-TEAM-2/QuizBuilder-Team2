import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AI_QUIZ_LIMITS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_QUIZ_EMOJI,
  DEFAULT_RESULT_EMOJI,
  contrastRatio,
  resolveTheme,
  textOnAccent,
  buildOnboardingLayout,
  buildQuestionLayout,
  buildResultLayout,
  normalizeCounts,
  parseAiQuizDraft,
} from "../convex/aiQuizDraft";

const counts = { questions: 3, results: 3, answers: 3 };

const sample = {
  title: "Which coffee are you?",
  description: "Find your brew.",
  accentColor: "#f59e0b",
  backgroundColor: "#1c1917",
  emoji: "☕",
  results: [
    { name: "Flat White", description: "You're smooth.", emoji: "🥛" },
    { name: "Long Black", description: "You're bold.", emoji: "☕" },
    { name: "Chai Latte", description: "You're cosy.", emoji: "not an emoji" },
  ],
  questions: [
    {
      question: "Pick a weekend",
      answers: [
        { text: "Brunch", result: 0, alsoResult: 2 },
        { text: "Hike", result: 1, alsoResult: -1 },
        { text: "Movie", result: 2 },
      ],
    },
    {
      question: "Pick a song",
      answers: [
        { text: "Pop", result: 0 },
        { text: "Rock", result: 1 },
        { text: "Folk", result: 2 },
      ],
    },
    {
      question: "Pick a city",
      answers: [
        { text: "Melbourne", result: 0 },
        { text: "Sydney", result: 1 },
        { text: "Hobart", result: 2 },
      ],
    },
  ],
};

void describe("normalizeCounts", () => {
  void it("clamps to limits and fills defaults", () => {
    assert.deepEqual(normalizeCounts({ questions: 99, results: 0 }), {
      questions: AI_QUIZ_LIMITS.questions.max,
      results: AI_QUIZ_LIMITS.results.min,
      answers: AI_QUIZ_LIMITS.answers.default,
    });
  });
});

void describe("parseAiQuizDraft", () => {
  void it("accepts a well-formed draft", () => {
    const draft = parseAiQuizDraft(sample, counts);
    assert.equal(draft.results.length, 3);
    assert.equal(draft.questions.length, 3);
    assert.equal(draft.accentColor, "#f59e0b");
    assert.equal(draft.backgroundColor, "#1c1917");
    assert.equal(draft.emoji, "☕");
    assert.equal(draft.results[0]!.emoji, "🥛");
    assert.equal(draft.results[2]!.emoji, DEFAULT_RESULT_EMOJI);
    assert.equal(draft.questions[0]!.answers[0]!.alsoResult, 2);
    assert.equal(draft.questions[0]!.answers[2]!.alsoResult, -1);
  });

  void it("fixes bad indexes and colours instead of failing", () => {
    const draft = parseAiQuizDraft(
      {
        ...sample,
        accentColor: "purple",
        backgroundColor: "#ffffff",
        emoji: 42,
        questions: [
          {
            question: "Q",
            answers: [
              { text: "A", result: 7, alsoResult: 7 },
              { text: "B", result: 1, alsoResult: 1 },
            ],
          },
        ],
      },
      counts,
    );
    assert.equal(draft.accentColor, DEFAULT_ACCENT_COLOR);
    assert.equal(draft.backgroundColor, DEFAULT_BACKGROUND_COLOR);
    assert.equal(draft.emoji, DEFAULT_QUIZ_EMOJI);
    for (const answer of draft.questions[0]!.answers) {
      assert.ok(answer.result >= 0 && answer.result < 3);
      assert.notEqual(answer.alsoResult, answer.result);
    }
  });

  void it("makes every result reachable", () => {
    const draft = parseAiQuizDraft(
      {
        ...sample,
        questions: sample.questions.map((q) => ({
          ...q,
          answers: q.answers.map((a) => ({ ...a, result: 0 })),
        })),
      },
      counts,
    );
    const reachable = new Set(
      draft.questions.flatMap((q) => q.answers.map((a) => a.result)),
    );
    assert.deepEqual([...reachable].sort(), [0, 1, 2]);
  });

  void it("rejects unusable output", () => {
    assert.throws(() => parseAiQuizDraft(null, counts));
    assert.throws(() =>
      parseAiQuizDraft({ ...sample, results: [{ name: "Only one" }] }, counts),
    );
    assert.throws(() => parseAiQuizDraft({ ...sample, questions: [] }, counts));
  });

  void it("trims to the requested counts", () => {
    const draft = parseAiQuizDraft(sample, {
      questions: 2,
      results: 2,
      answers: 2,
    });
    assert.equal(draft.results.length, 2);
    assert.equal(draft.questions.length, 2);
    assert.ok(draft.questions.every((q) => q.answers.length === 2));
  });
});

void describe("layouts", () => {
  const draft = parseAiQuizDraft(sample, counts);
  const all = [
    ...buildOnboardingLayout(draft),
    ...buildQuestionLayout(draft, 0),
    ...buildResultLayout(draft, 0),
  ];

  void it("keeps content inside the phone frame and centred", () => {
    for (const spec of all.filter((item) => !item.decorative)) {
      const { x, y, width, height } = spec.position;
      const left = 50 + x - width / 2;
      assert.ok(left >= 0 && left + width <= 100, `${spec.data} off screen`);
      assert.ok(y >= 0 && y + height <= 100, `${spec.data} off screen`);
      assert.equal(x, 0, `${spec.data} should be centred`);
    }
  });

  void it("keeps answer text narrower than its card", () => {
    const layout = buildQuestionLayout(draft, 0);
    const cards = layout.filter(
      (spec) => spec.type === "shape" && !spec.decorative,
    );
    const labels = layout.filter((spec) => spec.action === "answerBox");
    labels.forEach((label, index) => {
      assert.ok(label.position.width < cards[index]!.position.width);
    });
  });

  void it("scores answer buttons with 2 points, plus 1 for a second result", () => {
    const buttons = buildQuestionLayout(draft, 0).filter(
      (spec) => spec.action === "answerBox",
    );
    assert.equal(buttons.length, 3);
    assert.deepEqual(buttons[0]!.scores, [
      { resultIndex: 0, points: 2 },
      { resultIndex: 2, points: 1 },
    ]);
    assert.ok(buttons.every((spec) => spec.props.isButton === true));
  });

  void it("adds a start button to the onboarding page", () => {
    assert.ok(
      buildOnboardingLayout(draft).some((spec) => spec.action === "startQuiz"),
    );
  });
});

void describe("theme", () => {
  void it("keeps readable themes and rejects light backgrounds", () => {
    assert.deepEqual(resolveTheme("#14532d", "#facc15"), {
      backgroundColor: "#14532d",
      accentColor: "#facc15",
    });
    assert.equal(
      resolveTheme("#fef3c7", "#facc15").backgroundColor,
      DEFAULT_BACKGROUND_COLOR,
    );
  });

  void it("rejects an accent that disappears into the background", () => {
    assert.equal(
      resolveTheme("#0f172a", "#111827").accentColor,
      DEFAULT_ACCENT_COLOR,
    );
  });

  void it("picks readable text for buttons", () => {
    for (const accent of ["#facc15", "#10b981", "#7c3aed", "#ef4444"]) {
      assert.ok(contrastRatio(accent, textOnAccent(accent)) >= 3, accent);
    }
  });
});
