"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Copy,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Eye,
  Sparkles,
  FileText,
  Trophy,
  Calendar,
  Smartphone,
  Star,
  GitBranch,
  LinkIcon,
} from "lucide-react";
import type { Id, Component } from "@/types";
import ConvexUserButton from "@/components/auth/convex-user-button";
import {
  AdminDashboardNavDropdown,
  UserDashboardNavButton,
} from "@/components/nav/admin-dashboard-nav-dropdown";
import PhonePreview from "@/components/editor/PhonePreview";
import {
  buildQuizPlayHref,
  getEditQuizTitle,
  getPrimaryQuizAction,
  getQuizStatusBadgeClass,
  getQuizStatusLabel,
  shouldShowPauseAction,
  shouldShowPublishAction,
} from "@/lib/quiz-access-rules";

interface QuizWithPreview {
  _id: Id<"quiz">;
  title: string;
  description?: string;
  customSlug?: string;
  coverImage?: string;
  featured?: boolean;
  userId: Id<"users">;
  status: "draft" | "published" | "closed";
  _creationTime: number;
  pageCount?: number;
  resultCount?: number;
  publishVersion?: number;
  pageIds?: Id<"pages">[];
  resultIds?: Id<"results">[];
  onboardingPageId?: Id<"pages">;
  onboardingBackground?: {
    color?: string;
    image?: string;
  } | null;
  /** Set when the viewer is admin: quiz owner label for the title suffix. */
  ownerDisplayName?: string;
}

function QuizTitleHeading({
  quiz,
  className,
}: {
  quiz: QuizWithPreview;
  /** e.g. font-semibold in dialogs so only the owner suffix stays italic/normal */
  className?: string;
}) {
  return (
    <span className={className}>
      {quiz.title}
      {quiz.ownerDisplayName ? (
        <span className="italic font-normal text-slate-500">
          {" "}
          ({quiz.ownerDisplayName})
        </span>
      ) : null}
    </span>
  );
}

function getPublishedQuizLink(quiz: QuizWithPreview, origin: string) {
  return quiz.customSlug
    ? `${origin}/custom/${quiz.customSlug}`
    : `${origin}/discover/${quiz._id}`;
}

function toErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "number") return String(error);
  if (typeof error === "boolean") return error ? "true" : "false";
  if (typeof error === "bigint") return String(error);
  if (error == null) return "";
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getCreateQuizErrorMessage(error: unknown): string {
  const raw = toErrorText(error);

  if (raw.includes("You already have a quiz with this title")) {
    return "You already have a quiz with this title.";
  }

  if (raw.includes("Quiz title is required")) {
    return "Enter a quiz title.";
  }

  return "Failed to create quiz. Please try again.";
}

function isExpectedCreateQuizError(error: unknown): boolean {
  const raw = toErrorText(error);
  return (
    raw.includes("You already have a quiz with this title") ||
    raw.includes("Quiz title is required")
  );
}

interface QuizOnboardingPreviewProps {
  quizId: Id<"quiz">;
  fallbackBackground?: QuizWithPreview["onboardingBackground"];
}

