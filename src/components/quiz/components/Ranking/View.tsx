"use client";

import { GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RANKING_ITEM_BORDER_COLOR,
  DEFAULT_RANKING_ITEM_COLOR,
  DEFAULT_RANKING_ITEM_NODE_COLOR,
  DEFAULT_RANKING_ITEM_NODE_OPACITY,
  DEFAULT_RANKING_ITEM_TEXT_COLOR,
  getRankingItemLetter,
  RANKING_MAX_ITEMS,
  type RankingItem,
} from "./types";

export interface RankingViewProps {
  items: RankingItem[];
  itemColor?: string;
  itemNodeColor?: string;
  itemNodeOpacity?: number;
  itemTextColor?: string;
  itemBorderColor?: string;
  itemOpacity?: number;
  isEditable?: boolean;
  rankingOrder?: string[];
  onRankingChange?: (rankingOrder: string[]) => void;
}

function colorWithOpacity(color: string, opacity: number) {
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

const reorder = (items: string[], draggedId: string, targetId: string) => {
  if (draggedId === targetId) return items;
  const next = [...items];
  const from = next.indexOf(draggedId);
  const to = next.indexOf(targetId);
  if (from === -1 || to === -1) return items;
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
};

export function RankingView({
  items,
  itemColor = DEFAULT_RANKING_ITEM_COLOR,
  itemNodeColor = DEFAULT_RANKING_ITEM_NODE_COLOR,
  itemNodeOpacity,
  itemTextColor,
  itemBorderColor,
  itemOpacity,
  isEditable = false,
  rankingOrder,
  onRankingChange,
}: RankingViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const normalizedNodeOpacity =
    Math.max(
      0,
      Math.min(
        100,
        itemNodeOpacity ?? itemOpacity ?? DEFAULT_RANKING_ITEM_NODE_OPACITY,
      ),
    ) / 100;
  const nodeBackgroundColor = colorWithOpacity(
    itemNodeColor,
    normalizedNodeOpacity,
  );
  const resolvedTextColor =
    itemTextColor ?? itemColor ?? DEFAULT_RANKING_ITEM_TEXT_COLOR;
  const resolvedBorderColor =
    itemBorderColor ?? itemColor ?? DEFAULT_RANKING_ITEM_BORDER_COLOR;
  const displayItems = useMemo(
    () => items.slice(0, RANKING_MAX_ITEMS),
    [items],
  );
  const itemLetterById = useMemo(
    () =>
      new Map(
        displayItems.map((item, index) => [
          item.id,
          getRankingItemLetter(index),
        ]),
      ),
    [displayItems],
  );

  const orderedIds = useMemo(() => {
    const fallback = displayItems.map((item) => item.id);
    if (!rankingOrder || rankingOrder.length === 0) {
      return fallback;
    }
    const known = rankingOrder.filter((id) =>
      displayItems.some((item) => item.id === id),
    );
    const missing = fallback.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [displayItems, rankingOrder]);

  useEffect(() => {
    if (!isEditable && onRankingChange) {
      const normalized = displayItems.map((item) => item.id);
      if (!rankingOrder || rankingOrder.length === 0) {
        onRankingChange(normalized);
      }
    }
  }, [displayItems, isEditable, onRankingChange, rankingOrder]);

  const orderedItems = orderedIds
    .map((id) => displayItems.find((item) => item.id === id))
    .filter(Boolean) as RankingItem[];

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden rounded-2xl bg-transparent p-3 shadow-none">
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        {orderedItems.map((item) => (
          <div
            key={item.id}
            draggable={!isEditable}
            onDragStart={() => {
              if (!isEditable) setDraggedId(item.id);
            }}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => {
              if (!isEditable) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              if (isEditable || !draggedId) return;
              event.preventDefault();
              const next = reorder(orderedIds, draggedId, item.id);
              onRankingChange?.(next);
              setDraggedId(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
              !isEditable && "cursor-grab active:cursor-grabbing",
              draggedId === item.id && "opacity-60",
            )}
            style={{
              backgroundColor: nodeBackgroundColor,
              borderColor: resolvedBorderColor,
              color: resolvedTextColor,
            }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-semibold">
              {itemLetterById.get(item.id)}
            </div>
            <div className="min-w-0 flex-1 truncate text-sm font-medium">
              {item.label}
            </div>
            {!isEditable && <GripVertical className="h-4 w-4 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RankingView;
