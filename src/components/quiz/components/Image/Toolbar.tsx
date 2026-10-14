"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_IMAGE_OPACITY } from "./types";
import type { ImageComponent } from "./types";

export interface ImageToolbarProps {
  component: ImageComponent;
  onUpdateProps: (props: Record<string, unknown>) => void;
  onOpenImagePicker?: () => void;
}

export function ImageToolbar({
  component,
  onUpdateProps,
  onOpenImagePicker,
}: ImageToolbarProps) {
  const props = component.props ?? {};
  const opacity =
    typeof props.opacity === "number"
      ? Math.min(100, Math.max(0, props.opacity))
      : DEFAULT_IMAGE_OPACITY;
  const savedAlt = typeof props.alt === "string" ? props.alt : "";
  const [alt, setAlt] = useState(savedAlt);
  useEffect(() => setAlt(savedAlt), [savedAlt]);
  const commitAlt = () => {
    const next = alt.replace(/\s+/g, " ").trim().slice(0, 150);
    if (next !== savedAlt) onUpdateProps({ alt: next });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={onOpenImagePicker}>
        Change Image
      </Button>
      <div className="h-6 w-px bg-gray-200" />
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Opacity: {opacity}%</Label>
        <Slider
          value={[opacity]}
          onValueChange={([value]) => onUpdateProps({ opacity: value })}
          min={0}
          max={100}
          step={5}
          className="w-24"
        />
      </div>
      <div className="h-6 w-px bg-gray-200" />
      <div className="flex items-center gap-2">
        <Label htmlFor={`image-alt-${component.id}`} className="whitespace-nowrap text-xs">
          Alt text
        </Label>
        <input
          id={`image-alt-${component.id}`}
          value={alt}
          maxLength={150}
          placeholder="Describe the image"
          title="Read out by screen readers. Leave empty if the image is only decoration."
          onChange={(event) => setAlt(event.target.value)}
          onBlur={commitAlt}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") commitAlt();
          }}
          className="h-8 w-40 rounded-md border border-gray-200 px-2 text-xs"
        />
      </div>
    </>
  );
}

export default ImageToolbar;
