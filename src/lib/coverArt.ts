/**
 * Draws a 16:9 cover image for a quiz on a canvas: the quiz's own colours,
 * its emoji and title. Used for AI generated quizzes (which need a cover to
 * be published) and the "Generate" button next to the cover image picker.
 */

import type { CoverTheme } from "./coverTheme";

export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 900;

const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export type CoverDetails = CoverTheme & {
  title: string;
  brandName?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Splits text into lines that fit, ending with an ellipsis if it runs over. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1]!;
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

export function drawCover(ctx: CanvasRenderingContext2D, details: CoverDetails) {
  const W = COVER_WIDTH;
  const H = COVER_HEIGHT;

  // Background: the quiz colour with a soft accent glow.
  ctx.fillStyle = details.background;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.78, H * 0.18, 0, W * 0.78, H * 0.18, W * 0.7);
  glow.addColorStop(0, rgba(details.accent, 0.35));
  glow.addColorStop(1, rgba(details.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Decorative circles, like the quiz pages.
  ctx.fillStyle = rgba(details.accent, 0.16);
  ctx.beginPath();
  ctx.arc(W * 0.9, H * 0.05, 330, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.06, H * 1.02, 260, 0, Math.PI * 2);
  ctx.fill();

  // Dotted texture on the left.
  ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
  for (let x = 40; x < W * 0.45; x += 36) {
    for (let y = 40; y < H; y += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Emoji in an accent ring, kept central so tall crops still show it.
  const emojiY = H * 0.3;
  ctx.fillStyle = rgba(details.accent, 0.22);
  ctx.beginPath();
  ctx.arc(W / 2, emojiY, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(details.accent, 0.8);
  ctx.lineWidth = 6;
  ctx.stroke();
  // Colour emoji ignore the fill colour but not its transparency.
  ctx.fillStyle = "#ffffff";
  ctx.font = `140px ${EMOJI_FONT}`;
  ctx.fillText(details.emoji, W / 2, emojiY + 8);

  // Title: shrink the font until it fits in at most three lines.
  const maxWidth = W * 0.78;
  let size = 96;
  let lines: string[] = [];
  for (; size >= 56; size -= 8) {
    ctx.font = `800 ${size}px ${FONT}`;
    lines = wrapLines(ctx, details.title, maxWidth, 3);
    if (lines.length <= 2 || size === 56) break;
  }
  const lineHeight = size * 1.12;
  let y = H * 0.62 - ((lines.length - 1) * lineHeight) / 2;
  ctx.fillStyle = "#ffffff";
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += lineHeight;
  }

  // Small pill with the brand at the bottom.
  const label = (details.brandName?.trim() || "VisionVerse").toUpperCase();
  ctx.font = `700 30px ${FONT}`;
  const pillWidth = ctx.measureText(label).width + 80;
  const pillY = H * 0.87;
  ctx.fillStyle = details.accent;
  ctx.beginPath();
  ctx.roundRect(W / 2 - pillWidth / 2, pillY - 32, pillWidth, 64, 32);
  ctx.fill();
  const [r, g, b] = hexToRgb(details.accent);
  // Dark text on light accents, white on dark ones.
  ctx.fillStyle = 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0f172a" : "#ffffff";
  ctx.fillText(label, W / 2, pillY + 1);
}

export async function createCoverImage(details: CoverDetails): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  drawCover(ctx, details);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create the cover")),
      // JPEG keeps covers around 150 KB instead of over 1 MB as PNG.
      "image/jpeg",
      0.9,
    );
  });
}