function QuizOnboardingPreview({
  quizId,
  fallbackBackground,
}: QuizOnboardingPreviewProps) {
  const quizDetail = useQuery(api.quiz.getQuiz, { id: quizId });
  const onboarding = quizDetail?.onboardingPage as
    | {
      components?: Component[];
      background?: { color?: string; image?: string };
    }
    | null
    | undefined;

  if (!quizDetail) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div
        className="h-full w-full"
        style={{
          backgroundColor: fallbackBackground?.color || "#f1f5f9",
          backgroundImage: fallbackBackground?.image
            ? `url(${fallbackBackground.image})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!fallbackBackground?.color && !fallbackBackground?.image && (
          <div className="flex h-full w-full items-center justify-center">
            <Smartphone className="h-8 w-8 text-slate-300" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <PhonePreview
        components={onboarding.components ?? []}
        background={onboarding.background}
        isEditable={false}
        // Smaller scale so the full phone fits nicely inside the card
        scale={0.22}
        roundedCorners
        className="mx-auto"
        contentClassName="pointer-events-none"
      />
    </div>
  );
}

function AuthenticatedQuizContent() {
  const [deletingId, setDeletingId] = useState<Id<"quiz"> | null>(null);
  const [featuringId, setFeaturingId] = useState<Id<"quiz"> | null>(null);
  const [featuredHintId, setFeaturedHintId] = useState<Id<"quiz"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [createTitleError, setCreateTitleError] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    quiz: QuizWithPreview | null;
  }>({
    isOpen: false,
    quiz: null,
  });

  const [closeDialog, setCloseDialog] = useState<{
    isOpen: boolean;
    quiz: QuizWithPreview | null;
  }>({
    isOpen: false,
    quiz: null,
  });
  const router = useRouter();

  const quizzesQuery = useQuery(api.quiz.getUserQuizzes);
  const user = useQuery(api.auth.currentUser);
  const deleteQuizMutation = useMutation(api.quiz.deleteQuiz);
  const createQuizMutation = useMutation(api.quiz.createQuiz);
  const publishQuizMutation = useMutation(api.quiz.publishQuiz);//add publish mutation
  const closeQuizMutation = useMutation(api.quiz.closeQuiz);//add closed mutation
  const setQuizFeaturedMutation = useMutation(api.quiz.setQuizFeatured);
  const duplicateQuizMutation = useMutation(api.quiz.duplicateQuiz);
  const [duplicatingId, setDuplicatingId] = useState<Id<"quiz"> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published" | "closed"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "az" | "za">(
    "newest",
  );

  const quizzes = (quizzesQuery ?? []) as QuizWithPreview[];

  // Search, status filter and sort for the quiz list. Frontend only.
  const visibleQuizzes = useMemo(() => {
    const source = (quizzesQuery ?? []) as QuizWithPreview[];
    const term = searchTerm.trim().toLowerCase();
    const filtered = source.filter((quiz) => {
      if (statusFilter !== "all" && quiz.status !== statusFilter) return false;
      if (!term) return true;
      return (
        quiz.title.toLowerCase().includes(term) ||
        (quiz.description ?? "").toLowerCase().includes(term) ||
        (quiz.ownerDisplayName ?? "").toLowerCase().includes(term)
      );
    });
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return a._creationTime - b._creationTime;
        case "az":
          return a.title.localeCompare(b.title);
        case "za":
          return b.title.localeCompare(a.title);
        default:
          return b._creationTime - a._creationTime;
      }
    });
  }, [quizzesQuery, searchTerm, statusFilter, sortBy]);
  const isFiltering = searchTerm.trim() !== "" || statusFilter !== "all";
  const isLoading = quizzesQuery === undefined;
  const isAdmin = user?.role === "admin";

  const openCreateDialog = () => {
    setNewQuizTitle("");
    setCreateTitleError(null);
    setCreateDialogOpen(true);
  };

  const handleCreateNew = async () => {
    if (creatingRef.current) return;
    const title = newQuizTitle.trim();

    if (!title) {
      setCreateTitleError("Enter a quiz title.");
      return;
    }

    creatingRef.current = true;
    setIsCreating(true);
    setCreateTitleError(null);
    try {
      const result = await createQuizMutation({
        title,
        description: undefined,
      });

      if (!result.ok) {
        const message = result.message ?? "Failed to create quiz. Please try again.";
        setCreateTitleError(message);
        toast.error(message);
        return;
      }

      if (!result.id) {
        throw new Error("Create quiz succeeded without returning an id.");
      }

      setCreateDialogOpen(false);
      setNewQuizTitle("");
      router.push(`/quiz/${result.id}`);
    } catch (error) {
      const message = getCreateQuizErrorMessage(error);
      if (!isExpectedCreateQuizError(error)) {
        console.error("Error creating quiz:", error);
      }
      setCreateTitleError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
      creatingRef.current = false;
    }
  };
  const handleDuplicate = async (quizId: Id<"quiz">) => {
    setDuplicatingId(quizId);
    try {
      await duplicateQuizMutation({ quizId });
    } catch (err) {
      console.error("Failed to duplicate quiz", err);
    } finally {
      setDuplicatingId(null);
    }
  };
  const handleEdit = (quizId: Id<"quiz">) => {
    router.push(`/quiz/${quizId}`);
  };

  const handlePreview = (quizId: Id<"quiz">) => {
    router.push(
      buildQuizPlayHref(String(quizId), {
        source: "dashboard",
        surface: "preview",
      }),
    );
  };

  const handlePublish = async (quiz: QuizWithPreview) => {
    try {
      const result = await publishQuizMutation({ id: quiz._id });
      if (!result.ok) {
        toast.error(result.message ?? "Failed to publish quiz");
        return;
      }
      toast.success("Quiz published");
    } catch (error) {
      console.error("Failed to publish quiz:", error);
      toast.error("Failed to publish quiz");
    }
  };

  const handleCopyPublishedLink = async (quiz: QuizWithPreview) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const href = getPublishedQuizLink(quiz, origin);

    try {
      await navigator.clipboard.writeText(href);
      toast.success(`Copied: ${href}`);
    } catch (error) {
      console.error("Failed to copy quiz link:", error);
      toast.error("Failed to copy link");
    }
  };

  const handleDelete = (quiz: QuizWithPreview) => {
    setDeleteDialog({
      isOpen: true,
      quiz,
    });
  };

  const handleToggleFeatured = async (quiz: QuizWithPreview) => {
    if (!isAdmin) {
      return;
    }

    if (quiz.status !== "published") {
      toast.error("Only published quizzes can be marked as featured");
      return;
    }

    setFeaturingId(quiz._id);
    setFeaturedHintId(quiz._id);
    try {
      await setQuizFeaturedMutation({
        id: quiz._id,
        featured: !quiz.featured,
      });
      toast.success(
        quiz.featured
          ? "Removed quiz from featured"
          : "Marked quiz as featured"
      );
    } catch (error) {
      console.error("Error updating featured quiz:", error);
      toast.error("Failed to update featured status");
    } finally {
      setFeaturingId(null);
      window.setTimeout(() => {
        setFeaturedHintId((current) => (current === quiz._id ? null : current));
      }, 1200);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      isOpen: false,
      quiz: null,
    });
    setDeletingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteDialog.quiz) return;

    const quiz = deleteDialog.quiz;
    setDeletingId(quiz._id);
    try {
      await deleteQuizMutation({ id: quiz._id });
      toast.success("Quiz deleted successfully");
      closeDeleteDialog();
    } catch (error) {
      console.error("Error deleting quiz:", error);
      toast.error("Failed to delete quiz");
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-emerald-500">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          <p className="font-medium text-slate-500">Loading your quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Vision Verse</h1>
              <p className="text-sm text-slate-500">Your quiz dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">

            <Button
              onClick={() => router.push("/discover")}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              Discover
            </Button>

            {isAdmin ? <AdminDashboardNavDropdown /> : <UserDashboardNavButton />}

            <Button
              onClick={openCreateDialog}
              disabled={isCreating}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              New Quiz
            </Button>

            <ConvexUserButton />
          </div>
        </header>

        {/* Quizzes Grid */}
        {quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-24">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Sparkles className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              No quizzes yet
            </h3>
            <p className="mb-6 max-w-sm text-center text-slate-500">
              Create your first quiz and start engaging your audience with
              interactive content.
            </p>
            <Button
              onClick={openCreateDialog}
              disabled={isCreating}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create your first quiz
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Your Quizzes
                {isFiltering ? (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {visibleQuizzes.length} of {quizzes.length}
                  </span>
                ) : null}
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search quizzes"
                    aria-label="Search quizzes"
                    className="w-full bg-white pl-9 sm:w-64"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as typeof statusFilter)
                  }
                  aria-label="Filter by status"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="Sort quizzes"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="az">Title A to Z</option>
                  <option value="za">Title Z to A</option>
                </select>
              </div>
            </div>
            {visibleQuizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-16">
                <p className="mb-4 text-slate-500">
                  No quizzes match your search.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleQuizzes.map((quiz) => (
                <div
                  key={quiz._id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-lg"
                >
                  {isAdmin ? (
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                      <div
                        className={`pointer-events-none rounded-full border border-slate-950/10 bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-lg transition ${featuringId === quiz._id || featuredHintId === quiz._id
                          ? "translate-x-0 opacity-100"
                          : "translate-x-2 opacity-0 peer-hover:translate-x-0 peer-hover:opacity-100"
                          }`}
                      >
                        {quiz.featured ? "Featured" : "UnFeatured"}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleToggleFeatured(quiz)}
                        disabled={featuringId === quiz._id || quiz.status !== "published"}
                        title={
                          quiz.status !== "published"
                            ? "Only published quizzes can be featured"
                            : quiz.featured
                              ? "Remove from featured"
                              : "Mark as featured"
                        }
                        className={`peer flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${quiz.featured
                          ? "border-amber-300 bg-amber-400 text-white shadow-[0_12px_24px_rgba(251,191,36,0.32)]"
                          : "border-slate-200 bg-white text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.12)] hover:border-slate-300 hover:bg-slate-50"
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        {featuringId === quiz._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star
                            className={`h-4 w-4 ${quiz.featured ? "fill-current" : ""}`}
                          />
                        )}
                      </button>
                    </div>
                  ) : null}

                  {/* Cover / Phone Preview */}
                  {quiz.coverImage ? (
                    <div
                      className="relative aspect-[16/9] w-full bg-slate-100 bg-cover bg-center after:absolute after:inset-x-0 after:bottom-0 after:h-10 after:bg-gradient-to-t after:from-white/80 after:to-transparent"
                      style={{ backgroundImage: `url(${quiz.coverImage})` }}
                      aria-label={`${quiz.title} cover image`}
                    />
                  ) : (
                    <div className="p-6 pb-4">
                      <QuizOnboardingPreview
                        quizId={quiz._id}
                        fallbackBackground={quiz.onboardingBackground}
                      />
                    </div>
                  )}

                  {/* Quiz Info */}
                  <div className="px-6 pb-4 pt-4">
                    <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-emerald-600">
                      <span className="line-clamp-2 break-words">
                        <QuizTitleHeading quiz={quiz} />
                      </span>
                    </h3>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                      {quiz.description || "No description"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">

                      <Badge
                        variant="outline"
                        className={`border-0 text-xs ${getQuizStatusBadgeClass(
                          quiz.status,
                        )}`}
                      >
                        {getQuizStatusLabel(quiz.status)}
                      </Badge>


                      <Badge
                        variant="secondary"
                        className="border-0 bg-slate-100 text-xs text-slate-600"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        {quiz.pageCount ?? 0} pages
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="border-0 bg-slate-100 text-xs text-slate-600"
                      >
                        <Trophy className="mr-1 h-3 w-3" />
                        {quiz.resultCount ?? 0} results
                      </Badge>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        <GitBranch className="h-3.5 w-3.5" />
                        Version {quiz.publishVersion ?? 0}
                      </span>
                      {quiz.status === "published" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyPublishedLink(quiz)}
                          className="h-7 gap-1.5 border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                          title={
                            typeof window !== "undefined"
                              ? getPublishedQuizLink(quiz, window.location.origin)
                              : quiz.customSlug
                                ? `/custom/${quiz.customSlug}`
                                : `/discover/${quiz._id}`
                          }
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          Copy link
                        </Button>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(quiz._creationTime).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-slate-100 px-6 pb-6 pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handlePreview(quiz._id)}
                        className="bg-slate-900 text-white hover:bg-slate-800"
                        title="Preview this quiz"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        {getPrimaryQuizAction(quiz.status).label}
                      </Button>


                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(quiz._id)}
                        disabled={quiz.status === "published"}
                        title={getEditQuizTitle(quiz.status)}
                        className="flex-1 border-slate-200 hover:bg-slate-50"
                      >
                        <Edit className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDuplicate(quiz._id)}
                        disabled={duplicatingId === quiz._id}
                        className="border-slate-200 hover:bg-slate-50"
                        title="Duplicate this quiz"
                      >
                        {duplicatingId === quiz._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {shouldShowPublishAction(quiz.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handlePublish(quiz)}
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                        >
                          Publish
                        </Button>
                      )}

                      {shouldShowPauseAction(quiz.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCloseDialog({
                              isOpen: true,
                              quiz,
                            })
                          }
                          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                        >
                          Pause
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(quiz)}
                        disabled={deletingId === quiz._id}
                        className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        {deletingId === quiz._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Quiz Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (isCreating) return;
          setCreateDialogOpen(open);
          if (!open) {
            setNewQuizTitle("");
            setCreateTitleError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateNew();
            }}
          >
            <DialogHeader className="text-left">
              <DialogTitle className="text-left">Create Quiz</DialogTitle>
              <DialogDescription className="text-left">
                Name your quiz before creating it. Quiz titles must be unique in your account.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-2">
              <Label htmlFor="new-quiz-title">Quiz title</Label>
              <Input
                id="new-quiz-title"
                value={newQuizTitle}
                onChange={(event) => {
                  setNewQuizTitle(event.target.value);
                  if (createTitleError) setCreateTitleError(null);
                }}
                placeholder="Enter quiz title"
                disabled={isCreating}
                autoFocus
              />
              {createTitleError ? (
                <p className="text-sm text-red-600">{createTitleError}</p>
              ) : null}
            </div>

            <DialogFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setNewQuizTitle("");
                  setCreateTitleError(null);
                }}
                disabled={isCreating}
                className="w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="w-auto bg-slate-900 text-white hover:bg-slate-800"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Quiz"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.isOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center">Delete Quiz</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure you want to delete{" "}
              <span className="text-slate-700">
                &quot;
                {deleteDialog.quiz ? (
                  <QuizTitleHeading
                    quiz={deleteDialog.quiz}
                    className="font-semibold"
                  />
                ) : null}
                &quot;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              className="w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={!!deletingId}
              className="w-auto"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Quiz"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Pause Confirmation Dialog */}
      <Dialog
        open={closeDialog.isOpen}
        onOpenChange={() =>
          setCloseDialog({
            isOpen: false,
            quiz: null,
          })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-left">
              Pause Quiz
            </DialogTitle>

            <DialogDescription className="text-left">
              Are you sure you want to pause{" "}
              <span className="text-slate-700">
                &quot;
                {closeDialog.quiz ? (
                  <QuizTitleHeading
                    quiz={closeDialog.quiz}
                    className="font-semibold"
                  />
                ) : null}
                &quot;
              </span>
              ? Public players will no longer be able to play it, but you can still preview it from the dashboard.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            <Button
              variant="outline"
              onClick={() =>
                setCloseDialog({
                  isOpen: false,
                  quiz: null,
                })
              }
              className="w-28"
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={async () => {
                if (!closeDialog.quiz) return;

                try {
                  await closeQuizMutation({
                    id: closeDialog.quiz._id,
                  });

                  toast.success("Quiz paused");

                  setCloseDialog({
                    isOpen: false,
                    quiz: null,
                  });
                } catch (error) {
                  console.error("Error closing quiz:", error);
                  toast.error("Failed to close quiz");
                }
              }}
              className="w-28"
            >
              Pause Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function QuizListPage() {
  return <AuthenticatedQuizContent />;
}
