import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getExpectedInteractiveComponentType,
  getQuestionComponentLabel,
  getQuestionModeLabel,
  getRemovedQuestionComponentsByModeChange,
  inferQuestionModeFromComponents,
  isAnswerBoxMode,
  templateMatchesQuestionMode,
} from "../src/lib/questionTypeGuard";
import type { Component, QuestionMode } from "../src/types";

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

function createChoiceComponents(count: number): Component[] {
  return Array.from({ length: count }, (_, index) =>
    createComponent({
      id: `choice-${index + 1}`,
      type: "shape",
      action: "answerBox",
    }),
  );
}

function createRankingComponents(count: number): Component[] {
  return Array.from({ length: count }, (_, index) =>
    createComponent({
      id: `ranking-${index + 1}`,
      type: "ranking",
    }),
  );
}

function createInputComponents(count: number): Component[] {
  return Array.from({ length: count }, (_, index) =>
    createComponent({
      id: `input-${index + 1}`,
      type: "input",
    }),
  );
}

function createMatchingComponents(count: number): Component[] {
  return Array.from({ length: count }, (_, index) =>
    createComponent({
      id: `matching-${index + 1}`,
      type: "matching",
    }),
  );
}

function createSliderComponents(count: number): Component[] {
  return Array.from({ length: count }, (_, index) =>
    createComponent({
      id: `slider-${index + 1}`,
      type: "slider",
    }),
  );
}

const decorativeComponents: Component[] = [
  createComponent({ id: "text-1", type: "text" }),
  createComponent({ id: "image-1", type: "image" }),
];

