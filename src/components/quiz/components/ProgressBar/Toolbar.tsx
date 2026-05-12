"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
import {
  PROGRESS_BAR_VARIANTS,
  type ProgressBarComponent,
  type ProgressBarVariant,
} from "./types";

export type ProgressBarToolbarProps =
  ComponentToolbarProps<ProgressBarComponent>;

export function ProgressBarToolbar({
  component,
  onUpdateProps,
  pageType,
}: ProgressBarToolbarProps) {
  if (pageType !== "quiz") {
    return null;
  }

  const props = component.props ?? {};
  const variant =
    props.variant === "dots" ||
    props.variant === "rainbow" ||
    props.variant === "numeric"
      ? (props.variant as ProgressBarVariant)
      : "rainbow";
  const currentColor =
    typeof props.currentColor === "string" ? props.currentColor : "#d8b4fe";
  const totalColor =
    typeof props.totalColor === "string" ? props.totalColor : "#f8fafc";

  return (
    <>
      <Select
        value={variant}
        onValueChange={(next) =>
          onUpdateProps({ variant: next as ProgressBarVariant })
        }
      >
        <SelectTrigger className="h-8 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROGRESS_BAR_VARIANTS.map((item) => (
            <SelectItem key={item.variant} value={item.variant}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-gray-200" />

      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">
          {variant === "dots" ? "Dot" : "X"}
        </Label>
        <Input
          type="color"
          className="h-8 w-10 cursor-pointer p-1"
          value={currentColor}
          onChange={(event) =>
            onUpdateProps({ currentColor: event.target.value })
          }
        />
      </div>

      {(variant === "rainbow" || variant === "numeric") && (
        <>
          <div className="h-6 w-px bg-gray-200" />

          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Y</Label>
            <Input
              type="color"
              className="h-8 w-10 cursor-pointer p-1"
              value={totalColor}
              onChange={(event) =>
                onUpdateProps({ totalColor: event.target.value })
              }
            />
          </div>
        </>
      )}
    </>
  );
}

export default ProgressBarToolbar;
