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
  /** Rectangles only: rounded corner radius in px. */
  cornerRadius?: number;
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
  cornerRadius = 0,
}: ShapeViewProps) {
  const opacityValue = (opacity ?? 100) / 100;

  // Handle transparent/none values
  const effectiveFill = fillColor === null || fillColor === TRANSPARENT_COLOR ? "none" : fillColor;
  const effectiveStroke = strokeColor === null || strokeColor === TRANSPARENT_COLOR ? "none" : strokeColor;
  const effectiveStrokeWidth = effectiveStroke === "none" ? 0 : strokeWidth;

  // Rounded rectangles are drawn with CSS so the corners stay round at any
  // size (the SVG below stretches to fit, which would distort them). They fill
  // the whole box, unlike the inset SVG rectangle.
  if (variant === "rectangle" && cornerRadius > 0) {
    return (
      <div
        className="h-full w-full"
        style={{
          backgroundColor: effectiveFill === "none" ? "transparent" : effectiveFill,
          border:
            effectiveStroke === "none"
              ? undefined
              : `${effectiveStrokeWidth}px solid ${effectiveStroke}`,
          borderRadius: `${cornerRadius}px`,
          opacity: opacityValue,
        }}
      />
    );
  }

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

