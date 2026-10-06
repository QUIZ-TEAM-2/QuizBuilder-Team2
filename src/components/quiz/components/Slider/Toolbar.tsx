"use client";

import { SlidersHorizontal, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
import {
  DEFAULT_SLIDER_RANGE_COLOR,
  DEFAULT_SLIDER_STAR_COLOR,
  DEFAULT_SLIDER_TEXT_COLOR,
  DEFAULT_SLIDER_TRACK_COLOR,
  normalizeSliderConfig,
  normalizeSliderVariant,
  type SliderComponent,
} from "./types";

export function SliderToolbar({
  component,
  onUpdateProps,
  pageType,
}: ComponentToolbarProps<SliderComponent>) {
  if (pageType !== "quiz") {
    return null;
  }

  const props = component.props ?? {};
  const { min, max, defaultValue } = normalizeSliderConfig(props);
  const trackColor =
    typeof props.trackColor === "string"
      ? props.trackColor
      : DEFAULT_SLIDER_TRACK_COLOR;
  const rangeColor =
    typeof props.rangeColor === "string"
      ? props.rangeColor
      : DEFAULT_SLIDER_RANGE_COLOR;
  const textColor =
    typeof props.textColor === "string"
      ? props.textColor
      : DEFAULT_SLIDER_TEXT_COLOR;
  const showValue = props.showValue !== false;
  const variant = normalizeSliderVariant(props.variant);
  const starColor =
    typeof props.starColor === "string"
      ? props.starColor
      : DEFAULT_SLIDER_STAR_COLOR;
  const colorControls =
    variant === "stars"
      ? ([
          ["Stars", "starColor", starColor],
          ["Text", "textColor", textColor],
        ] as const)
      : ([
          ["Track", "trackColor", trackColor],
          ["Fill", "rangeColor", rangeColor],
          ["Text", "textColor", textColor],
        ] as const);

  const updateNumber = (key: string, value: string) => {
    const numeric = Number(value);
    const integerValue = Math.round(numeric);
    const nextValue = key === "min" ? Math.max(0, integerValue) : integerValue;

    onUpdateProps({
      [key]: Number.isFinite(nextValue) ? nextValue : props[key],
    });
  };

  return (
    <>
      <div className="flex items-center gap-1" title="Show as a slider or a star rating">
        <Button
          variant={variant === "slider" ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => onUpdateProps({ variant: "slider" })}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Slider
        </Button>
        <Button
          variant={variant === "stars" ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => onUpdateProps({ variant: "stars" })}
        >
          <Star className="h-4 w-4" />
          Stars
        </Button>
      </div>

      <div className="h-8 w-px self-stretch bg-gray-200" />

      <div className="grid min-w-[320px] grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Min</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={min}
            onChange={(event) => updateNumber("min", event.target.value)}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Max</Label>
          <Input
            type="number"
            step={1}
            value={max}
            onChange={(event) => updateNumber("max", event.target.value)}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Default</Label>
          <Input
            type="number"
            min={min}
            max={max}
            step={1}
            value={defaultValue}
            onChange={(event) =>
              updateNumber("defaultValue", event.target.value)
            }
            className="h-8"
          />
        </div>
      </div>

      <div className="h-8 w-px self-stretch bg-gray-200" />

      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Show labels</Label>
        <input
          type="checkbox"
          checked={showValue}
          onChange={(event) =>
            onUpdateProps({ showValue: event.target.checked })
          }
          className="h-4 w-4"
        />
      </div>

      <div className="h-8 w-px self-stretch bg-gray-200" />

      <div className="flex items-center gap-2">
        {colorControls.map(([label, key, value]) => (
          <label
            key={key}
            className="flex flex-col items-center gap-1 text-[10px] text-gray-500"
          >
            {label}
            <input
              type="color"
              value={value}
              onChange={(event) => onUpdateProps({ [key]: event.target.value })}
              className="h-8 w-9 cursor-pointer rounded border p-1"
            />
          </label>
        ))}
      </div>
    </>
  );
}

export default SliderToolbar;
