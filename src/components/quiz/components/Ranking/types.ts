import type { Component } from "@/types";

export interface RankingItem {
  id: string;
  label: string;
}

export type RankingResultMapping = Record<string, number>;
export type RankingItemResultMappings = Record<string, RankingResultMapping>;

export interface RankingActionProps {
  positionWeights?: number[];
  itemResultMappings?: RankingItemResultMappings;
  [key: string]: unknown;
}

export interface RankingProps {
  title?: string;
  items?: RankingItem[];
  titleColor?: string;
  itemColor?: string;
  itemNodeColor?: string;
  itemNodeOpacity?: number;
  itemTextColor?: string;
  itemBorderColor?: string;
  itemOpacity?: number;
  [key: string]: unknown;
}

export interface RankingComponent extends Component {
  type: "ranking";
  props?: RankingProps;
}

export const RANKING_COMPONENT_SLUG = "ranking";

export const DEFAULT_RANKING_ITEMS: RankingItem[] = [
  { id: "rank-1", label: "First option" },
  { id: "rank-2", label: "Second option" },
  { id: "rank-3", label: "Third option" },
  { id: "rank-4", label: "Fourth option" },
];

export const DEFAULT_RANKING_TITLE = "Arrange the items";
export const DEFAULT_RANKING_TITLE_COLOR = "#ffffff";
export const DEFAULT_RANKING_ITEM_COLOR = "#ffffff";
export const DEFAULT_RANKING_ITEM_NODE_COLOR = "#ffffff";
export const DEFAULT_RANKING_ITEM_NODE_OPACITY = 0;
export const DEFAULT_RANKING_ITEM_TEXT_COLOR = "#ffffff";
export const DEFAULT_RANKING_ITEM_BORDER_COLOR = "#ffffff";
export const DEFAULT_RANKING_ITEM_OPACITY = 100;
export const RANKING_MAX_ITEMS = 26;

export const getRankingItemLetter = (index: number) =>
  String.fromCharCode(65 + index);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getRankingPositionWeights = (
  actionProps: Record<string, unknown> | undefined,
  itemCount: number,
): number[] => {
  const raw = Array.isArray(actionProps?.positionWeights)
    ? actionProps.positionWeights
    : [];

  return Array.from({ length: itemCount }, (_, index) => {
    const value = raw[index];
    return typeof value === "number" && Number.isFinite(value) ? value : 1;
  });
};

export const getRankingItemResultMappings = (
  actionProps: Record<string, unknown> | undefined,
): RankingItemResultMappings => {
  if (!isPlainObject(actionProps?.itemResultMappings)) {
    return {};
  }

  const nextMappings: RankingItemResultMappings = {};

  Object.entries(actionProps.itemResultMappings).forEach(([itemId, value]) => {
    if (!isPlainObject(value)) {
      return;
    }

    const resultMapping: RankingResultMapping = {};
    Object.entries(value).forEach(([resultId, score]) => {
      if (typeof score === "number" && Number.isFinite(score)) {
        resultMapping[resultId] = score;
      }
    });

    nextMappings[itemId] = resultMapping;
  });

  return nextMappings;
};

export const computeRankingResultMapping = ({
  rankingOrder,
  positionWeights,
  itemResultMappings,
}: {
  rankingOrder: string[];
  positionWeights: number[];
  itemResultMappings: RankingItemResultMappings;
}): RankingResultMapping => {
  const sanitizedWeights = positionWeights.map((weight) =>
    typeof weight === "number" && Number.isFinite(weight)
      ? Math.max(0, weight)
      : 0,
  );
  const weightSum = sanitizedWeights.reduce((sum, weight) => sum + weight, 0);

  if (weightSum <= 0) {
    return {};
  }

  const totalScores: RankingResultMapping = {};

  rankingOrder.forEach((itemId, index) => {
    const normalizedWeight = (sanitizedWeights[index] ?? 0) / weightSum;
    if (normalizedWeight <= 0) {
      return;
    }

    const itemMapping = itemResultMappings[itemId] ?? {};
    Object.entries(itemMapping).forEach(([resultId, score]) => {
      if (typeof score !== "number" || !Number.isFinite(score)) {
        return;
      }

      totalScores[resultId] =
        (totalScores[resultId] ?? 0) + score * normalizedWeight;
    });
  });

  return totalScores;
};
