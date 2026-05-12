"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
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

export type MatchingToolbarProps = ComponentToolbarProps<MatchingComponent>;

const createNodeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="whitespace-nowrap text-xs">{label}</Label>
      <input
        type="color"
        className="h-8 w-10 cursor-pointer rounded border p-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function MatchingToolbar({
  component,
  onUpdateProps,
  pageType,
}: MatchingToolbarProps) {
  if (pageType !== "quiz") {
    return null;
  }

  const props = component.props ?? {};
  const leftNodes = Array.isArray(props.leftNodes)
    ? (props.leftNodes as MatchingNode[])
    : DEFAULT_MATCHING_LEFT_NODES;
  const rightNodes = Array.isArray(props.rightNodes)
    ? (props.rightNodes as MatchingNode[])
    : DEFAULT_MATCHING_RIGHT_NODES;
  const nodeColor =
    typeof props.nodeColor === "string" && props.nodeColor !== "transparent"
      ? props.nodeColor
      : DEFAULT_MATCHING_NODE_COLOR;
  const nodeOpacity =
    typeof props.nodeOpacity === "number"
      ? Math.max(0, Math.min(100, props.nodeOpacity))
      : DEFAULT_MATCHING_NODE_OPACITY;
  const textColor =
    typeof props.textColor === "string"
      ? props.textColor
      : DEFAULT_MATCHING_TEXT_COLOR;
  const borderColor =
    typeof props.borderColor === "string"
      ? props.borderColor
      : DEFAULT_MATCHING_BORDER_COLOR;
  const lineColor =
    typeof props.lineColor === "string"
      ? props.lineColor
      : DEFAULT_MATCHING_LINE_COLOR;

  const updateLeftNodes = (nextLeftNodes: MatchingNode[]) => {
    onUpdateProps({ leftNodes: nextLeftNodes });
  };

  const updateRightNodes = (nextRightNodes: MatchingNode[]) => {
    onUpdateProps({ rightNodes: nextRightNodes });
  };

  const handleLeftLabelChange = (index: number, label: string) => {
    updateLeftNodes(
      leftNodes.map((node, itemIndex) =>
        itemIndex === index ? { ...node, label } : node,
      ),
    );
  };

  const handleRightLabelChange = (index: number, label: string) => {
    updateRightNodes(
      rightNodes.map((node, itemIndex) =>
        itemIndex === index ? { ...node, label } : node,
      ),
    );
  };

  const handleAddLeft = () => {
    if (leftNodes.length >= 5) return;
    const labels = ["a", "b", "c", "d", "e"];
    updateLeftNodes([
      ...leftNodes,
      {
        id: createNodeId("left"),
        label: labels[leftNodes.length] ?? `node-${leftNodes.length + 1}`,
      },
    ]);
  };

  const handleAddRight = () => {
    if (rightNodes.length >= 5) return;
    const labels = ["A", "B", "C", "D", "E"];
    updateRightNodes([
      ...rightNodes,
      {
        id: createNodeId("right"),
        label: labels[rightNodes.length] ?? `Node-${rightNodes.length + 1}`,
      },
    ]);
  };

  const handleRemoveLeft = (index: number) => {
    if (leftNodes.length <= 1) return;
    updateLeftNodes(leftNodes.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleRemoveRight = (index: number) => {
    if (rightNodes.length <= 1) return;
    updateRightNodes(rightNodes.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="flex min-w-[320px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ColorControl
          label="Node"
          value={nodeColor}
          onChange={(value) => onUpdateProps({ nodeColor: value })}
        />
        <ColorControl
          label="Text"
          value={textColor}
          onChange={(value) => onUpdateProps({ textColor: value })}
        />
        <ColorControl
          label="Border"
          value={borderColor}
          onChange={(value) => onUpdateProps({ borderColor: value })}
        />
        <ColorControl
          label="Line"
          value={lineColor}
          onChange={(value) => onUpdateProps({ lineColor: value })}
        />
      </div>

      <div className="flex items-center gap-3">
        <Label className="w-16 text-xs">Opacity</Label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={nodeOpacity}
          className="h-2 min-w-[160px] flex-1 accent-slate-900"
          onChange={(event) =>
            onUpdateProps({ nodeOpacity: Number(event.target.value) })
          }
        />
        <span className="w-10 text-right text-xs text-slate-500">
          {nodeOpacity}%
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Left items</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={handleAddLeft}
              disabled={leftNodes.length >= 5}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {leftNodes.map((node, index) => (
              <div key={node.id} className="flex items-center gap-2">
                <Input
                  value={node.label}
                  onChange={(event) =>
                    handleLeftLabelChange(index, event.target.value)
                  }
                  className="h-8 text-sm"
                  placeholder={`Left ${index + 1}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                  onClick={() => handleRemoveLeft(index)}
                  disabled={leftNodes.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Right items</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={handleAddRight}
              disabled={rightNodes.length >= 5}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {rightNodes.map((node, index) => (
              <div key={node.id} className="flex items-center gap-2">
                <Input
                  value={node.label}
                  onChange={(event) =>
                    handleRightLabelChange(index, event.target.value)
                  }
                  className="h-8 text-sm"
                  placeholder={`Right ${index + 1}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                  onClick={() => handleRemoveRight(index)}
                  disabled={rightNodes.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchingToolbar;
