"use client";

import type { Component } from "@/types";
import {
  type ComponentRenderHelpers,
  getManifestByType,
} from "@/lib/quizComponents";

export interface ComponentRendererProps {
  component: Component;
  selectedComponentId?: string;
  editingComponentId?: string;
  isEditable?: boolean;
  onTextChange?: (componentId: string, text: string) => void;
  currentPageNumber?: number;
  totalPages?: number;
  rankingOrder?: string[];
  onRankingChange?: (componentId: string, rankingOrder: string[]) => void;
  onRankingSubmit?: (componentId: string) => void;
  matchingPairs?: Record<string, string>;
  onMatchingChange?: (componentId: string, pairs: Record<string, string>) => void;
  sliderValue?: number;
  onSliderChange?: (
    componentId: string,
    value: number,
    intervalIndex: number,
  ) => void;
}

export function ComponentRenderer({
  component,
  selectedComponentId,
  editingComponentId,
  isEditable = false,
  onTextChange,
  currentPageNumber,
  totalPages,
  rankingOrder,
  onRankingChange,
  onRankingSubmit,
  matchingPairs,
  onMatchingChange,
  sliderValue,
  onSliderChange,
}: ComponentRendererProps) {
  const manifest = getManifestByType(component.type);

  if (!manifest) {
    return null;
  }

  const helpers: ComponentRenderHelpers = {
    isEditable,
    selectedComponentId,
    editingComponentId,
    onTextChange,
    currentPageNumber,
    totalPages,
    rankingOrder,
    onRankingChange,
    onRankingSubmit,
    matchingPairs,
    onMatchingChange,
    sliderValue,
    onSliderChange,
  };

  return manifest.render({
    component,
    helpers,
  });
}
