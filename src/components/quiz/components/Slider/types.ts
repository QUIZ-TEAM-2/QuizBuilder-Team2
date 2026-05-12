import type { Component } from "@/types";

export type SliderResultMapping = Record<string, number>;
export type SliderIntervalResultMappings = Record<string, SliderResultMapping>;
export type SliderResultTotals = Record<string, number>;

export interface SliderActionProps {
  intervalResultMappings?: SliderIntervalResultMappings;
  sliderResultTotals?: SliderResultTotals;
  [key: string]: unknown;
}

export interface SliderProps {
  min?: number;
  max?: number;
  divisions?: number;
  defaultValue?: number;
  trackColor?: string;
  rangeColor?: string;
  thumbColor?: string;
  textColor?: string;
  showValue?: boolean;
  [key: string]: unknown;
}

export interface SliderComponent extends Component {
  type: "slider";
  props?: SliderProps;
}

export const SLIDER_COMPONENT_SLUG = "slider";

export const DEFAULT_SLIDER_MIN = 0;
export const DEFAULT_SLIDER_MAX = 5;
export const DEFAULT_SLIDER_DIVISIONS = 5;
export const DEFAULT_SLIDER_VALUE = 3;
export const DEFAULT_SLIDER_TRACK_COLOR = "#FFFFFF";
export const DEFAULT_SLIDER_RANGE_COLOR = "#FFFFFF";
export const DEFAULT_SLIDER_THUMB_COLOR = "#111827";
export const DEFAULT_SLIDER_TEXT_COLOR = "#FFFFFF";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeSliderNumber = (
  value: unknown,
  fallback: number,
): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const normalizeSliderConfig = (props: SliderProps | undefined) => {
  const rawMin = Math.floor(
    normalizeSliderNumber(props?.min, DEFAULT_SLIDER_MIN),
  );
  const rawMax = Math.floor(
    normalizeSliderNumber(props?.max, DEFAULT_SLIDER_MAX),
  );
  const min = Math.max(0, Math.min(rawMin, rawMax - 1));
  const max = Math.max(rawMax, min + 1);
  const divisions = max - min;
  const defaultValue = snapSliderValueToTick(
    Math.round(
      normalizeSliderNumber(props?.defaultValue, DEFAULT_SLIDER_VALUE),
    ),
    min,
    max,
    divisions,
  );

  return {
    min,
    max,
    divisions,
    defaultValue,
  };
};

export const clampSliderValue = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getSliderStep = (min: number, max: number, divisions: number) =>
  (max - min) / Math.max(1, divisions);

export const getSliderTickIndex = ({
  value,
  min,
  max,
  divisions,
}: {
  value: number;
  min: number;
  max: number;
  divisions: number;
}) => {
  const step = getSliderStep(min, max, divisions);
  if (step <= 0) return 0;
  const tickIndex = Math.round(
    (clampSliderValue(value, min, max) - min) / step,
  );
  return Math.min(Math.max(tickIndex, 0), divisions);
};

export const getSliderTickValue = (
  tickIndex: number,
  min: number,
  max: number,
  divisions: number,
) =>
  clampSliderValue(
    min + getSliderStep(min, max, divisions) * tickIndex,
    min,
    max,
  );

export const snapSliderValueToTick = (
  value: number,
  min: number,
  max: number,
  divisions: number,
) =>
  getSliderTickValue(
    getSliderTickIndex({ value, min, max, divisions }),
    min,
    max,
    divisions,
  );

export const getSliderIntervalIndex = ({
  value,
  min,
  max,
  divisions,
}: {
  value: number;
  min: number;
  max: number;
  divisions: number;
}) => getSliderTickIndex({ value, min, max, divisions });

export const getSliderIntervalLabel = (
  index: number,
  min: number,
  max: number,
  divisions: number,
) => {
  const step = getSliderStep(min, max, divisions);
  const start = min + step * (index - 1);
  const end = index === divisions ? max : min + step * index;
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(2);

  return `${format(start)} - ${format(end)}`;
};

export const getSliderIntervalResultMappings = (
  actionProps: Record<string, unknown> | undefined,
): SliderIntervalResultMappings => {
  if (!isPlainObject(actionProps?.intervalResultMappings)) {
    return {};
  }

  const nextMappings: SliderIntervalResultMappings = {};

  Object.entries(actionProps.intervalResultMappings).forEach(
    ([intervalIndex, value]) => {
      if (!isPlainObject(value)) return;

      const resultMapping: SliderResultMapping = {};
      Object.entries(value).forEach(([resultId, score]) => {
        if (typeof score === "number" && Number.isFinite(score)) {
          resultMapping[resultId] = score;
        }
      });

      nextMappings[intervalIndex] = resultMapping;
    },
  );

  return nextMappings;
};

export const getSliderResultTotals = (
  actionProps: Record<string, unknown> | undefined,
): SliderResultTotals => {
  if (!isPlainObject(actionProps?.sliderResultTotals)) {
    return {};
  }

  const totals: SliderResultTotals = {};

  Object.entries(actionProps.sliderResultTotals).forEach(
    ([resultId, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        totals[resultId] = Math.max(0, value);
      }
    },
  );

  return totals;
};

export const computeSliderResultMapping = ({
  value,
  intervalIndex,
  divisions,
  max,
  sliderResultTotals,
  intervalResultMappings,
}: {
  value?: number;
  intervalIndex: number;
  divisions?: number;
  max?: number;
  sliderResultTotals?: SliderResultTotals;
  intervalResultMappings: SliderIntervalResultMappings;
}): SliderResultMapping => {
  if (sliderResultTotals && Object.keys(sliderResultTotals).length > 0) {
    const denominator = Math.max(1, max ?? divisions ?? intervalIndex);
    const numerator =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : intervalIndex;
    const ratio = Math.min(Math.max(numerator / denominator, 0), 1);
    const resultMapping: SliderResultMapping = {};

    Object.entries(sliderResultTotals).forEach(([resultId, totalScore]) => {
      resultMapping[resultId] = totalScore * ratio;
    });

    return resultMapping;
  }

  return intervalResultMappings[String(intervalIndex)] ?? {};
};
