"use client";

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
    </>
  );
}

export default ImageToolbar;
