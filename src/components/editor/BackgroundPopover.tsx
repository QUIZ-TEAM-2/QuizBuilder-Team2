"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useQuery } from "convex/react";
import { Image as ImageIcon, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import type { PageBackground } from "@/types";
import { api } from "../../../convex/_generated/api";

export interface BackgroundPopoverProps {
  background?: PageBackground;
  onBackgroundChange: (bg: PageBackground) => void;
}

export function BackgroundPopover({
  background,
  onBackgroundChange,
}: BackgroundPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const imagesQuery = useQuery(api.images.getUserImages);

  const color = background?.color ?? "#ffffff";
  const image = background?.image ?? "";
  const imageOpacity =
    typeof background?.imageOpacity === "number"
      ? Math.min(1, Math.max(0, background.imageOpacity))
      : 1;

  // Auto-save color changes
  const handleColorChange = (newColor: string) => {
    onBackgroundChange({ ...background, color: newColor || undefined });
  };

  // Auto-save image changes
  const handleImageChange = (newImage: string) => {
    onBackgroundChange({ ...background, image: newImage || undefined });
  };

  const handleImageOpacityChange = (nextOpacity: number) => {
    onBackgroundChange({
      ...background,
      imageOpacity: Math.min(1, Math.max(0, nextOpacity)),
    });
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <ImageIcon className="h-4 w-4" />
            Background
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Page Background</h4>
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-8 w-12 p-1"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#ffffff"
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background Image</Label>
              <div
                className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 bg-cover bg-center"
                aria-label="Background image preview"
              >
                {image ? (
                  <Image
                    src={image}
                    alt="Background preview"
                    fill
                    className="object-cover"
                    draggable={false}
                    sizes="(max-width: 768px) 100vw, 320px"
                    style={{ opacity: imageOpacity }}
                  />
                ) : (
                  <ImageIcon className="h-7 w-7 text-gray-400" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setIsOpen(false);
                    setIsPickerOpen(true);
                  }}
                >
                  <ImageIcon className="h-4 w-4" />
                  Choose
                </Button>
                {image ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-gray-500 hover:text-red-600"
                    onClick={() => handleImageChange("")}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            {image ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs">Image Opacity</Label>
                  <span className="text-xs tabular-nums text-gray-500">
                    {Math.round(imageOpacity * 100)}%
                  </span>
                </div>
                <Slider
                  value={[imageOpacity]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([value]) =>
                    handleImageOpacityChange(value ?? 1)
                  }
                  aria-label="Background image opacity"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-xs">Image URL</Label>
              <Input
                type="text"
                value={image}
                onChange={(e) => handleImageChange(e.target.value)}
                placeholder="https://..."
                className="h-8"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <ImagePickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        images={imagesQuery ?? []}
        onImageSelect={(url) => handleImageChange(url)}
      />
    </>
  );
}

export default BackgroundPopover;
