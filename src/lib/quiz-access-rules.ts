export type QuizLifecycleStatus = "draft" | "published" | "closed";

export type QuizPlaySurface = "public" | "preview";

export const QUIZ_STATUS_LABELS: Record<QuizLifecycleStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Paused",
};

export const QUIZ_STATUS_BADGE_CLASSES: Record<QuizLifecycleStatus, string> = {
  draft: "bg-amber-500 text-white",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-red-100 text-red-700",
};

export function getQuizStatusLabel(status: QuizLifecycleStatus): string {
  return QUIZ_STATUS_LABELS[status];
}

export function getQuizStatusBadgeClass(status: QuizLifecycleStatus): string {
  return QUIZ_STATUS_BADGE_CLASSES[status];
}

export function canPublicPlayQuiz(status: QuizLifecycleStatus): boolean {
  return status === "published";
}

export function shouldShowPreviewAction(status: QuizLifecycleStatus): boolean {
  return status === "draft" || status === "published" || status === "closed";
}

export function shouldShowPauseAction(status: QuizLifecycleStatus): boolean {
  return status === "published";
}

export function shouldShowPublishAction(status: QuizLifecycleStatus): boolean {
  return status !== "published";
}

export function shouldDisableEditQuiz(status: QuizLifecycleStatus): boolean {
  return status === "published";
}

export function getEditQuizTitle(status: QuizLifecycleStatus): string {
  return shouldDisableEditQuiz(status)
    ? "Pause the quiz before editing"
    : "Edit quiz";
}

export function getPrimaryQuizAction(
  _status: QuizLifecycleStatus,
): {
  kind: "play" | "preview";
  label: "Play" | "Preview";
} {
  return {
    kind: "preview",
    label: "Preview",
  };
}

export function resolveQuizPlaySurfaceFromFlag(
  previewFlag: string | null | undefined,
): QuizPlaySurface {
  return previewFlag === "1" ? "preview" : "public";
}

export function buildQuizPlayHref(
  quizId: string,
  options?: {
    source?: string;
    surface?: QuizPlaySurface;
  },
): string {
  const source = options?.source ?? "dashboard";
  const surface = options?.surface ?? "public";
  const params = new URLSearchParams({
    source,
  });

  if (surface === "preview") {
    params.set("preview", "1");
  }

  return `/play/${quizId}?${params.toString()}`;
}

export function createClientSessionId(
  surface: QuizPlaySurface,
  randomPart: string,
): string {
  return `${surface === "preview" ? "demo" : "session"}_${randomPart}`;
}

export function getQuizLoadingLabel(surface: QuizPlaySurface): string {
  return surface === "preview" ? "Loading preview..." : "Loading quiz...";
}

export function getMissingQuizStateCopy(surface: QuizPlaySurface): {
  title: string;
  description: string;
} {
  if (surface === "preview") {
    return {
      title: "Preview unavailable",
      description: "Only the quiz owner can preview unpublished quizzes.",
    };
  }

  return {
    title: "Quiz not found",
    description: "Double-check the link and try again.",
  };
}

export function getStartExperienceLabel(surface: QuizPlaySurface): string {
  return surface === "preview" ? "Start Preview" : "Start Quiz";
}

export function getExperienceMetaLabel(
  surface: QuizPlaySurface,
  totalQuestions: number,
): string {
  const questionLabel =
    totalQuestions === 1 ? "question" : "questions";
  const base = `${totalQuestions} ${questionLabel} • Interactive quiz`;

  return surface === "preview" ? `Internal preview • ${base}` : base;
}
