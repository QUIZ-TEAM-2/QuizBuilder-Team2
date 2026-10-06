"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TIMER_PROPS,
  formatTimerSeconds,
  normalizeTimerDuration,
  normalizeTimerWarningAt,
} from "./types";

export interface TimerViewProps {
  duration?: number;
  warningAt?: number;
  textColor?: string;
  warningColor?: string;
  backgroundColor?: string;
  showBackground?: boolean;
  /** True in the editor: the timer shows its starting value and does not run. */
  isEditable?: boolean;
  /** Called once when the countdown reaches 0:00 during play. */
  onExpire?: () => void;
}

export function TimerView({
  duration,
  warningAt,
  textColor = DEFAULT_TIMER_PROPS.textColor,
  warningColor = DEFAULT_TIMER_PROPS.warningColor,
  backgroundColor = DEFAULT_TIMER_PROPS.backgroundColor,
  showBackground = DEFAULT_TIMER_PROPS.showBackground,
  isEditable = false,
  onExpire,
}: TimerViewProps) {
  const totalSeconds = normalizeTimerDuration(duration);
  const warningThreshold = normalizeTimerWarningAt(warningAt, totalSeconds);
  const [remaining, setRemaining] = useState(totalSeconds);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Restart whenever the configured duration changes, or when switching
  // between the editor and the player.
  useEffect(() => {
    setRemaining(totalSeconds);
    hasExpiredRef.current = false;
  }, [totalSeconds, isEditable]);

  // Fire onExpire exactly once when the countdown hits zero.
  useEffect(() => {
    if (isEditable || remaining > 0 || hasExpiredRef.current) return;
    hasExpiredRef.current = true;
    onExpireRef.current?.();
  }, [isEditable, remaining]);

  useEffect(() => {
    if (isEditable) return;

    const interval = window.setInterval(() => {
      setRemaining((current) => (current <= 0 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isEditable, totalSeconds]);

  const displaySeconds = isEditable ? totalSeconds : remaining;
  const isWarning = !isEditable && displaySeconds <= warningThreshold;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-lg px-2",
          "font-mono text-[clamp(0.75rem,3vw,2rem)] font-semibold tabular-nums",
          showBackground && "shadow-sm",
        )}
        style={{
          backgroundColor: showBackground ? backgroundColor : "transparent",
          color: isWarning ? warningColor : textColor,
        }}
        aria-label={`Time remaining ${formatTimerSeconds(displaySeconds)}`}
      >
        {formatTimerSeconds(displaySeconds)}
      </div>
    </div>
  );
}

export default TimerView;
