"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Loader2,
  Trash2,
} from "lucide-react";
import BackgroundPopover from "@/components/editor/BackgroundPopover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import PhonePreview from "@/components/editor/PhonePreview";
import ComponentDock from "@/components/editor/ComponentDock";
import TemplatePickerDialog from "./TemplatePickerDialog";
import DeletePageDialog from "./DeletePageDialog";
import type { PageTemplate } from "@/types";
import { api } from "../../../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import type {
  Component,
  PageBackground,
  PageEntity,
  ComponentPosition,
  PageAction,
} from "@/types";

type PreviewPanelProps = {
  page: PageEntity | undefined;
  components: Component[];
  background?: PageBackground;
  pageName: string;
  onPageNameChange: (value: string) => void;
  onPageNameBlur?: () => void;
  activeIndex: number;
  pageCount: number;
  onSelectPage: (index: number) => void;
  selectedComponentId: string | null;
  selectedComponent: Component | null;
  onComponentClick: (component: Component) => void;
  onBackgroundClick: () => void;
  isSaving?: boolean;
  // Drag and toolbar props
  onComponentPositionChange?: (
    componentId: string,
    position: ComponentPosition,
  ) => void;
  onTextChange?: (componentId: string, text: string) => void;
  onImageEdit?: (componentId: string) => void;
  onDropComponent?: (
    componentType:
      | "image"
      | "text"
      | "shape"
      | "progressBar"
      | "ranking"
      | "input"
      | "matching"
      | "slider",
    dropPosition: { x: number; y: number },
    shapeVariant?: string,
  ) => void;
  onUpdateProps?: (props: Record<string, unknown>) => void;
  onUpdateData?: (data: string) => void;
  onDeleteComponent?: () => void;
  onOpenImagePicker?: () => void;
  onApplyTemplate?: (template: PageTemplate) => void;
  onUpdateBackground?: (background: PageBackground) => void;
  hideTemplateButton?: boolean;
  // Context menu actions
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canPaste?: boolean;
  canBringForward?: boolean;
  canSendBackward?: boolean;
  // Multi-selection props
  multiSelectedIds?: string[];
  onMultiSelect?: (ids: string[]) => void;
  onMergeComponents?: (ids: string[]) => void;
  onUnmergeGroup?: (groupId: string) => void;
  // Action update handler
  onUpdateAction?: (
    action: PageAction | undefined,
    actionProps?: Record<string, unknown>,
  ) => void;
};

