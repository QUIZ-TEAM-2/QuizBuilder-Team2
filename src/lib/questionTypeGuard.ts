import type { Component, QuestionMode } from "@/types";

const SPECIAL_QUESTION_COMPONENT_TYPES = new Set([
  "ranking",
  "input",
  "matching",
  "slider",
] as const);

export type RemovedQuestionComponentSummary = {
  key: "answerBox" | "ranking" | "input" | "matching" | "slider";
  label: string;
  count: number;
};

export function isAnswerBoxMode(mode: QuestionMode): boolean {
  return mode === "single" || mode === "multiple";
}

export function getQuestionModeLabel(mode: QuestionMode): string {
  switch (mode) {
    case "single":
      return "Single choice";
    case "multiple":
      return "Multiple choice";
    case "ranking":
      return "Ranking";
    case "fill-in-blank":
      return "Fill in blank";
    case "matching":
      return "Matching";
    case "slider":
      return "Slider";
  }
}

export function getExpectedInteractiveComponentType(
  mode: QuestionMode,
): "ranking" | "input" | "matching" | "slider" | null {
  switch (mode) {
    case "ranking":
      return "ranking";
    case "fill-in-blank":
      return "input";
    case "matching":
      return "matching";
    case "slider":
      return "slider";
    default:
      return null;
  }
}

export function getQuestionComponentLabel(
  key: RemovedQuestionComponentSummary["key"],
): string {
  switch (key) {
    case "answerBox":
      return "Answer boxes";
    case "ranking":
      return "Ranking blocks";
    case "input":
      return "Fill in blank inputs";
    case "matching":
      return "Matching blocks";
    case "slider":
      return "Slider blocks";
  }
}

export function getRemovedQuestionComponentsByModeChange(
  components: Component[],
  nextMode: QuestionMode,
): RemovedQuestionComponentSummary[] {
  const expectedType = getExpectedInteractiveComponentType(nextMode);
  const removedCounts: Record<RemovedQuestionComponentSummary["key"], number> = {
    answerBox: 0,
    ranking: 0,
    input: 0,
    matching: 0,
    slider: 0,
  };

  components.forEach((component) => {
    if (component.action === "answerBox") {
      if (!isAnswerBoxMode(nextMode)) {
        removedCounts.answerBox += 1;
      }
      return;
    }

    if (!SPECIAL_QUESTION_COMPONENT_TYPES.has(component.type as never)) {
      return;
    }

    if (component.type !== expectedType) {
      removedCounts[
        component.type as Exclude<
          RemovedQuestionComponentSummary["key"],
          "answerBox"
        >
      ] += 1;
    }
  });

  return (
    Object.entries(removedCounts) as Array<
      [RemovedQuestionComponentSummary["key"], number]
    >
  )
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      key,
      label: getQuestionComponentLabel(key),
      count,
    }));
}

export function inferQuestionModeFromComponents(
  components: Component[],
): QuestionMode | null {
  let hasAnswerBox = false;
  let hasRanking = false;
  let hasInput = false;
  let hasMatching = false;
  let hasSlider = false;

  components.forEach((component) => {
    if (component.action === "answerBox") {
      hasAnswerBox = true;
    }

    if (component.type === "ranking") {
      hasRanking = true;
    } else if (component.type === "input") {
      hasInput = true;
    } else if (component.type === "matching") {
      hasMatching = true;
    } else if (component.type === "slider") {
      hasSlider = true;
    }
  });

  const detectedModes = [
    hasAnswerBox ? "choice" : null,
    hasRanking ? "ranking" : null,
    hasInput ? "fill-in-blank" : null,
    hasMatching ? "matching" : null,
    hasSlider ? "slider" : null,
  ].filter((value): value is string => value !== null);

  if (detectedModes.length !== 1) {
    return null;
  }

  switch (detectedModes[0]) {
    case "choice":
      return null;
    case "ranking":
      return "ranking";
    case "fill-in-blank":
      return "fill-in-blank";
    case "matching":
      return "matching";
    case "slider":
      return "slider";
    default:
      return null;
  }
}

export function templateMatchesQuestionMode(
  templateQuestionMode: QuestionMode | undefined,
  components: Component[],
  currentQuestionMode: QuestionMode | undefined,
): boolean {
  if (!currentQuestionMode) {
    return true;
  }

  if (templateQuestionMode) {
    return templateQuestionMode === currentQuestionMode;
  }

  const inferredQuestionMode = inferQuestionModeFromComponents(components);
  return inferredQuestionMode === currentQuestionMode;
}
