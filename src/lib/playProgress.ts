/**
 * Helpers for the quiz player: stable question shuffling and saved progress.
 * Kept free of React and the DOM (apart from the storage wrappers) so they can
 * be unit tested.
 */

/** Saved progress is ignored after this long. */
export const PLAY_PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SavedPlayProgress = {
  sessionId: string;
  /** ID of the question page the player was on. */
  pageId: string;
  savedAt: number;
};

/** 32-bit FNV-1a hash of a string, used to seed the shuffle. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles a copy of `items` using `seed`. The same seed always gives the same
 * order, so a player who refreshes (same session) keeps their question order,
 * while different players get different orders.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = createRandom(hashString(seed));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function playProgressStorageKey(quizKey: string): string {
  return `visionverse_play_progress:${quizKey}`;
}

/** Validates stored progress. Returns null if missing, malformed or expired. */
export function parseSavedProgress(
  raw: string | null,
  now: number,
): SavedPlayProgress | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { sessionId, pageId, savedAt } = value as Record<string, unknown>;
  if (
    typeof sessionId !== "string" ||
    sessionId === "" ||
    typeof pageId !== "string" ||
    pageId === "" ||
    typeof savedAt !== "number" ||
    !Number.isFinite(savedAt)
  ) {
    return null;
  }
  if (now - savedAt > PLAY_PROGRESS_TTL_MS || savedAt > now + 60_000) {
    return null;
  }
  return { sessionId, pageId, savedAt };
}

export function readSavedProgress(quizKey: string): SavedPlayProgress | null {
  try {
    return parseSavedProgress(
      window.localStorage.getItem(playProgressStorageKey(quizKey)),
      Date.now(),
    );
  } catch {
    return null;
  }
}

export function writeSavedProgress(
  quizKey: string,
  progress: SavedPlayProgress,
): void {
  try {
    window.localStorage.setItem(
      playProgressStorageKey(quizKey),
      JSON.stringify(progress),
    );
  } catch {
    // Storage can be full or blocked (e.g. some private modes); progress is optional.
  }
}

export function clearSavedProgress(quizKey: string): void {
  try {
    window.localStorage.removeItem(playProgressStorageKey(quizKey));
  } catch {
    // Ignore storage errors.
  }
}
