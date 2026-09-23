"use client";

import type {
  Component,
  PageBackground,
  ComponentPosition,
  PageAction,
} from "@/types";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { ComponentRenderer } from "./ComponentRenderer";
import ComponentToolbar, { type EditorPageType } from "./ComponentToolbar";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  getPageTransitionDuration,
  type PageTransitionEffect,
} from "@/lib/pageTransitions";
import { canComponentBecomeButton } from "@/lib/quizComponents";

interface PhonePreviewProps {
  components?: Component[];
  background?: PageBackground;
  scale?: number;
  selectedComponentId?: string;
  selectedComponent?: Component | null;
  onComponentClick?: (component: Component) => void;
  onComponentHover?: (component: Component | null) => void;
  onBackgroundClick?: () => void;
  isEditable?: boolean;
  emptyStateContent?: React.ReactNode;
  className?: string;
  onInsertComponent?: (
    payload: unknown,
    destination: { parentId: string; index: number },
  ) => void;
  onComponentPositionChange?: (
    componentId: string,
    position: ComponentPosition,
  ) => void;
  roundedCorners?: boolean;
  contentClassName?: string;
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
      | "slider"
      | "bgm"
      | "timer",
    dropPosition: { x: number; y: number },
    shapeVariant?: string,
  ) => void;
  // Toolbar props
  onUpdateProps?: (props: Record<string, unknown>) => void;
  onUpdateData?: (data: string) => void;
  onDeleteComponent?: () => void;
  onOpenImagePicker?: () => void;
  onOpenAudioPicker?: () => void;
  onUpdateAction?: (
    action: PageAction | undefined,
    actionProps?: Record<string, unknown>,
  ) => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  canBringForward?: boolean;
  canSendBackward?: boolean;
  // Multi-selection props
  multiSelectedIds?: string[];
  onMultiSelect?: (ids: string[]) => void;
  onMergeComponents?: (ids: string[]) => void;
  // Unmerge callback for group components
  onUnmergeGroup?: (groupId: string) => void;
  // Page type for action filtering
  pageType?: EditorPageType;
  // Play mode action callback - triggered when clicking a component with an action
  onComponentAction?: (
    action: PageAction,
    actionProps?: Record<string, unknown>,
    component?: Component,
  ) => void;
  rankingOrderByComponent?: Record<string, string[]>;
  onRankingChange?: (componentId: string, rankingOrder: string[]) => void;
  onRankingSubmit?: (componentId: string) => void;
  matchingPairsByComponent?: Record<string, Record<string, string>>;
  onMatchingChange?: (
    componentId: string,
    pairs: Record<string, string>,
  ) => void;
  sliderValueByComponent?: Record<string, number>;
  onSliderChange?: (
    componentId: string,
    value: number,
    intervalIndex: number,
  ) => void;
  currentPageNumber?: number;
  totalPages?: number;
  bgmMuted?: boolean;
  bgmBlocked?: boolean;
  onBGMToggleMute?: () => void;
  // Frameless mode - removes phone frame styling for full-screen play mode
  frameless?: boolean;
  selectedAnswers?: Component[];
  transitionEffect?: PageTransitionEffect;
  transitionKey?: string;
  transitionSequence?: number;
}

interface PreviewWrapperProps {
  isEditable: boolean;
  isSelected: boolean;
  isMultiSelected?: boolean; // True when component is part of multi-selection (hide toolbar)
  onComponentClick?: (component: Component) => void;
  onComponentHover?: (component: Component | null) => void;
  selectedComponentId?: string;
  editingComponentId?: string;
  onPositionChange?: (componentId: string, position: ComponentPosition) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onTextChange?: (componentId: string, text: string) => void;
  onStartEditing?: (componentId: string) => void;
  onImageEdit?: (componentId: string) => void;
  // Toolbar props
  onUpdateProps?: (props: Record<string, unknown>) => void;
  onUpdateData?: (data: string) => void;
  onDeleteComponent?: () => void;
  onOpenImagePicker?: () => void;
  onOpenAudioPicker?: () => void;
  onUpdateAction?: (
    action: PageAction | undefined,
    actionProps?: Record<string, unknown>,
  ) => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  canBringForward?: boolean;
  canSendBackward?: boolean;
  // Page type for action filtering
  pageType?: EditorPageType;
  // Unmerge callback for group components
  onUnmerge?: () => void;
  // Clear multi-selection callback
  onClearMultiSelect?: () => void;
  multiSelectedIds?: string[];
  onMultiSelect?: (ids: string[]) => void;
  // Play mode action callback
  onComponentAction?: (
    action: PageAction,
    actionProps?: Record<string, unknown>,
    component?: Component,
  ) => void;
  rankingOrderByComponent?: Record<string, string[]>;
  onRankingChange?: (componentId: string, rankingOrder: string[]) => void;
  onRankingSubmit?: (componentId: string) => void;
  matchingPairsByComponent?: Record<string, Record<string, string>>;
  onMatchingChange?: (
    componentId: string,
    pairs: Record<string, string>,
  ) => void;
  sliderValueByComponent?: Record<string, number>;
  onSliderChange?: (
    componentId: string,
    value: number,
    intervalIndex: number,
  ) => void;
  currentPageNumber?: number;
  totalPages?: number;
  bgmMuted?: boolean;
  bgmBlocked?: boolean;
  onBGMToggleMute?: () => void;
}

type TransitionSlideSnapshot = {
  key: string;
  components: Component[];
  background?: PageBackground;
};

type TransitionDirection = "forward" | "backward";

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

const VISIBILITY_MARGIN = 0.01;

// Clamp positions so that at least part of the component stays on-screen.
const clampXToVisibleRange = (x: number, width: number) => {
  const halfWidth = width / 2;
  const minX = -50 - halfWidth + VISIBILITY_MARGIN; // Keep right edge inside
  const maxX = 50 + halfWidth - VISIBILITY_MARGIN; // Keep left edge inside
  return Math.min(Math.max(x, minX), maxX);
};

