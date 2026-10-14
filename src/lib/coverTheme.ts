/**
 * Works out the colours and emoji for a generated cover image from a quiz's
 * onboarding page. Pure functions only, so it can be unit tested.
 */

export type CoverTheme = {
  background: string;
  accent: string;
  emoji: string;
};

export const DEFAULT_COVER_THEME: CoverTheme = {
  background: "#0f172a",
  accent: "#10b981",
  emoji: "✨",
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ONLY_EMOJI =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

type ComponentLike = {
  type?: string;
  data?: string;
  props?: Record<string, unknown>;
};

const normaliseHex = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX.test(trimmed)) return null;
  if (trimmed.length === 4) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

/** True for text like "☕" or "🏙️" with nothing else in it. */
export const isEmojiOnly = (text: string): boolean =>
  text.trim() !== "" && ONLY_EMOJI.test(text) && /\p{Extended_Pictographic}/u.test(text);

/**
 * Background comes from the page; the accent is the most used shape colour
 * that isn't the background; the emoji is the first emoji-only text box.
 */
export function pickCoverTheme(
  components: readonly ComponentLike[] | undefined,
  pageBackground: { color?: string } | null | undefined,
): CoverTheme {
  const background =
    normaliseHex(pageBackground?.color) ?? DEFAULT_COVER_THEME.background;

  const counts = new Map<string, number>();
  for (const component of components ?? []) {
    if (component.type !== "shape") continue;
    const fill = normaliseHex(component.props?.fillColor);
    if (!fill || fill === background) continue;
    counts.set(fill, (counts.get(fill) ?? 0) + 1);
  }
  let accent = DEFAULT_COVER_THEME.accent;
  let best = 0;
  for (const [color, count] of counts) {
    if (count > best) {
      accent = color;
      best = count;
    }
  }

  const emojiText = (components ?? []).find(
    (component) =>
      component.type === "text" &&
      typeof component.data === "string" &&
      isEmojiOnly(component.data),
  )?.data;

  return {
    background,
    accent,
    emoji: emojiText?.trim() ?? DEFAULT_COVER_THEME.emoji,
  };
}

/** Drops the " (2)" that duplicate or regenerated quiz titles get. */
export const coverTitle = (title: string | undefined): string =>
  (title ?? "").replace(/\s+\(\d+\)$/, "").trim() || "My quiz";
