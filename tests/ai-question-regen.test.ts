import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildComponentUpdates,
  buildRegenPrompt,
  findQuestionParts,
  parseRegeneratedQuestion,
  type RegenComponent,
} from "../convex/aiQuestionRegen";
import { parseAiQuizDraft, stripTrailingFullStop } from "../convex/aiQuizDraft";

const pos = (y: number, x = 0) => ({ x, y, width: 80, height: 8 });

const page: RegenComponent[] = [
  { _id: "dots", type: "progressBar", position: pos(6) },
  { _id: "card1", type: "shape", position: pos(35) },
  {
    _id: "q",
    type: "text",
    data: "Pick a weekend plan",
    props: { fontSize: 24 },
    position: pos(13),
  },
  {
    _id: "hint",
    type: "text",
    data: "Choose one",
    props: { fontSize: 12 },
    position: pos(30),
  },
  {
    _id: "a2",
    type: "text",
    data: "Hike",
    props: { isButton: true },
    action: "answerBox",
    actionProps: { resultMapping: { old: 5 }, keepMe: true },
    position: pos(47),
  },
  {
    _id: "a1",
    type: "text",
    data: "Brunch",
    props: { isButton: true },
    action: "answerBox",
    position: pos(35),
  },
];

describe("findQuestionParts", () => {
  it("finds the biggest text as the question and answers in reading order", () => {
    const parts = findQuestionParts(page);
    assert.ok(!("error" in parts));
    assert.equal(parts.question._id, "q");
    assert.deepEqual(
      parts.answers.map((a) => a._id),
      ["a1", "a2"],
    );
  });

  it("explains when there aren't enough answers", () => {
    const parts = findQuestionParts(page.filter((c) => c._id !== "a2"));
    assert.ok("error" in parts);
  });

  it("refuses image answers", () => {
    const parts = findQuestionParts(
      page.map((c) => (c._id === "a2" ? { ...c, type: "image" } : c)),
    );
    assert.ok("error" in parts);
    assert.match(parts.error, /text answers/);
  });

  it("needs a question text box", () => {
    const parts = findQuestionParts(
      page.filter((c) => c._id !== "q" && c._id !== "hint"),
    );
    assert.ok("error" in parts);
  });
});

describe("parseRegeneratedQuestion", () => {
  it("cleans personality answers and drops trailing full stops", () => {
    const parsed = parseRegeneratedQuestion(
      {
        question: "  Your ideal Sunday?  ",
        answers: [
          { text: "Sleeping in.", result: 1, alsoResult: 1 },
          { text: "Footy at the G", result: 9, alsoResult: 0 },
        ],
      },
      { quizType: "personality", answerCount: 2, resultCount: 2 },
    );
    assert.equal(parsed.question, "Your ideal Sunday?");
    assert.equal(parsed.answers[0]!.text, "Sleeping in");
    assert.equal(parsed.answers[0]!.alsoResult, -1);
    assert.equal(parsed.answers[1]!.result, 1);
    assert.equal(parsed.answers[1]!.alsoResult, 0);
  });

  it("keeps exactly one correct answer for knowledge quizzes", () => {
    const parsed = parseRegeneratedQuestion(
      {
        question: "Capital of Australia?",
        answers: [
          { text: "Sydney", correct: false },
          { text: "Canberra", correct: true },
          { text: "Melbourne", correct: true },
        ],
      },
      { quizType: "knowledge", answerCount: 3, resultCount: 0 },
    );
    assert.deepEqual(
      parsed.answers.map((a) => a.correct),
      [false, true, false],
    );
  });

  it("rejects the wrong number of answers", () => {
    assert.throws(() =>
      parseRegeneratedQuestion(
        { question: "Q?", answers: [{ text: "Only one", result: 0 }] },
        { quizType: "personality", answerCount: 2, resultCount: 2 },
      ),
    );
  });

  it("rejects knowledge answers with nothing marked correct", () => {
    assert.throws(() =>
      parseRegeneratedQuestion(
        {
          question: "Q?",
          answers: [
            { text: "A", correct: false },
            { text: "B", correct: false },
          ],
        },
        { quizType: "knowledge", answerCount: 2, resultCount: 0 },
      ),
    );
  });
});

describe("buildComponentUpdates", () => {
  const parts = findQuestionParts(page);
  assert.ok(!("error" in parts));

  it("rewrites text and personality scoring but keeps other actionProps", () => {
    const updates = buildComponentUpdates(
      parts,
      {
        question: "New question",
        answers: [
          { text: "One", result: 0, alsoResult: 1 },
          { text: "Two", result: 1, alsoResult: -1 },
        ],
      },
      { quizType: "personality", resultIds: ["r0", "r1"] },
    );
    assert.deepEqual(updates[0], { id: "q", data: "New question" });
    assert.deepEqual(updates[1], {
      id: "a1",
      data: "One",
      actionProps: { resultMapping: { r0: 2, r1: 1 } },
    });
    assert.deepEqual(updates[2], {
      id: "a2",
      data: "Two",
      actionProps: { resultMapping: { r1: 2 }, keepMe: true },
    });
  });

  it("marks the correct answer for knowledge quizzes", () => {
    const updates = buildComponentUpdates(
      parts,
      {
        question: "Q",
        answers: [
          { text: "Wrong", correct: false },
          { text: "Right", correct: true },
        ],
      },
      { quizType: "knowledge", resultIds: [] },
    );
    assert.equal(updates[1]!.actionProps!.isCorrect, false);
    assert.equal(updates[2]!.actionProps!.isCorrect, true);
  });
});

describe("prompt and full stops", () => {
  it("mentions the instruction and other questions", () => {
    const prompt = buildRegenPrompt({
      quizTitle: "Coffee",
      quizType: "personality",
      resultNames: ["Flat White", "Long Black"],
      currentQuestion: "Pick a city",
      currentAnswers: ["Melbourne", "Sydney"],
      otherQuestions: ["Pick a pet"],
      instruction: "make it about food",
    });
    assert.match(prompt, /make it about food/);
    assert.match(prompt, /Pick a pet/);
    assert.match(prompt, /0: "Flat White"/);
  });

  it("strips one trailing full stop but keeps ellipses", () => {
    assert.equal(stripTrailingFullStop("Talk it through with a mate."), "Talk it through with a mate");
    assert.equal(stripTrailingFullStop("Wait for it..."), "Wait for it...");
    assert.equal(stripTrailingFullStop("Hmm…"), "Hmm…");
  });

  it("AI generated quizzes no longer end answers with a full stop", () => {
    const draft = parseAiQuizDraft(
      {
        title: "T",
        description: "D",
        results: [
          { name: "A", description: "a" },
          { name: "B", description: "b" },
        ],
        questions: [
          {
            question: "Q?",
            answers: [
              { text: "First answer.", result: 0 },
              { text: "Second answer", result: 1 },
            ],
          },
        ],
      },
      { questions: 1, results: 2, answers: 2 },
    );
    assert.equal(draft.questions[0]!.answers[0]!.text, "First answer");
  });
});
