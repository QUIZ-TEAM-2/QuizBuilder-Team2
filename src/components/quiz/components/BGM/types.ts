import type { Component } from "@/types";

export interface BGMComponent extends Component {
  type: "bgm";
  data?: string;
  props?: BGMProps;
}

export interface BGMProps extends Record<string, unknown> {
  muted?: boolean;
  volume?: number;
  loop?: boolean;
  fileName?: string;
  backgroundColor?: string;
  iconColor?: string;
  opacity?: number;
}

export const DEFAULT_BGM_PROPS: Required<BGMProps> = {
  muted: false,
  volume: 70,
  loop: true,
  fileName: "",
  backgroundColor: "#020617",
  iconColor: "#ffffff",
  opacity: 100,
};

export function normalizeBGMVolume(value: unknown): number {
  return typeof value === "number" ? Math.min(100, Math.max(0, value)) : 70;
}

export function normalizeBGMOpacity(value: unknown): number {
  return typeof value === "number" ? Math.min(100, Math.max(0, value)) : 100;
}
