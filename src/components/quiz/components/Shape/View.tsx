"use client";

import React from "react";
import type { ShapeVariant } from "./types";
import { DEFAULT_SHAPE_PROPS, TRANSPARENT_COLOR } from "./types";

export interface ShapeViewProps {
  variant?: ShapeVariant;
  fillColor?: string | null; // null or "transparent" for no fill
  strokeColor?: string | null; // null or "transparent" for no border
  strokeWidth?: number;
  opacity?: number;
}

// SVG paths for each shape variant
function getShapePath(variant: ShapeVariant): React.ReactNode {
  switch (variant) {
    case "rectangle":
      return <rect x="5" y="15" width="90" height="70" />;
    case "circle":
      return <ellipse cx="50" cy="50" rx="45" ry="45" />;
    case "triangle":
      return <polygon points="50,5 95,95 5,95" />;
    case "halfCircle":
      return <path d="M5,50 A45,45 0 0,1 95,50 L5,50 Z" />;
    default:
      return <rect x="5" y="5" width="90" height="90" />;
  }
}

export function ShapeView({
  variant = DEFAULT_SHAPE_PROPS.variant,
  fillColor = DEFAULT_SHAPE_PROPS.fillColor,
  strokeColor = DEFAULT_SHAPE_PROPS.strokeColor,
  strokeWidth = DEFAULT_SHAPE_PROPS.strokeWidth,
  opacity = DEFAULT_SHAPE_PROPS.opacity,
}: ShapeViewProps) {
  const opacityValue = (opacity ?? 100) / 100;

  // Handle transparent/none values
  const effectiveFill = fillColor === null || fillColor === TRANSPARENT_COLOR ? "none" : fillColor;
  const effectiveStroke = strokeColor === null || strokeColor === TRANSPARENT_COLOR ? "none" : strokeColor;
  const effectiveStrokeWidth = effectiveStroke === "none" ? 0 : strokeWidth;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{
          opacity: opacityValue,
        }}
      >
        <g
          fill={effectiveFill}
          stroke={effectiveStroke}
          strokeWidth={effectiveStrokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {getShapePath(variant ?? "rectangle")}
        </g>
      </svg>
    </div>
  );
}

export default ShapeView;