export default function PreviewPanel({
  page,
  components,
  background,
  pageName,
  onPageNameChange,
  onPageNameBlur,
  activeIndex,
  pageCount,
  onSelectPage,
  selectedComponentId,
  selectedComponent,
  onComponentClick,
  onBackgroundClick,
  isSaving,
  onComponentPositionChange,
  onTextChange,
  onImageEdit,
  onDropComponent,
  onUpdateProps,
  onUpdateData,
  onDeleteComponent,
  onOpenImagePicker,
  onApplyTemplate,
  onUpdateBackground,
  hideTemplateButton = false,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onUndo,
  onRedo,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  canUndo,
  canRedo,
  canPaste,
  canBringForward,
  canSendBackward,
  multiSelectedIds = [],
  onMultiSelect,
  onMergeComponents,
  onUnmergeGroup,
  onUpdateAction,
}: PreviewPanelProps) {
  const deletePage = useMutation(api.quiz.deletePage);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  // Fetch templates from Convex
  const convexTemplates = useQuery(api.templates.getTemplates, {
    templateType: "quiz",
  });

  // Convert Convex templates to PageTemplate format
  const templates = useMemo<PageTemplate[]>(() => {
    const blankTemplate: PageTemplate = {
      id: "blank",
      title: "Blank Page",
      description: "Start with an empty canvas",
      pageName: "",
      background: { color: "#1e293b" },
      build: () => [],
    };

    if (!convexTemplates) {
      return [blankTemplate];
    }

    const converted = convexTemplates.map((t) => ({
      id: t._id,
      title: t.title,
      description: t.description,
      pageName: t.pageName,
      background: t.background,
      build: () => t.components as Component[],
    }));

    return [blankTemplate, ...converted];
  }, [convexTemplates]);

  const canNavigatePrev = activeIndex > 0;
  const canNavigateNext = activeIndex < Math.max(pageCount - 1, 0);

  const requestDeletePage = useCallback(() => {
    if (!page) return;
    setIsDeleteDialogOpen(true);
  }, [page]);

  const handleDelete = useCallback(async () => {
    if (!page) return;
    setIsDeleting(true);
    try {
      await deletePage({ id: page._id });
      toast.success("Page deleted");
    } catch (error) {
      console.error("Failed to delete page", error);
      toast.error("Failed to delete page");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }, [deletePage, page]);

  const handleCancelDeletePage = useCallback(() => {
    if (isDeleting) return;
    setIsDeleteDialogOpen(false);
  }, [isDeleting]);

  const handleTemplateSelect = useCallback(
    (template: PageTemplate) => {
      onApplyTemplate?.(template);
      setIsTemplateDialogOpen(false);
    },
    [onApplyTemplate],
  );

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (pageCount <= 0) return;
      if (direction === "prev") {
        if (!canNavigatePrev) return;
        onSelectPage(Math.max(activeIndex - 1, 0));
      } else {
        if (!canNavigateNext) return;
        onSelectPage(Math.min(activeIndex + 1, pageCount - 1));
      }
    },
    [activeIndex, canNavigateNext, canNavigatePrev, onSelectPage, pageCount],
  );

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <CardHeader className="border-b bg-gray-50 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Preview
          </CardTitle>
          <div className="flex flex-1 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleNavigate("prev")}
              disabled={!canNavigatePrev}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="flex flex-1 justify-center">
              {page && (
                <Input
                  value={pageName}
                  onChange={(event) => onPageNameChange(event.target.value)}
                  onBlur={onPageNameBlur}
                  placeholder={`Page ${activeIndex + 1}`}
                  className="h-8 w-64 text-center text-sm"
                  disabled={!page}
                />
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleNavigate("next")}
              disabled={!canNavigateNext}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {page && (
            <div className="ml-auto flex items-center gap-2">
              {isSaving && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
              <BackgroundPopover
                background={background}
                onBackgroundChange={(bg) => onUpdateBackground?.(bg)}
              />
              {!hideTemplateButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className="gap-1"
                >
                  <LayoutTemplate className="h-4 w-4" />
                  Use Template
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={requestDeletePage}
                disabled={isDeleting}
                className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent
        className="relative flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto bg-gray-50 p-4"
        onMouseDown={(e) => {
          // Deselect when clicking on the background area (not on phone or interactive elements)
          const target = e.target as HTMLElement;
          const isBackgroundClick =
            target === e.currentTarget ||
            target.dataset.backgroundArea === "true" ||
            target.closest("[data-background-area]") === target;
          if (isBackgroundClick) {
            onBackgroundClick?.();
          }
        }}
      >
        {page ? (
          <>
            {/* Component Dock - floating on the left */}
            <ComponentDock pageType="quiz" />
            {/* Phone Preview with Context Menu */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className="flex min-w-fit flex-1 items-center justify-center py-8"
                  data-background-area="true"
                >
                  <PhonePreview
                    components={components}
                    background={background ?? page?.background}
                    scale={0.6}
                    selectedComponentId={selectedComponentId ?? undefined}
                    selectedComponent={selectedComponent}
                    onComponentClick={onComponentClick}
                    onBackgroundClick={onBackgroundClick}
                    isEditable
                    onComponentPositionChange={onComponentPositionChange}
                    onTextChange={onTextChange}
                    onImageEdit={onImageEdit}
                    onDropComponent={onDropComponent}
                    onUpdateProps={onUpdateProps}
                    onUpdateData={onUpdateData}
                    onDeleteComponent={onDeleteComponent}
                    onOpenImagePicker={onOpenImagePicker}
                    multiSelectedIds={multiSelectedIds}
                    onMultiSelect={onMultiSelect}
                    onMergeComponents={onMergeComponents}
                    onUnmergeGroup={onUnmergeGroup}
                    onUpdateAction={onUpdateAction}
                    onBringToFront={onBringToFront}
                    onSendToBack={onSendToBack}
                    canBringForward={canBringForward}
                    canSendBackward={canSendBackward}
                    pageType="quiz"
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={onUndo} disabled={!canUndo}>
                  Undo
                  <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={onRedo} disabled={!canRedo}>
                  Redo
                  <ContextMenuShortcut>⌘⇧Z</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onCopy} disabled={!selectedComponent}>
                  Copy
                  <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={onCut} disabled={!selectedComponent}>
                  Cut
                  <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={onPaste} disabled={!canPaste}>
                  Paste
                  <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onDuplicate}
                  disabled={!selectedComponent}
                >
                  Duplicate
                  <ContextMenuShortcut>⌘D</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onBringToFront}
                  disabled={!selectedComponent || !canBringForward}
                >
                  Bring to Front
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onBringForward}
                  disabled={!selectedComponent || !canBringForward}
                >
                  Bring Forward
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onSendBackward}
                  disabled={!selectedComponent || !canSendBackward}
                >
                  Send Backward
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onSendToBack}
                  disabled={!selectedComponent || !canSendBackward}
                >
                  Send to Back
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onDeleteComponent}
                  disabled={!selectedComponent}
                  className="text-red-600 focus:text-red-600"
                >
                  Delete
                  <ContextMenuShortcut>⌫</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select a page to preview.
          </div>
        )}
      </CardContent>

      <TemplatePickerDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates}
        title="Select a Page Template"
        description="Choose a template to apply to this page. This will replace the current content."
        onSelect={handleTemplateSelect}
      />
      <DeletePageDialog
        open={isDeleteDialogOpen}
        pageName={page?.pageName}
        isDeleting={isDeleting}
        onOpenChange={setIsDeleteDialogOpen}
        onCancel={handleCancelDeletePage}
        onConfirm={() => void handleDelete()}
      />
    </Card>
  );
}