describe("question type guard matrix", () => {
  describe("mode metadata", () => {
    const labelCases: Array<{
      mode: QuestionMode;
      expectedLabel: string;
      expectedInteractiveType: string | null;
      expectedAnswerBoxMode: boolean;
    }> = [
      {
        mode: "single",
        expectedLabel: "Single choice",
        expectedInteractiveType: null,
        expectedAnswerBoxMode: true,
      },
      {
        mode: "multiple",
        expectedLabel: "Multiple choice",
        expectedInteractiveType: null,
        expectedAnswerBoxMode: true,
      },
      {
        mode: "ranking",
        expectedLabel: "Ranking",
        expectedInteractiveType: "ranking",
        expectedAnswerBoxMode: false,
      },
      {
        mode: "fill-in-blank",
        expectedLabel: "Fill in blank",
        expectedInteractiveType: "input",
        expectedAnswerBoxMode: false,
      },
      {
        mode: "matching",
        expectedLabel: "Matching",
        expectedInteractiveType: "matching",
        expectedAnswerBoxMode: false,
      },
      {
        mode: "slider",
        expectedLabel: "Slider",
        expectedInteractiveType: "slider",
        expectedAnswerBoxMode: false,
      },
    ];

    for (const testCase of labelCases) {
      it(`maps ${testCase.mode} to the correct metadata`, () => {
        assert.equal(getQuestionModeLabel(testCase.mode), testCase.expectedLabel);
        assert.equal(
          getExpectedInteractiveComponentType(testCase.mode),
          testCase.expectedInteractiveType,
        );
        assert.equal(
          isAnswerBoxMode(testCase.mode),
          testCase.expectedAnswerBoxMode,
        );
      });
    }

    const componentLabelCases = [
      { key: "answerBox" as const, label: "Answer boxes" },
      { key: "ranking" as const, label: "Ranking blocks" },
      { key: "input" as const, label: "Fill in blank inputs" },
      { key: "matching" as const, label: "Matching blocks" },
      { key: "slider" as const, label: "Slider blocks" },
    ];

    for (const testCase of componentLabelCases) {
      it(`maps ${testCase.key} to "${testCase.label}"`, () => {
        assert.equal(getQuestionComponentLabel(testCase.key), testCase.label);
      });
    }
  });

  describe("removal matrix", () => {
    const removalCases: Array<{
      title: string;
      nextMode: QuestionMode;
      components: Component[];
      expected: Array<{
        key: "answerBox" | "ranking" | "input" | "matching" | "slider";
        label: string;
        count: number;
      }>;
    }> = [
      {
        title: "keeps single-choice answer boxes when staying on single",
        nextMode: "single",
        components: [...createChoiceComponents(3), ...decorativeComponents],
        expected: [],
      },
      {
        title: "keeps multiple-choice answer boxes when staying on multiple",
        nextMode: "multiple",
        components: [...createChoiceComponents(2), ...decorativeComponents],
        expected: [],
      },
      {
        title: "removes answer boxes when moving from choice to ranking",
        nextMode: "ranking",
        components: [...createChoiceComponents(4), ...decorativeComponents],
        expected: [{ key: "answerBox", label: "Answer boxes", count: 4 }],
      },
      {
        title: "removes answer boxes when moving from choice to fill in blank",
        nextMode: "fill-in-blank",
        components: [...createChoiceComponents(3), ...decorativeComponents],
        expected: [{ key: "answerBox", label: "Answer boxes", count: 3 }],
      },
      {
        title: "removes answer boxes when moving from choice to matching",
        nextMode: "matching",
        components: [...createChoiceComponents(5), ...decorativeComponents],
        expected: [{ key: "answerBox", label: "Answer boxes", count: 5 }],
      },
      {
        title: "removes answer boxes when moving from choice to slider",
        nextMode: "slider",
        components: [...createChoiceComponents(1), ...decorativeComponents],
        expected: [{ key: "answerBox", label: "Answer boxes", count: 1 }],
      },
      {
        title: "keeps ranking components on ranking pages",
        nextMode: "ranking",
        components: [...createRankingComponents(2), ...decorativeComponents],
        expected: [],
      },
      {
        title: "keeps input components on fill-in-blank pages",
        nextMode: "fill-in-blank",
        components: [...createInputComponents(2), ...decorativeComponents],
        expected: [],
      },
      {
        title: "keeps matching components on matching pages",
        nextMode: "matching",
        components: [...createMatchingComponents(2), ...decorativeComponents],
        expected: [],
      },
      {
        title: "keeps slider components on slider pages",
        nextMode: "slider",
        components: [...createSliderComponents(2), ...decorativeComponents],
        expected: [],
      },
      {
        title: "removes ranking components when moving to fill in blank",
        nextMode: "fill-in-blank",
        components: [...createRankingComponents(3), ...decorativeComponents],
        expected: [{ key: "ranking", label: "Ranking blocks", count: 3 }],
      },
      {
        title: "removes ranking components when moving to matching",
        nextMode: "matching",
        components: [...createRankingComponents(2), ...decorativeComponents],
        expected: [{ key: "ranking", label: "Ranking blocks", count: 2 }],
      },
      {
        title: "removes ranking components when moving to slider",
        nextMode: "slider",
        components: [...createRankingComponents(4), ...decorativeComponents],
        expected: [{ key: "ranking", label: "Ranking blocks", count: 4 }],
      },
      {
        title: "removes input components when moving to ranking",
        nextMode: "ranking",
        components: [...createInputComponents(3), ...decorativeComponents],
        expected: [{ key: "input", label: "Fill in blank inputs", count: 3 }],
      },
      {
        title: "removes matching components when moving to ranking",
        nextMode: "ranking",
        components: [...createMatchingComponents(2), ...decorativeComponents],
        expected: [{ key: "matching", label: "Matching blocks", count: 2 }],
      },
      {
        title: "removes slider components when moving to ranking",
        nextMode: "ranking",
        components: [...createSliderComponents(5), ...decorativeComponents],
        expected: [{ key: "slider", label: "Slider blocks", count: 5 }],
      },
      {
        title: "reports every incompatible type in a mixed page when moving to ranking",
        nextMode: "ranking",
        components: [
          ...createChoiceComponents(2),
          ...createInputComponents(1),
          ...createMatchingComponents(2),
          ...createSliderComponents(1),
          ...createRankingComponents(1),
          ...decorativeComponents,
        ],
        expected: [
          { key: "answerBox", label: "Answer boxes", count: 2 },
          { key: "input", label: "Fill in blank inputs", count: 1 },
          { key: "matching", label: "Matching blocks", count: 2 },
          { key: "slider", label: "Slider blocks", count: 1 },
        ],
      },
      {
        title: "reports every incompatible type in a mixed page when moving to fill in blank",
        nextMode: "fill-in-blank",
        components: [
          ...createChoiceComponents(2),
          ...createRankingComponents(1),
          ...createMatchingComponents(2),
          ...createSliderComponents(1),
          ...createInputComponents(1),
          ...decorativeComponents,
        ],
        expected: [
          { key: "answerBox", label: "Answer boxes", count: 2 },
          { key: "ranking", label: "Ranking blocks", count: 1 },
          { key: "matching", label: "Matching blocks", count: 2 },
          { key: "slider", label: "Slider blocks", count: 1 },
        ],
      },
      {
        title: "reports every incompatible type in a mixed page when moving to matching",
        nextMode: "matching",
        components: [
          ...createChoiceComponents(1),
          ...createRankingComponents(2),
          ...createInputComponents(2),
          ...createSliderComponents(1),
          ...createMatchingComponents(1),
          ...decorativeComponents,
        ],
        expected: [
          { key: "answerBox", label: "Answer boxes", count: 1 },
          { key: "ranking", label: "Ranking blocks", count: 2 },
          { key: "input", label: "Fill in blank inputs", count: 2 },
          { key: "slider", label: "Slider blocks", count: 1 },
        ],
      },
      {
        title: "reports every incompatible type in a mixed page when moving to slider",
        nextMode: "slider",
        components: [
          ...createChoiceComponents(3),
          ...createRankingComponents(1),
          ...createInputComponents(1),
          ...createMatchingComponents(2),
          ...createSliderComponents(1),
          ...decorativeComponents,
        ],
        expected: [
          { key: "answerBox", label: "Answer boxes", count: 3 },
          { key: "ranking", label: "Ranking blocks", count: 1 },
          { key: "input", label: "Fill in blank inputs", count: 1 },
          { key: "matching", label: "Matching blocks", count: 2 },
        ],
      },
    ];

    for (const testCase of removalCases) {
      it(testCase.title, () => {
        assert.deepEqual(
          getRemovedQuestionComponentsByModeChange(
            testCase.components,
            testCase.nextMode,
          ),
          testCase.expected,
        );
      });
    }
  });

  describe("inference matrix", () => {
    const inferenceCases: Array<{
      title: string;
      components: Component[];
      expected: QuestionMode | null;
    }> = [
      {
        title: "infers ranking from ranking-only templates",
        components: [...createRankingComponents(1), ...decorativeComponents],
        expected: "ranking",
      },
      {
        title: "infers fill-in-blank from input-only templates",
        components: [...createInputComponents(1), ...decorativeComponents],
        expected: "fill-in-blank",
      },
      {
        title: "infers matching from matching-only templates",
        components: [...createMatchingComponents(1), ...decorativeComponents],
        expected: "matching",
      },
      {
        title: "infers slider from slider-only templates",
        components: [...createSliderComponents(1), ...decorativeComponents],
        expected: "slider",
      },
      {
        title: "does not infer single from answer-box-only templates",
        components: [...createChoiceComponents(2), ...decorativeComponents],
        expected: null,
      },
      {
        title: "does not infer when ranking and input coexist",
        components: [
          ...createRankingComponents(1),
          ...createInputComponents(1),
          ...decorativeComponents,
        ],
        expected: null,
      },
      {
        title: "does not infer when matching and slider coexist",
        components: [
          ...createMatchingComponents(1),
          ...createSliderComponents(1),
          ...decorativeComponents,
        ],
        expected: null,
      },
      {
        title: "does not infer when answer boxes and ranking coexist",
        components: [
          ...createChoiceComponents(2),
          ...createRankingComponents(1),
          ...decorativeComponents,
        ],
        expected: null,
      },
      {
        title: "does not infer from decorative-only templates",
        components: decorativeComponents,
        expected: null,
      },
      {
        title: "does not infer from empty templates",
        components: [],
        expected: null,
      },
    ];

    for (const testCase of inferenceCases) {
      it(testCase.title, () => {
        assert.equal(
          inferQuestionModeFromComponents(testCase.components),
          testCase.expected,
        );
      });
    }
  });

  describe("template matching matrix", () => {
    const matchingOnlyComponents = [
      ...createMatchingComponents(1),
      ...decorativeComponents,
    ];
    const rankingOnlyComponents = [
      ...createRankingComponents(1),
      ...decorativeComponents,
    ];
    const sliderOnlyComponents = [
      ...createSliderComponents(1),
      ...decorativeComponents,
    ];
    const choiceComponents = [
      ...createChoiceComponents(2),
      ...decorativeComponents,
    ];
    const mixedLegacyComponents = [
      ...createChoiceComponents(1),
      ...createMatchingComponents(1),
      ...decorativeComponents,
    ];

    const matchCases: Array<{
      title: string;
      templateQuestionMode: QuestionMode | undefined;
      currentQuestionMode: QuestionMode | undefined;
      components: Component[];
      expected: boolean;
    }> = [
      {
        title: "matches explicit single template on single pages",
        templateQuestionMode: "single",
        currentQuestionMode: "single",
        components: choiceComponents,
        expected: true,
      },
      {
        title: "does not match explicit single template on multiple pages",
        templateQuestionMode: "single",
        currentQuestionMode: "multiple",
        components: choiceComponents,
        expected: false,
      },
      {
        title: "matches explicit multiple template on multiple pages",
        templateQuestionMode: "multiple",
        currentQuestionMode: "multiple",
        components: choiceComponents,
        expected: true,
      },
      {
        title: "does not match explicit multiple template on single pages",
        templateQuestionMode: "multiple",
        currentQuestionMode: "single",
        components: choiceComponents,
        expected: false,
      },
      {
        title: "matches inferred matching template on matching pages",
        templateQuestionMode: undefined,
        currentQuestionMode: "matching",
        components: matchingOnlyComponents,
        expected: true,
      },
      {
        title: "does not match inferred matching template on ranking pages",
        templateQuestionMode: undefined,
        currentQuestionMode: "ranking",
        components: matchingOnlyComponents,
        expected: false,
      },
      {
        title: "matches inferred ranking template on ranking pages",
        templateQuestionMode: undefined,
        currentQuestionMode: "ranking",
        components: rankingOnlyComponents,
        expected: true,
      },
      {
        title: "does not match inferred ranking template on slider pages",
        templateQuestionMode: undefined,
        currentQuestionMode: "slider",
        components: rankingOnlyComponents,
        expected: false,
      },
      {
        title: "matches inferred slider template on slider pages",
        templateQuestionMode: undefined,
        currentQuestionMode: "slider",
        components: sliderOnlyComponents,
        expected: true,
      },
      {
        title: "does not match answer-box legacy templates without explicit mode",
        templateQuestionMode: undefined,
        currentQuestionMode: "single",
        components: choiceComponents,
        expected: false,
      },
      {
        title: "does not match mixed legacy templates without explicit mode",
        templateQuestionMode: undefined,
        currentQuestionMode: "matching",
        components: mixedLegacyComponents,
        expected: false,
      },
      {
        title: "always matches when current page mode is not known and template is explicit",
        templateQuestionMode: "matching",
        currentQuestionMode: undefined,
        components: matchingOnlyComponents,
        expected: true,
      },
      {
        title: "always matches when current page mode is not known and template is legacy",
        templateQuestionMode: undefined,
        currentQuestionMode: undefined,
        components: rankingOnlyComponents,
        expected: true,
      },
    ];

    for (const testCase of matchCases) {
      it(testCase.title, () => {
        assert.equal(
          templateMatchesQuestionMode(
            testCase.templateQuestionMode,
            testCase.components,
            testCase.currentQuestionMode,
          ),
          testCase.expected,
        );
      });
    }
  });
});
