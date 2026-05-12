"use client";

import React from "react";
import type { ProgressBarVariant } from "./types";

export interface ProgressBarViewProps {
  currentValue: string;
  totalValue: string;
  variant?: ProgressBarVariant;
  currentColor?: string;
  totalColor?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const parseNumericProgress = (currentValue: string, totalValue: string) => {
  const current = Number(currentValue);
  const total = Number(totalValue);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return { current: 1, total: 9, ratio: 0 };
  }

  const clampedCurrent = clamp(current, 1, total);
  const ratio = clampedCurrent / total;
  return { current: clampedCurrent, total, ratio };
};

export function ProgressBarView({
  currentValue,
  totalValue,
  variant = "rainbow",
  currentColor = "#d8b4fe",
  totalColor = "#f8fafc",
}: ProgressBarViewProps) {
  const { current, total, ratio } = parseNumericProgress(currentValue, totalValue);

  if (variant === "numeric") {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        <div
          className="inline-flex items-baseline justify-center whitespace-nowrap font-semibold"
          style={{
            fontFamily:
              '"Cormorant Garamond", "Times New Roman", Georgia, serif',
            fontSize: "clamp(20px, 4.2vw, 40px)",
            lineHeight: 0.88,
            fontVariantNumeric: "lining-nums",
            letterSpacing: "-0.05em",
            fontWeight: 600,
            textShadow: "0 1px 12px rgba(15, 23, 42, 0.16)",
          }}
        >
          <span className="drop-shadow-sm" style={{ color: currentColor }}>
            {currentValue}
          </span>
          <span
            className="mx-[0.08em] opacity-80"
            style={{ color: totalColor }}
          >
            /
          </span>
          <span className="opacity-95" style={{ color: totalColor }}>
            {totalValue}
          </span>
        </div>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: Math.max(total, 1) }, (_, index) => {
            const isFilled = index < current;
            return (
              <div
                key={index}
                className="h-3 w-3 rounded-full transition-all"
                style={{
                  backgroundColor: currentColor,
                  opacity: isFilled ? 1 : 0.22,
                  boxShadow: isFilled
                    ? "0 0 0 2px rgba(255,255,255,0.15) inset"
                    : "none",
                  transform: isFilled ? "scale(1)" : "scale(0.92)",
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative flex h-full w-full items-center px-3">
        <div
          className="absolute left-3 right-3 h-6 rounded-full border border-[#ebd7df] bg-[#f8e7ed] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
          style={{
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
        <div
          className="absolute inset-0 rounded-full opacity-100"
          style={{
            background:
              "linear-gradient(90deg, #d8f150 0%, #ff9bc2 24%, #86bbff 52%, #c4a0ff 76%, #ffc978 100%)",
          }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#6f79ef] shadow-[0_1px_6px_rgba(86,92,214,0.28)]"
          style={{
            width: `${clamp(ratio, 0, 1) * 100}%`,
          }}
        />
        </div>
        <div
          className="relative z-10 mx-auto font-medium"
          style={{
            fontFamily:
              '"Cormorant Garamond", "Times New Roman", Georgia, serif',
            fontSize: "clamp(14px, 2.4vw, 22px)",
            lineHeight: 0.9,
            fontVariantNumeric: "lining-nums",
            letterSpacing: "-0.04em",
            fontWeight: 600,
            color: "#78a6c6",
            textShadow: "0 1px 10px rgba(255,255,255,0.38)",
          }}
        >
          {currentValue}/{totalValue}
        </div>
      </div>
    </div>
  );
}

export default ProgressBarView;
