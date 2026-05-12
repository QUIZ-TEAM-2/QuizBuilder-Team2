import type { Component } from "@/types";

// Available shape variants
export type ShapeVariant =
  | "rectangle"
  | "circle"
  | "triangle"
  | "halfCircle";

export interface ShapeProps {
  variant?: ShapeVariant;
  fillColor?: string | null; // null or "transparent" for no fill
  strokeColor?: string | null; // null or "transparent" for no border
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  [key: string]: unknown;
}

export interface ShapeComponent extends Component {
  type: "shape";
  props?: ShapeProps;
}

// Special value for transparent/none
export const TRANSPARENT_COLOR = "transparent";

export const DEFAULT_SHAPE_PROPS: ShapeProps = {
  variant: "rectangle",
  fillColor: "#3b82f6",
  strokeColor: null,
  strokeWidth: 2,
  opacity: 100,
  rotation: 0,
};

// Shape variant metadata for the dock picker
export interface ShapeVariantInfo {
  variant: ShapeVariant;
  label: string;
  icon: string; // SVG path or emoji
}

export const SHAPE_VARIANTS: ShapeVariantInfo[] = [
  { variant: "rectangle", label: "Rectangle", icon: "▬" },
  { variant: "circle", label: "Circle", icon: "●" },
  { variant: "triangle", label: "Triangle", icon: "▲" },
  { variant: "halfCircle", label: "Half Circle", icon: "◗" },
];

