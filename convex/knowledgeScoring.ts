/**
 * Knowledge quiz scoring, shared by the server (real results) and the player
 * (preview mode and instant feedback). Pure functions only.
 */

export type QuizType = "personality" | "knowledge";

export const normalizeQuizType = (value: unknown): QuizType =>
  value === "knowledge" ? "knowledge" : "personality";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const isCorrectAnswerBox = (component: Record<string, unknown>): boolean =>
  component.action === "answerBox" &&
  asRecord(component.actionProps)?.isCorrect === true;

/**
 * IDs of answer buttons marked correct on a page, including answer buttons
 * inside groups. Pass DB components (`_id`) or client components (`id`).
 */
export function getCorrectAnswerIds(components: readonly unknown[]): string[] {
  const ids: string[] = [];
  for (const item of components) {
    const component = asRecord(item);
    if (!component) continue;
    const id = component.id ?? component._id;
    if (isCorrectAnswerBox(component) && typeof id === "string") ids.push(id);
    if (Array.isArray(component.children)) {
      for (const child of component.children) {
        const childRecord = asRecord(child);
        if (
          childRecord &&
          isCorrectAnswerBox(childRecord) &&
          typeof childRecord.id === "string"
        ) {
          ids.push(childRecord.id);
        }
      }
    }
  }
  return ids;
}

/** Only single and multiple choice pages can be marked right or wrong. */
export const isScorableQuestionMode = (mode: unknown): boolean =>
  mode === undefined ||
  mode === null ||
  mode === "single" ||
  mode === "multiple";

export type ScorablePage = {
  id: string;
  questionMode?: unknown;
  correctAnswerIds: readonly string[];
};

/**
 * Whether a set of chosen answers is right. Single choice: the one chosen
 * answer is correct. Multiple choice: exactly the correct answers were chosen.
 */
export function isAnswerCorrect(
  questionMode: unknown,
  chosenIds: readonly string[],
  correctIds: readonly string[],
): boolean {
  if (chosenIds.length === 0 || correctIds.length === 0) return false;
  const correct = new Set(correctIds);
  if (questionMode === "multiple") {
    const chosen = new Set(chosenIds);
    return (
      chosen.size === correct.size && [...chosen].every((id) => correct.has(id))
    );
  }
  return chosenIds.every((id) => correct.has(id));
}

/**
 * Scores a play-through. Pages with no correct answer marked (or that aren't
 * single/multiple choice) don't count towards the total. Unanswered pages
 * (e.g. the timer ran out) count as wrong.
 */
export function scoreKnowledgeQuiz(
  pages: readonly ScorablePage[],
  chosenIdsByPage: ReadonlyMap<string, readonly string[]>,
): { score: number; total: number } {
  let score = 0;
  let total = 0;
  for (const page of pages) {
    if (!isScorableQuestionMode(page.questionMode)) continue;
    if (page.correctAnswerIds.length === 0) continue;
    total += 1;
    if (
      isAnswerCorrect(
        page.questionMode,
        chosenIdsByPage.get(page.id) ?? [],
        page.correctAnswerIds,
      )
    ) {
      score += 1;
    }
  }
  return { score, total };
}

/** Evenly spaced default bands: 0%, then equal steps by result order. */
export const defaultMinScorePercent = (index: number, count: number): number =>
  count <= 1 ? 0 : Math.round((index * 100) / count);

export const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(value)));

export function resolveMinScorePercent(
  value: unknown,
  index: number,
  count: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clampPercent(value)
    : defaultMinScorePercent(index, count);
}

/**
 * Picks the result band for a score: the result with the highest minimum the
 * player reached. Ties go to the earlier result. If no band is reached, the
 * lowest band wins.
 */
export function pickKnowledgeResult(
  results: ReadonlyArray<{ id: string; minScorePercent?: unknown }>,
  score: number,
  total: number,
): string | null {
  if (results.length === 0) return null;
  const percent = total > 0 ? (score / total) * 100 : 0;
  const bands = results.map((result, index) => ({
    id: result.id,
    min: resolveMinScorePercent(result.minScorePercent, index, results.length),
  }));
  let best: { id: string; min: number } | null = null;
  for (const band of bands) {
    if (band.min <= percent && (!best || band.min > best.min)) best = band;
  }
  if (best) return best.id;
  return bands.reduce((lowest, band) => (band.min < lowest.min ? band : lowest))
    .id;
}

/** Replaces {score} and {total} in result page text. */
export const applyScoreTokens = (text: string, score: number, total: number) =>
  text
    .replace(/\{score\}/gi, String(score))
    .replace(/\{total\}/gi, String(total));
