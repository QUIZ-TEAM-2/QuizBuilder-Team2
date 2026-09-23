"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import ResultsPanel from "./components/ResultsPanel";
import EditorPreviewPanel from "./components/EditorPreviewPanel";
import RenamePageDialog from "./components/RenamePageDialog";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import AudioPickerDialog from "@/components/quiz/AudioPickerDialog";
import { usePageEditor } from "@/hooks/usePageEditor";
import { useTemplates } from "@/hooks/useTemplates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Component, Id, ResultEntity } from "@/types";

type ResultPagesTabProps = {
  quizId: Id<"quiz"> | null;
  activeResultIndex?: number;
  onActiveResultIndexChange?: (index: number) => void;
};

export default function ResultPagesTab({
  quizId,
  activeResultIndex,
  onActiveResultIndexChange,
}: ResultPagesTabProps) {
  const updateResult = useMutation(api.quiz.updateResult);
  const deleteResultMutation = useMutation(api.quiz.deleteResult);
  const setResultComponents = useMutation(api.quiz.setResultComponents);
  const reorderResults = useMutation(api.quiz.reorderResults);

  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const results = useMemo(
    () => (quizQuery?.results ?? []) as ResultEntity[],
    [quizQuery?.results],
  );
  const isLoading = quizQuery === undefined;

  const [internalIndex, setInternalIndex] = useState(0);
  const [resultPendingDelete, setResultPendingDelete] =
    useState<ResultEntity | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingResultId, setDeletingResultId] =
    useState<Id<"results"> | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenamingResult, setIsRenamingResult] = useState(false);

  const isControlled =
    typeof activeResultIndex === "number" &&
    typeof onActiveResultIndexChange === "function";
  const currentIndex = isControlled ? (activeResultIndex ?? 0) : internalIndex;

  const previousIndexRef = useRef(currentIndex);

  const setIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = Math.max(0, nextIndex);
      if (isControlled) {
        if (activeResultIndex !== clampedIndex) {
          onActiveResultIndexChange?.(clampedIndex);
        }
      } else {
        setInternalIndex(clampedIndex);
      }
    },
    [activeResultIndex, isControlled, onActiveResultIndexChange],
  );

  useEffect(() => {
    if (results.length === 0) {
      setIndex(0);
      return;
    }
    if (currentIndex > results.length - 1) {
      setIndex(results.length - 1);
    }
  }, [results, currentIndex, setIndex]);

  const currentResult = results[currentIndex] ?? null;
  const transitionPreviewTarget = useMemo(() => {
    const nextResult = results[currentIndex + 1];
    if (nextResult) {
      return {
        key: String(nextResult._id),
        components: (nextResult.components ?? []) as Component[],
        background: nextResult.background,
        sequence: currentIndex + 1,
      };
    }

    const previousResult = results[currentIndex - 1];
    if (previousResult) {
      return {
        key: String(previousResult._id),
        components: (previousResult.components ?? []) as Component[],
        background: previousResult.background,
        sequence: currentIndex - 1,
      };
    }

    return null;
  }, [currentIndex, results]);

  const editor = usePageEditor({
    quizId,
    pageType: "result",
    entity: currentResult,
    setComponentsMutation: setResultComponents,
    updateEntityMutation: updateResult,
    enableClipboard: false,
    enableZIndex: false,
    enableUndoRedo: true,
  });

  const handleSelectResult = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        void editor.editing.saveChanges();
      }
      setIndex(index);
    },
    [currentIndex, editor.editing, setIndex],
  );

  // Reset selection when result changes
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

  const templates = useTemplates("result");

  const getDisplayResultName = useCallback(
    (result: ResultEntity, index: number) =>
      result.pageName?.trim() || `Result ${index + 1}`,
    [],
  );

  const requestRenameResult = useCallback(() => {
    if (!currentResult) return;
    setRenameValue(getDisplayResultName(currentResult, currentIndex));
    setRenameError(null);
    setIsRenameDialogOpen(true);
  }, [currentIndex, currentResult, getDisplayResultName]);

  const handleCancelRenameResult = useCallback(() => {
    if (isRenamingResult) return;
    setIsRenameDialogOpen(false);
    setRenameError(null);
  }, [isRenamingResult]);

  const handleRenameResult = useCallback(async () => {
    if (!currentResult) return;

    const normalizedName = renameValue.trim();
    if (!normalizedName) {
      setRenameError("Result page name is required.");
      return;
    }

    const normalizedKey = normalizedName.toLocaleLowerCase();
    const duplicate = results.some((result, index) => {
      if (result._id === currentResult._id) return false;
      return (
        getDisplayResultName(result, index).toLocaleLowerCase() ===
        normalizedKey
      );
    });

    if (duplicate) {
      setRenameError("You already have a result page with this name.");
      return;
    }

    const existingName = (currentResult.pageName ?? "").trim();
    if (existingName === normalizedName) {
      setIsRenameDialogOpen(false);
      setRenameError(null);
      return;
    }

    setIsRenamingResult(true);
    setRenameError(null);
    try {
      await updateResult({
        id: currentResult._id,
        pageName: normalizedName,
      });
      editor.setLocalPageName(null);
      toast.success("Result page renamed");
      setIsRenameDialogOpen(false);
    } catch (error) {
      console.error("Failed to rename result page", error);
      setRenameError("Failed to rename result page.");
      toast.error("Failed to rename result page");
    } finally {
      setIsRenamingResult(false);
    }
  }, [
    currentResult,
    editor,
    getDisplayResultName,
    renameValue,
    results,
    updateResult,
  ]);

  const requestDeleteResult = useCallback((result: ResultEntity) => {
    setResultPendingDelete(result);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleConfirmDeleteResult = useCallback(async () => {
    if (!resultPendingDelete) return;
    const targetId = resultPendingDelete._id as Id<"results">;
    setDeletingResultId(targetId);
    try {
      await deleteResultMutation({ id: targetId });
      toast.success("Result page deleted");
      const deletedIndex = results.findIndex(
        (result) => result._id === targetId,
      );
      if (
        deletedIndex !== -1 &&
        currentIndex === deletedIndex &&
        deletedIndex === results.length - 1
      ) {
        setIndex(Math.max(deletedIndex - 1, 0));
      }
      if (currentResult && currentResult._id === targetId) {
        editor.editing.selectComponent(null);
      }
    } catch (error) {
      console.error("Failed to delete result page", error);
      toast.error("Failed to delete result page");
    } finally {
      setDeletingResultId(null);
      setIsDeleteDialogOpen(false);
      setResultPendingDelete(null);
    }
  }, [
    currentIndex,
    currentResult,
    deleteResultMutation,
    resultPendingDelete,
    results,
    setIndex,
    editor.editing,
  ]);

  const handleCancelDeleteResult = useCallback(() => {
    if (deletingResultId) return;
    setIsDeleteDialogOpen(false);
    setResultPendingDelete(null);
  }, [deletingResultId]);

  const handleReorderResults = useCallback(
    async (fromIndex: number, insertionIndex: number) => {
      if (!quizId) return;

      const normalizedToIndex =
        fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;

      if (
        fromIndex === normalizedToIndex ||
        fromIndex < 0 ||
        insertionIndex < 0 ||
        fromIndex >= results.length ||
        insertionIndex > results.length
      ) {
        return;
      }

      const nextResults = [...results];
      const [movedResult] = nextResults.splice(fromIndex, 1);
      if (!movedResult) return;
      nextResults.splice(normalizedToIndex, 0, movedResult);

      const currentResultId = currentResult?._id;

      try {
        if (!quizId) return;
        await reorderResults({
          quizId,
          resultIds: nextResults.map((result) => result._id as Id<"results">),
        });

        if (currentResultId) {
          const nextIndex = nextResults.findIndex(
            (result) => result._id === currentResultId,
          );
          if (nextIndex !== -1) {
            setIndex(nextIndex);
          }
        }
      } catch (error) {
        console.error("Failed to reorder result pages", error);
        toast.error("Failed to reorder result pages");
      }
    },
    [currentResult?._id, quizId, reorderResults, results, setIndex],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">
          Save the quiz first to manage result pages.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading result pages...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-2">
      <ResultsPanel
        quizId={quizId}
        results={results}
        activeIndex={currentIndex}
        onSelectResult={handleSelectResult}
        onReorderResults={(fromIndex, toIndex) =>
          void handleReorderResults(fromIndex, toIndex)
        }
        onDeleteResult={requestDeleteResult}
        deletingResultId={deletingResultId}
      />

      <EditorPreviewPanel
        title="Result Preview"
        hasEntity={!!currentResult}
        components={editor.displayComponents}
        background={editor.currentBackground}
        previewKey={currentResult?._id}
        navigation={{
          activeIndex: currentIndex,
          totalCount: results.length,
          onNavigate: handleSelectResult,
        }}
        pageName={editor.currentPageName}
        pageNamePlaceholder={`Result ${currentIndex + 1}`}
        onPageNameChange={(value) => editor.setLocalPageName(value)}
        onPageNameBlur={editor.handlePageNameBlur}
        onRequestPageRename={requestRenameResult}
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
        templateDialogTitle="Select a Result Template"
        templateDialogDescription="Choose a template to apply to this result page. This will replace the current content."
        onUpdateBackground={editor.handleUpdateBackground}
        onDelete={
          currentResult ? () => requestDeleteResult(currentResult) : undefined
        }
        isDeleting={deletingResultId !== null}
        pageType="result"
        emptyMessage="Select a result page to preview."
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

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (deletingResultId) return;
          setIsDeleteDialogOpen(open);
          if (!open) {
            setResultPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Result Page</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold">
                {resultPendingDelete?.pageName?.trim() || "this result page"}
              </span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            <Button
              variant="outline"
              onClick={handleCancelDeleteResult}
              disabled={deletingResultId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDeleteResult()}
              disabled={!resultPendingDelete || deletingResultId !== null}
              className="gap-2"
            >
              {deletingResultId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Result"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RenamePageDialog
        open={isRenameDialogOpen}
        value={renameValue}
        error={renameError}
        isSaving={isRenamingResult}
        onOpenChange={(open) => {
          setIsRenameDialogOpen(open);
          if (!open) setRenameError(null);
        }}
        onValueChange={(value) => {
          setRenameValue(value);
          if (renameError) setRenameError(null);
        }}
        onCancel={handleCancelRenameResult}
        onConfirm={() => void handleRenameResult()}
      />
    </div>
  );
}
