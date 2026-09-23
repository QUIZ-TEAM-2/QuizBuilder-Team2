import type { Component } from "@/types";

export interface TimerComponent extends Component {
  type: "timer";
  data?: string;
  props?: TimerProps;
}

export interface TimerProps extends Record<string, unknown> {
  /** Countdown length in seconds. */
  duration?: number;
  /** Seconds remaining at which the timer switches to the warning colour. */
  warningAt?: number;
  textColor?: string;
  warningColor?: string;
  backgroundColor?: string;
  showBackground?: boolean;
}

export const DEFAULT_TIMER_PROPS: Required<TimerProps> = {
  duration: 60,
  warningAt: 10,
  textColor: "#f8fafc",
  warningColor: "#f87171",
  backgroundColor: "#020617",
  showBackground: true,
};

export const MIN_TIMER_DURATION = 5;
export const MAX_TIMER_DURATION = 3600;

export function normalizeTimerDuration(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_TIMER_PROPS.duration;
  }
  return Math.min(
    MAX_TIMER_DURATION,
    Math.max(MIN_TIMER_DURATION, Math.round(value)),
  );
}

export function normalizeTimerWarningAt(value: unknown, duration: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return Math.min(DEFAULT_TIMER_PROPS.warningAt, duration);
  }
  return Math.min(duration, Math.max(0, Math.round(value)));
}

/** Formats a number of seconds as m:ss, or h:mm:ss past an hour. */
export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
