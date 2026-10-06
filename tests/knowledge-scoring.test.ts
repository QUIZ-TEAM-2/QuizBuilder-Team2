import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyScoreTokens,
  defaultMinScorePercent,
  getCorrectAnswerIds,
  isAnswerCorrect,
  pickKnowledgeResult,
  scoreKnowledgeQuiz,
} from "../convex/knowledgeScoring";

void describe("getCorrectAnswerIds", () => {
  void it("finds correct answer boxes, including inside groups", () => {
    const ids = getCorrectAnswerIds([
      { id: "a", action: "answerBox", actionProps: { isCorrect: true } },
      { id: "b", action: "answerBox", actionProps: { isCorrect: false } },
      { _id: "c", action: "answerBox", actionProps: { isCorrect: true } },
      { id: "d", action: "nextPage" },
      {
        id: "g",
        type: "group",
        children: [
          { id: "e", action: "answerBox", actionProps: { isCorrect: true } },
        ],
      },
    ]);
    assert.deepEqual(ids, ["a", "c", "e"]);
  });
});

void describe("isAnswerCorrect", () => {
  void it("single choice needs the chosen answer to be correct", () => {
    assert.equal(isAnswerCorrect("single", ["a"], ["a"]), true);
    assert.equal(isAnswerCorrect("single", ["b"], ["a"]), false);
    assert.equal(isAnswerCorrect(undefined, ["a"], ["a", "c"]), true);
  });

  void it("multiple choice needs exactly the correct set", () => {
    assert.equal(isAnswerCorrect("multiple", ["a", "c"], ["c", "a"]), true);
    assert.equal(isAnswerCorrect("multiple", ["a"], ["a", "c"]), false);
    assert.equal(
      isAnswerCorrect("multiple", ["a", "b", "c"], ["a", "c"]),
      false,
    );
  });

  void it("no answer is wrong", () => {
    assert.equal(isAnswerCorrect("single", [], ["a"]), false);
  });
});

void describe("scoreKnowledgeQuiz", () => {
  void it("counts only scorable pages and treats unanswered as wrong", () => {
    const result = scoreKnowledgeQuiz(
      [
        { id: "p1", questionMode: "single", correctAnswerIds: ["a"] },
        { id: "p2", questionMode: "multiple", correctAnswerIds: ["x", "y"] },
        { id: "p3", questionMode: "single", correctAnswerIds: ["q"] },
        { id: "p4", questionMode: "slider", correctAnswerIds: [] },
        { id: "p5", questionMode: "single", correctAnswerIds: [] },
      ],
      new Map([
        ["p1", ["a"]],
        ["p2", ["x", "y"]],
      ]),
    );
    assert.deepEqual(result, { score: 2, total: 3 });
  });
});

void describe("pickKnowledgeResult", () => {
  const results = [
    { id: "low", minScorePercent: 0 },
    { id: "mid", minScorePercent: 50 },
    { id: "high", minScorePercent: 90 },
  ];

  void it("picks the highest band reached", () => {
    assert.equal(pickKnowledgeResult(results, 2, 10), "low");
    assert.equal(pickKnowledgeResult(results, 5, 10), "mid");
    assert.equal(pickKnowledgeResult(results, 9, 10), "high");
    assert.equal(pickKnowledgeResult(results, 10, 10), "high");
  });

  void it("uses even default bands when none are set", () => {
    assert.equal(defaultMinScorePercent(0, 3), 0);
    assert.equal(defaultMinScorePercent(1, 3), 33);
    assert.equal(defaultMinScorePercent(2, 3), 67);
    assert.equal(
      pickKnowledgeResult([{ id: "a" }, { id: "b" }, { id: "c" }], 7, 10),
      "c",
    );
  });

  void it("falls back to the lowest band", () => {
    assert.equal(
      pickKnowledgeResult(
        [
          { id: "a", minScorePercent: 40 },
          { id: "b", minScorePercent: 80 },
        ],
        0,
        5,
      ),
      "a",
    );
  });
});

void describe("applyScoreTokens", () => {
  void it("fills in score and total", () => {
    assert.equal(
      applyScoreTokens("You scored {score} out of {TOTAL}!", 7, 10),
      "You scored 7 out of 10!",
    );
  });
});
