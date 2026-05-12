import type { Component } from "@/types";

export type TextAlign = "left" | "center" | "right";

export const DEFAULT_TEXT_FONT_SIZE = 16;
const MIN_TEXT_FONT_SIZE = 10;
const MAX_TEXT_FONT_SIZE = 72;

export const clampFontSize = (value: number): number =>
  Math.max(MIN_TEXT_FONT_SIZE, Math.min(MAX_TEXT_FONT_SIZE, Math.round(value)));

export const parseFontSize = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampFontSize(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return clampFontSize(parsed);
    }
  }
  return undefined;
};

export const resolveTextFontSize = (fontSize: unknown): number => {
  const parsed = parseFontSize(fontSize);
  if (parsed !== undefined) {
    return parsed;
  }
  return DEFAULT_TEXT_FONT_SIZE;
};

export interface TextComponent extends Component {
  type: "text";
  data: string;
  props?: {
    fontSize?: number;
    align?: TextAlign;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  } & Record<string, unknown>;
}