const clampYToVisibleRange = (y: number, height: number) => {
  const minY = -height + VISIBILITY_MARGIN; // Keep bottom edge inside
  const maxY = 100 - VISIBILITY_MARGIN; // Keep top edge inside
  return Math.min(Math.max(y, minY), maxY);
};

function PreviewComponentWrapper({
  component,
  isEditable,
  isSelected,
  isMultiSelected,
  onComponentClick,
  onComponentHover,
  selectedComponentId,
  editingComponentId,
  onPositionChange,
  containerRef,
  onTextChange,
  onStartEditing,
  onImageEdit,
  onUpdateProps,
  onUpdateData,
  onDeleteComponent,
  onOpenImagePicker,
  onOpenAudioPicker,
  onUpdateAction,
  onBringToFront,
  onSendToBack,
  canBringForward,
  canSendBackward,
  pageType,
  onUnmerge,
  onClearMultiSelect,
  multiSelectedIds = [],
  onMultiSelect,
  onComponentAction,
  rankingOrderByComponent,
  onRankingChange,
  matchingPairsByComponent,
  onMatchingChange,
  onRankingSubmit,
  sliderValueByComponent,
  onSliderChange,
  currentPageNumber,
  totalPages,
  bgmMuted,
  bgmBlocked,
  onBGMToggleMute,
}: PreviewWrapperProps & { component: Component }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState({
    mouseX: 0,
    mouseY: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const elementRef = useRef<HTMLDivElement>(null);
  const rotateStartRef = useRef<{
    startAngle: number;
    startRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  // Use position from component - should always exist after normalization
  // Position system: x=0 means horizontally centered, position refers to component's center-top
  const position = useMemo(
    () =>
      component.position ?? {
        x: 0,
        y: 10,
        width: 90,
        height: 15,
      },
    [component.position],
  );

  const rotation = position.rotation ?? 0;

  // Convert center-based position to CSS left/top
  // x: 0 = centered, negative = left of center, positive = right of center
  // The position.x represents where the CENTER of the component is relative to 50% (center of container)
  const cssLeft = 50 + position.x - position.width / 2;
  const cssTop = position.y;

  // Check if component has an action (for play mode cursor styling)
  const hasAction =
    canComponentBecomeButton(component) && Boolean(component.action);

  const interactiveClass = !isEditable
    ? hasAction
      ? "cursor-pointer hover:brightness-95 active:brightness-90 transition-all" // Play mode: actionable components get click feedback
      : ""
    : isMultiSelected
      ? "" // No individual outline for multi-selected components (unified box is shown instead)
      : isSelected
        ? "outline outline-2 outline-offset-2 outline-white shadow-lg"
        : "hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-gray-300";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      // Only allow dragging if component is selected
      if (!isSelected) return;
      // Don't start drag if clicking on a resize handle
      const target = e.target as HTMLElement;
      if (target.dataset.resizeHandle || target.dataset.rotateHandle) return;
      e.stopPropagation();
      e.preventDefault(); // Prevent default to stop image dragging

      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });

      setIsDragging(true);
    },
    [isEditable, isSelected, position],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();

      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });
      setIsResizing(handle);
    },
    [isEditable, position],
  );

  const handleRotateStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();

      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

      rotateStartRef.current = {
        startAngle,
        startRotation: rotation,
        centerX,
        centerY,
      };
      setIsRotating(true);
    },
    [isEditable, rotation],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef?.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Calculate mouse delta as percentage of container
      const deltaXPercent =
        ((e.clientX - dragStart.mouseX) / containerRect.width) * 100;
      const deltaYPercent =
        ((e.clientY - dragStart.mouseY) / containerRect.height) * 100;

      if (isDragging) {
        // Move the component (position is center-based)
        const newX = dragStart.x + deltaXPercent;
        const newY = dragStart.y + deltaYPercent;

        // Clamp so component never goes fully offscreen
        const clampedX = clampXToVisibleRange(newX, dragStart.width);
        const clampedY = clampYToVisibleRange(newY, dragStart.height);

        onPositionChange?.(component.id, {
          ...position,
          x: clampedX,
          y: clampedY,
          rotation: position.rotation,
        });
      } else if (isResizing) {
        const newX = dragStart.x;
        let newY = dragStart.y;
        let newWidth = dragStart.width;
        let newHeight = dragStart.height;
        const maxWidth = component.type === "shape" ? Infinity : 100;

        // Handle resize based on which handle is being dragged
        if (isResizing.includes("e")) {
          // East (right edge) - increase width, keep center x the same means left edge moves left
          newWidth = Math.max(
            5,
            Math.min(maxWidth, dragStart.width + deltaXPercent * 2),
          );
        }
        if (isResizing.includes("w")) {
          // West (left edge) - increase width on the left side
          newWidth = Math.max(
            5,
            Math.min(maxWidth, dragStart.width - deltaXPercent * 2),
          );
        }
        if (isResizing.includes("s")) {
          // South (bottom edge) - increase height
          newHeight = Math.max(5, dragStart.height + deltaYPercent);
        }
        if (isResizing.includes("n")) {
          // North (top edge) - decrease height, move y
          const heightDelta = -deltaYPercent;
          newHeight = Math.max(5, dragStart.height + heightDelta);
          // Adjust y to keep the bottom edge in place
          newY = clampYToVisibleRange(dragStart.y - heightDelta, newHeight);
        }

        onPositionChange?.(component.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          rotation: position.rotation,
        });
      } else if (isRotating && rotateStartRef.current) {
        const { centerX, centerY, startAngle, startRotation } =
          rotateStartRef.current;
        const currentAngle = Math.atan2(
          e.clientY - centerY,
          e.clientX - centerX,
        );
        const delta = currentAngle - startAngle;
        let newRotation = startRotation + (delta * 180) / Math.PI;
        newRotation = ((newRotation % 360) + 360) % 360;

        onPositionChange?.(component.id, {
          ...position,
          rotation: newRotation,
        });
      }
    },
    [
      isDragging,
      isResizing,
      isRotating,
      containerRef,
      dragStart,
      position,
      component.id,
      component.type,
      onPositionChange,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
    setIsRotating(false);
    rotateStartRef.current = null;
  }, []);

  // Attach global mouse listeners when dragging or resizing
  useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp]);

  const RotationHandle =
    isEditable && isSelected && !isMultiSelected ? (
      <>
        <div
          data-rotate-handle="true"
          className="absolute -top-6 left-1/2 z-10 flex h-4 w-4 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-blue-500 bg-white shadow"
          onMouseDown={handleRotateStart}
        >
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
        <div className="absolute -top-2 left-1/2 z-10 h-3 w-px -translate-x-1/2 bg-blue-500" />
      </>
    ) : null;

  // Resize handle component (hide for multi-selected components - they use unified bounding box)
  const ResizeHandles =
    isEditable && isSelected && !isMultiSelected ? (
      <>
        {/* Corner handles */}
        <div
          data-resize-handle="nw"
          className="absolute -left-1.5 -top-1.5 z-10 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "nw")}
        />
        <div
          data-resize-handle="ne"
          className="absolute -right-1.5 -top-1.5 z-10 h-3 w-3 cursor-nesw-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "ne")}
        />
        <div
          data-resize-handle="sw"
          className="absolute -bottom-1.5 -left-1.5 z-10 h-3 w-3 cursor-nesw-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "sw")}
        />
        <div
          data-resize-handle="se"
          className="absolute -bottom-1.5 -right-1.5 z-10 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "se")}
        />
        {/* Edge handles */}
        <div
          data-resize-handle="n"
          className="absolute -top-1 left-1/2 z-10 h-2 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "n")}
        />
        <div
          data-resize-handle="s"
          className="absolute -bottom-1 left-1/2 z-10 h-2 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "s")}
        />
        <div
          data-resize-handle="w"
          className="absolute -left-1 top-1/2 z-10 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "w")}
        />
        <div
          data-resize-handle="e"
          className="absolute -right-1 top-1/2 z-10 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "e")}
        />
      </>
    ) : null;

  // Show toolbar for selected components (not multi-selected)
  const showToolbar =
    isEditable &&
    isSelected &&
    !isMultiSelected &&
    onUpdateProps &&
    onDeleteComponent;

  const componentElement = (
    <div
      ref={elementRef}
      data-component-wrapper
      className={`absolute overflow-visible ${interactiveClass} ${isDragging ? "z-50 cursor-grabbing" : isResizing ? "z-50" : isEditable && isSelected ? "cursor-grab" : ""}`}
      style={{
        left: `${cssLeft}%`,
        top: `${cssTop}%`,
        width: `${position.width}%`,
        height: `${position.height}%`,
        userSelect: "none", // Prevent text selection while dragging
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      onMouseDown={handleMouseDown}
      onDragStart={(event) => {
        // Allow interactive quiz components to use their native play-mode gestures.
        if (
          !isEditable &&
          (component.type === "ranking" || component.type === "slider")
        ) {
          return;
        }
        event.preventDefault();
      }}
      onClick={(event) => {
        event.stopPropagation();
        // Handle action clicks in play mode (non-editable)
        if (!isEditable) {
          if (hasAction && component.action && onComponentAction) {
            onComponentAction(
              component.action,
              component.actionProps,
              component,
            );
          }
          return;
        }
        // Editor mode click handling
        if ((event.ctrlKey || event.metaKey) && onMultiSelect) {
          const baseSelection =
            multiSelectedIds.length > 0
              ? multiSelectedIds
              : selectedComponentId && selectedComponentId !== component.id
                ? [selectedComponentId]
                : [];
          const nextSelection = baseSelection.includes(component.id)
            ? baseSelection.filter((id) => id !== component.id)
            : [...baseSelection, component.id];

          if (nextSelection.length > 0) {
            onMultiSelect(nextSelection);
          } else {
            onClearMultiSelect?.();
          }
          return;
        }

        onClearMultiSelect?.();
        onComponentClick?.(component);
      }}
      onDoubleClick={(event) => {
        if (!isEditable) return;
        event.stopPropagation();
        if (component.type === "text") {
          onStartEditing?.(component.id);
        } else if (component.type === "image") {
          onImageEdit?.(component.id);
        }
      }}
      onMouseEnter={() => {
        if (!isEditable) return;
        onComponentHover?.(component);
      }}
      onMouseLeave={() => {
        if (!isEditable) return;
        onComponentHover?.(null);
      }}
    >
      <div
        className={`h-full w-full ${editingComponentId === component.id && component.type === "text" ? "" : isEditable ? "pointer-events-none select-none" : "select-none"}`}
        style={{
          pointerEvents:
            editingComponentId === component.id && component.type === "text"
              ? "auto"
              : isEditable
                ? "none"
                : "auto", // Allow pointer events in play mode for actions
        }}
      >
        <ComponentRenderer
          component={component}
          selectedComponentId={selectedComponentId}
          editingComponentId={editingComponentId}
          isEditable={isEditable}
          onTextChange={onTextChange}
          rankingOrder={rankingOrderByComponent?.[component.id]}
          onRankingChange={onRankingChange}
          onRankingSubmit={onRankingSubmit}
          matchingPairs={matchingPairsByComponent?.[component.id]}
          onMatchingChange={onMatchingChange}
          sliderValue={sliderValueByComponent?.[component.id]}
          onSliderChange={onSliderChange}
          currentPageNumber={currentPageNumber}
          totalPages={totalPages}
          bgmMuted={bgmMuted}
          bgmBlocked={bgmBlocked}
          onBGMToggleMute={onBGMToggleMute}
        />
        {isSelected && !isEditable && (
          <div className="pointer-events-none absolute right-1 top-1 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white">
            ✓
          </div>
        )}
      </div>
      {RotationHandle}
      {ResizeHandles}
    </div>
  );

  if (showToolbar) {
    return (
      <Popover open={true} modal={false}>
        <PopoverAnchor asChild>{componentElement}</PopoverAnchor>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={16}
          className="w-auto border-none bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ComponentToolbar
              component={component}
              onUpdateProps={onUpdateProps}
              onUpdateData={onUpdateData ?? (() => undefined)}
              onUpdatePosition={() => undefined}
              onDelete={onDeleteComponent}
              onOpenImagePicker={onOpenImagePicker}
              onOpenAudioPicker={onOpenAudioPicker}
              onUpdateAction={onUpdateAction}
              pageType={pageType}
              onUnmerge={component.type === "group" ? onUnmerge : undefined}
              onBringToFront={onBringToFront}
              onSendToBack={onSendToBack}
              canBringForward={canBringForward}
              canSendBackward={canSendBackward}
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return componentElement;
}

export default function PhonePreview({
  components,
  background,
  scale = 0.4,
  selectedComponentId,
  selectedComponent,
  onComponentClick,
  onComponentHover,
  onBackgroundClick,
  isEditable = false,
  emptyStateContent,
  className = "",
  onInsertComponent,
  onComponentPositionChange,
  roundedCorners = true,
  contentClassName,
  onTextChange,
  onImageEdit,
  onDropComponent,
  onUpdateProps,
  onUpdateData,
  onDeleteComponent,
  onOpenImagePicker,
  onOpenAudioPicker,
  onUpdateAction,
  onBringToFront,
  onSendToBack,
  canBringForward,
  canSendBackward,
  multiSelectedIds = [],
  onMultiSelect,
  onMergeComponents,
  onUnmergeGroup,
  pageType = "quiz",
  onComponentAction,
  rankingOrderByComponent,
  onRankingChange,
  matchingPairsByComponent,
  onMatchingChange,
  onRankingSubmit,
  sliderValueByComponent,
  onSliderChange,
  currentPageNumber,
  totalPages,
  bgmMuted,
  bgmBlocked,
  onBGMToggleMute,
  frameless = false,
  selectedAnswers,
  transitionEffect = "none",
  transitionKey,
  transitionSequence,
}: PhonePreviewProps) {
  const baseWidth = 390;
  const baseHeight = 844;
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(
    null,
  );
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const [renderSlides, setRenderSlides] = useState<TransitionSlideSnapshot[]>(
    [],
  );
  const [animateTransition, setAnimateTransition] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<TransitionDirection>("forward");
  const transitionTimeoutRef = useRef<number | null>(null);
  const previousTransitionKeyRef = useRef<string | null>(null);
  const previousTransitionSequenceRef = useRef<number | undefined>(undefined);

  // Marquee selection state
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  // Flag to prevent click from clearing selection right after marquee completes
  const justCompletedMarqueeRef = useRef(false);

  const normalizedComponents = useMemo(() => components ?? [], [components]);
  const resolvedTransitionKey = transitionKey ?? "default-preview";
  const transitionDuration = useMemo(
    () => getPageTransitionDuration(transitionEffect),
    [transitionEffect],
  );

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentSnapshot: TransitionSlideSnapshot = {
      key: resolvedTransitionKey,
      components: normalizedComponents,
      background,
    };

    if (transitionEffect === "none" || transitionDuration <= 0) {
      setAnimateTransition(false);
      setRenderSlides([currentSnapshot]);
      previousTransitionKeyRef.current = resolvedTransitionKey;
      previousTransitionSequenceRef.current = transitionSequence;
      return;
    }

    const previousKey = previousTransitionKeyRef.current;
    const keyChanged =
      previousKey !== null && previousKey !== resolvedTransitionKey;

    if (!keyChanged) {
      // Same page, new content. We refresh the active slide in place so editing
      // and autosave updates do not replay the transition animation.
      setRenderSlides((prev) => {
        if (prev.length === 0) return [currentSnapshot];
        const nextSlides = [...prev];
        nextSlides[nextSlides.length - 1] = currentSnapshot;
        return nextSlides;
      });
      previousTransitionKeyRef.current = resolvedTransitionKey;
      previousTransitionSequenceRef.current = transitionSequence;
      return;
    }

    setRenderSlides((prev) => {
      // Keep the outgoing page around just long enough to stage a real
      // page-to-page transition instead of a content swap.
      const previousSnapshot = prev[prev.length - 1] ?? currentSnapshot;
      return [previousSnapshot, currentSnapshot];
    });
    const previousSequence = previousTransitionSequenceRef.current ?? 0;
    const currentSequence = transitionSequence ?? 0;
    setTransitionDirection(
      currentSequence < previousSequence ? "backward" : "forward",
    );
    setAnimateTransition(true);

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = window.setTimeout(() => {
      setRenderSlides([currentSnapshot]);
      setAnimateTransition(false);
      transitionTimeoutRef.current = null;
    }, transitionDuration + 80);

    previousTransitionKeyRef.current = resolvedTransitionKey;
    previousTransitionSequenceRef.current = transitionSequence;
  }, [
    background,
    normalizedComponents,
    resolvedTransitionKey,
    transitionDuration,
    transitionEffect,
    transitionSequence,
  ]);

  // Clear editing mode when selection changes to a different component
  useEffect(() => {
    if (editingComponentId && selectedComponentId !== editingComponentId) {
      setEditingComponentId(null);
    }
  }, [selectedComponentId, editingComponentId]);

  useEffect(() => {
    const wrapperElement = previewWrapperRef.current;
    if (!wrapperElement) return;

    const targetElement = wrapperElement.parentElement ?? wrapperElement;

    const updateWidth = () => {
      const newWidth = targetElement.getBoundingClientRect().width;
      setAvailableWidth((prev) => {
        if (prev === null) return newWidth;
        return Math.abs(prev - newWidth) < 0.5 ? prev : newWidth;
      });
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  const effectiveScale = useMemo(() => {
    if (!availableWidth || availableWidth <= 0) {
      return scale;
    }
    const maxScale = availableWidth / baseWidth;
    return Math.min(scale, maxScale);
  }, [availableWidth, scale]);

  // Keyboard event handler for delete and arrow keys
  useEffect(() => {
    if (!isEditable || !selectedComponentId || !selectedComponent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys when editing text
      if (editingComponentId) return;

      // Don't handle if focus is on an input element
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      // Delete component with Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDeleteComponent?.();
        return;
      }

      // Move component with arrow keys
      const MOVE_STEP = 1; // 1% per key press
      const MOVE_STEP_LARGE = 5; // 5% when holding Shift
      const step = e.shiftKey ? MOVE_STEP_LARGE : MOVE_STEP;

      const position = selectedComponent.position;
      if (!position || !onComponentPositionChange) return;

      let newX = position.x;
      let newY = position.y;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newX = position.x - step;
          break;
        case "ArrowRight":
          e.preventDefault();
          newX = position.x + step;
          break;
        case "ArrowUp":
          e.preventDefault();
          newY = position.y - step;
          break;
        case "ArrowDown":
          e.preventDefault();
          newY = position.y + step;
          break;
        default:
          return;
      }

      // Clamp positions so the component never leaves the screen completely
      newX = clampXToVisibleRange(newX, position.width);
      newY = clampYToVisibleRange(newY, position.height);

      onComponentPositionChange(selectedComponentId, {
        ...position,
        x: newX,
        y: newY,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isEditable,
    selectedComponentId,
    selectedComponent,
    editingComponentId,
    onDeleteComponent,
    onComponentPositionChange,
  ]);

  const scaledWidth = baseWidth * effectiveScale;
  const scaledHeight = baseHeight * effectiveScale;

  const handleBackgroundClickInternal = useCallback(() => {
    // Skip if we just completed a marquee selection (click fires after mouseup)
    if (justCompletedMarqueeRef.current) {
      justCompletedMarqueeRef.current = false;
      return;
    }

    setEditingComponentId(null);
    onBackgroundClick?.();
    // Clear multi-selection when clicking background
    if (multiSelectedIds.length > 0) {
      onMultiSelect?.([]);
    }
  }, [onBackgroundClick, multiSelectedIds.length, onMultiSelect]);

  // Marquee selection handlers
  const handleMarqueeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isEditable || !onMultiSelect) return;

      // Check if we clicked directly on the container (background)
      // or on a child element that is part of a component
      const target = e.target as HTMLElement;
      const isClickOnComponent = target.closest("[data-component-wrapper]");
      if (isClickOnComponent) return;

      const rect = e.currentTarget.getBoundingClientRect();
      // Divide by scale to convert screen coordinates to unscaled coordinate system
      const x = (e.clientX - rect.left) / effectiveScale;
      const y = (e.clientY - rect.top) / effectiveScale;

      setIsMarqueeActive(true);
      setMarqueeStart({ x, y });
      setMarqueeEnd({ x, y });

      // Clear single selection when starting marquee
      onBackgroundClick?.();
    },
    [isEditable, onMultiSelect, onBackgroundClick, effectiveScale],
  );

  const handleMarqueeMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isMarqueeActive) return;

      const rect = e.currentTarget.getBoundingClientRect();
      // Divide by scale to convert screen coordinates to unscaled coordinate system
      const x = (e.clientX - rect.left) / effectiveScale;
      const y = (e.clientY - rect.top) / effectiveScale;

      setMarqueeEnd({ x, y });
    },
    [isMarqueeActive, effectiveScale],
  );

  const handleMarqueeEnd = useCallback(() => {
    if (!isMarqueeActive || !onMultiSelect) {
      setIsMarqueeActive(false);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setIsMarqueeActive(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    // Divide by scale to get unscaled dimensions (marquee coordinates are in unscaled space)
    const containerWidth = containerRect.width / effectiveScale;
    const containerHeight = containerRect.height / effectiveScale;

    // Normalize marquee rectangle
    const left = Math.min(marqueeStart.x, marqueeEnd.x);
    const right = Math.max(marqueeStart.x, marqueeEnd.x);
    const top = Math.min(marqueeStart.y, marqueeEnd.y);
    const bottom = Math.max(marqueeStart.y, marqueeEnd.y);

    // Convert marquee pixels to percentage coordinates
    const marqueeLeftPct = (left / containerWidth) * 100;
    const marqueeRightPct = (right / containerWidth) * 100;
    const marqueeTopPct = (top / containerHeight) * 100;
    const marqueeBottomPct = (bottom / containerHeight) * 100;

    // Find components that intersect with the marquee
    const selected = normalizedComponents.filter((comp) => {
      if (!comp.position) return false;
      const pos = comp.position;

      // Convert component center-based X to left position
      const compLeftPct = 50 + pos.x - pos.width / 2;
      const compRightPct = 50 + pos.x + pos.width / 2;
      const compTopPct = pos.y;
      const compBottomPct = pos.y + pos.height;

      // Check for intersection
      const intersectsX =
        compLeftPct < marqueeRightPct && compRightPct > marqueeLeftPct;
      const intersectsY =
        compTopPct < marqueeBottomPct && compBottomPct > marqueeTopPct;

      return intersectsX && intersectsY;
    });

    if (selected.length > 1) {
      onMultiSelect(selected.map((c) => c.id));
      // Prevent the subsequent click event from clearing the selection
      justCompletedMarqueeRef.current = true;
    }

    setIsMarqueeActive(false);
  }, [
    isMarqueeActive,
    marqueeStart,
    marqueeEnd,
    normalizedComponents,
    onMultiSelect,
    effectiveScale,
  ]);

  // Calculate marquee display rect
  const marqueeRect = useMemo(
    () =>
      isMarqueeActive
        ? {
          left: Math.min(marqueeStart.x, marqueeEnd.x),
          top: Math.min(marqueeStart.y, marqueeEnd.y),
          width: Math.abs(marqueeEnd.x - marqueeStart.x),
          height: Math.abs(marqueeEnd.y - marqueeStart.y),
        }
        : null,
    [
      isMarqueeActive,
      marqueeEnd.x,
      marqueeEnd.y,
      marqueeStart.x,
      marqueeStart.y,
    ],
  );

  // Calculate bounding box for multi-selected components (in percentage coordinates)
  const multiSelectionBounds = useMemo(() => {
    if (multiSelectedIds.length < 2) return null;

    const selectedComponents = normalizedComponents.filter((c) =>
      multiSelectedIds.includes(c.id),
    );
    if (selectedComponents.length < 2) return null;

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    selectedComponents.forEach((comp) => {
      if (!comp.position) return;
      const pos = comp.position;

      // Convert center-based X to left/right positions
      const compLeft = 50 + pos.x - pos.width / 2;
      const compRight = 50 + pos.x + pos.width / 2;
      const compTop = pos.y;
      const compBottom = pos.y + pos.height;

      minLeft = Math.min(minLeft, compLeft);
      minTop = Math.min(minTop, compTop);
      maxRight = Math.max(maxRight, compRight);
      maxBottom = Math.max(maxBottom, compBottom);
    });

    if (!isFinite(minLeft)) return null;

    return {
      left: minLeft,
      top: minTop,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };
  }, [multiSelectedIds, normalizedComponents]);

  const getBackgroundStyle = useCallback(
    (pageBackground?: PageBackground): React.CSSProperties => ({
      backgroundColor: pageBackground?.color ?? "white",
    }),
    [],
  );

  const getBackgroundImageStyle = useCallback(
    (pageBackground?: PageBackground): React.CSSProperties | undefined => {
      if (!pageBackground?.image) return undefined;

      const opacity =
        typeof pageBackground.imageOpacity === "number"
          ? Math.min(1, Math.max(0, pageBackground.imageOpacity))
          : 1;

      return {
        backgroundImage: `url(${pageBackground.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        opacity,
      };
    },
    [],
  );

  const defaultEmptyState = useMemo(
    () => (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mb-4 text-4xl">📱</div>
          <p className="mb-2 text-lg">No content</p>
          <p className="text-sm">
            {isEditable
              ? "Drop components here to start building"
              : "Nothing to display"}
          </p>
        </div>
      </div>
    ),
    [isEditable],
  );

  const getPayloadFromEvent = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const json = event.dataTransfer.getData("application/json");
      if (json) {
        try {
          return JSON.parse(json);
        } catch {
          return undefined;
        }
      }
      const text = event.dataTransfer.getData("text/plain");
      if (text) {
        return text;
      }
      return undefined;
    },
    [],
  );

  const handleDropToDestination = useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      destination: { parentId: string; index: number },
    ) => {
      if (!isEditable) return;
      const payload = getPayloadFromEvent(event);
      if (payload === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      onInsertComponent?.(payload, destination);
    },
    [getPayloadFromEvent, isEditable, onInsertComponent],
  );

  const rootInsertionIndex = normalizedComponents.length;

  const handleBackgroundDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isEditable) return;

      // Check for component type drop from dock
      const componentType = event.dataTransfer.getData("componentType");
      if (
        componentType === "image" ||
        componentType === "text" ||
        componentType === "shape" ||
        componentType === "progressBar" ||
        componentType === "ranking" ||
        componentType === "input" ||
        componentType === "matching" ||
        componentType === "slider" ||
        componentType === "bgm" ||
        componentType === "timer"
      ) {
        event.preventDefault();
        event.stopPropagation();

        // Calculate drop position relative to container
        const container = containerRef.current;
        if (container && onDropComponent) {
          const rect = container.getBoundingClientRect();
          // Account for scale
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;

          // Convert from CSS position to center-based position
          // The position.x represents offset from center (50%)
          // So if drop is at CSS left 30%, that's 30 - 50 = -20 for center-x
          const centerX = x - 50;

          // Get shape variant if dropping a shape
          const shapeVariant =
            componentType === "shape"
              ? event.dataTransfer.getData("shapeVariant") || undefined
              : undefined;

          onDropComponent(
            componentType,
            { x: centerX, y: Math.max(0, y) },
            shapeVariant,
          );
        }
        return;
      }

      handleDropToDestination(event, {
        parentId: "root",
        index: rootInsertionIndex,
      });
    },
    [handleDropToDestination, isEditable, rootInsertionIndex, onDropComponent],
  );

  const renderPageSurface = useCallback(
    (
      slideComponents: Component[],
      slideBackground?: PageBackground,
      options?: { interactive?: boolean },
    ) => {
      const interactive = options?.interactive ?? true;

      return (
        <div
          className={`relative h-full w-full overflow-hidden ${!frameless && roundedCorners ? "rounded-[2rem]" : ""}`}
          style={getBackgroundStyle(slideBackground)}
          onClick={interactive ? handleBackgroundClickInternal : undefined}
          onDragOver={(e) => {
            if (!interactive || !isEditable) return;
            if (
              e.dataTransfer.types.includes("componenttype") ||
              e.dataTransfer.types.includes("application/json") ||
              e.dataTransfer.types.includes("text/plain")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={interactive ? handleBackgroundDrop : undefined}
        >
          {slideBackground?.image ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={getBackgroundImageStyle(slideBackground)}
              aria-hidden
            />
          ) : null}
          <div
            ref={interactive ? containerRef : undefined}
            className={`relative h-full w-full overflow-hidden ${contentClassName ?? ""}`}
            onMouseDown={interactive ? handleMarqueeStart : undefined}
            onMouseMove={interactive ? handleMarqueeMove : undefined}
            onMouseUp={interactive ? handleMarqueeEnd : undefined}
            onMouseLeave={interactive ? handleMarqueeEnd : undefined}
          >
            {slideComponents.length > 0
              ? slideComponents.map((component) => {
                const isAnswerSelected =
                  selectedAnswers?.some((a) => a.id === component.id) ??
                  false;

                return (
                  <PreviewComponentWrapper
                    key={component.id}
                    component={component}
                    isEditable={interactive && isEditable}
                    isSelected={
                      interactive &&
                      (selectedComponentId === component.id ||
                        multiSelectedIds.includes(component.id) ||
                        isAnswerSelected)
                    }
                    isMultiSelected={
                      interactive && multiSelectedIds.includes(component.id)
                    }
                    onComponentClick={
                      interactive ? onComponentClick : undefined
                    }
                    onComponentHover={
                      interactive ? onComponentHover : undefined
                    }
                    selectedComponentId={
                      interactive ? selectedComponentId : undefined
                    }
                    editingComponentId={
                      interactive
                        ? (editingComponentId ?? undefined)
                        : undefined
                    }
                    onPositionChange={
                      interactive ? onComponentPositionChange : undefined
                    }
                    containerRef={interactive ? containerRef : undefined}
                    onTextChange={interactive ? onTextChange : undefined}
                    onStartEditing={
                      interactive ? setEditingComponentId : undefined
                    }
                    onImageEdit={interactive ? onImageEdit : undefined}
                    onUpdateProps={interactive ? onUpdateProps : undefined}
                    onUpdateData={interactive ? onUpdateData : undefined}
                    onDeleteComponent={
                      interactive ? onDeleteComponent : undefined
                    }
                    onOpenImagePicker={
                      interactive ? onOpenImagePicker : undefined
                    }
                    onOpenAudioPicker={
                      interactive ? onOpenAudioPicker : undefined
                    }
                    onUpdateAction={interactive ? onUpdateAction : undefined}
                    onBringToFront={interactive ? onBringToFront : undefined}
                    onSendToBack={interactive ? onSendToBack : undefined}
                    canBringForward={interactive && canBringForward}
                    canSendBackward={interactive && canSendBackward}
                    pageType={pageType}
                    onUnmerge={
                      interactive &&
                        component.type === "group" &&
                        onUnmergeGroup
                        ? () => onUnmergeGroup(component.id)
                        : undefined
                    }
                    onClearMultiSelect={
                      interactive && multiSelectedIds.length > 0
                        ? () => onMultiSelect?.([])
                        : undefined
                    }
                    multiSelectedIds={multiSelectedIds}
                    onMultiSelect={interactive ? onMultiSelect : undefined}
                    onComponentAction={
                      interactive ? onComponentAction : undefined
                    }
                    rankingOrderByComponent={rankingOrderByComponent}
                    onRankingChange={
                      interactive ? onRankingChange : undefined
                    }
                    onRankingSubmit={
                      interactive ? onRankingSubmit : undefined
                    }
                    matchingPairsByComponent={matchingPairsByComponent}
                    onMatchingChange={
                      interactive ? onMatchingChange : undefined
                    }
                    sliderValueByComponent={sliderValueByComponent}
                    onSliderChange={interactive ? onSliderChange : undefined}
                    currentPageNumber={currentPageNumber}
                    totalPages={totalPages}
                    bgmMuted={bgmMuted}
                    bgmBlocked={bgmBlocked}
                    onBGMToggleMute={onBGMToggleMute}
                  />
                );
              })
              : (emptyStateContent ?? defaultEmptyState)}

            {interactive && isMarqueeActive && marqueeRect && (
              <div
                className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/10"
                style={{
                  left: marqueeRect.left,
                  top: marqueeRect.top,
                  width: marqueeRect.width,
                  height: marqueeRect.height,
                }}
              />
            )}
          </div>

          {interactive && multiSelectionBounds && onMergeComponents && (
            <Popover open={true} modal={false}>
              <PopoverAnchor asChild>
                <div
                  className="pointer-events-none absolute z-40 border-2 border-dashed border-blue-500 bg-blue-500/5"
                  style={{
                    left: `${multiSelectionBounds.left}%`,
                    top: `${multiSelectionBounds.top}%`,
                    width: `${multiSelectionBounds.width}%`,
                    height: `${multiSelectionBounds.height}%`,
                  }}
                />
              </PopoverAnchor>
              <PopoverContent
                side="top"
                align="center"
                sideOffset={8}
                className="w-auto border-none bg-transparent p-0 shadow-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-lg">
                    <span className="text-sm text-gray-600">
                      {multiSelectedIds.length} selected
                    </span>
                    <button
                      onClick={() => onMergeComponents(multiSelectedIds)}
                      className="rounded bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600"
                    >
                      Merge
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      );
    },
    [
      contentClassName,
      currentPageNumber,
      bgmBlocked,
      bgmMuted,
      defaultEmptyState,
      editingComponentId,
      emptyStateContent,
      frameless,
      getBackgroundStyle,
      getBackgroundImageStyle,
      handleBackgroundClickInternal,
      handleBackgroundDrop,
      handleMarqueeEnd,
      handleMarqueeMove,
      handleMarqueeStart,
      isEditable,
      isMarqueeActive,
      marqueeRect,
      canBringForward,
      canSendBackward,
      multiSelectedIds,
      multiSelectionBounds,
      onBringToFront,
      onBGMToggleMute,
      onComponentAction,
      onComponentClick,
      onComponentHover,
      onComponentPositionChange,
      onDeleteComponent,
      onImageEdit,
      onMergeComponents,
      onMultiSelect,
      onOpenImagePicker,
      onOpenAudioPicker,
      onSendToBack,
      onTextChange,
      onUnmergeGroup,
      onUpdateAction,
      onUpdateData,
      onUpdateProps,
      pageType,
      rankingOrderByComponent,
      onRankingChange,
      onRankingSubmit,
      matchingPairsByComponent,
      onMatchingChange,
      sliderValueByComponent,
      onSliderChange,
      roundedCorners,
      selectedAnswers,
      selectedComponentId,
      totalPages,
    ],
  );

  const renderTransitionPiece = useCallback(
    (
      slide: TransitionSlideSnapshot,
      pieceKey: string,
      clipPath: string,
      className: string,
      style?: React.CSSProperties,
    ) => (
      <div
        key={pieceKey}
        className={`ppt-transition-piece absolute inset-0 ${className}`}
        style={{ clipPath, ...style }}
      >
        <div className="absolute inset-0">
          {renderPageSurface(slide.components, slide.background, {
            interactive: false,
          })}
        </div>
      </div>
    ),
    [renderPageSurface],
  );

  const screenContent = useMemo(() => {
    const activeSlide = renderSlides[renderSlides.length - 1] ?? {
      key: resolvedTransitionKey,
      components: normalizedComponents,
      background,
    };

    if (
      !animateTransition ||
      renderSlides.length < 2 ||
      transitionEffect === "none"
    ) {
      return renderPageSurface(activeSlide.components, activeSlide.background);
    }

    const previousSlide = renderSlides[0]!;
    const nextSlide = renderSlides[1]!;
    const directionClass =
      transitionDirection === "forward" ? "ppt-forward" : "ppt-backward";
    const rootClass = `ppt-transition-root ppt-effect-${transitionEffect} ${directionClass}`;
    const durationStyle = {
      ["--ppt-transition-duration" as string]: `${transitionDuration}ms`,
    } as React.CSSProperties;

    if (transitionEffect === "curtains") {
      return (
        <div className={rootClass} style={durationStyle}>
          <div className="absolute inset-0 z-0">
            {renderPageSurface(nextSlide.components, nextSlide.background, {
              interactive: false,
            })}
          </div>
          {renderTransitionPiece(
            previousSlide,
            "curtain-left",
            "inset(0 50% 0 0)",
            "z-20 ppt-curtain-left",
          )}
          {renderTransitionPiece(
            previousSlide,
            "curtain-right",
            "inset(0 0 0 50%)",
            "z-20 ppt-curtain-right",
          )}
        </div>
      );
    }

    if (transitionEffect === "wind") {
      const clips = [
        "inset(0 83.333% 0 0)",
        "inset(0 66.666% 0 16.666%)",
        "inset(0 50% 0 33.333%)",
        "inset(0 33.333% 0 50%)",
        "inset(0 16.666% 0 66.666%)",
        "inset(0 0 0 83.333%)",
      ];

      return (
        <div className={rootClass} style={durationStyle}>
          <div className="absolute inset-0 z-0">
            {renderPageSurface(nextSlide.components, nextSlide.background, {
              interactive: false,
            })}
          </div>
          {clips.map((clipPath, index) =>
            renderTransitionPiece(
              previousSlide,
              `wind-${index}`,
              clipPath,
              "z-20 ppt-wind-strip",
              {
                animationDelay: `${index * 45}ms`,
              },
            ),
          )}
        </div>
      );
    }

    if (transitionEffect === "drape") {
      const clips = [
        "inset(0 80% 0 0)",
        "inset(0 60% 0 20%)",
        "inset(0 40% 0 40%)",
        "inset(0 20% 0 60%)",
        "inset(0 0 0 80%)",
      ];

      return (
        <div className={rootClass} style={durationStyle}>
          <div className="absolute inset-0 z-0">
            {renderPageSurface(nextSlide.components, nextSlide.background, {
              interactive: false,
            })}
          </div>
          {clips.map((clipPath, index) =>
            renderTransitionPiece(
              previousSlide,
              `drape-${index}`,
              clipPath,
              "z-20 ppt-drape-panel",
              {
                animationDelay: `${index * 55}ms`,
              },
            ),
          )}
        </div>
      );
    }

    if (
      transitionEffect === "fade" ||
      transitionEffect === "coverflow" ||
      transitionEffect === "flip" ||
      transitionEffect === "cards" ||
      transitionEffect === "push"
    ) {
      return (
        <div className={rootClass} style={durationStyle}>
          <div className="ppt-transition-next absolute inset-0 z-0">
            {renderPageSurface(nextSlide.components, nextSlide.background, {
              interactive: false,
            })}
          </div>
          <div className="ppt-transition-prev absolute inset-0 z-20">
            {renderPageSurface(
              previousSlide.components,
              previousSlide.background,
              {
                interactive: false,
              },
            )}
          </div>
          <div className="ppt-transition-shadow pointer-events-none absolute inset-0 z-30" />
        </div>
      );
    }

    return (
      <div className={rootClass} style={durationStyle}>
        <div className="ppt-transition-next absolute inset-0 z-0">
          {renderPageSurface(nextSlide.components, nextSlide.background, {
            interactive: false,
          })}
        </div>
        <div className="ppt-transition-prev absolute inset-0 z-20">
          {renderPageSurface(
            previousSlide.components,
            previousSlide.background,
            {
              interactive: false,
            },
          )}
        </div>
        <div className="ppt-transition-shadow pointer-events-none absolute inset-0 z-30" />
      </div>
    );
  }, [
    animateTransition,
    background,
    normalizedComponents,
    renderPageSurface,
    renderSlides,
    renderTransitionPiece,
    resolvedTransitionKey,
    transitionDirection,
    transitionDuration,
    transitionEffect,
  ]);

  // Frameless mode: render content directly without phone frame wrapper
  if (frameless) {
    return (
      <div ref={previewWrapperRef} className={`h-full w-full ${className}`}>
        {screenContent}
      </div>
    );
  }

  // Normal mode: render with phone frame
  return (
    <div
      ref={previewWrapperRef}
      className={`flex flex-col items-center justify-center ${className}`}
    >
      {/* Layout box sized to scaled dimensions to prevent stretching */}
      <div
        className="relative overflow-visible"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Scaled content wrapper */}
        <div
          className="relative"
          style={{
            transform: `scale(${effectiveScale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Phone Frame */}
          <div
            className={`h-[844px] w-[390px] bg-black p-[6px] shadow-2xl ${roundedCorners ? "rounded-[2.5rem]" : ""}`}
          >
            {screenContent}
          </div>
        </div>
      </div>
    </div>
  );
}
