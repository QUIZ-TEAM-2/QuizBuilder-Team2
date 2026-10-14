/**
 * Pure rules for knowledge quiz leaderboards, shared by the backend and the
 * player. No database access, so they can be unit tested.
 */

export const LEADERBOARD_SIZE = 10;
export const LEADERBOARD_NAME_MAX = 20;

/** Durations above this (about 11 days) all rank the same. */
const MAX_DURATION_MS = 999_999_999;

/** Leaderboards are for knowledge quizzes, and on unless the creator turns them off. */
export function isLeaderboardOn(quiz: {
  quizType?: string;
  leaderboardEnabled?: boolean;
}): boolean {
  return quiz.quizType === "knowledge" && quiz.leaderboardEnabled !== false;
}

/**
 * Tidies a player's display name. Returns null when nothing usable is left.
 * Control characters, angle brackets and runs of spaces are removed.
 */
export function cleanLeaderboardName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned === "") return null;
  return Array.from(cleaned).slice(0, LEADERBOARD_NAME_MAX).join("").trim();
}

/**
 * One number that sorts entries best-first when sorted descending: higher
 * percentage wins, then the faster time.
 */
export function computeRankKey(
  score: number,
  total: number,
  durationMs: number,
): number {
  const permille = total > 0 ? Math.round((Math.max(0, score) / total) * 1000) : 0;
  const duration = Math.min(MAX_DURATION_MS, Math.max(0, Math.round(durationMs)));
  return Math.min(1000, permille) * 1_000_000_000 + (MAX_DURATION_MS - duration);
}

/** Competition ranking (1, 2, 2, 4) for keys already sorted best-first. */
export function rankSortedKeys(keys: readonly number[]): number[] {
  const ranks: number[] = [];
  keys.forEach((key, index) => {
    ranks.push(index > 0 && key === keys[index - 1] ? ranks[index - 1]! : index + 1);
  });
  return ranks;
}

/** "45s", "2m 05s", "1h 02m". */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
