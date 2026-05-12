export type QuizLifecycleStatus = "draft" | "published" | "closed";

export function canPublicAccessQuiz(status: QuizLifecycleStatus): boolean {
  return status === "published";
}

export function canActorPreviewQuiz(args: {
  actorId: string | null | undefined;
  ownerId: string;
  isAdmin: boolean;
}): boolean {
  if (!args.actorId) {
    return false;
  }

  return args.isAdmin || args.actorId === args.ownerId;
}

export function getPublishedQuizEditBlockMessage(): string {
  return "Quiz is published and cannot be edited. Please pause it first.";
}
