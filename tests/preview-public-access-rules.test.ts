import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQuizPlayHref,
  canPublicPlayQuiz,
  createClientSessionId,
  getEditQuizTitle,
  getExperienceMetaLabel,
  getMissingQuizStateCopy,
  getPrimaryQuizAction,
  getQuizLoadingLabel,
  getQuizStatusBadgeClass,
  getQuizStatusLabel,
  getStartExperienceLabel,
  resolveQuizPlaySurfaceFromFlag,
  shouldDisableEditQuiz,
  shouldShowPauseAction,
  shouldShowPreviewAction,
  shouldShowPublishAction,
  type QuizLifecycleStatus,
  type QuizPlaySurface,
} from "../src/lib/quiz-access-rules";
import {
  canActorPreviewQuiz,
  canPublicAccessQuiz,
  getPublishedQuizEditBlockMessage,
} from "../convex/quizAccessRules";

const lifecycleStatuses: QuizLifecycleStatus[] = [
  "draft",
  "published",
  "closed",
];

describe("preview/public access rules", () => {
  describe("frontend lifecycle labels and badge styling", () => {
    it("capitalizes all user-facing status labels", () => {
      assert.equal(getQuizStatusLabel("draft"), "Draft");
      assert.equal(getQuizStatusLabel("published"), "Published");
      assert.equal(getQuizStatusLabel("closed"), "Paused");
    });

    it("keeps published green, draft amber, and paused readable", () => {
      assert.equal(
        getQuizStatusBadgeClass("published"),
        "bg-emerald-600 text-white",
      );
      assert.equal(
        getQuizStatusBadgeClass("draft"),
        "bg-amber-500 text-white",
      );
      assert.equal(
        getQuizStatusBadgeClass("closed"),
        "bg-red-100 text-red-700",
      );
    });

    it("returns a label and badge class for every known lifecycle status", () => {
      for (const status of lifecycleStatuses) {
        assert.ok(getQuizStatusLabel(status).length > 0);
        assert.ok(getQuizStatusBadgeClass(status).includes("text-"));
      }
    });
  });

  describe("frontend dashboard action rules", () => {
    it("only allows public play when the quiz is published", () => {
      assert.equal(canPublicPlayQuiz("draft"), false);
      assert.equal(canPublicPlayQuiz("closed"), false);
      assert.equal(canPublicPlayQuiz("published"), true);
    });

    it("shows preview for every dashboard quiz state", () => {
      assert.equal(shouldShowPreviewAction("draft"), true);
      assert.equal(shouldShowPreviewAction("closed"), true);
      assert.equal(shouldShowPreviewAction("published"), true);
    });

    it("shows pause only for published quizzes", () => {
      assert.equal(shouldShowPauseAction("draft"), false);
      assert.equal(shouldShowPauseAction("closed"), false);
      assert.equal(shouldShowPauseAction("published"), true);
    });

    it("shows publish for everything except already published quizzes", () => {
      assert.equal(shouldShowPublishAction("draft"), true);
      assert.equal(shouldShowPublishAction("closed"), true);
      assert.equal(shouldShowPublishAction("published"), false);
    });

    it("disables editing only while the quiz is published", () => {
      assert.equal(shouldDisableEditQuiz("draft"), false);
      assert.equal(shouldDisableEditQuiz("closed"), false);
      assert.equal(shouldDisableEditQuiz("published"), true);
    });

    it("keeps the published edit tooltip aligned with the pause wording", () => {
      assert.equal(getEditQuizTitle("draft"), "Edit quiz");
      assert.equal(getEditQuizTitle("closed"), "Edit quiz");
      assert.equal(
        getEditQuizTitle("published"),
        "Pause the quiz before editing",
      );
    });

    it("maps each lifecycle state to the expected primary CTA", () => {
      assert.deepEqual(getPrimaryQuizAction("draft"), {
        kind: "preview",
        label: "Preview",
      });
      assert.deepEqual(getPrimaryQuizAction("closed"), {
        kind: "preview",
        label: "Preview",
      });
      assert.deepEqual(getPrimaryQuizAction("published"), {
        kind: "preview",
        label: "Preview",
      });
    });
  });

  describe("play href and surface resolution", () => {
    it("builds a public play href without the preview flag", () => {
      assert.equal(
        buildQuizPlayHref("quiz_123", {
          source: "dashboard",
          surface: "public",
        }),
        "/play/quiz_123?source=dashboard",
      );
    });

    it("builds a preview href that keeps source and adds preview=1", () => {
      assert.equal(
        buildQuizPlayHref("quiz_456", {
          source: "dashboard",
          surface: "preview",
        }),
        "/play/quiz_456?source=dashboard&preview=1",
      );
    });

    it("defaults the source to dashboard when callers do not provide one", () => {
      assert.equal(
        buildQuizPlayHref("quiz_default", {
          surface: "public",
        }),
        "/play/quiz_default?source=dashboard",
      );
      assert.equal(
        buildQuizPlayHref("quiz_default_preview", {
          surface: "preview",
        }),
        "/play/quiz_default_preview?source=dashboard&preview=1",
      );
    });

    it("treats only preview=1 as preview mode", () => {
      assert.equal(resolveQuizPlaySurfaceFromFlag("1"), "preview");
      assert.equal(resolveQuizPlaySurfaceFromFlag("0"), "public");
      assert.equal(resolveQuizPlaySurfaceFromFlag("true"), "public");
      assert.equal(resolveQuizPlaySurfaceFromFlag(undefined), "public");
      assert.equal(resolveQuizPlaySurfaceFromFlag(null), "public");
    });
  });

  describe("play-mode copy and session IDs", () => {
    const surfaces: QuizPlaySurface[] = ["public", "preview"];

    it("uses different session prefixes so preview sessions can stay out of KPIs", () => {
      assert.equal(
        createClientSessionId("public", "abc-123"),
        "session_abc-123",
      );
      assert.equal(
        createClientSessionId("preview", "xyz-789"),
        "demo_xyz-789",
      );
    });

    it("uses the correct loading copy for each play surface", () => {
      assert.equal(getQuizLoadingLabel("public"), "Loading quiz...");
      assert.equal(getQuizLoadingLabel("preview"), "Loading preview...");
    });

    it("uses the correct empty-state copy for public and preview modes", () => {
      assert.deepEqual(getMissingQuizStateCopy("public"), {
        title: "Quiz not found",
        description: "Double-check the link and try again.",
      });
      assert.deepEqual(getMissingQuizStateCopy("preview"), {
        title: "Preview unavailable",
        description: "Only the quiz owner can preview unpublished quizzes.",
      });
    });

    it("uses distinct start labels for public play and internal preview", () => {
      assert.equal(getStartExperienceLabel("public"), "Start Quiz");
      assert.equal(getStartExperienceLabel("preview"), "Start Preview");
    });

    it("adds the internal preview prefix to the meta line only in preview mode", () => {
      assert.equal(
        getExperienceMetaLabel("public", 3),
        "3 questions • Interactive quiz",
      );
      assert.equal(
        getExperienceMetaLabel("preview", 3),
        "Internal preview • 3 questions • Interactive quiz",
      );
      assert.equal(
        getExperienceMetaLabel("public", 1),
        "1 question • Interactive quiz",
      );
      assert.equal(
        getExperienceMetaLabel("preview", 1),
        "Internal preview • 1 question • Interactive quiz",
      );
    });

    it("always returns non-empty copy for each supported play surface", () => {
      for (const surface of surfaces) {
        assert.ok(getQuizLoadingLabel(surface).length > 0);
        assert.ok(getStartExperienceLabel(surface).length > 0);
        assert.ok(getExperienceMetaLabel(surface, 2).length > 0);
        const missing = getMissingQuizStateCopy(surface);
        assert.ok(missing.title.length > 0);
        assert.ok(missing.description.length > 0);
      }
    });
  });

  describe("backend public and preview access guards", () => {
    it("exposes public play only for published quizzes", () => {
      assert.equal(canPublicAccessQuiz("draft"), false);
      assert.equal(canPublicAccessQuiz("closed"), false);
      assert.equal(canPublicAccessQuiz("published"), true);
    });

    it("allows preview when the actor owns the quiz", () => {
      assert.equal(
        canActorPreviewQuiz({
          actorId: "user_1",
          ownerId: "user_1",
          isAdmin: false,
        }),
        true,
      );
    });

    it("allows preview when the actor is an admin reviewing another user's quiz", () => {
      assert.equal(
        canActorPreviewQuiz({
          actorId: "admin_1",
          ownerId: "user_9",
          isAdmin: true,
        }),
        true,
      );
    });

    it("rejects preview when the actor is logged out", () => {
      assert.equal(
        canActorPreviewQuiz({
          actorId: null,
          ownerId: "user_1",
          isAdmin: false,
        }),
        false,
      );
      assert.equal(
        canActorPreviewQuiz({
          actorId: undefined,
          ownerId: "user_1",
          isAdmin: true,
        }),
        false,
      );
    });

    it("rejects preview when the actor is neither owner nor admin", () => {
      assert.equal(
        canActorPreviewQuiz({
          actorId: "user_2",
          ownerId: "user_1",
          isAdmin: false,
        }),
        false,
      );
    });

    it("keeps the published edit-block message aligned with the pause terminology", () => {
      assert.equal(
        getPublishedQuizEditBlockMessage(),
        "Quiz is published and cannot be edited. Please pause it first.",
      );
    });
  });

  describe("cross-checking frontend and backend expectations", () => {
    it("keeps published dashboard preview separate from backend public access", () => {
      assert.equal(getPrimaryQuizAction("published").kind, "preview");
      assert.equal(shouldShowPreviewAction("published"), true);
      assert.equal(canPublicPlayQuiz("published"), true);
      assert.equal(canPublicAccessQuiz("published"), true);
    });

    it("keeps draft and paused quizzes aligned across preview CTA and backend preview-only intent", () => {
      for (const status of ["draft", "closed"] as const) {
        assert.equal(getPrimaryQuizAction(status).kind, "preview");
        assert.equal(shouldShowPreviewAction(status), true);
        assert.equal(canPublicPlayQuiz(status), false);
        assert.equal(canPublicAccessQuiz(status), false);
      }
    });

    it("keeps paused wording consistent wherever the old closed state still exists internally", () => {
      assert.equal(getQuizStatusLabel("closed"), "Paused");
      assert.equal(
        getQuizStatusBadgeClass("closed"),
        "bg-red-100 text-red-700",
      );
      assert.equal(shouldShowPreviewAction("closed"), true);
      assert.equal(shouldShowPublishAction("closed"), true);
      assert.equal(shouldShowPauseAction("closed"), false);
    });
  });
});
