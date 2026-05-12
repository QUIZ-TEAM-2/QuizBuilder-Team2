"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MATCHING_BORDER_COLOR,
  DEFAULT_MATCHING_LEFT_NODES,
  DEFAULT_MATCHING_LINE_COLOR,
  DEFAULT_MATCHING_NODE_COLOR,
  DEFAULT_MATCHING_NODE_OPACITY,
  DEFAULT_MATCHING_RIGHT_NODES,
  DEFAULT_MATCHING_TEXT_COLOR,
  type MatchingComponent,
  type MatchingNode,
} from "./types";

export interface MatchingViewProps {
  leftNodes: MatchingNode[];
  rightNodes: MatchingNode[];
  nodeColor?: string;
  nodeOpacity?: number;
  textColor?: string;
  borderColor?: string;
  lineColor?: string;
  isEditable?: boolean;
  currentPairs?: Record<string, string>;
  onPairsChange?: (pairs: Record<string, string>) => void;
  onDeletePair?: (leftId: string) => void;
}

interface ConnectionDragState {
  side: "left" | "right";
  itemId: string;
  startX: number;
  startY: number;
}

function getCenterPoint(
  element: HTMLElement | null,
  container: HTMLElement | null,
) {
  if (!element || !container) return null;
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Handle scaling (e.g. from PhonePreview transform: scale)
  const scaleX =
    container.offsetWidth > 0 ? containerRect.width / container.offsetWidth : 1;
  const scaleY =
    container.offsetHeight > 0
      ? containerRect.height / container.offsetHeight
      : 1;

  return {
    x: (elementRect.left + elementRect.width / 2 - containerRect.left) / scaleX,
    y: (elementRect.top + elementRect.height / 2 - containerRect.top) / scaleY,
  };
}

