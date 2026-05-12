"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { PageTemplate, ResultEntity } from "@/types";
import TemplatePickerDialog from "./TemplatePickerDialog";
import { useTemplates } from "@/hooks/useTemplates";

const DISPLAY_NAME = (index: number) => `Result ${index + 1}`;

type ResultsPanelProps = {
  quizId: Id<"quiz">;
  results: ResultEntity[];
  activeIndex: number;
  onSelectResult: (index: number) => void;
  onReorderResults: (fromIndex: number, toIndex: number) => void;
  onDeleteResult: (result: ResultEntity) => void;
  deletingResultId: Id<"results"> | null;
};

export default function ResultsPanel({
  quizId,
  results,
  activeIndex,
  onSelectResult,
  onReorderResults,
  onDeleteResult,
  deletingResultId,
}: ResultsPanelProps) {
  const createResult = useMutation(api.quiz.createResult);
  const setResultComponents = useMutation(api.quiz.setResultComponents);

  const [isCreating, setIsCreating] = useState(false);
  const [pendingResultId, setPendingResultId] =
    useState<Id<"results"> | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  const templates = useTemplates("result");

  const handleTemplateSelected = useCallback(
    async (template: PageTemplate) => {
      setIsCreating(true);
      try {
        const resultId = await createResult({
          quizId,
          background: template.background,
        });

        const components = template.build();
        if (components.length > 0) {
          await setResultComponents({ id: resultId, components });
        }

        setPendingResultId(resultId);
        toast.success("Result page created from template");
        setIsTemplateDialogOpen(false);
      } catch (error) {
        console.error("Failed to create result page from template", error);
        toast.error("Failed to create result page from template");
      } finally {
        setIsCreating(false);
      }
    },
    [createResult, quizId, setResultComponents],
  );

  useEffect(() => {
    if (!pendingResultId) return;
    const index = results.findIndex(
      (result) => result._id === pendingResultId,
    );
    if (index !== -1) {
      onSelectResult(index);
      setPendingResultId(null);
    }
  }, [onSelectResult, pendingResultId, results]);

  const handleDragOverItem = useCallback(
    (event: DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const offsetY = event.clientY - bounds.top;
      const insertionIndex = offsetY < bounds.height / 2 ? index : index + 1;
      if (dropIndicatorIndex !== insertionIndex) {
        setDropIndicatorIndex(insertionIndex);
      }
    },
    [dropIndicatorIndex],
  );

  const resetDragState = useCallback(() => {
    setDraggedIndex(null);
    setDropIndicatorIndex(null);
  }, []);

  const handleDrop = useCallback(() => {
    if (draggedIndex !== null && dropIndicatorIndex !== null) {
      onReorderResults(draggedIndex, dropIndicatorIndex);
    }
    resetDragState();
  }, [draggedIndex, dropIndicatorIndex, onReorderResults, resetDragState]);

  return (
    <div className="flex w-72 min-w-[18rem] flex-shrink-0 flex-col">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Result Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto py-4">
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">
              No result pages yet. Use the button below to add one.
            </p>
          ) : (
            <div
              className="space-y-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              {results.map((result, index) => {
                const name = result.pageName?.trim() ?? "";
                const label =
                  name.length > 0 ? name : DISPLAY_NAME(index);
                const isActive = index === activeIndex;
                const componentsCount = result.components?.length ?? 0;
                const showTopIndicator = dropIndicatorIndex === index;
                const showBottomIndicator =
                  index === results.length - 1 &&
                  dropIndicatorIndex === results.length;

                return (
                  <div key={result._id} className="relative">
                    {showTopIndicator ? (
                      <div className="absolute -top-1 left-2 right-2 z-10 h-0.5 rounded-full bg-purple-500" />
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() => onSelectResult(index)}
                      onDragStart={() => {
                        setDraggedIndex(index);
                        setDropIndicatorIndex(index);
                      }}
                      onDragOver={(event) => handleDragOverItem(event, index)}
                      onDragEnd={resetDragState}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectResult(index);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                        isActive
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-transparent bg-gray-50 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                      } ${
                        draggedIndex === index ? "scale-[0.98] opacity-60" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{label}</span>
                          <span className="text-xs text-gray-500">
                            {componentsCount} component
                            {componentsCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteResult(result);
                        }}
                        disabled={
                          deletingResultId !== null &&
                          deletingResultId === result._id
                        }
                      >
                        {deletingResultId !== null &&
                        deletingResultId === result._id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {showBottomIndicator ? (
                      <div className="absolute -bottom-1 left-2 right-2 z-10 h-0.5 rounded-full bg-purple-500" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t px-4 py-3">
          <Button
            onClick={() => setIsTemplateDialogOpen(true)}
            disabled={isCreating}
            className="w-full gap-2"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Result
          </Button>
        </CardFooter>
      </Card>
      <TemplatePickerDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates}
        isProcessing={isCreating}
        title="Select a Result Template"
        onSelect={(template) => void handleTemplateSelected(template)}
      />
    </div>
  );
}
