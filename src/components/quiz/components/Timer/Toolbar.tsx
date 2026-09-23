"use client";

import { useEffect, useState } from "react";
import { Square, SquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
import type { TimerComponent } from "./types";
import {
  DEFAULT_TIMER_PROPS,
  MAX_TIMER_DURATION,
  MIN_TIMER_DURATION,
  normalizeTimerDuration,
  normalizeTimerWarningAt,
} from "./types";

/**
 * Number box that lets you type freely and only applies (and clamps) the
 * value when you leave the field or press Enter. Clamping on every keystroke
 * would turn a half-typed "1" into the minimum before you finish typing "15".
 */
function NumberField({
  value,
  min,
  max,
  title,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  title: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className="h-8 w-20"
      title={title}
    />
  );
}

export function TimerToolbar({
  component,
  onUpdateProps,
}: ComponentToolbarProps<TimerComponent>) {
  const props = component.props ?? {};
  const duration = normalizeTimerDuration(props.duration);
  const warningAt = normalizeTimerWarningAt(props.warningAt, duration);
  const textColor =
    typeof props.textColor === "string"
      ? props.textColor
      : DEFAULT_TIMER_PROPS.textColor;
  const warningColor =
    typeof props.warningColor === "string"
      ? props.warningColor
      : DEFAULT_TIMER_PROPS.warningColor;
  const backgroundColor =
    typeof props.backgroundColor === "string"
      ? props.backgroundColor
      : DEFAULT_TIMER_PROPS.backgroundColor;
  const showBackground =
    typeof props.showBackground === "boolean"
      ? props.showBackground
      : DEFAULT_TIMER_PROPS.showBackground;

  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Seconds</Label>
        <NumberField
          value={duration}
          min={MIN_TIMER_DURATION}
          max={MAX_TIMER_DURATION}
          title="Countdown length in seconds"
          onCommit={(next) => onUpdateProps({ duration: next })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Warn at</Label>
        <NumberField
          value={warningAt}
          min={0}
          max={duration}
          title="Seconds remaining when the timer turns to the warning colour"
          onCommit={(next) => onUpdateProps({ warningAt: next })}
        />
      </div>
      <div className="h-6 w-px bg-gray-200" />
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Text</Label>
        <Input
          type="color"
          value={textColor}
          onChange={(event) => onUpdateProps({ textColor: event.target.value })}
          className="h-8 w-10 cursor-pointer p-1"
          title="Text colour"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Warning</Label>
        <Input
          type="color"
          value={warningColor}
          onChange={(event) =>
            onUpdateProps({ warningColor: event.target.value })
          }
          className="h-8 w-10 cursor-pointer p-1"
          title="Colour used once the warning time is reached"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Background</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(event) =>
            onUpdateProps({ backgroundColor: event.target.value })
          }
          className="h-8 w-10 cursor-pointer p-1"
          title="Background colour"
          disabled={!showBackground}
        />
      </div>
      <Button
        variant={showBackground ? "default" : "outline"}
        size="sm"
        onClick={() => onUpdateProps({ showBackground: !showBackground })}
        className="gap-1"
        title="Show or hide the timer background"
      >
        {showBackground ? (
          <Square className="h-4 w-4" />
        ) : (
          <SquareDashed className="h-4 w-4" />
        )}
        {showBackground ? "Filled" : "Transparent"}
      </Button>
    </>
  );
}

export default TimerToolbar;
