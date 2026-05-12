"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { ShapeComponent, ShapeVariant } from "./types";
import { SHAPE_VARIANTS, DEFAULT_SHAPE_PROPS, TRANSPARENT_COLOR } from "./types";

export interface ShapeToolbarProps {
  component: ShapeComponent;
  onUpdateProps: (props: Record<string, unknown>) => void;
}

export function ShapeToolbar({ component, onUpdateProps }: ShapeToolbarProps) {
  const props = component.props ?? {};
  const variant = (props.variant as ShapeVariant) ?? DEFAULT_SHAPE_PROPS.variant;
  const fillColor = props.fillColor as string | null | undefined;
  const strokeColor = props.strokeColor as string | null | undefined;
  const strokeWidth = (props.strokeWidth as number) ?? DEFAULT_SHAPE_PROPS.strokeWidth;
  const opacity = (props.opacity as number) ?? DEFAULT_SHAPE_PROPS.opacity;

  // Check if colors are transparent/none
  const isFillTransparent = fillColor === null || fillColor === TRANSPARENT_COLOR;
  const isStrokeTransparent = strokeColor === null || strokeColor === TRANSPARENT_COLOR;
  
  // Default solid colors (used when switching from none to solid)
  const DEFAULT_FILL_COLOR = "#3b82f6";
  const DEFAULT_STROKE_COLOR = "#1d4ed8";
  
  // Get display colors (default if undefined/transparent, or the actual color)
  const displayFillColor = isFillTransparent ? DEFAULT_FILL_COLOR : (fillColor ?? DEFAULT_FILL_COLOR);
  const displayStrokeColor = isStrokeTransparent ? DEFAULT_STROKE_COLOR : (strokeColor ?? DEFAULT_STROKE_COLOR);

  return (
    <>
      {/* Shape Variant */}
      <Select
        value={variant}
        onValueChange={(next) => onUpdateProps({ variant: next as ShapeVariant })}
      >
        <SelectTrigger className="h-8 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SHAPE_VARIANTS.map((shape) => (
            <SelectItem key={shape.variant} value={shape.variant}>
              <span className="flex items-center gap-2">
                <span>{shape.icon}</span>
                <span>{shape.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-gray-200" />

      {/* Fill Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative h-8 w-8 p-0 overflow-hidden"
            title="Fill color"
          >
            {isFillTransparent ? (
              // Checkerboard pattern for transparent
              <div className="absolute inset-0 bg-[length:8px_8px] bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%),linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%)] bg-[position:0_0,4px_4px]" />
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: displayFillColor }} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <Label className="text-xs">Fill Color</Label>
            <div className="flex gap-2">
              <Button
                variant={isFillTransparent ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onUpdateProps({ fillColor: TRANSPARENT_COLOR })}
              >
                None
              </Button>
              <Button
                variant={!isFillTransparent ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onUpdateProps({ fillColor: displayFillColor })}
              >
                Solid
              </Button>
            </div>
            {!isFillTransparent && (
              <Input
                type="color"
                value={displayFillColor}
                onChange={(e) => onUpdateProps({ fillColor: e.target.value })}
                className="h-10 w-full cursor-pointer"
              />
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Stroke Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Border/Stroke"
          >
            {isStrokeTransparent ? (
              // Show "no border" indicator
              <div className="h-5 w-5 rounded border-2 border-dashed border-gray-300" />
            ) : (
              <div
                className="h-5 w-5 rounded border-2"
                style={{ borderColor: displayStrokeColor, backgroundColor: "transparent" }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <Label className="text-xs">Border</Label>
            <div className="flex gap-2">
              <Button
                variant={isStrokeTransparent ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onUpdateProps({ strokeColor: TRANSPARENT_COLOR })}
              >
                None
              </Button>
              <Button
                variant={!isStrokeTransparent ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onUpdateProps({ strokeColor: displayStrokeColor })}
              >
                Solid
              </Button>
            </div>
            {!isStrokeTransparent && (
              <>
                <Input
                  type="color"
                  value={displayStrokeColor}
                  onChange={(e) => onUpdateProps({ strokeColor: e.target.value })}
                  className="h-10 w-full cursor-pointer"
                />
                <div className="space-y-2">
                  <Label className="text-xs">Border Width: {strokeWidth}px</Label>
                  <Slider
                    value={[strokeWidth]}
                    onValueChange={([value]) => onUpdateProps({ strokeWidth: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-gray-200" />

      {/* Opacity Slider */}
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Opacity: {opacity}%</Label>
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

export default ShapeToolbar;

