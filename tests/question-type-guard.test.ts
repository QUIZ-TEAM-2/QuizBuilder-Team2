import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getQuestionModeLabel,
  getRemovedQuestionComponentsByModeChange,
  inferQuestionModeFromComponents,
  templateMatchesQuestionMode,
} from "../src/lib/questionTypeGuard";
import type { Component } from "../src/types";

function createComponent(overrides: Partial<Component>): Component {
  return {
    id: overrides.id ?? "component-id",
    type: overrides.type ?? "text",
    data: overrides.data,
    props: overrides.props,
    action: overrides.action,
    actionProps: overrides.actionProps,
    position:
      overrides.position ?? { x: 0, y: 0, width: 20, height: 10 },
    children: overrides.children,
  };
}

describe("question type guard", () => {
  it("keeps single/multiple labels human-readable", () => {
    assert.equal(getQuestionModeLabel("single"), "Single choice");
    assert.equal(getQuestionModeLabel("multiple"), "Multiple choice");
    assert.equal(getQuestionModeLabel("fill-in-blank"), "Fill in blank");
  });

  it("flags answer boxes for removal when switching from choice to ranking", () => {
    const components: Component[] = [
      createComponent({ id: "a", type: "shape", action: "answerBox" }),
      createComponent({ id: "b", type: "shape", action: "answerBox" }),
      createComponent({ id: "c", type: "text" }),
    ];

    assert.deepEqual(getRemovedQuestionComponentsByModeChange(components, "ranking"), [
      {
        key: "answerBox",
        label: "Answer boxes",
        count: 2,
      },
    ]);
  });

  it("flags incompatible interactive components so each page ends with one question type", () => {
    const components: Component[] = [
      createComponent({ id: "ranking-1", type: "ranking" }),
      createComponent({ id: "input-1", type: "input" }),
      createComponent({ id: "matching-1", type: "matching" }),
      createComponent({ id: "slider-1", type: "slider" }),
      createComponent({ id: "text-1", type: "text" }),
    ];

    assert.deepEqual(
      getRemovedQuestionComponentsByModeChange(components, "fill-in-blank"),
      [
        {
          key: "ranking",
          label: "Ranking blocks",
          count: 1,
        },
        {
          key: "matching",
          label: "Matching blocks",
          count: 1,
        },
        {
          key: "slider",
          label: "Slider blocks",
          count: 1,
        },
      ],
    );
  });

  it("returns no removals when the page already matches the target question type", () => {
    const components: Component[] = [
      createComponent({ id: "input-1", type: "input" }),
      createComponent({ id: "text-1", type: "text" }),
      createComponent({ id: "image-1", type: "image" }),
    ];

    assert.deepEqual(
      getRemovedQuestionComponentsByModeChange(components, "fill-in-blank"),
      [],
    );
  });

  it("infers non-choice template modes from interactive components", () => {
    assert.equal(
      inferQuestionModeFromComponents([
        createComponent({ id: "matching-1", type: "matching" }),
      ]),
      "matching",
    );
    assert.equal(
      inferQuestionModeFromComponents([
        createComponent({ id: "slider-1", type: "slider" }),
      ]),
      "slider",
    );
  });

  it("does not infer single or multiple from legacy answer-box-only templates", () => {
    assert.equal(
      inferQuestionModeFromComponents([
        createComponent({ id: "choice-1", type: "shape", action: "answerBox" }),
      ]),
      null,
    );
  });

  it("does not infer a mode from mixed interactive template components", () => {
    assert.equal(
      inferQuestionModeFromComponents([
        createComponent({ id: "ranking-1", type: "ranking" }),
        createComponent({ id: "input-1", type: "input" }),
      ]),
      null,
    );
  });

  it("matches templates only when their question mode aligns with the current page", () => {
    const matchingComponents = [
      createComponent({ id: "matching-1", type: "matching" }),
    ];

    assert.equal(
      templateMatchesQuestionMode("matching", matchingComponents, "matching"),
      true,
    );
    assert.equal(
      templateMatchesQuestionMode("single", matchingComponents, "multiple"),
      false,
    );
    assert.equal(
      templateMatchesQuestionMode(undefined, matchingComponents, "matching"),
      true,
    );
    assert.equal(
      templateMatchesQuestionMode(undefined, matchingComponents, "ranking"),
      false,
    );
  });

  it("keeps single and multiple templates separated when questionMode is stored explicitly", () => {
    const choiceComponents = [
      createComponent({ id: "choice-1", type: "shape", action: "answerBox" }),
      createComponent({ id: "choice-2", type: "shape", action: "answerBox" }),
    ];

    assert.equal(
      templateMatchesQuestionMode("single", choiceComponents, "single"),
      true,
    );
    assert.equal(
      templateMatchesQuestionMode("multiple", choiceComponents, "multiple"),
      true,
    );
    assert.equal(
      templateMatchesQuestionMode("single", choiceComponents, "multiple"),
      false,
    );
    assert.equal(
      templateMatchesQuestionMode("multiple", choiceComponents, "single"),
      false,
    );
  });

  it("treats templates without a current page question mode as visible", () => {
    const rankingComponents = [
      createComponent({ id: "ranking-1", type: "ranking" }),
    ];

    assert.equal(
      templateMatchesQuestionMode("ranking", rankingComponents, undefined),
      true,
    );
    assert.equal(
      templateMatchesQuestionMode(undefined, rankingComponents, undefined),
      true,
    );
  });
});
