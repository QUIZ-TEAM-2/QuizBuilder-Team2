import type { Component } from "@/types";

export type ProgressBarVariant = "rainbow" | "dots" | "numeric";

export interface ProgressBarProps {
  variant?: ProgressBarVariant;
  currentColor?: string;
  totalColor?: string;
  [key: string]: unknown;
}

export interface ProgressBarComponent extends Component {
  type: "progressBar";
  props?: ProgressBarProps;
}

export const PROGRESS_BAR_COMPONENT_SLUG = "progress-bar";

export const PROGRESS_BAR_VARIANTS: Array<{
  variant: ProgressBarVariant;
  label: string;
}> = [
  { variant: "rainbow", label: "Rainbow" },
  { variant: "dots", label: "Dots" },
  { variant: "numeric", label: "Numeric" },
];

export const DEFAULT_PROGRESS_BAR_PROPS: Required<
  Pick<ProgressBarProps, "variant" | "currentColor" | "totalColor">
> = {
  variant: "rainbow",
  currentColor: "#d8b4fe",
  totalColor: "#f8fafc",
};

/**
 * The numbers the progress bar shows. Players see their real progress. In
 * the editor, question pages show their own position ("2 of 3") so the dots
 * match the quiz; anywhere without a page count shows "X / Y" placeholders.
 */
export function getProgressValues(helpers: {
  isEditable: boolean;
  currentPageNumber?: number;
  totalPages?: number;
}): { currentValue: string; totalValue: string } {
  const hasCounts =
    typeof helpers.totalPages === "number" && helpers.totalPages > 0;
  if (helpers.isEditable && !hasCounts) {
    return { currentValue: "X", totalValue: "Y" };
  }
  return {
    currentValue: String(helpers.currentPageNumber ?? 1),
    totalValue: String(helpers.totalPages ?? 1),
  };
}
