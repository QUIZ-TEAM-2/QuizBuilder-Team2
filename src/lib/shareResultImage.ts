/**
 * Builds a "my quiz result" image on a canvas and shares it with the native
 * share sheet, falling back to a download where file sharing isn't supported.
 */

export type ShareResultDetails = {
  quizTitle: string;
  resultName: string;
  brandName?: string;
  quizUrl: string;
};

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Splits text into lines that fit `maxWidth`, capped at `maxLines`. */
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
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

export async function createResultImage(
  details: ShareResultDetails,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  // Background matching the app's dark slate and emerald branding.
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#064e3b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(52, 211, 153, 0.12)";
  ctx.beginPath();
  ctx.arc(WIDTH - 120, 180, 260, 0, Math.PI * 2);
  ctx.fill();

  const margin = 96;
  const maxWidth = WIDTH - margin * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(details.brandName?.trim() || "VisionVerse", WIDTH / 2, 180);

  ctx.fillStyle = "#34d399";
  ctx.font = `600 52px ${FONT}`;
  ctx.fillText("I got", WIDTH / 2, 470);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 104px ${FONT}`;
  const resultLines = wrapLines(ctx, details.resultName, maxWidth, 3);
  const lineHeight = 120;
  let y = 610;
  for (const line of resultLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += lineHeight;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = `500 44px ${FONT}`;
  const titleLines = wrapLines(ctx, `on "${details.quizTitle}"`, maxWidth, 2);
  y += 40;
  for (const line of titleLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 58;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText("Take the quiz", WIDTH / 2, HEIGHT - 170);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 34px ${FONT}`;
  const urlLabel = details.quizUrl.replace(/^https?:\/\//, "");
  ctx.fillText(
    wrapLines(ctx, urlLabel, maxWidth, 1)[0] ?? "",
    WIDTH / 2,
    HEIGHT - 115,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create image")),
      "image/png",
    );
  });
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareResult(
  details: ShareResultDetails,
): Promise<ShareOutcome> {
  const blob = await createResultImage(details);
  const file = new File([blob], "my-quiz-result.png", { type: "image/png" });
  const text = `I got "${details.resultName}" on ${details.quizTitle}! Take the quiz:`;

  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: details.quizTitle,
        text: `${text} ${details.quizUrl}`,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      // Fall through to download if sharing fails for another reason.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-quiz-result.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
