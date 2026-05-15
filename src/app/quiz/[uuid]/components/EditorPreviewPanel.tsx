"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutTemplate,
  Loader2,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
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
import BackgroundPopover from "@/components/editor/BackgroundPopover";
import TemplatePickerDialog from "./TemplatePickerDialog";
import { api } from "../../../../../convex/_generated/api";
import type {
  Component,
  EditorActions,
  PageBackground,
  PageTemplate,
  QuestionMode,
} from "@/types";
import type { EditorPageType } from "@/components/editor/ComponentToolbar";
import { toast } from "sonner";
import {
  getPageTransitionDuration,
  PAGE_TRANSITION_OPTIONS,
  type PageTransitionEffect,
} from "@/lib/pageTransitions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type NavigationConfig = {
  activeIndex: number;
  totalCount: number;
  onNavigate: (index: number) => void;
};

type TransitionPreviewTarget = {
  key: string;
  components: Component[];
  background?: PageBackground;
  sequence: number;
};

type EditorPreviewPanelProps = {
  title: string;
  /** Pass page/result/onboarding entity — only used for truthiness checks */
  hasEntity: boolean;
  components: Component[];
  background?: PageBackground;
  previewKey?: string;

  // Navigation (optional — omitted for single-entity editors like onboarding)
  navigation?: NavigationConfig;

  // Page name
  pageName: string;
  pageNamePlaceholder?: string;
  onPageNameChange: (value: string) => void;
  onPageNameBlur?: () => void;
  onRequestPageRename?: () => void;

  // Selection & editing
  selectedComponentId: string | null;
  selectedComponent: Component | null;
  onComponentClick: (component: Component) => void;
  onBackgroundClick: () => void;
  editorActions: EditorActions;

  // Saving indicator
  isSaving?: boolean;

  // Templates
  templates: PageTemplate[];
  onApplyTemplate: (template: PageTemplate) => void;
  templateDialogTitle?: string;
  templateDialogDescription?: string;

  // Background
  onUpdateBackground?: (background: PageBackground) => void;

  // Delete
  onDelete?: () => void;
  isDeleting?: boolean;

  // Page type for PhonePreview
  pageType: EditorPageType;

  // Empty state
  emptyMessage?: string;

  questionMode?: QuestionMode;
  onQuestionModeChange?: (mode: QuestionMode) => void;
  onMatchingChange?: (
    componentId: string,
    pairs: Record<string, string>,
  ) => void;
  isQuestionModeSaving?: boolean;
  transitionEffect?: PageTransitionEffect;
  onTransitionEffectChange?: (effect: PageTransitionEffect) => void;
  transitionPreviewTarget?: TransitionPreviewTarget | null;
};

