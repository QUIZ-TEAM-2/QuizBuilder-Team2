import type { Component } from "@/types";

export interface MatchingNode {
  id: string;
  label: string;
}

export interface MatchingPairMapping {
  leftId: string;
  rightId: string;
  resultPageId: string;
  score: number;
}

export interface MatchingActionProps {
  pairMappings?: MatchingPairMapping[];
  [key: string]: unknown;
}

export interface MatchingProps {
  leftNodes?: MatchingNode[];
  rightNodes?: MatchingNode[];
  nodeColor?: string;
  nodeOpacity?: number;
  textColor?: string;
  borderColor?: string;
  lineColor?: string;
  [key: string]: unknown;
}

export interface MatchingComponent extends Component {
  type: "matching";
  props?: MatchingProps;
  actionProps?: MatchingActionProps;
}

export const DEFAULT_MATCHING_LEFT_NODES: MatchingNode[] = [
  { id: "left-1", label: "a" },
  { id: "left-2", label: "b" },
];

export const DEFAULT_MATCHING_RIGHT_NODES: MatchingNode[] = [
  { id: "right-1", label: "A" },
  { id: "right-2", label: "B" },
];

export const DEFAULT_MATCHING_NODE_COLOR = "#ffffff";
export const DEFAULT_MATCHING_NODE_OPACITY = 100;
export const DEFAULT_MATCHING_TEXT_COLOR = "#111827";
export const DEFAULT_MATCHING_BORDER_COLOR = "#cbd5e1";
export const DEFAULT_MATCHING_LINE_COLOR = "#0ea5e9";

export const isMatchingPairMapping = (
  value: unknown,
): value is MatchingPairMapping =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { leftId?: unknown }).leftId === "string" &&
  typeof (value as { rightId?: unknown }).rightId === "string" &&
  typeof (value as { resultPageId?: unknown }).resultPageId === "string" &&
  typeof (value as { score?: unknown }).score === "number";

export const normalizeMatchingPairMappings = (
  actionProps: Record<string, unknown> | undefined,
): MatchingPairMapping[] => {
  if (!Array.isArray(actionProps?.pairMappings)) {
    return [];
  }
  return actionProps.pairMappings.filter(isMatchingPairMapping);
};

export const computeMatchingResultMapping = (
  pairs: Record<string, string>,
  pairMappings: MatchingPairMapping[],
): Record<string, number> => {
  const totals: Record<string, number> = {};
  pairMappings.forEach((mapping) => {
    const matchedRight = pairs[mapping.leftId];
    if (matchedRight !== mapping.rightId) {
      return;
    }
    if (!Number.isFinite(mapping.score) || mapping.score <= 0) {
      return;
    }
    totals[mapping.resultPageId] =
      (totals[mapping.resultPageId] ?? 0) + mapping.score;
  });
  return totals;
};