function colorWithOpacity(color: string, opacity: number) {
  if (color === "transparent") {
    return "transparent";
  }

  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  const isShortHex = /^[0-9a-fA-F]{3}$/.test(hex);
  const isLongHex = /^[0-9a-fA-F]{6}$/.test(hex);

  if (!isShortHex && !isLongHex) {
    return color;
  }

  const expandedHex = isShortHex
    ? hex
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : hex;
  const red = parseInt(expandedHex.slice(0, 2), 16);
  const green = parseInt(expandedHex.slice(2, 4), 16);
  const blue = parseInt(expandedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function MatchingView({
  leftNodes,
  rightNodes,
  nodeColor = DEFAULT_MATCHING_NODE_COLOR,
  nodeOpacity = DEFAULT_MATCHING_NODE_OPACITY,
  textColor = DEFAULT_MATCHING_TEXT_COLOR,
  borderColor = DEFAULT_MATCHING_BORDER_COLOR,
  lineColor = DEFAULT_MATCHING_LINE_COLOR,
  isEditable = false,
  currentPairs = {},
  onPairsChange,
  onDeletePair,
}: MatchingViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<string, HTMLElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLElement | null>>({});
  const [dragState, setDragState] = useState<ConnectionDragState | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [lineAnchor, setLineAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const interactive = isEditable || Boolean(onPairsChange);
  const normalizedNodeOpacity = Math.max(0, Math.min(100, nodeOpacity)) / 100;
  const nodeBackgroundColor = colorWithOpacity(
    nodeColor,
    normalizedNodeOpacity,
  );

  const clearExistingPairForLeft = useCallback(
    (leftId: string) => {
      if (!currentPairs[leftId]) return;
      const next = { ...currentPairs };
      delete next[leftId];
      onPairsChange?.(next);
    },
    [currentPairs, onPairsChange],
  );

  const clearExistingPairForRight = useCallback(
    (rightId: string) => {
      const leftKey = Object.entries(currentPairs).find(
        ([, mappedRight]) => mappedRight === rightId,
      )?.[0];
      if (!leftKey) return;
      const next = { ...currentPairs };
      delete next[leftKey];
      onPairsChange?.(next);
    },
    [currentPairs, onPairsChange],
  );

  const handleStartDrag = useCallback(
    (
      side: "left" | "right",
      itemId: string,
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      if (!interactive) return;
      event.preventDefault();
      event.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const center = getCenterPoint(
        side === "left"
          ? leftRefs.current[itemId]!
          : rightRefs.current[itemId]!,
        container,
      );
      if (!center) return;

      if (side === "left") {
        clearExistingPairForLeft(itemId);
      } else {
        clearExistingPairForRight(itemId);
      }

      setDragState({ side, itemId, startX: center.x, startY: center.y });
      setLineAnchor(center);
      setCursorPosition({ x: center.x, y: center.y });
    },
    [clearExistingPairForLeft, clearExistingPairForRight, interactive],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragState || !containerRef.current) return;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      const scaleX =
        container.offsetWidth > 0
          ? containerRect.width / container.offsetWidth
          : 1;
      const scaleY =
        container.offsetHeight > 0
          ? containerRect.height / container.offsetHeight
          : 1;

      setCursorPosition({
        x: (event.clientX - containerRect.left) / scaleX,
        y: (event.clientY - containerRect.top) / scaleY,
      });
    },
    [dragState],
  );

  const completeConnection = useCallback(
    (targetSide: "left" | "right", targetId: string) => {
      if (!dragState || !onPairsChange) return;
      if (dragState.side === targetSide) {
        setDragState(null);
        setCursorPosition(null);
        setLineAnchor(null);
        return;
      }

      const leftId = dragState.side === "left" ? dragState.itemId : targetId;
      const rightId = dragState.side === "right" ? dragState.itemId : targetId;
      const next = { ...currentPairs };

      // Remove existing right-side mapping if present
      const existingLeftForRight = Object.entries(next).find(
        ([, mappedRight]) => mappedRight === rightId,
      )?.[0];
      if (existingLeftForRight) {
        delete next[existingLeftForRight];
      }

      next[leftId] = rightId;
      onPairsChange(next);
      setDragState(null);
      setCursorPosition(null);
      setLineAnchor(null);
    },
    [currentPairs, dragState, onPairsChange],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (!dragState) return;

      // Check if we released over a node
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const nodeElement = element?.closest("[data-node-id]");

      if (nodeElement) {
        const targetId = nodeElement.getAttribute("data-node-id")!;
        const targetSide = nodeElement.getAttribute("data-node-side") as
          | "left"
          | "right";
        completeConnection(targetSide, targetId);
      }

      setDragState(null);
      setCursorPosition(null);
      setLineAnchor(null);
    },
    [dragState, completeConnection],
  );

  useEffect(() => {
    if (!dragState) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, handlePointerMove, handlePointerUp]);

  const lineSegments = useMemo(() => {
    if (!containerRef.current) return [];
    return Object.entries(currentPairs)
      .map(([leftId, rightId]) => {
        const leftCenter = getCenterPoint(
          leftRefs.current[leftId]!,
          containerRef.current,
        );
        const rightCenter = getCenterPoint(
          rightRefs.current[rightId]!,
          containerRef.current,
        );
        if (!leftCenter || !rightCenter) return null;
        return { leftId, rightId, from: leftCenter, to: rightCenter };
      })
      .filter(Boolean) as Array<{
      leftId: string;
      rightId: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }>;
  }, [currentPairs]);

  const dragLine = useMemo(() => {
    if (!dragState || !lineAnchor || !cursorPosition) return null;
    return {
      from: lineAnchor,
      to: cursorPosition,
    };
  }, [dragState, cursorPosition, lineAnchor]);

  const handleLineDoubleClick = useCallback(
    (leftId: string) => {
      onDeletePair?.(leftId);
    },
    [onDeletePair],
  );

  return (
    <div
      className="relative h-full w-full touch-none overflow-hidden rounded-3xl p-3"
      ref={containerRef}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
        style={{ zIndex: 10 }}
      >
        {lineSegments.map((segment) => (
          <g
            key={`${segment.leftId}-${segment.rightId}`}
            className={cn(
              dragState ? "pointer-events-none" : "pointer-events-auto",
            )}
          >
            <path
              d={`M ${segment.from.x} ${segment.from.y} C ${segment.from.x + 80} ${segment.from.y} ${segment.to.x - 80} ${segment.to.y} ${segment.to.x} ${segment.to.y}`}
              stroke={lineColor}
              strokeWidth="3"
              fill="none"
              className="cursor-pointer"
              onDoubleClick={() => handleLineDoubleClick(segment.leftId)}
            />
            <circle
              cx={segment.to.x}
              cy={segment.to.y}
              r="6"
              fill={lineColor}
            />
          </g>
        ))}
        {dragLine ? (
          <path
            d={`M ${dragLine.from.x} ${dragLine.from.y} C ${dragLine.from.x + 80} ${dragLine.from.y} ${dragLine.to.x - 80} ${dragLine.to.y} ${dragLine.to.x} ${dragLine.to.y}`}
            stroke={lineColor}
            strokeWidth="3"
            fill="none"
            strokeDasharray="8 6"
            className="pointer-events-none"
          />
        ) : null}
      </svg>

      <div className="relative flex h-full gap-4">
        <div className="flex min-w-[35%] flex-col gap-3">
          {leftNodes.map((node) => {
            const isConnected = Boolean(currentPairs[node.id]);

            return (
              <button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-side="left"
                onPointerDown={(event) =>
                  handleStartDrag("left", node.id, event)
                }
                className="relative z-20 touch-none rounded-2xl border px-3 py-4 text-left text-sm font-medium transition"
                style={{
                  backgroundColor: nodeBackgroundColor,
                  borderColor: isConnected ? lineColor : borderColor,
                  color: textColor,
                  boxShadow: isConnected
                    ? `0 0 0 1px ${lineColor} inset`
                    : undefined,
                }}
              >
                <div className="pointer-events-none flex items-center justify-between gap-2">
                  <span>{node.label}</span>
                  <div
                    ref={(el) => {
                      leftRefs.current[node.id] = el;
                    }}
                  >
                    <Circle
                      className="h-3.5 w-3.5"
                      style={{ color: lineColor }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1" />

        <div className="flex min-w-[35%] flex-col gap-3">
          {rightNodes.map((node) => {
            const isConnected = Object.values(currentPairs).includes(node.id);

            return (
              <button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-side="right"
                onPointerDown={(event) =>
                  handleStartDrag("right", node.id, event)
                }
                className="relative z-20 touch-none rounded-2xl border px-3 py-4 text-left text-sm font-medium transition"
                style={{
                  backgroundColor: nodeBackgroundColor,
                  borderColor: isConnected ? lineColor : borderColor,
                  color: textColor,
                  boxShadow: isConnected
                    ? `0 0 0 1px ${lineColor} inset`
                    : undefined,
                }}
              >
                <div className="pointer-events-none flex items-center justify-start gap-2">
                  <div
                    ref={(el) => {
                      rightRefs.current[node.id] = el;
                    }}
                  >
                    <Circle
                      className="h-3.5 w-3.5"
                      style={{ color: lineColor }}
                    />
                  </div>
                  <span>{node.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MatchingViewWrapper({
  component,
  helpers,
}: {
  component: MatchingComponent;
  helpers: {
    isEditable: boolean;
    matchingPairs?: Record<string, string>;
    onMatchingChange?: (
      componentId: string,
      pairs: Record<string, string>,
    ) => void;
  };
}) {
  const props = component.props ?? {};
  const leftNodes =
    Array.isArray(props.leftNodes) && props.leftNodes.length > 0
      ? (props.leftNodes as MatchingNode[])
      : DEFAULT_MATCHING_LEFT_NODES;
  const rightNodes =
    Array.isArray(props.rightNodes) && props.rightNodes.length > 0
      ? (props.rightNodes as MatchingNode[])
      : DEFAULT_MATCHING_RIGHT_NODES;

  const [localPairs, setLocalPairs] = useState<Record<string, string>>({});

  // Initialize and sync with external state if provided (e.g. in Player)
  useEffect(() => {
    if (helpers.matchingPairs) {
      setLocalPairs(helpers.matchingPairs);
    }
  }, [helpers.matchingPairs]);

  // Reset when component changes
  useEffect(() => {
    if (!helpers.matchingPairs) {
      setLocalPairs({});
    }
  }, [component.id, helpers.matchingPairs]);

  const handlePairsChange = (nextPairs: Record<string, string>) => {
    setLocalPairs(nextPairs);
    helpers.onMatchingChange?.(component.id, nextPairs);
  };

  const handleDeletePair = (leftId: string) => {
    const next = { ...localPairs };
    delete next[leftId];
    setLocalPairs(next);
    helpers.onMatchingChange?.(component.id, next);
  };

  return (
    <MatchingView
      leftNodes={leftNodes}
      rightNodes={rightNodes}
      nodeColor={
        typeof props.nodeColor === "string" && props.nodeColor !== "transparent"
          ? props.nodeColor
          : DEFAULT_MATCHING_NODE_COLOR
      }
      nodeOpacity={
        typeof props.nodeOpacity === "number"
          ? props.nodeOpacity
          : DEFAULT_MATCHING_NODE_OPACITY
      }
      textColor={
        typeof props.textColor === "string"
          ? props.textColor
          : DEFAULT_MATCHING_TEXT_COLOR
      }
      borderColor={
        typeof props.borderColor === "string"
          ? props.borderColor
          : DEFAULT_MATCHING_BORDER_COLOR
      }
      lineColor={
        typeof props.lineColor === "string"
          ? props.lineColor
          : DEFAULT_MATCHING_LINE_COLOR
      }
      isEditable={helpers.isEditable || Boolean(helpers.onMatchingChange)}
      currentPairs={localPairs}
      onPairsChange={helpers.onMatchingChange ? handlePairsChange : undefined}
      onDeletePair={helpers.onMatchingChange ? handleDeletePair : undefined}
    />
  );
}

export default MatchingViewWrapper;
