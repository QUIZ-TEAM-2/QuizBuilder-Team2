import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answerIndexForKey,
  buildPageAnnouncement,
  describeAction,
  getAnswerTargets,
  getPageHeadline,
} from "../src/lib/playA11y";

const at = (y: number, x = 0) => ({ x, y });

describe("describeAction", () => {
  it("uses the button text, image alt text or a sensible fallback", () => {
    assert.deepEqual(
      describeAction({ id: "a", type: "text", data: " Start  quiz ", action: "startQuiz" }),
      { role: "button", label: "Start quiz" },
    );
    assert.deepEqual(
      describeAction({ id: "b", type: "image", props: { alt: "A koala" }, action: "answerBox" }),
      { role: "button", label: "A koala" },
    );
    assert.deepEqual(
      describeAction({ id: "c", type: "image", action: "hyperlink" }),
      { role: "link", label: "Open link" },
    );
    assert.equal(describeAction({ id: "d", type: "shape", action: "nextPage" }).label, "Next");
  });
});

describe("getPageHeadline", () => {
  it("picks the biggest real text, skipping emoji and buttons", () => {
    const components = [
      { id: "1", type: "text", data: "🏙️", props: { fontSize: 64 }, position: at(17) },
      { id: "2", type: "text", data: "Which city suits you?", props: { fontSize: 30 }, position: at(29) },
      { id: "3", type: "text", data: "Find out", props: { fontSize: 16 }, position: at(43) },
      { id: "4", type: "text", data: "Start quiz", props: { fontSize: 40, isButton: true }, action: "startQuiz", position: at(66) },
    ];
    assert.equal(getPageHeadline(components), "Which city suits you?");
    assert.equal(getPageHeadline([]), null);
  });
});

describe("getAnswerTargets and answerIndexForKey", () => {
  it("orders answers top to bottom and maps 1-9", () => {
    const answers = getAnswerTargets([
      { id: "b", type: "text", action: "answerBox", position: at(50) },
      { id: "x", type: "text", position: at(10) },
      { id: "a", type: "text", action: "answerBox", position: at(35) },
    ]);
    assert.deepEqual(answers.map((a) => a.id), ["a", "b"]);
    assert.equal(answerIndexForKey({ key: "1" }), 0);
    assert.equal(answerIndexForKey({ key: "9" }), 8);
    assert.equal(answerIndexForKey({ key: "0" }), null);
    assert.equal(answerIndexForKey({ key: "a" }), null);
    assert.equal(answerIndexForKey({ key: "2", metaKey: true }), null);
  });
});

describe("buildPageAnnouncement", () => {
  it("names the question number and the result", () => {
    assert.equal(
      buildPageAnnouncement({ kind: "question", headline: "Pick a city", questionNumber: 2, totalQuestions: 5 }),
      "Question 2 of 5: Pick a city",
    );
    assert.equal(buildPageAnnouncement({ kind: "result", headline: "Melbourne" }), "Your result: Melbourne");
    assert.equal(buildPageAnnouncement({ kind: "onboarding", headline: null }), "");
  });
});
