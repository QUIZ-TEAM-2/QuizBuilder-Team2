"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
import {
  DEFAULT_RANKING_ITEM_BORDER_COLOR,
  DEFAULT_RANKING_ITEM_COLOR,
  DEFAULT_RANKING_ITEM_NODE_COLOR,
  DEFAULT_RANKING_ITEM_NODE_OPACITY,
  DEFAULT_RANKING_ITEM_TEXT_COLOR,
  getRankingItemLetter,
  RANKING_MAX_ITEMS,
  type RankingComponent,
  type RankingItem,
} from "./types";

export type RankingToolbarProps = ComponentToolbarProps<RankingComponent>;

const createItemId = () => `rank-${crypto.randomUUID()}`;

export function RankingToolbar({
  component,
  onUpdateProps,
  pageType,
}: RankingToolbarProps) {
  if (pageType !== "quiz") {
    return null;
  }

  const props = component.props ?? {};
  const items = Array.isArray(props.items)
    ? (props.items as RankingItem[]).slice(0, RANKING_MAX_ITEMS)
    : [];
  const canAddItem = items.length < RANKING_MAX_ITEMS;
  const itemColor =
    typeof props.itemColor === "string"
      ? props.itemColor
      : DEFAULT_RANKING_ITEM_COLOR;
  const itemNodeColor =
    typeof props.itemNodeColor === "string"
      ? props.itemNodeColor
      : DEFAULT_RANKING_ITEM_NODE_COLOR;
  const itemNodeOpacity =
    typeof props.itemNodeOpacity === "number"
      ? Math.max(0, Math.min(100, props.itemNodeOpacity))
      : typeof props.itemOpacity === "number"
        ? Math.max(0, Math.min(100, props.itemOpacity))
        : DEFAULT_RANKING_ITEM_NODE_OPACITY;
  const itemTextColor =
    typeof props.itemTextColor === "string"
      ? props.itemTextColor
      : itemColor || DEFAULT_RANKING_ITEM_TEXT_COLOR;
  const itemBorderColor =
    typeof props.itemBorderColor === "string"
      ? props.itemBorderColor
      : itemColor || DEFAULT_RANKING_ITEM_BORDER_COLOR;

  const handleItemLabelChange = (index: number, label: string) => {
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, label } : item,
    );
    onUpdateProps({ items: nextItems });
  };

  const handleAddItem = () => {
    if (!canAddItem) {
      return;
    }

    onUpdateProps({
      items: [
        ...items,
        {
          id: createItemId(),
          label: `Option ${getRankingItemLetter(items.length)}`,
        },
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    onUpdateProps({
      items: items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  return (
    <>
      <div className="flex min-w-[280px] flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs">Items</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={handleAddItem}
            disabled={!canAddItem}
            title={
              canAddItem
                ? "Add item"
                : `Ranking items are limited to ${RANKING_MAX_ITEMS}`
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <div className="flex max-h-[180px] flex-col gap-2 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-gray-50 text-xs font-semibold text-gray-600">
                {getRankingItemLetter(index)}
              </div>
              <Input
                value={item.label}
                onChange={(event) =>
                  handleItemLabelChange(index, event.target.value)
                }
                className="h-8 text-sm"
                placeholder={`Option ${getRankingItemLetter(index)}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => handleRemoveItem(index)}
                disabled={items.length <= 1}
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="h-8 w-px self-stretch bg-gray-200" />

      <div className="flex min-w-[260px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs">Node</Label>
            <input
              type="color"
              className="h-8 w-10 cursor-pointer rounded border p-1"
              value={itemNodeColor}
              onChange={(event) =>
                onUpdateProps({ itemNodeColor: event.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs">Text</Label>
            <input
              type="color"
              className="h-8 w-10 cursor-pointer rounded border p-1"
              value={itemTextColor}
              onChange={(event) =>
                onUpdateProps({ itemTextColor: event.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs">Border</Label>
            <input
              type="color"
              className="h-8 w-10 cursor-pointer rounded border p-1"
              value={itemBorderColor}
              onChange={(event) =>
                onUpdateProps({ itemBorderColor: event.target.value })
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-14 text-xs">Opacity</Label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={itemNodeOpacity}
            className="h-2 min-w-[120px] flex-1 accent-slate-900"
            onChange={(event) =>
              onUpdateProps({ itemNodeOpacity: Number(event.target.value) })
            }
          />
          <span className="w-10 text-right text-xs text-slate-500">
            {itemNodeOpacity}%
          </span>
        </div>
      </div>
    </>
  );
}

export default RankingToolbar;
