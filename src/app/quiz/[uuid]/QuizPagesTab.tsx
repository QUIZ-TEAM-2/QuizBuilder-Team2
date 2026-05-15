"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import PagesPanel from "./components/PagesPanel";
import EditorPreviewPanel from "./components/EditorPreviewPanel";
import DeletePageDialog from "./components/DeletePageDialog";
import QuestionTypeChangeDialog from "./components/QuestionTypeChangeDialog";
import RenamePageDialog from "./components/RenamePageDialog";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import AudioPickerDialog from "@/components/quiz/AudioPickerDialog";
import { usePageEditor } from "@/hooks/usePageEditor";
import {
  getQuestionModeLabel,
  getRemovedQuestionComponentsByModeChange,
  type RemovedQuestionComponentSummary,
} from "@/lib/questionTypeGuard";
import { useTemplates } from "@/hooks/useTemplates";
import type { Component, Id, PageEntity, QuestionMode } from "@/types";

type QuizPagesTabProps = {
  quizId: Id<"quiz"> | null;
  activePageIndex?: number;
  onActivePageChange?: (index: number) => void;
};

type PendingQuestionModeChange = {
  mode: QuestionMode;
  removedComponentCount: number;
  removedComponents: RemovedQuestionComponentSummary[];
};

export default function QuizPagesTab({
  quizId,
  activePageIndex,
  onActivePageChange,
}: QuizPagesTabProps) {
  const updatePage = useMutation(api.quiz.updatePage);
  const setPageComponents = useMutation(api.quiz.setPageComponents);
  const deletePage = useMutation(api.quiz.deletePage);
  const reorderPages = useMutation(api.quiz.reorderPages);

  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const pages = useMemo<PageEntity[]>(
    () => (quizQuery?.pages ?? []) as PageEntity[],
    [quizQuery?.pages],
  );
  const isLoading = quizQuery === undefined;

  const [internalIndex, setInternalIndex] = useState(0);
  const [pagePendingDelete, setPagePendingDelete] = useState<PageEntity | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenamingPage, setIsRenamingPage] = useState(false);
  const [localQuestionMode, setLocalQuestionMode] =
    useState<QuestionMode | null>(null);
  const [isSavingQuestionMode, setIsSavingQuestionMode] = useState(false);
  const [pendingQuestionModeChange, setPendingQuestionModeChange] =
    useState<PendingQuestionModeChange | null>(null);

  const isControlled =
    typeof activePageIndex === "number" &&
    typeof onActivePageChange === "function";
  const currentIndex = isControlled ? (activePageIndex ?? 0) : internalIndex;

  const previousIndexRef = useRef(currentIndex);

  const setIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = Math.max(0, nextIndex);
      if (isControlled) {
        if (activePageIndex !== clampedIndex) {
          onActivePageChange?.(clampedIndex);
        }
      } else {
        setInternalIndex(clampedIndex);
      }
    },
    [activePageIndex, isControlled, onActivePageChange],
  );

  useEffect(() => {
    if (pages.length === 0) {
      setIndex(0);
      return;
    }
    if (currentIndex > pages.length - 1) {
      setIndex(pages.length - 1);
    }
  }, [pages, currentIndex, setIndex]);

  const currentPage = pages[currentIndex];
  const transitionPreviewTarget = useMemo(() => {
    const nextPage = pages[currentIndex + 1];
    if (nextPage) {
      return {
        key: String(nextPage._id),
        components: (nextPage.components ?? []) as Component[],
        background: nextPage.background,
        sequence: currentIndex + 1,
      };
    }

    const previousPage = pages[currentIndex - 1];
    if (previousPage) {
      return {
        key: String(previousPage._id),
        components: (previousPage.components ?? []) as Component[],
        background: previousPage.background,
        sequence: currentIndex - 1,
      };
    }

    return null;
  }, [currentIndex, pages]);
  const questionMode =
    localQuestionMode ?? currentPage?.questionMode ?? "single";

  const editor = usePageEditor({
    quizId,
    pageType: "page",
    entity: currentPage,
    setComponentsMutation: setPageComponents,
    updateEntityMutation: updatePage,
    enableClipboard: true,
    enableZIndex: true,
    enableUndoRedo: true,
  });

  const handleSelectPage = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        void editor.editing.saveChanges();
      }
      setIndex(index);
    },
    [currentIndex, editor.editing, setIndex],
  );

  // Reset selection when page changes
  const {
    editing: editingHook,
    setLocalPageName,
    setMultiSelectedIds,
  } = editor;
  useEffect(() => {
    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = currentIndex;
    if (previousIndex !== currentIndex) {
      editingHook.selectComponent(null);
      setLocalPageName(null);
      setMultiSelectedIds([]);
    }
  }, [currentIndex, editingHook, setLocalPageName, setMultiSelectedIds]);

  useEffect(() => {
    setLocalQuestionMode(currentPage?.questionMode ?? "single");
  }, [currentPage?._id, currentPage?.questionMode]);

  const templates = useTemplates("quiz", questionMode);

  const getDisplayPageName = useCallback(
    (page: PageEntity, index: number) =>
      page.pageName?.trim() || `Page ${index + 1}`,
    [],
  );

  const requestRenamePage = useCallback(() => {
    if (!currentPage) return;
    setRenameValue(getDisplayPageName(currentPage, currentIndex));
    setRenameError(null);
    setIsRenameDialogOpen(true);
  }, [currentIndex, currentPage, getDisplayPageName]);

  const handleCancelRenamePage = useCallback(() => {
    if (isRenamingPage) return;
    setIsRenameDialogOpen(false);
    setRenameError(null);
  }, [isRenamingPage]);

  const handleRenamePage = useCallback(async () => {
    if (!currentPage) return;

    const normalizedName = renameValue.trim();
    if (!normalizedName) {
      setRenameError("Page name is required.");
      return;
    }

    const normalizedKey = normalizedName.toLocaleLowerCase();
    const duplicate = pages.some((page, index) => {
      if (page._id === currentPage._id) return false;
      return (
        getDisplayPageName(page, index).toLocaleLowerCase() === normalizedKey
      );
    });

    if (duplicate) {
      setRenameError("You already have a page with this name.");
      return;
    }

    const existingName = (currentPage.pageName ?? "").trim();
    if (existingName === normalizedName) {
      setIsRenameDialogOpen(false);
      setRenameError(null);
      return;
    }

    setIsRenamingPage(true);
    setRenameError(null);
    try {
      await updatePage({
        id: currentPage._id,
        pageName: normalizedName,
      });
      editor.setLocalPageName(null);
      toast.success("Page renamed");
      setIsRenameDialogOpen(false);
    } catch (error) {
      console.error("Failed to rename page", error);
      setRenameError("Failed to rename page.");
      toast.error("Failed to rename page");
    } finally {
      setIsRenamingPage(false);
    }
  }, [currentPage, editor, getDisplayPageName, pages, renameValue, updatePage]);

  const requestDeletePage = useCallback(() => {
    if (!currentPage) return;
    setPagePendingDelete(currentPage);
    setIsDeleteDialogOpen(true);
  }, [currentPage]);

  const handleDeletePage = useCallback(async () => {
    if (!pagePendingDelete) return;
    setIsDeleting(true);
    try {
      await deletePage({ id: pagePendingDelete._id });
      toast.success("Page deleted");
    } catch (error) {
      console.error("Failed to delete page", error);
      toast.error("Failed to delete page");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setPagePendingDelete(null);
    }
  }, [deletePage, pagePendingDelete]);

  const handleCancelDeletePage = useCallback(() => {
    if (isDeleting) return;
    setIsDeleteDialogOpen(false);
    setPagePendingDelete(null);
  }, [isDeleting]);

  const saveQuestionModeChange = useCallback(
    async (mode: QuestionMode) => {
      if (!currentPage || isSavingQuestionMode) {
        return;
      }

      const previousMode = currentPage.questionMode ?? "single";
      setLocalQuestionMode(mode);
      setIsSavingQuestionMode(true);

      try {
        await updatePage({
          id: currentPage._id,
          questionMode: mode,
        });
        console.log("[question-mode] change-success", {
          pageId: currentPage._id,
          savedMode: mode,
        });
        toast.success("Question type updated");
      } catch (error) {
        console.error("Failed to update question type", error);
        console.log("[question-mode] change-failed", {
          pageId: currentPage._id,
          previousMode,
          requestedMode: mode,
        });
        setLocalQuestionMode(previousMode);
        toast.error("Failed to update question type");
      } finally {
        setIsSavingQuestionMode(false);
      }
    },
    [currentPage, isSavingQuestionMode, updatePage],
  );

  const handleQuestionModeChange = useCallback(
    (mode: QuestionMode) => {
      if (!currentPage || isSavingQuestionMode) {
        console.log("[question-mode] skip-change", {
          hasCurrentPage: Boolean(currentPage),
          isSavingQuestionMode,
          requestedMode: mode,
        });
        return;
      }

      const previousMode = currentPage.questionMode ?? "single";
      console.log("[question-mode] change-request", {
        pageId: currentPage._id,
        pageName: currentPage.pageName ?? `Page ${currentIndex + 1}`,
        previousMode,
        requestedMode: mode,
      });

      if (mode === previousMode) {
        setLocalQuestionMode(mode);
        console.log("[question-mode] no-op", {
          pageId: currentPage._id,
          mode,
        });
        return;
      }

      const removedComponents = getRemovedQuestionComponentsByModeChange(
        currentPage.components ?? [],
        mode,
      );
      const removedComponentCount = removedComponents.reduce(
        (total, item) => total + item.count,
        0,
      );
      if (removedComponentCount > 0) {
        setPendingQuestionModeChange({
          mode,
          removedComponentCount,
          removedComponents,
        });
        return;
      }

      void saveQuestionModeChange(mode);
    },
    [currentIndex, currentPage, isSavingQuestionMode, saveQuestionModeChange],
  );

  const handleCancelQuestionModeChange = useCallback(() => {
    setPendingQuestionModeChange(null);
  }, []);

  const handleConfirmQuestionModeChange = useCallback(() => {
    if (!pendingQuestionModeChange) return;
    const { mode } = pendingQuestionModeChange;
    setPendingQuestionModeChange(null);
    void saveQuestionModeChange(mode);
  }, [pendingQuestionModeChange, saveQuestionModeChange]);

  const handleReorderPages = useCallback(
    async (fromIndex: number, insertionIndex: number) => {
      if (!quizId) return;

      const normalizedToIndex =
        fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;

      if (
        fromIndex === normalizedToIndex ||
        fromIndex < 0 ||
        insertionIndex < 0 ||
        fromIndex >= pages.length ||
        insertionIndex > pages.length
      ) {
        return;
      }

      const nextPages = [...pages];
      const [movedPage] = nextPages.splice(fromIndex, 1);
      if (!movedPage) return;
      nextPages.splice(normalizedToIndex, 0, movedPage);

      const currentPageId = currentPage?._id;

      try {
        if (!quizId) return;
        await reorderPages({
          quizId,
          pageIds: nextPages.map((page) => page._id),
        });

        if (currentPageId) {
          const nextIndex = nextPages.findIndex(
            (page) => page._id === currentPageId,
          );
          if (nextIndex !== -1) {
            setIndex(nextIndex);
          }
        }
      } catch (error) {
        console.error("Failed to reorder pages", error);
        toast.error("Failed to reorder pages");
      }
    },
    [currentPage?._id, pages, quizId, reorderPages, setIndex],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Save the quiz first to manage pages.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pages...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-2">
      <PagesPanel
        quizId={quizId}
        pages={pages}
        activeIndex={currentIndex}
        onSelectPage={handleSelectPage}
        onReorderPages={(fromIndex, toIndex) =>
          void handleReorderPages(fromIndex, toIndex)
        }
      />

      <EditorPreviewPanel
        title="Preview"
        hasEntity={!!currentPage}
        components={editor.displayComponents}
        background={editor.currentBackground}
        previewKey={currentPage?._id}
        navigation={{
          activeIndex: currentIndex,
          totalCount: pages.length,
          onNavigate: handleSelectPage,
        }}
        pageName={editor.currentPageName}
        pageNamePlaceholder={`Page ${currentIndex + 1}`}
        onPageNameChange={(value) => editor.setLocalPageName(value)}
        onPageNameBlur={editor.handlePageNameBlur}
        onRequestPageRename={requestRenamePage}
        selectedComponentId={editor.editing.selectedId}
        selectedComponent={editor.editing.selectedComponent}
        onComponentClick={(component: Component) =>
          editor.editing.selectComponent(component.id)
        }
        onBackgroundClick={editor.handleDeselectComponent}
        editorActions={editor.editorActions}
        isSaving={editor.isSaving}
        templates={templates}
        onApplyTemplate={editor.handleApplyTemplate}
        templateDialogTitle="Select a Page Template"
        templateDialogDescription="Choose a template to apply to this page. This will replace the current content."
        onUpdateBackground={editor.handleUpdateBackground}
        onDelete={requestDeletePage}
        isDeleting={isDeleting}
        pageType="quiz"
        emptyMessage="Select a page to preview."
        questionMode={questionMode}
        onQuestionModeChange={(mode) => void handleQuestionModeChange(mode)}
        isQuestionModeSaving={isSavingQuestionMode}
        transitionEffect={editor.currentTransitionEffect}
        onTransitionEffectChange={(effect) =>
          void editor.handleUpdateTransitionEffect(effect)
        }
        transitionPreviewTarget={transitionPreviewTarget}
      />

      <ImagePickerDialog
        isOpen={editor.isImagePickerOpen}
        onClose={() => editor.setIsImagePickerOpen(false)}
        images={editor.imagesQuery ?? []}
        onImageSelect={editor.handleImageSelect}
      />
      <AudioPickerDialog
        isOpen={editor.isAudioPickerOpen}
        onClose={() => editor.setIsAudioPickerOpen(false)}
        audios={editor.audiosQuery ?? []}
        onAudioSelect={editor.handleAudioSelect}
      />
      <DeletePageDialog
        open={isDeleteDialogOpen}
        pageName={pagePendingDelete?.pageName}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setPagePendingDelete(null);
        }}
        onCancel={handleCancelDeletePage}
        onConfirm={() => void handleDeletePage()}
      />
      <RenamePageDialog
        open={isRenameDialogOpen}
        value={renameValue}
        error={renameError}
        isSaving={isRenamingPage}
        onOpenChange={(open) => {
          setIsRenameDialogOpen(open);
          if (!open) setRenameError(null);
        }}
        onValueChange={(value) => {
          setRenameValue(value);
          if (renameError) setRenameError(null);
        }}
        onCancel={handleCancelRenamePage}
        onConfirm={() => void handleRenamePage()}
      />
      <QuestionTypeChangeDialog
        open={pendingQuestionModeChange !== null}
        pageName={currentPage?.pageName?.trim() || `Page ${currentIndex + 1}`}
        nextQuestionTypeLabel={getQuestionModeLabel(
          pendingQuestionModeChange?.mode ?? "single",
        )}
        removedComponentCount={
          pendingQuestionModeChange?.removedComponentCount ?? 0
        }
        removedComponents={pendingQuestionModeChange?.removedComponents ?? []}
        onOpenChange={(open) => {
          if (!open) {
            setPendingQuestionModeChange(null);
          }
        }}
        onCancel={handleCancelQuestionModeChange}
        onConfirm={handleConfirmQuestionModeChange}
      />
    </div>
  );
}
