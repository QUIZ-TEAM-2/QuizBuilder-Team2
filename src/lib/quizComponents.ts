import type React from "react";
import type { Component, ComponentCategory, ComponentType } from "@/types";
import ImageManifest from "../components/quiz/components/Image";
import TextManifest from "../components/quiz/components/Text";
import ShapeManifest from "../components/quiz/components/Shape";
import GroupManifest from "../components/quiz/components/Group";
import ProgressBarManifest from "../components/quiz/components/ProgressBar";
import RankingManifest from "../components/quiz/components/Ranking";
import InputManifest from "../components/quiz/components/Input";
import MatchingManifest from "../components/quiz/components/Matching";
import SliderManifest from "../components/quiz/components/Slider";
import BGMManifest from "../components/quiz/components/BGM";
import TimerManifest from "../components/quiz/components/Timer";

// ==========================================
// COMPONENT MANIFEST TYPES
// ==========================================

export interface InstantiateHelpers {
  createId: () => string;
}

export interface ComponentRenderHelpers {
  isEditable: boolean;
  selectedComponentId?: string;
  editingComponentId?: string;
  onComponentClick?: (component: Component) => void;
  onTextChange?: (componentId: string, text: string) => void;
  currentPageNumber?: number;
  totalPages?: number;
  rankingOrder?: string[];
  onRankingChange?: (componentId: string, rankingOrder: string[]) => void;
  onRankingSubmit?: (componentId: string) => void;
  matchingPairs?: Record<string, string>;
  onMatchingChange?: (
    componentId: string,
    pairs: Record<string, string>,
  ) => void;
  sliderValue?: number;
  onSliderChange?: (
    componentId: string,
    value: number,
    intervalIndex: number,
  ) => void;
  bgmMuted?: boolean;
  bgmBlocked?: boolean;
  onBGMToggleMute?: () => void;
}

export interface ComponentRenderParams<
  TComponent extends Component = Component,
> {
  component: TComponent;
  helpers: ComponentRenderHelpers;
}

export interface ComponentToolbarProps<
  TComponent extends Component = Component,
> {
  component: TComponent;
  onUpdateProps: (props: Record<string, unknown>) => void;
  onOpenImagePicker?: () => void;
  onOpenAudioPicker?: () => void;
  onUnmerge?: () => void; // For group components
  pageType?: "quiz" | "result" | "onboarding";
}

export interface ComponentManifest<TComponent extends Component = Component> {
  slug: string;
  type: ComponentType;
  category: ComponentCategory;
  label: string;
  Asset: React.ComponentType;
  Toolbar: React.ComponentType<ComponentToolbarProps<TComponent>>;
  render: (params: ComponentRenderParams<TComponent>) => React.ReactNode;
  create: (helpers: InstantiateHelpers) => TComponent;
}

// ==========================================
// COMPONENT REGISTRY
// ==========================================

const manifests: ComponentManifest[] = [
  ImageManifest as ComponentManifest,
  TextManifest as ComponentManifest,
  ShapeManifest as ComponentManifest,
  GroupManifest as ComponentManifest,
  ProgressBarManifest as ComponentManifest,
  RankingManifest as ComponentManifest,
  InputManifest as ComponentManifest,
  MatchingManifest as ComponentManifest,
  SliderManifest as ComponentManifest,
  BGMManifest as ComponentManifest,
  TimerManifest as ComponentManifest,
];

export const componentManifests = manifests;

export function canComponentBecomeButton(component: Component): boolean {
  return (
    component.type !== "progressBar" &&
    component.type !== "ranking" &&
    component.type !== "input" &&
    component.type !== "slider" &&
    component.type !== "matching" &&
    component.type !== "bgm" &&
    component.type !== "timer"
  );
}

const componentManifestByType = new Map(
  manifests.map((manifest) => [manifest.type, manifest]),
);

export function getManifestByType(
  type: ComponentType,
): ComponentManifest | undefined {
  return componentManifestByType.get(type);
}