export default function EditorPreviewPanel({
  title,
  hasEntity,
  components,
  background,
  previewKey,
  navigation,
  pageName,
  pageNamePlaceholder,
  onPageNameChange,
  onPageNameBlur,
  onRequestPageRename,
  selectedComponentId,
  selectedComponent,
  onComponentClick,
  onBackgroundClick,
  editorActions,
  isSaving,
  templates,
  onApplyTemplate,
  templateDialogTitle = "Select a Template",
  templateDialogDescription = "Choose a template to apply. This will replace the current content.",
  onUpdateBackground,
  onDelete,
  isDeleting,
  pageType,
  emptyMessage = "Select an item to preview.",
  questionMode,
  onQuestionModeChange,
  onMatchingChange,
  isQuestionModeSaving = false,
  transitionEffect = "none",
  onTransitionEffectChange,
  transitionPreviewTarget = null,
}: EditorPreviewPanelProps) {
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] =
    useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTitleError, setTemplateTitleError] = useState<string | null>(
    null,
  );
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [transitionPreviewStage, setTransitionPreviewStage] = useState<
    "idle" | "target" | "return"
  >("idle");
  const [transitionPreviewRunId, setTransitionPreviewRunId] = useState(0);
  const previewTimeoutsRef = useRef<number[]>([]);
  const previousTransitionEffectRef = useRef<PageTransitionEffect | null>(null);
  const previousPreviewOwnerRef = useRef<string | null>(null);
  const createTemplate = useMutation(api.templates.createTemplate);

  const handleTemplateSelect = useCallback(
    (template: PageTemplate) => {
      onApplyTemplate(template);
      setIsTemplateDialogOpen(false);
    },
    [onApplyTemplate],
  );

  useEffect(() => {
    if (!isSaveTemplateDialogOpen) return;
    setTemplateTitle("");
    setTemplateDescription("");
    setTemplateTitleError(null);
  }, [isSaveTemplateDialogOpen]);

  const handleSaveCurrentPageAsTemplate = useCallback(async () => {
    const normalizedTitle = templateTitle.trim();
    if (!normalizedTitle) {
      setTemplateTitleError("Template title is required.");
      toast.error("Template title is required");
      return;
    }

    setIsSavingTemplate(true);
    setTemplateTitleError(null);
    try {
      const result = await createTemplate({
        title: normalizedTitle,
        description: templateDescription.trim() || undefined,
        pageName: pageName.trim() || undefined,
        background,
        transitionEffect,
        components,
        templateType: pageType,
        questionMode: pageType === "quiz" ? questionMode : undefined,
      });
      if (!result.ok) {
        const message = result.message ?? "Failed to save template";
        setTemplateTitleError(message);
        toast.error(message);
        return;
      }
      toast.success("Template saved");
      setIsSaveTemplateDialogOpen(false);
    } catch (error) {
      console.error("Failed to save template", error);
      toast.error("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    background,
    components,
    createTemplate,
    pageName,
    pageType,
    templateDescription,
    templateTitle,
    transitionEffect,
  ]);

  const canNavigatePrev = navigation ? navigation.activeIndex > 0 : false;
  const canNavigateNext = navigation
    ? navigation.activeIndex < Math.max(navigation.totalCount - 1, 0)
    : false;
  const selectedTransitionLabel =
    PAGE_TRANSITION_OPTIONS.find((option) => option.value === transitionEffect)
      ?.label ?? "Default";
  const showTransitionPlaceholder = transitionEffect === "none";
  const transitionTriggerLabel = showTransitionPlaceholder
    ? "Page Effect"
    : selectedTransitionLabel;
  const transitionDuration = getPageTransitionDuration(transitionEffect);
  const baseTransitionSequence = navigation?.activeIndex ?? 0;
  const isTransitionPreviewing = transitionPreviewStage !== "idle";
  const previewOwnerKey = String(previewKey ?? pageName ?? title);
  const resolvedTransitionPreviewTarget =
    useMemo<TransitionPreviewTarget>(() => {
      if (transitionPreviewTarget) {
        return transitionPreviewTarget;
      }

      // Keep the eye action useful even when there is no adjacent page yet.
      // A lightweight fallback page makes the transition feel testable instead
      // of looking like a dead button.
      return {
        key: `${String(previewKey ?? "editor-preview")}-preview-fallback`,
        sequence: baseTransitionSequence + 1,
        background: {
          color: "#e0ecff",
        },
        components: [
          {
            id: "transition-preview-shape-left",
            type: "shape",
            position: {
              x: -18,
              y: 34,
              width: 18,
              height: 14,
            },
            props: {
              variant: "halfCircle",
              fillColor: "#3b82f6",
              strokeColor: null,
              opacity: 100,
            },
          },
          {
            id: "transition-preview-shape-right",
            type: "shape",
            position: {
              x: 18,
              y: 28,
              width: 18,
              height: 16,
            },
            props: {
              variant: "triangle",
              fillColor: "#3b82f6",
              strokeColor: null,
              opacity: 100,
            },
          },
          {
            id: "transition-preview-label",
            type: "text",
            data: "Next page",
            position: {
              x: 0,
              y: 68,
              width: 46,
              height: 8,
            },
            props: {
              align: "center",
              fontSize: 18,
              bold: true,
              color: "#4f6b95",
            },
          },
        ],
      };
    }, [baseTransitionSequence, previewKey, transitionPreviewTarget]);

  const clearTransitionPreviewTimeouts = useCallback(() => {
    previewTimeoutsRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId),
    );
    previewTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTransitionPreviewTimeouts();
    };
  }, [clearTransitionPreviewTimeouts]);

  const handlePlayTransitionPreview = useCallback(() => {
    if (transitionEffect === "none" || transitionDuration <= 0) {
      return;
    }

    clearTransitionPreviewTimeouts();

    const nextRunId = transitionPreviewRunId + 1;
    setTransitionPreviewRunId(nextRunId);
    setTransitionPreviewStage("target");

    const holdTimeout = window.setTimeout(() => {
      setTransitionPreviewStage("return");
    }, transitionDuration + 220);

    const resetTimeout = window.setTimeout(
      () => {
        setTransitionPreviewStage("idle");
        previewTimeoutsRef.current = [];
      },
      transitionDuration * 2 + 440,
    );

    previewTimeoutsRef.current = [holdTimeout, resetTimeout];
  }, [
    clearTransitionPreviewTimeouts,
    transitionDuration,
    transitionEffect,
    transitionPreviewRunId,
  ]);

  useEffect(() => {
    const previousOwner = previousPreviewOwnerRef.current;
    const previousEffect = previousTransitionEffectRef.current;
    const ownerChanged =
      previousOwner !== null && previousOwner !== previewOwnerKey;

    previousPreviewOwnerRef.current = previewOwnerKey;

    if (previousEffect === null || ownerChanged) {
      previousTransitionEffectRef.current = transitionEffect;
      return;
    }

    const effectChanged = previousEffect !== transitionEffect;
    previousTransitionEffectRef.current = transitionEffect;

    if (!effectChanged || transitionEffect === "none") {
      return;
    }

    const previewFrame = window.requestAnimationFrame(() => {
      handlePlayTransitionPreview();
    });

    return () => window.cancelAnimationFrame(previewFrame);
  }, [handlePlayTransitionPreview, previewOwnerKey, transitionEffect]);

  const phonePreviewProps = useMemo(() => {
    if (transitionPreviewStage === "target") {
      return {
        background: resolvedTransitionPreviewTarget.background,
        components: resolvedTransitionPreviewTarget.components,
        transitionKey: `${resolvedTransitionPreviewTarget.key}-preview-${transitionPreviewRunId}-target`,
        transitionSequence: resolvedTransitionPreviewTarget.sequence,
      };
    }

    if (transitionPreviewStage === "return") {
      return {
        background,
        components,
        transitionKey: `${previewKey ?? "editor-preview"}-preview-${transitionPreviewRunId}-return`,
        transitionSequence: baseTransitionSequence,
      };
    }

    return {
      background,
      components,
      transitionKey:
        transitionPreviewRunId > 0
          ? `${previewKey ?? "editor-preview"}-preview-${transitionPreviewRunId}-return`
          : (previewKey ?? "editor-preview"),
      transitionSequence: baseTransitionSequence,
    };
  }, [
    background,
    baseTransitionSequence,
    components,
    previewKey,
    resolvedTransitionPreviewTarget,
    transitionPreviewRunId,
    transitionPreviewStage,
  ]);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!navigation || navigation.totalCount <= 0) return;
      if (direction === "prev") {
        if (!canNavigatePrev) return;
        navigation.onNavigate(Math.max(navigation.activeIndex - 1, 0));
      } else {
        if (!canNavigateNext) return;
        navigation.onNavigate(
          Math.min(navigation.activeIndex + 1, navigation.totalCount - 1),
        );
      }
    },
    [navigation, canNavigatePrev, canNavigateNext],
  );

  const {
    onComponentPositionChange,
    onTextChange,
    onUpdateProps,
    onUpdateData,
    onUpdateAction,
    onDeleteComponent,
    onDropComponent,
    onOpenImagePicker,
    onOpenAudioPicker,
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
  } = editorActions;

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <CardHeader className="border-b bg-gray-50 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {pageType === "quiz" && questionMode && onQuestionModeChange && (
            <select
              value={questionMode}
              onChange={(e) =>
                onQuestionModeChange(e.target.value as QuestionMode)
              }
              disabled={isQuestionModeSaving}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
              <option value="ranking">Ranking</option>
              <option value="fill-in-blank">Fill in blank</option>
              <option value="matching">Matching</option>
              <option value="slider">Slider</option>
            </select>
          )}
          {/* Keep the multiple-choice buttons only on the quiz page. */}

          <CardTitle className="text-sm font-semibold text-gray-700">
            {title}
          </CardTitle>
          <div className="flex flex-1 items-center gap-2">
            {navigation && (
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
            )}
            <div className="flex flex-1 justify-center">
              {hasEntity &&
                (onRequestPageRename ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRequestPageRename}
                    className="grid h-8 min-w-64 max-w-[28rem] grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 px-3"
                    title="Rename page"
                  >
                    <span aria-hidden="true" />
                    <span className="truncate text-center">
                      {pageName.trim() ||
                        pageNamePlaceholder ||
                        "Untitled Page"}
                    </span>
                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                ) : (
                  <Input
                    value={pageName}
                    onChange={(event) => onPageNameChange(event.target.value)}
                    onBlur={onPageNameBlur}
                    placeholder={pageNamePlaceholder}
                    className="h-8 w-80 text-center text-sm"
                  />
                ))}
            </div>
            {navigation && (
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
            )}
          </div>
          {hasEntity && (
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
              <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm">
                <Select
                  value={transitionEffect}
                  onValueChange={(value) =>
                    onTransitionEffectChange?.(value as PageTransitionEffect)
                  }
                >
                  <SelectTrigger className="h-full min-w-[210px] flex-1 rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="text-sm font-medium">
                        {transitionTriggerLabel}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="w-[220px]">
                    {PAGE_TRANSITION_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="py-2 pr-3"
                      >
                        <span className="truncate">{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayTransitionPreview}
                  disabled={
                    transitionEffect === "none" || isTransitionPreviewing
                  }
                  className="h-full w-10 shrink-0 rounded-none border-l border-input px-0 text-gray-600 hover:bg-gray-50"
                  title="Preview transition"
                  aria-label="Preview transition"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTemplateDialogOpen(true)}
                className="gap-1"
              >
                <LayoutTemplate className="h-4 w-4" />
                Use Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveTemplateDialogOpen(true)}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                Save Template
              </Button>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
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
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent
        className="relative flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto bg-gray-50 p-4"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          const isBackgroundClickEvent =
            target === e.currentTarget ||
            target.dataset.backgroundArea === "true" ||
            target.closest("[data-background-area]") === target;
          if (isBackgroundClickEvent) {
            onBackgroundClick?.();
          }
        }}
      >
        {hasEntity ? (
          <>
            <ComponentDock pageType={pageType} questionMode={questionMode} />
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className="flex min-w-fit flex-1 items-center justify-center py-8"
                  data-background-area="true"
                >
                  <PhonePreview
                    components={phonePreviewProps.components}
                    background={phonePreviewProps.background}
                    transitionEffect={transitionEffect}
                    transitionKey={phonePreviewProps.transitionKey}
                    transitionSequence={phonePreviewProps.transitionSequence}
                    scale={0.6}
                    selectedComponentId={
                      isTransitionPreviewing
                        ? undefined
                        : (selectedComponentId ?? undefined)
                    }
                    selectedComponent={
                      isTransitionPreviewing ? null : selectedComponent
                    }
                    onComponentClick={
                      isTransitionPreviewing ? undefined : onComponentClick
                    }
                    onBackgroundClick={
                      isTransitionPreviewing ? undefined : onBackgroundClick
                    }
                    isEditable={!isTransitionPreviewing}
                    onComponentPositionChange={
                      isTransitionPreviewing
                        ? undefined
                        : onComponentPositionChange
                    }
                    onTextChange={
                      isTransitionPreviewing ? undefined : onTextChange
                    }
                    onDropComponent={
                      isTransitionPreviewing ? undefined : onDropComponent
                    }
                    onUpdateProps={
                      isTransitionPreviewing ? undefined : onUpdateProps
                    }
                    onUpdateData={
                      isTransitionPreviewing ? undefined : onUpdateData
                    }
                    onDeleteComponent={
                      isTransitionPreviewing ? undefined : onDeleteComponent
                    }
                    onOpenImagePicker={
                      isTransitionPreviewing ? undefined : onOpenImagePicker
                    }
                    onOpenAudioPicker={
                      isTransitionPreviewing ? undefined : onOpenAudioPicker
                    }
                    multiSelectedIds={
                      isTransitionPreviewing ? [] : multiSelectedIds
                    }
                    onMultiSelect={
                      isTransitionPreviewing ? undefined : onMultiSelect
                    }
                    onMergeComponents={
                      isTransitionPreviewing ? undefined : onMergeComponents
                    }
                    onUnmergeGroup={
                      isTransitionPreviewing ? undefined : onUnmergeGroup
                    }
                    onUpdateAction={
                      isTransitionPreviewing ? undefined : onUpdateAction
                    }
                    onBringToFront={
                      isTransitionPreviewing ? undefined : onBringToFront
                    }
                    onSendToBack={
                      isTransitionPreviewing ? undefined : onSendToBack
                    }
                    canBringForward={!isTransitionPreviewing && canBringForward}
                    canSendBackward={!isTransitionPreviewing && canSendBackward}
                    pageType={pageType}
                    onMatchingChange={onMatchingChange}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                {onUndo !== undefined && (
                  <>
                    <ContextMenuItem onClick={onUndo} disabled={!canUndo}>
                      Undo
                      <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={onRedo} disabled={!canRedo}>
                      Redo
                      <ContextMenuShortcut>⌘⇧Z</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
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
            {emptyMessage}
          </div>
        )}
      </CardContent>

      <TemplatePickerDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates}
        title={templateDialogTitle}
        description={templateDialogDescription}
        onSelect={handleTemplateSelect}
      />

      <Dialog
        open={isSaveTemplateDialogOpen}
        onOpenChange={(open) => {
          if (!isSavingTemplate) {
            setIsSaveTemplateDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Page as Template</DialogTitle>
            <DialogDescription>
              Save the current page layout, background, and components as a
              reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-title">Template Title</Label>
              <Input
                id="template-title"
                value={templateTitle}
                onChange={(event) => {
                  setTemplateTitle(event.target.value);
                  if (templateTitleError) setTemplateTitleError(null);
                }}
                placeholder="Template title"
                disabled={isSavingTemplate}
              />
              {templateTitleError ? (
                <p className="text-sm text-red-600">{templateTitleError}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="Optional description"
                rows={3}
                disabled={isSavingTemplate}
              />
            </div>
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setIsSaveTemplateDialogOpen(false)}
              disabled={isSavingTemplate}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveCurrentPageAsTemplate()}
              disabled={isSavingTemplate}
              className="gap-2"
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
