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
