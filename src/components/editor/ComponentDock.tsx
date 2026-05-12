"use client";

import React, { useState } from "react";
import {
  Type,
  Image as ImageIcon,
  Shapes,
  ListOrdered,
  Edit3,
  Shuffle,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SHAPE_VARIANTS,
  type ShapeVariant,
} from "@/components/quiz/components/Shape/types";
import { ShapeView } from "@/components/quiz/components/Shape/View";
import type { QuestionMode } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComponentDockProps {
  className?: string;
  pageType?: "quiz" | "result" | "onboarding";
  questionMode?: QuestionMode;
}

export function ComponentDock({
  className,
  pageType = "quiz",
  questionMode,
}: ComponentDockProps) {
  const [isShapesOpen, setIsShapesOpen] = useState(false);
  const showInput = !questionMode || questionMode === "fill-in-blank";
  const showRanking = !questionMode || questionMode === "ranking";
  const showMatching = !questionMode || questionMode === "matching";
  const showSlider = !questionMode || questionMode === "slider";

  const handleTextDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "text");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleImageDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "image");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleShapeDragStart = (e: React.DragEvent, variant: ShapeVariant) => {
    e.dataTransfer.setData("componentType", "shape");
    e.dataTransfer.setData("shapeVariant", variant);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleProgressBarDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "progressBar");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleRankingDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "ranking");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleInputDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "input");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleMatchingDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "matching");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleSliderDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", "slider");
    e.dataTransfer.effectAllowed = "copy";
  };

  const baseIconClass = cn(
    "flex h-11 w-11 cursor-grab items-center justify-center rounded-lg",
    "bg-gray-100 text-gray-600 transition-all hover:bg-blue-100 hover:text-blue-600",
    "active:scale-95 active:cursor-grabbing",
  );

  const shapeVariantClass = cn(
    "flex h-10 w-10 cursor-grab items-center justify-center rounded-lg",
    "bg-gray-50 text-gray-600 transition-all hover:bg-blue-100 hover:text-blue-600",
    "active:scale-95 active:cursor-grabbing border border-gray-200",
  );

  return (
    <div className={cn("sticky left-4 top-4 z-10", className)}>
      {/* Main dock - vertical arrangement */}
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-3 shadow-lg">
        {/* Text Icon */}
        <div
          draggable
          onDragStart={handleTextDragStart}
          className={baseIconClass}
          title="Drag to add Text"
        >
          <Type className="h-5 w-5" />
        </div>

        {/* Image Icon */}
        <div
          draggable
          onDragStart={handleImageDragStart}
          className={baseIconClass}
          title="Drag to add Image"
        >
          <ImageIcon className="h-5 w-5" />
        </div>

        {/* Shapes with Popover */}
        <Popover open={isShapesOpen} onOpenChange={setIsShapesOpen}>
          <PopoverTrigger asChild>
            <div
              className={cn(
                baseIconClass,
                "cursor-pointer",
                isShapesOpen && "bg-blue-100 text-blue-600",
              )}
              title="Click to show shapes"
            >
              <Shapes className="h-5 w-5" />
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="center"
            sideOffset={8}
            className="w-auto p-3"
          >
            {/* Shape variants - horizontal row */}
            <div className="flex items-center gap-1.5">
              {SHAPE_VARIANTS.map((shape) => (
                <div
                  key={shape.variant}
                  draggable
                  onDragStart={(e) => handleShapeDragStart(e, shape.variant)}
                  className={shapeVariantClass}
                  title={`Drag to add ${shape.label}`}
                >
                  <div className="h-6 w-6">
                    <ShapeView
                      variant={shape.variant}
                      fillColor="#3b82f6"
                      strokeColor="#1d4ed8"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {pageType === "quiz" && (
          <div
            draggable
            onDragStart={handleProgressBarDragStart}
            className={baseIconClass}
            title="Drag to add Progress"
          >
            <span className="text-sm font-semibold tracking-tight">P</span>
          </div>
        )}
        {pageType === "quiz" && showInput && (
          <div
            draggable
            onDragStart={handleInputDragStart}
            className={baseIconClass}
            title="Drag to add Input"
          >
            <Edit3 className="h-5 w-5" />
          </div>
        )}
        {pageType === "quiz" && showMatching && (
          <div
            draggable
            onDragStart={handleMatchingDragStart}
            className={baseIconClass}
            title="Drag to add Matching"
          >
            <Shuffle className="h-5 w-5" />
          </div>
        )}
        {pageType === "quiz" && showRanking && (
          <div
            draggable
            onDragStart={handleRankingDragStart}
            className={baseIconClass}
            title="Drag to add Ranking"
          >
            <ListOrdered className="h-5 w-5" />
          </div>
        )}
        {pageType === "quiz" && showSlider && (
          <div
            draggable
            onDragStart={handleSliderDragStart}
            className={baseIconClass}
            title="Drag to add Slider"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default ComponentDock;
