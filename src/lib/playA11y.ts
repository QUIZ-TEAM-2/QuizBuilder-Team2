/**
 * Accessibility helpers for the quiz player: what screen readers call each
 * clickable component, what gets announced when the page changes, and the
 * answers that the number-key shortcuts pick. Pure functions only.
 */

import { isEmojiOnly } from "./coverTheme";

type ComponentLike = {
  id: string;
  type: string;
  data?: string;
  props?: Record<string, unknown>;
  action?: string;
  position?: { x: number; y: number };
};

const FALLBACK_LABELS: Record<string, string> = {
  startQuiz: "Start quiz",
  nextPage: "Next",
  previousPage: "Previous",
  hyperlink: "Open link",
  answerBox: "Answer",
};

const cleanText = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/** Role and accessible name for a component with an action in play mode. */
export function describeAction(component: ComponentLike): {
  role: "button" | "link";
  label: string;
} {
  const role = component.action === "hyperlink" ? "link" : "button";
  let label = "";
  if (component.type === "text") label = cleanText(component.data);
  else if (component.type === "image") label = cleanText(component.props?.alt);
  if (!label) label = FALLBACK_LABELS[component.action ?? ""] ?? "Button";
  return { role, label };
}

const readingOrder = (a: ComponentLike, b: ComponentLike) =>
  (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
  (a.position?.x ?? 0) - (b.position?.x ?? 0);

/** The page's main text: the biggest plain (non-button) text, then the highest. */
export function getPageHeadline(components: readonly ComponentLike[]): string | null {
  const candidates = components
    .filter(
      (component) =>
        component.type === "text" &&
        !component.action &&
        component.props?.isButton !== true &&
        cleanText(component.data) !== "" &&
        // A big decorative emoji isn't the title.
        !isEmojiOnly(cleanText(component.data)),
    )
    .sort((a, b) => {
      const size = (c: ComponentLike) =>
        typeof c.props?.fontSize === "number" ? c.props.fontSize : 16;
      return size(b) - size(a) || readingOrder(a, b);
    });
  return candidates[0] ? cleanText(candidates[0].data) : null;
}

/** Answer buttons in the order players read them, for the 1-9 shortcuts. */
export function getAnswerTargets<T extends ComponentLike>(
  components: readonly T[],
): T[] {
  return components
    .filter((component) => component.action === "answerBox")
    .sort(readingOrder);
}

/** Maps a key press to an answer index, or null. Only plain 1-9. */
export function answerIndexForKey(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  return /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : null;
}

/** What a screen reader hears when a new page appears. */
export function buildPageAnnouncement(page: {
  kind: "onboarding" | "question" | "result";
  headline: string | null;
  questionNumber?: number;
  totalQuestions?: number;
}): string {
  const headline = page.headline ?? "";
  if (page.kind === "question" && page.questionNumber && page.totalQuestions) {
    const prefix = `Question ${page.questionNumber} of ${page.totalQuestions}`;
    return headline ? `${prefix}: ${headline}` : prefix;
  }
  if (page.kind === "result") {
    return headline ? `Your result: ${headline}` : "Your result";
  }
  return headline;
}
