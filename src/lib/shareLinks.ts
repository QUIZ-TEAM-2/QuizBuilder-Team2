/**
 * Helpers for sharing a published quiz: the public link, an embeddable
 * play URL and the <iframe> snippet creators paste into their own site.
 */

export interface ShareableQuiz {
  _id: string;
  title: string;
  customSlug?: string;
}

export const EMBED_SIZE = { width: 400, height: 720 } as const;

export function buildPublicQuizLink(quiz: ShareableQuiz, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return quiz.customSlug
    ? `${base}/custom/${quiz.customSlug}`
    : `${base}/discover/${quiz._id}`;
}

export function buildEmbedUrl(quizId: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  const params = new URLSearchParams({ source: "embed", embed: "1" });
  return `${base}/play/${quizId}?${params.toString()}`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildEmbedSnippet(
  quiz: ShareableQuiz,
  origin: string,
  size: { width: number; height: number } = EMBED_SIZE,
): string {
  const src = buildEmbedUrl(quiz._id, origin);
  return [
    `<iframe`,
    `  src="${escapeAttribute(src)}"`,
    `  title="${escapeAttribute(quiz.title)}"`,
    `  width="${size.width}"`,
    `  height="${size.height}"`,
    `  style="border:0;border-radius:16px;max-width:100%"`,
    `  allow="autoplay; clipboard-write; web-share"`,
    `  loading="lazy"`,
    `></iframe>`,
  ].join("\n");
}

/** File-name friendly version of a quiz title, used for the QR download. */
export function toFileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "quiz";
}
