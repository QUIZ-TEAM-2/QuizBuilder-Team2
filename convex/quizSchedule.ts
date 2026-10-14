/**
 * Optional open and close times for a published quiz. Times are stored as
 * millisecond timestamps and checked when they matter, so no background job
 * is needed: a published quiz is only playable inside its window.
 * Pure functions only, shared by the backend and the app.
 */

export type QuizSchedule = {
  opensAt?: number | null;
  closesAt?: number | null;
};

export type ScheduleState = "open" | "upcoming" | "ended";

export function getScheduleState(
  schedule: QuizSchedule,
  now: number,
): ScheduleState {
  if (typeof schedule.opensAt === "number" && now < schedule.opensAt) {
    return "upcoming";
  }
  if (typeof schedule.closesAt === "number" && now >= schedule.closesAt) {
    return "ended";
  }
  return "open";
}

/** Returns a message when the schedule doesn't make sense, otherwise null. */
export function validateSchedule(schedule: QuizSchedule): string | null {
  const { opensAt, closesAt } = schedule;
  for (const value of [opensAt, closesAt]) {
    if (value !== undefined && value !== null && !Number.isFinite(value)) {
      return "That date isn't valid.";
    }
  }
  if (
    typeof opensAt === "number" &&
    typeof closesAt === "number" &&
    closesAt <= opensAt
  ) {
    return "The closing time must be after the opening time.";
  }
  return null;
}

/** "Mon 20 Oct, 9:00 am" in the viewer's own time zone. */
export function formatScheduleDate(timestamp: number, locale = "en-AU"): string {
  return new Date(timestamp).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Short label for badges: the time if it's today ("12:50 pm"), else "20 Oct". */
export function formatShortDate(
  timestamp: number,
  locale = "en-AU",
  now = Date.now(),
): string {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date(now).toDateString()) {
    return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** "2d 4h", "3h 05m", "4m 09s", "12s". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

export type ScheduleBadge = {
  label: string;
  tone: "upcoming" | "ended" | "closing";
};

/** Small label for the dashboard card of a published quiz, if it has a schedule. */
export function getScheduleBadge(
  status: string,
  schedule: QuizSchedule,
  now: number,
  locale = "en-AU",
): ScheduleBadge | null {
  if (status !== "published") return null;
  const state = getScheduleState(schedule, now);
  if (state === "upcoming" && typeof schedule.opensAt === "number") {
    return { label: `Opens ${formatShortDate(schedule.opensAt, locale, now)}`, tone: "upcoming" };
  }
  if (state === "ended" && typeof schedule.closesAt === "number") {
    return { label: `Ended ${formatShortDate(schedule.closesAt, locale, now)}`, tone: "ended" };
  }
  if (typeof schedule.closesAt === "number") {
    return { label: `Closes ${formatShortDate(schedule.closesAt, locale, now)}`, tone: "closing" };
  }
  return null;
}

/** Value for an <input type="datetime-local"> in the viewer's time zone. */
export function toDateTimeLocalValue(timestamp: number | null | undefined): string {
  if (typeof timestamp !== "number") return "";
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Parses an <input type="datetime-local"> value (local time). Empty means no time. */
export function fromDateTimeLocalValue(value: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
