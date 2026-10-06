import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AI_QUIZ_LIMITS,
  DEFAULT_ACCENT_COLOR,
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
  accentColor: "#8b5cf6",
  results: [
    { name: "Flat White", description: "You're smooth." },
    { name: "Long Black", description: "You're bold." },
    { name: "Chai Latte", description: "You're cosy." },
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
    assert.equal(draft.accentColor, "#8b5cf6");
    assert.equal(draft.questions[0]!.answers[0]!.alsoResult, 2);
    assert.equal(draft.questions[0]!.answers[2]!.alsoResult, -1);
  });

  void it("fixes bad indexes and colours instead of failing", () => {
    const draft = parseAiQuizDraft(
      {
        ...sample,
        accentColor: "purple",
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

  void it("keeps every component inside the phone frame", () => {
    for (const spec of all) {
      const { x, y, width, height } = spec.position;
      assert.ok(x >= 0 && y >= 0 && x + width <= 100 && y + height <= 100);
    }
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
