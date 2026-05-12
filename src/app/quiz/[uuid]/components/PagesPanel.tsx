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
import type { PageEntity, PageTemplate } from "@/types";
import TemplatePickerDialog from "./TemplatePickerDialog";
import DeletePageDialog from "./DeletePageDialog";
import { useTemplates } from "@/hooks/useTemplates";

const DISPLAY_NAME = (index: number) => `Page ${index + 1}`;

type PagesPanelProps = {
  quizId: Id<"quiz">;
  pages: PageEntity[];
  activeIndex: number;
  onSelectPage: (index: number) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
};

export default function PagesPanel({
  quizId,
  pages,
  activeIndex,
  onSelectPage,
  onReorderPages,
}: PagesPanelProps) {
  const createPage = useMutation(api.quiz.createPage);
  const setPageComponents = useMutation(api.quiz.setPageComponents);
  const deletePage = useMutation(api.quiz.deletePage);

  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"pages"> | null>(null);
  const [pagePendingDelete, setPagePendingDelete] =
    useState<PageEntity | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingPageId, setPendingPageId] = useState<Id<"pages"> | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  const templates = useTemplates("quiz");

  const handleTemplateSelected = useCallback(
    async (template: PageTemplate) => {
      setIsCreating(true);
      try {
        const pageId = await createPage({
          quizId,
          background: template.background,
        });

        const components = template.build();
        if (components.length > 0) {
          await setPageComponents({ id: pageId, components });
        }

        setPendingPageId(pageId);
        toast.success("Page created from template");
        setIsTemplateDialogOpen(false);
      } catch (error) {
        console.error("Failed to create page from template", error);
        toast.error("Failed to create page from template");
      } finally {
        setIsCreating(false);
      }
    },
    [createPage, quizId, setPageComponents],
  );

  const requestDeletePage = useCallback((page: PageEntity) => {
    setPagePendingDelete(page);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeletePage = useCallback(
    async () => {
      if (!pagePendingDelete) return;
      setDeletingId(pagePendingDelete._id);
      try {
        await deletePage({ id: pagePendingDelete._id });
        toast.success("Page deleted");
      } catch (error) {
        console.error("Failed to delete page", error);
        toast.error("Failed to delete page");
      } finally {
        setDeletingId(null);
        setIsDeleteDialogOpen(false);
        setPagePendingDelete(null);
      }
    },
    [deletePage, pagePendingDelete],
  );

  const handleCancelDeletePage = useCallback(() => {
    if (deletingId) return;
    setIsDeleteDialogOpen(false);
    setPagePendingDelete(null);
  }, [deletingId]);

  useEffect(() => {
    if (!pendingPageId) return;
    const index = pages.findIndex((page) => page._id === pendingPageId);
    if (index !== -1) {
      onSelectPage(index);
      setPendingPageId(null);
    }
  }, [onSelectPage, pages, pendingPageId]);

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
      onReorderPages(draggedIndex, dropIndicatorIndex);
    }
    resetDragState();
  }, [draggedIndex, dropIndicatorIndex, onReorderPages, resetDragState]);

  return (
    <div className="flex w-72 min-w-[18rem] flex-shrink-0 flex-col">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto py-4">
          {pages.length === 0 ? (
            <p className="text-sm text-gray-500">
              No quiz pages yet. Use the button below to add your first page.
            </p>
          ) : (
            <div
              className="space-y-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              {pages.map((page, index) => {
                const pageName = page.pageName?.trim() ?? "";
                const label =
                  pageName.length > 0 ? pageName : DISPLAY_NAME(index);
                const isActive = index === activeIndex;
                const componentsCount = page.components?.length ?? 0;
                const showTopIndicator = dropIndicatorIndex === index;
                const showBottomIndicator =
                  index === pages.length - 1 &&
                  dropIndicatorIndex === pages.length;

                return (
                  <div key={page._id} className="relative">
                    {showTopIndicator ? (
                      <div className="absolute -top-1 left-2 right-2 z-10 h-0.5 rounded-full bg-blue-500" />
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() => onSelectPage(index)}
                      onDragStart={() => {
                        setDraggedIndex(index);
                        setDropIndicatorIndex(index);
                      }}
                      onDragOver={(event) => handleDragOverItem(event, index)}
                      onDragEnd={resetDragState}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectPage(index);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-transparent bg-gray-50 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
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
                          requestDeletePage(page);
                        }}
                        disabled={deletingId === page._id}
                      >
                        {deletingId === page._id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {showBottomIndicator ? (
                      <div className="absolute -bottom-1 left-2 right-2 z-10 h-0.5 rounded-full bg-blue-500" />
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
            Create Page
          </Button>
        </CardFooter>
      </Card>
      <TemplatePickerDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates}
        isProcessing={isCreating}
        title="Select a Page Template"
        onSelect={(template) => void handleTemplateSelected(template)}
      />
      <DeletePageDialog
        open={isDeleteDialogOpen}
        pageName={pagePendingDelete?.pageName}
        isDeleting={deletingId !== null}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setPagePendingDelete(null);
        }}
        onCancel={handleCancelDeletePage}
        onConfirm={() => void handleDeletePage()}
      />
    </div>
  );
}
