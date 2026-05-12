"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  Component,
  Id,
  PageAction,
  PageBackground,
  PageEntity,
  ResultEntity,
} from "@/types";
import { ComponentRenderer } from "@/components/editor/ComponentRenderer";
import PhonePreview from "@/components/editor/PhonePreview";
import { canComponentBecomeButton } from "@/lib/quizComponents";
import {
  getRankingItemResultMappings,
  getRankingPositionWeights,
  RANKING_MAX_ITEMS,
  type RankingItem,
} from "@/components/quiz/components/Ranking/types";
import {
  isMatchingPairMapping,
  DEFAULT_MATCHING_LEFT_NODES,
  DEFAULT_MATCHING_RIGHT_NODES,
  type MatchingPairMapping,
  type MatchingNode,
} from "@/components/quiz/components/Matching/types";
import {
  getSliderResultTotals,
  normalizeSliderConfig,
} from "@/components/quiz/components/Slider/types";

type MatchingPairCombination = {
  leftId: string;
  rightId: string;
};

type MatchingScoreDraft = {
  resultPageId: string;
  score: string;
};

type ResultMappingTabProps = {
  quizId: Id<"quiz"> | null;
};

const ACTION_OPTIONS: { value: PageAction | "none"; label: string }[] = [
  { value: "none", label: "No Action" },
  { value: "nextPage", label: "Next Page" },
  { value: "previousPage", label: "Previous Page" },
  { value: "startQuiz", label: "Start Quiz" },
  { value: "hyperlink", label: "Hyperlink" },
  { value: "answerBox", label: "Answer Box" },
];

const getMatchingPairKey = (leftId: string, rightId: string) =>
  `${leftId}::${rightId}`;

type ConfigurableComponentKind = "button" | "ranking" | "matching" | "slider";

function ConfigurableComponentPreview({
  component,
  kind,
  background,
}: {
  component: Component;
  kind: ConfigurableComponentKind;
  background?: PageBackground;
}) {
  const previewComponent: Component = {
    ...component,
    position: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: component.position?.rotation,
    },
  };

  const previewHeight =
    kind === "ranking" || kind === "matching"
      ? "h-64"
      : kind === "slider"
        ? "h-24"
        : "h-32";
  const innerClassName =
    kind === "ranking" || kind === "matching"
      ? "h-full w-full"
      : kind === "slider"
        ? "h-16 w-full max-w-[520px]"
        : "h-16 w-full max-w-[360px]";
  const backgroundImageOpacity =
    typeof background?.imageOpacity === "number"
      ? Math.max(0, Math.min(1, background.imageOpacity))
      : 1;

  return (
    <div className="rounded border p-2">
      <div
        className={`relative flex w-full items-center justify-center overflow-hidden rounded-sm ${previewHeight}`}
        style={{ backgroundColor: background?.color ?? "white" }}
      >
        {background?.image ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${background.image})`,
              opacity: backgroundImageOpacity,
            }}
            aria-hidden="true"
          />
        ) : null}
        <div className={`relative z-10 ${innerClassName}`}>
          <ComponentRenderer component={previewComponent} isEditable={false} />
        </div>
      </div>
    </div>
  );
}

const isMatchingPairCombination = (
  value: unknown,
): value is MatchingPairCombination =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { leftId?: unknown }).leftId === "string" &&
  typeof (value as { rightId?: unknown }).rightId === "string";

const getFirstAvailableMatchingPairCombination = (
  leftNodes: MatchingNode[],
  rightNodes: MatchingNode[],
  combinations: MatchingPairCombination[],
): MatchingPairCombination => {
  const usedPairKeys = new Set(
    combinations.map((combination) =>
      getMatchingPairKey(combination.leftId, combination.rightId),
    ),
  );

  for (const leftNode of leftNodes) {
    for (const rightNode of rightNodes) {
      if (!usedPairKeys.has(getMatchingPairKey(leftNode.id, rightNode.id))) {
        return { leftId: leftNode.id, rightId: rightNode.id };
      }
    }
  }

  return {
    leftId: leftNodes[0]?.id ?? "",
    rightId: rightNodes[0]?.id ?? "",
  };
};

const getFirstAvailableMatchingResultId = (
  results: ResultEntity[],
  mappings: MatchingPairMapping[],
) => {
  const usedResultIds = new Set(
    mappings.map((mapping) => mapping.resultPageId),
  );
  return (
    results
      .find((result) => !usedResultIds.has(String(result._id)))
      ?._id?.toString() ?? ""
  );
};

function RankingScoreTips() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:border-blue-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Ranking score logic"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-80 text-sm leading-5 text-gray-700"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="space-y-2">
          <div className="font-medium text-gray-900">Ranking score logic</div>
          <p>
            Each item can assign scores to result pages. Each rank position has
            a coefficient.
          </p>
          <p>
            During play, position coefficients are clamped to non-negative
            values and normalized by their total. The final score added to each
            result is item score multiplied by that normalized position
            coefficient.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ResultMappingTab({ quizId }: ResultMappingTabProps) {
  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const updateComponentAction = useMutation(api.quiz.updateComponentAction);

  const pages = useMemo(
    () => (quizQuery?.pages ?? []) as PageEntity[],
    [quizQuery?.pages],
  );
  const results = useMemo(
    () => (quizQuery?.results ?? []) as ResultEntity[],
    [quizQuery?.results],
  );

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [matchingDraftByComponent, setMatchingDraftByComponent] = useState<
    Record<
      string,
      {
        leftId: string;
        rightId: string;
      }
    >
  >({});
  const [matchingScoreDraftByPair, setMatchingScoreDraftByPair] = useState<
    Record<string, Record<string, MatchingScoreDraft>>
  >({});
  const [matchingPairStateByComponent, setMatchingPairStateByComponent] =
    useState<
      Record<
        string,
        {
          pairMappings: MatchingPairMapping[];
          pairCombinations: MatchingPairCombination[];
        }
      >
    >({});

  const setComponentSaving = useCallback((id: string, value: boolean) => {
    setSaving((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleActionChange = useCallback(
    async (component: Component, value: string) => {
      const action = value === "none" ? undefined : (value as PageAction);
      setComponentSaving(component.id, true);
      try {
        // Preserve existing props when switching to answerBox
        const actionProps =
          action === "answerBox"
            ? {
                resultMapping:
                  (component.actionProps?.resultMapping as Record<
                    string,
                    number
                  >) ?? {},
              }
            : action === "hyperlink"
              ? { url: (component.actionProps?.url as string) ?? "" }
              : undefined;

        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action,
          actionProps,
        });
        toast.success("Action updated");
      } catch (error) {
        console.error("Failed to update action", error);
        toast.error("Failed to update action");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleHyperlinkChange = useCallback(
    async (component: Component, url: string) => {
      const trimmed = url.trim();
      setComponentSaving(component.id, true);
      try {
        if (!trimmed) {
          await updateComponentAction({
            componentId: component.id as Id<"components">,
            action: undefined,
            actionProps: undefined,
          });
        } else {
          await updateComponentAction({
            componentId: component.id as Id<"components">,
            action: "hyperlink",
            actionProps: { url: trimmed },
          });
        }
        toast.success("Link updated");
      } catch (error) {
        console.error("Failed to update hyperlink", error);
        toast.error("Failed to update hyperlink");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleResultWeightChange = useCallback(
    async (component: Component, resultId: string, value: string) => {
      const numeric = Number(value);
      const weight = Number.isFinite(numeric) ? numeric : 0;

      setComponentSaving(component.id, true);
      try {
        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action: "answerBox",
          actionProps: { resultMapping: { [resultId]: weight } },
        });
        toast.success("Result mapping updated");
      } catch (error) {
        console.error("Failed to update result weights", error);
        toast.error("Failed to update result weights");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleRankingPositionWeightChange = useCallback(
    async (component: Component, positionIndex: number, value: string) => {
      const items = Array.isArray(component.props?.items)
        ? (component.props.items as RankingItem[]).slice(0, RANKING_MAX_ITEMS)
        : [];
      const numeric = Number(value);
      const weight = Number.isFinite(numeric) ? numeric : 0;
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const positionWeights = getRankingPositionWeights(
        actionProps,
        items.length,
      );
      const itemResultMappings = getRankingItemResultMappings(actionProps);
      const nextPositionWeights = [...positionWeights];
      nextPositionWeights[positionIndex] = weight;

      setComponentSaving(component.id, true);
      try {
        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action: component.action,
          actionProps: {
            ...(actionProps ?? {}),
            positionWeights: nextPositionWeights,
            itemResultMappings,
          },
        });
        toast.success("Ranking weights updated");
      } catch (error) {
        console.error("Failed to update ranking weights", error);
        toast.error("Failed to update ranking weights");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleRankingItemScoreChange = useCallback(
    async (
      component: Component,
      itemId: string,
      resultId: string,
      value: string,
    ) => {
      const items = Array.isArray(component.props?.items)
        ? (component.props.items as RankingItem[]).slice(0, RANKING_MAX_ITEMS)
        : [];
      const numeric = Number(value);
      const score = Number.isFinite(numeric) ? numeric : 0;
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const positionWeights = getRankingPositionWeights(
        actionProps,
        items.length,
      );
      const itemResultMappings = getRankingItemResultMappings(actionProps);

      setComponentSaving(component.id, true);
      try {
        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action: component.action,
          actionProps: {
            ...(actionProps ?? {}),
            positionWeights,
            itemResultMappings: {
              ...itemResultMappings,
              [itemId]: {
                ...(itemResultMappings[itemId] ?? {}),
                [resultId]: score,
              },
            },
          },
        });
        toast.success("Ranking item scores updated");
      } catch (error) {
        console.error("Failed to update ranking item scores", error);
        toast.error("Failed to update ranking item scores");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const getMatchingPairMappings = useCallback(
    (component: Component): MatchingPairMapping[] => {
      const localState = matchingPairStateByComponent[component.id];
      if (localState) {
        return localState.pairMappings;
      }

      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const pairMappings = Array.isArray(actionProps?.pairMappings)
        ? actionProps.pairMappings.filter(isMatchingPairMapping)
        : [];
      return pairMappings;
    },
    [matchingPairStateByComponent],
  );

  const getMatchingPairCombinations = useCallback(
    (component: Component): MatchingPairCombination[] => {
      const localState = matchingPairStateByComponent[component.id];
      if (localState) {
        return localState.pairCombinations;
      }

      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const savedCombinations = Array.isArray(actionProps?.pairCombinations)
        ? actionProps.pairCombinations.filter(isMatchingPairCombination)
        : [];
      const pairMappings = getMatchingPairMappings(component);
      const combinationsByKey = new Map<string, MatchingPairCombination>();

      savedCombinations.forEach((combination) => {
        combinationsByKey.set(
          getMatchingPairKey(combination.leftId, combination.rightId),
          combination,
        );
      });
      pairMappings.forEach((mapping) => {
        const key = getMatchingPairKey(mapping.leftId, mapping.rightId);
        if (!combinationsByKey.has(key)) {
          combinationsByKey.set(key, {
            leftId: mapping.leftId,
            rightId: mapping.rightId,
          });
        }
      });

      return Array.from(combinationsByKey.values());
    },
    [getMatchingPairMappings, matchingPairStateByComponent],
  );

  const updateMatchingDraft = useCallback(
    (
      componentId: string,
      value: Partial<{
        leftId: string;
        rightId: string;
      }>,
    ) => {
      setMatchingDraftByComponent((prev) => ({
        ...prev,
        [componentId]: {
          ...(prev[componentId] ?? {
            leftId: "",
            rightId: "",
          }),
          ...value,
        },
      }));
    },
    [],
  );

  const updateMatchingScoreDraft = useCallback(
    (
      componentId: string,
      pairKey: string,
      value: Partial<MatchingScoreDraft>,
    ) => {
      setMatchingScoreDraftByPair((prev) => ({
        ...prev,
        [componentId]: {
          ...(prev[componentId] ?? {}),
          [pairKey]: {
            ...((prev[componentId] ?? {})[pairKey] ?? {
              resultPageId: "",
              score: "1",
            }),
            ...value,
          },
        },
      }));
    },
    [],
  );

  const saveMatchingPairState = useCallback(
    async (
      component: Component,
      nextPairMappings: MatchingPairMapping[],
      nextPairCombinations?: MatchingPairCombination[],
    ) => {
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : {};
      const currentCombinations = getMatchingPairCombinations(component);
      const combinationsByKey = new Map<string, MatchingPairCombination>();

      (nextPairCombinations ?? currentCombinations).forEach((combination) => {
        combinationsByKey.set(
          getMatchingPairKey(combination.leftId, combination.rightId),
          combination,
        );
      });
      nextPairMappings.forEach((mapping) => {
        const key = getMatchingPairKey(mapping.leftId, mapping.rightId);
        if (!combinationsByKey.has(key)) {
          combinationsByKey.set(key, {
            leftId: mapping.leftId,
            rightId: mapping.rightId,
          });
        }
      });
      const nextCombinations = Array.from(combinationsByKey.values());

      setMatchingPairStateByComponent((prev) => ({
        ...prev,
        [component.id]: {
          pairMappings: nextPairMappings,
          pairCombinations: nextCombinations,
        },
      }));

      setComponentSaving(component.id, true);
      try {
        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action: component.action,
          actionProps: {
            ...actionProps,
            pairMappings: nextPairMappings,
            pairCombinations: nextCombinations,
          },
        });
        toast.success("Matching scores updated");
      } catch (error) {
        setMatchingPairStateByComponent((prev) => {
          const next = { ...prev };
          delete next[component.id];
          return next;
        });
        console.error("Failed to update matching pair mappings", error);
        toast.error("Failed to update matching scores");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [getMatchingPairCombinations, setComponentSaving, updateComponentAction],
  );

  const handleSliderTotalScoreChange = useCallback(
    async (component: Component, resultId: string, value: string) => {
      const numeric = Number(value);
      const totalScore = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const sliderResultTotals = getSliderResultTotals(actionProps);

      setComponentSaving(component.id, true);
      try {
        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action: component.action,
          actionProps: {
            ...(actionProps ?? {}),
            sliderResultTotals: {
              ...sliderResultTotals,
              [resultId]: totalScore,
            },
          },
        });
        toast.success("Slider total score updated");
      } catch (error) {
        console.error("Failed to update slider total score", error);
        toast.error("Failed to update slider total score");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleAddMatchingPairMapping = useCallback(
    async (
      component: Component,
      leftId: string,
      rightId: string,
      resultId: string,
      score: number,
    ) => {
      if (!leftId || !rightId || !resultId || score <= 0) return;
      const currentMappings = getMatchingPairMappings(component);

      // Check for existing mapping with same (left, right, resultPage)
      const existingIndex = currentMappings.findIndex(
        (m) =>
          m.leftId === leftId &&
          m.rightId === rightId &&
          m.resultPageId === resultId,
      );

      let nextMappings: MatchingPairMapping[];
      if (existingIndex >= 0) {
        // Update existing instead of adding duplicate
        nextMappings = currentMappings.map((m, i) =>
          i === existingIndex ? { ...m, score } : m,
        );
      } else {
        nextMappings = [
          ...currentMappings,
          { leftId, rightId, resultPageId: resultId, score },
        ];
      }

      await saveMatchingPairState(component, nextMappings);
    },
    [getMatchingPairMappings, saveMatchingPairState],
  );

  const handleUpdateMatchingPairMapping = useCallback(
    async (
      component: Component,
      index: number,
      nextMapping: MatchingPairMapping,
    ) => {
      const currentMappings = getMatchingPairMappings(component);

      // If score is 0 or less, remove the mapping
      if (nextMapping.score <= 0) {
        const nextMappings = currentMappings.filter((_, i) => i !== index);
        await saveMatchingPairState(component, nextMappings);
        toast.info("Removed mapping with zero score");
        return;
      }

      // Check if updating this mapping would create a duplicate of ANOTHER mapping
      const duplicateIndex = currentMappings.findIndex(
        (m, i) =>
          i !== index &&
          m.leftId === nextMapping.leftId &&
          m.rightId === nextMapping.rightId &&
          m.resultPageId === nextMapping.resultPageId,
      );

      let nextMappings: MatchingPairMapping[];
      if (duplicateIndex >= 0) {
        // If it becomes a duplicate, we merge them (remove current, update the other)
        nextMappings = currentMappings
          .filter((_, i) => i !== index)
          .map((m, i) =>
            i === (duplicateIndex < index ? duplicateIndex : duplicateIndex - 1)
              ? nextMapping
              : m,
          );
        toast.info("Merged duplicate mapping");
      } else {
        nextMappings = currentMappings.map((mapping, mappingIndex) =>
          mappingIndex === index ? nextMapping : mapping,
        );
      }

      await saveMatchingPairState(component, nextMappings);
    },
    [getMatchingPairMappings, saveMatchingPairState],
  );

  const handleRemoveMatchingPairMapping = useCallback(
    async (component: Component, index: number) => {
      const currentMappings = getMatchingPairMappings(component);
      const nextMappings = currentMappings.filter(
        (_, mappingIndex) => mappingIndex !== index,
      );
      await saveMatchingPairState(component, nextMappings);
    },
    [getMatchingPairMappings, saveMatchingPairState],
  );

  const handleAddMatchingPairCombination = useCallback(
    async (component: Component, leftId: string, rightId: string) => {
      if (!leftId || !rightId) return;
      const currentMappings = getMatchingPairMappings(component);
      const currentCombinations = getMatchingPairCombinations(component);
      const pairKey = getMatchingPairKey(leftId, rightId);

      if (
        currentCombinations.some(
          (combination) =>
            getMatchingPairKey(combination.leftId, combination.rightId) ===
            pairKey,
        )
      ) {
        toast.info("This pair combination already exists");
        return;
      }

      const nextCombinations = [...currentCombinations, { leftId, rightId }];
      await saveMatchingPairState(component, currentMappings, nextCombinations);

      const leftNodes =
        Array.isArray(component.props?.leftNodes) &&
        component.props.leftNodes.length > 0
          ? (component.props.leftNodes as MatchingNode[])
          : DEFAULT_MATCHING_LEFT_NODES;
      const rightNodes =
        Array.isArray(component.props?.rightNodes) &&
        component.props.rightNodes.length > 0
          ? (component.props.rightNodes as MatchingNode[])
          : DEFAULT_MATCHING_RIGHT_NODES;
      const nextDraft = getFirstAvailableMatchingPairCombination(
        leftNodes,
        rightNodes,
        nextCombinations,
      );
      setMatchingDraftByComponent((prev) => ({
        ...prev,
        [component.id]: nextDraft,
      }));
    },
    [
      getMatchingPairCombinations,
      getMatchingPairMappings,
      saveMatchingPairState,
    ],
  );

  const handleRemoveMatchingPairCombination = useCallback(
    async (component: Component, leftId: string, rightId: string) => {
      const pairKey = getMatchingPairKey(leftId, rightId);
      const nextMappings = getMatchingPairMappings(component).filter(
        (mapping) =>
          getMatchingPairKey(mapping.leftId, mapping.rightId) !== pairKey,
      );
      const nextCombinations = getMatchingPairCombinations(component).filter(
        (combination) =>
          getMatchingPairKey(combination.leftId, combination.rightId) !==
          pairKey,
      );
      await saveMatchingPairState(component, nextMappings, nextCombinations);
    },
    [
      getMatchingPairCombinations,
      getMatchingPairMappings,
      saveMatchingPairState,
    ],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Save the quiz first to manage mappings.
      </div>
    );
  }

  if (quizQuery === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Loading mappings...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      {pages.map((page) => {
        const buttons =
          (page.components ?? []).filter(
            (c) =>
              canComponentBecomeButton(c) &&
              (c.props as Record<string, unknown>)?.isButton,
          ) ?? [];
        const rankingComponents =
          (page.components ?? []).filter((c) => c.type === "ranking") ?? [];
        const matchingComponents =
          (page.components ?? []).filter((c) => c.type === "matching") ?? [];
        const sliderComponents =
          (page.components ?? []).filter((c) => c.type === "slider") ?? [];
        const configurableComponents = [
          ...buttons.map((component) => ({
            kind: "button" as const,
            component,
          })),
          ...rankingComponents.map((component) => ({
            kind: "ranking" as const,
            component,
          })),
          ...matchingComponents.map((component) => ({
            kind: "matching" as const,
            component,
          })),
          ...sliderComponents.map((component) => ({
            kind: "slider" as const,
            component,
          })),
        ];

        return (
          <div key={page._id} className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-start gap-4 p-4">
              <div className="flex-shrink-0">
                <PhonePreview
                  components={page.components ?? []}
                  background={page.background}
                  isEditable={false}
                  scale={0.35}
                  pageType="quiz"
                  className="border"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {page.pageName?.trim() || "Untitled Page"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {configurableComponents.length} configurable component
                      {configurableComponents.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {configurableComponents.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    No answer boxes, ranking, or slider components on this page.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {configurableComponents.map(({ kind, component }) => {
                      const currentAction =
                        (component.action as PageAction | undefined) ?? "none";
                      const hyperlinkUrl =
                        (component.actionProps?.url as string | undefined) ??
                        "";
                      const resultMapping =
                        (component.actionProps?.resultMapping as Record<
                          string,
                          number
                        >) ?? {};
                      const rankingItems = Array.isArray(component.props?.items)
                        ? (component.props.items as RankingItem[]).slice(
                            0,
                            RANKING_MAX_ITEMS,
                          )
                        : [];
                      const rankingActionProps =
                        typeof component.actionProps === "object" &&
                        component.actionProps !== null
                          ? (component.actionProps as Record<string, unknown>)
                          : undefined;
                      const positionWeights = getRankingPositionWeights(
                        rankingActionProps,
                        rankingItems.length,
                      );
                      const itemResultMappings =
                        getRankingItemResultMappings(rankingActionProps);

                      // For matching
                      const matchingPairMappings =
                        kind === "matching"
                          ? getMatchingPairMappings(component)
                          : [];
                      const matchingPairCombinations =
                        kind === "matching"
                          ? getMatchingPairCombinations(component)
                          : [];
                      const leftNodes =
                        Array.isArray(component.props?.leftNodes) &&
                        component.props.leftNodes.length > 0
                          ? (component.props.leftNodes as MatchingNode[])
                          : DEFAULT_MATCHING_LEFT_NODES;
                      const rightNodes =
                        Array.isArray(component.props?.rightNodes) &&
                        component.props.rightNodes.length > 0
                          ? (component.props.rightNodes as MatchingNode[])
                          : DEFAULT_MATCHING_RIGHT_NODES;
                      const defaultCombinationDraft =
                        getFirstAvailableMatchingPairCombination(
                          leftNodes,
                          rightNodes,
                          matchingPairCombinations,
                        );
                      const draft =
                        matchingDraftByComponent[component.id] ??
                        defaultCombinationDraft;
                      const draftPairKey = getMatchingPairKey(
                        draft.leftId,
                        draft.rightId,
                      );
                      const hasDraftCombination = matchingPairCombinations.some(
                        (combination) =>
                          getMatchingPairKey(
                            combination.leftId,
                            combination.rightId,
                          ) === draftPairKey,
                      );

                      const sliderConfig =
                        kind === "slider"
                          ? normalizeSliderConfig(component.props ?? {})
                          : null;
                      const sliderActionProps =
                        kind === "slider" &&
                        typeof component.actionProps === "object" &&
                        component.actionProps !== null
                          ? (component.actionProps as Record<string, unknown>)
                          : undefined;
                      const sliderResultTotals =
                        kind === "slider"
                          ? getSliderResultTotals(sliderActionProps)
                          : {};
                      const isSaving = saving[component.id] ?? false;

                      return (
                        <div
                          key={component.id}
                          className="rounded-md border px-3 py-2"
                        >
                          <div className="mb-3">
                            <div className="mb-1 text-xs font-medium text-gray-600">
                              {kind === "ranking"
                                ? "Ranking preview"
                                : kind === "matching"
                                  ? "Matching preview"
                                  : kind === "slider"
                                    ? "Slider preview"
                                    : "Button preview"}
                            </div>
                            <ConfigurableComponentPreview
                              component={component}
                              kind={kind}
                              background={page.background}
                            />
                          </div>

                          {kind === "button" ? (
                            <>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    Action
                                  </span>
                                  <Select
                                    value={currentAction}
                                    onValueChange={(val) =>
                                      void handleActionChange(component, val)
                                    }
                                    disabled={isSaving}
                                  >
                                    <SelectTrigger className="h-8 w-44">
                                      <SelectValue placeholder="Select action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACTION_OPTIONS.map((option) => (
                                        <SelectItem
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {currentAction === "hyperlink" && (
                                <div className="mt-3 space-y-1.5">
                                  <Label className="text-xs">URL</Label>
                                  <Input
                                    value={hyperlinkUrl}
                                    placeholder="https://example.com"
                                    onChange={(e) =>
                                      void handleHyperlinkChange(
                                        component,
                                        e.target.value,
                                      )
                                    }
                                    disabled={isSaving}
                                    className="h-8"
                                  />
                                </div>
                              )}

                              {currentAction === "answerBox" && (
                                <div className="mt-3 space-y-2">
                                  {results.length === 0 ? (
                                    <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                      No result pages available. Create result
                                      pages before configuring answer box
                                      scores.
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label className="text-xs">
                                        Result scores
                                      </Label>
                                      <div className="space-y-2">
                                        {results.map((result, index) => {
                                          const resultId = result._id as string;
                                          const score = Number.isFinite(
                                            resultMapping[resultId],
                                          )
                                            ? resultMapping[resultId]
                                            : 0;

                                          return (
                                            <div
                                              key={result._id}
                                              className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                                            >
                                              <div className="text-sm text-gray-700">
                                                {result.pageName?.trim() ||
                                                  `Result ${index + 1}`}
                                              </div>
                                              <Input
                                                type="number"
                                                inputMode="numeric"
                                                className="h-8 w-full sm:w-24"
                                                value={score}
                                                onChange={(e) =>
                                                  void handleResultWeightChange(
                                                    component,
                                                    resultId,
                                                    e.target.value,
                                                  )
                                                }
                                                disabled={isSaving}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : kind === "ranking" ? (
                            <div className="mt-1 space-y-4">
                              <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
                                <div>
                                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Question Type
                                  </div>
                                  <div className="mt-1 text-sm font-medium text-slate-700">
                                    Ranking
                                  </div>
                                </div>
                                <RankingScoreTips />
                              </div>

                              <Tabs
                                defaultValue="positions"
                                className="space-y-3"
                              >
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="positions">
                                    Position coefficients
                                  </TabsTrigger>
                                  <TabsTrigger value="items">
                                    Item result scores
                                  </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                  value="positions"
                                  className="space-y-2"
                                >
                                  <div className="space-y-2">
                                    {rankingItems.map((item, index) => (
                                      <div
                                        key={item.id}
                                        className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                                      >
                                        <div className="text-sm text-gray-700">
                                          Position {index + 1}
                                        </div>
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          className="h-8 w-full sm:w-24"
                                          value={positionWeights[index] ?? 1}
                                          onChange={(e) =>
                                            void handleRankingPositionWeightChange(
                                              component,
                                              index,
                                              e.target.value,
                                            )
                                          }
                                          disabled={isSaving}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </TabsContent>

                                <TabsContent
                                  value="items"
                                  className="space-y-2"
                                >
                                  {results.length === 0 ? (
                                    <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                      No result pages available. Create result
                                      pages before configuring ranking scores.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {rankingItems.map((item, itemIndex) => (
                                        <div
                                          key={item.id}
                                          className="rounded-md border bg-slate-50/60 px-3 py-2"
                                        >
                                          <div className="mb-2 text-sm font-medium text-slate-800">
                                            {item.label.trim() ||
                                              `Item ${itemIndex + 1}`}
                                          </div>
                                          <div className="space-y-2">
                                            {results.map(
                                              (result, resultIndex) => {
                                                const resultId =
                                                  result._id as string;
                                                const score = Number.isFinite(
                                                  itemResultMappings[item.id]?.[
                                                    resultId
                                                  ],
                                                )
                                                  ? itemResultMappings[
                                                      item.id
                                                    ]![resultId]
                                                  : 0;

                                                return (
                                                  <div
                                                    key={result._id}
                                                    className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                                                  >
                                                    <div className="text-sm text-gray-700">
                                                      {result.pageName?.trim() ||
                                                        `Result ${resultIndex + 1}`}
                                                    </div>
                                                    <Input
                                                      type="number"
                                                      inputMode="decimal"
                                                      className="h-8 w-full sm:w-24"
                                                      value={score}
                                                      onChange={(e) =>
                                                        void handleRankingItemScoreChange(
                                                          component,
                                                          item.id,
                                                          resultId,
                                                          e.target.value,
                                                        )
                                                      }
                                                      disabled={isSaving}
                                                    />
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </div>
                          ) : kind === "matching" ? (
                            <div className="mt-1 space-y-4">
                              <div className="rounded-md border bg-slate-50 px-3 py-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Question Type
                                </div>
                                <div className="mt-1 text-sm font-medium text-slate-700">
                                  Matching
                                </div>
                              </div>

                              {results.length === 0 ? (
                                <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                  No result pages available. Create result pages
                                  before configuring matching scores.
                                </div>
                              ) : leftNodes.length === 0 ||
                                rightNodes.length === 0 ? (
                                <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                  Matching component needs left and right nodes
                                  configured before score mapping.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="space-y-3">
                                    <Label className="text-xs">
                                      Match combinations
                                    </Label>
                                    {matchingPairCombinations.length === 0 ? (
                                      <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                        No configured matching combinations.
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {(() => {
                                          const groups: Record<
                                            string,
                                            {
                                              leftId: string;
                                              rightId: string;
                                              mappings: {
                                                mapping: MatchingPairMapping;
                                                index: number;
                                              }[];
                                            }
                                          > = {};
                                          matchingPairCombinations.forEach(
                                            (combination) => {
                                              const key = getMatchingPairKey(
                                                combination.leftId,
                                                combination.rightId,
                                              );
                                              groups[key] = {
                                                leftId: combination.leftId,
                                                rightId: combination.rightId,
                                                mappings: [],
                                              };
                                            },
                                          );
                                          matchingPairMappings.forEach(
                                            (mapping, index) => {
                                              const key = getMatchingPairKey(
                                                mapping.leftId,
                                                mapping.rightId,
                                              );
                                              if (!groups[key]) {
                                                groups[key] = {
                                                  leftId: mapping.leftId,
                                                  rightId: mapping.rightId,
                                                  mappings: [],
                                                };
                                              }
                                              groups[key].mappings.push({
                                                mapping,
                                                index,
                                              });
                                            },
                                          );

                                          return Object.entries(groups).map(
                                            ([pairKey, group]) => {
                                              const leftLabel =
                                                leftNodes.find(
                                                  (n) => n.id === group.leftId,
                                                )?.label ?? group.leftId;
                                              const rightLabel =
                                                rightNodes.find(
                                                  (n) => n.id === group.rightId,
                                                )?.label ?? group.rightId;
                                              const defaultResultPageId =
                                                getFirstAvailableMatchingResultId(
                                                  results,
                                                  group.mappings.map(
                                                    ({ mapping }) => mapping,
                                                  ),
                                                );
                                              const availableResults =
                                                results.filter(
                                                  (result) =>
                                                    !group.mappings.some(
                                                      ({ mapping }) =>
                                                        mapping.resultPageId ===
                                                        String(result._id),
                                                    ),
                                                );
                                              const rawScoreDraft =
                                                matchingScoreDraftByPair[
                                                  component.id
                                                ]?.[pairKey];
                                              const scoreDraftResultIsAvailable =
                                                rawScoreDraft?.resultPageId
                                                  ? !group.mappings.some(
                                                      ({ mapping }) =>
                                                        mapping.resultPageId ===
                                                        rawScoreDraft.resultPageId,
                                                    )
                                                  : false;
                                              const scoreDraft = {
                                                resultPageId:
                                                  scoreDraftResultIsAvailable
                                                    ? rawScoreDraft!
                                                        .resultPageId
                                                    : defaultResultPageId,
                                                score:
                                                  rawScoreDraft?.score ?? "1",
                                              };

                                              return (
                                                <div
                                                  key={pairKey}
                                                  className="rounded-md border bg-white p-3 shadow-sm"
                                                >
                                                  <div className="mb-3 flex items-center justify-between border-b pb-2">
                                                    <div className="text-xs font-bold text-blue-700">
                                                      {leftLabel}{" "}
                                                      <span className="mx-1 text-slate-400">
                                                        -&gt;
                                                      </span>{" "}
                                                      {rightLabel}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <div className="text-[10px] uppercase text-slate-400">
                                                        Pair Combination
                                                      </div>
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                                                        onClick={() =>
                                                          void handleRemoveMatchingPairCombination(
                                                            component,
                                                            group.leftId,
                                                            group.rightId,
                                                          )
                                                        }
                                                        disabled={isSaving}
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </div>
                                                  </div>

                                                  <div className="space-y-3">
                                                    {group.mappings.length ===
                                                    0 ? (
                                                      <div className="rounded border border-dashed bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                                                        No result scores for
                                                        this combination.
                                                      </div>
                                                    ) : (
                                                      group.mappings.map(
                                                        ({
                                                          mapping,
                                                          index,
                                                        }) => {
                                                          const resultName =
                                                            results
                                                              .find(
                                                                (r) =>
                                                                  String(
                                                                    r._id,
                                                                  ) ===
                                                                  mapping.resultPageId,
                                                              )
                                                              ?.pageName?.trim() ||
                                                            "Untitled Result";
                                                          return (
                                                            <div
                                                              key={`${mapping.resultPageId}-${index}`}
                                                              className="flex flex-col gap-2 rounded bg-slate-50/50 p-2 sm:flex-row sm:items-center"
                                                            >
                                                              <div className="flex-1 space-y-1">
                                                                <Label className="text-[10px] uppercase text-gray-400">
                                                                  Result Page
                                                                </Label>
                                                                <Select
                                                                  value={
                                                                    mapping.resultPageId
                                                                  }
                                                                  onValueChange={(
                                                                    value,
                                                                  ) =>
                                                                    void handleUpdateMatchingPairMapping(
                                                                      component,
                                                                      index,
                                                                      {
                                                                        ...mapping,
                                                                        resultPageId:
                                                                          value,
                                                                      },
                                                                    )
                                                                  }
                                                                  disabled={
                                                                    isSaving
                                                                  }
                                                                >
                                                                  <SelectTrigger className="h-7 w-full bg-white text-xs">
                                                                    <SelectValue
                                                                      placeholder={
                                                                        resultName
                                                                      }
                                                                    />
                                                                  </SelectTrigger>
                                                                  <SelectContent>
                                                                    {results.map(
                                                                      (
                                                                        result,
                                                                      ) => (
                                                                        <SelectItem
                                                                          key={
                                                                            result._id
                                                                          }
                                                                          value={String(
                                                                            result._id,
                                                                          )}
                                                                        >
                                                                          {result.pageName?.trim() ||
                                                                            "Untitled Result"}
                                                                        </SelectItem>
                                                                      ),
                                                                    )}
                                                                  </SelectContent>
                                                                </Select>
                                                              </div>
                                                              <div className="flex items-end gap-2">
                                                                <div className="space-y-1">
                                                                  <Label className="text-[10px] uppercase text-gray-400">
                                                                    Score
                                                                  </Label>
                                                                  <Input
                                                                    type="number"
                                                                    inputMode="numeric"
                                                                    className="h-7 w-16 bg-white text-xs"
                                                                    value={
                                                                      mapping.score
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      void handleUpdateMatchingPairMapping(
                                                                        component,
                                                                        index,
                                                                        {
                                                                          ...mapping,
                                                                          score:
                                                                            Number(
                                                                              e
                                                                                .target
                                                                                .value,
                                                                            ),
                                                                        },
                                                                      )
                                                                    }
                                                                    disabled={
                                                                      isSaving
                                                                    }
                                                                  />
                                                                </div>
                                                                <Button
                                                                  type="button"
                                                                  variant="ghost"
                                                                  size="icon"
                                                                  className="h-7 w-7 text-red-500 hover:bg-red-50"
                                                                  onClick={() =>
                                                                    void handleRemoveMatchingPairMapping(
                                                                      component,
                                                                      index,
                                                                    )
                                                                  }
                                                                  disabled={
                                                                    isSaving
                                                                  }
                                                                >
                                                                  <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                              </div>
                                                            </div>
                                                          );
                                                        },
                                                      )
                                                    )}

                                                    <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3 border-t pt-3">
                                                      <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-medium text-slate-500">
                                                          Result Page
                                                        </Label>
                                                        <Select
                                                          value={
                                                            scoreDraft.resultPageId
                                                          }
                                                          onValueChange={(
                                                            value,
                                                          ) =>
                                                            updateMatchingScoreDraft(
                                                              component.id,
                                                              pairKey,
                                                              {
                                                                resultPageId:
                                                                  value,
                                                              },
                                                            )
                                                          }
                                                          disabled={
                                                            isSaving ||
                                                            availableResults.length ===
                                                              0
                                                          }
                                                        >
                                                          <SelectTrigger className="h-8 w-full border-blue-200 bg-white text-xs font-medium text-blue-600">
                                                            <SelectValue placeholder="Select a result page" />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            {availableResults.map(
                                                              (result) => (
                                                                <SelectItem
                                                                  key={
                                                                    result._id
                                                                  }
                                                                  value={String(
                                                                    result._id,
                                                                  )}
                                                                >
                                                                  {result.pageName?.trim() ||
                                                                    "Untitled Result"}
                                                                </SelectItem>
                                                              ),
                                                            )}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>

                                                      <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-medium text-slate-500">
                                                          Score
                                                        </Label>
                                                        <Input
                                                          type="number"
                                                          inputMode="numeric"
                                                          className="h-8 w-16 border-slate-200 bg-white text-xs"
                                                          value={
                                                            scoreDraft.score
                                                          }
                                                          onChange={(e) =>
                                                            updateMatchingScoreDraft(
                                                              component.id,
                                                              pairKey,
                                                              {
                                                                score:
                                                                  e.target
                                                                    .value,
                                                              },
                                                            )
                                                          }
                                                          disabled={isSaving}
                                                        />
                                                      </div>

                                                      <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-8 bg-blue-600 px-4 hover:bg-blue-700"
                                                        onClick={() =>
                                                          void (async () => {
                                                            await handleAddMatchingPairMapping(
                                                              component,
                                                              group.leftId,
                                                              group.rightId,
                                                              scoreDraft.resultPageId,
                                                              Number(
                                                                scoreDraft.score,
                                                              ),
                                                            );
                                                            const nextResultId =
                                                              availableResults
                                                                .find(
                                                                  (result) =>
                                                                    String(
                                                                      result._id,
                                                                    ) !==
                                                                    scoreDraft.resultPageId,
                                                                )
                                                                ?._id?.toString() ??
                                                              "";
                                                            updateMatchingScoreDraft(
                                                              component.id,
                                                              pairKey,
                                                              {
                                                                resultPageId:
                                                                  nextResultId,
                                                                score: "1",
                                                              },
                                                            );
                                                          })()
                                                        }
                                                        disabled={
                                                          isSaving ||
                                                          !scoreDraft.resultPageId ||
                                                          Number(
                                                            scoreDraft.score,
                                                          ) <= 0
                                                        }
                                                      >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        <span className="ml-1.5 text-xs font-semibold">
                                                          Add
                                                        </span>
                                                      </Button>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            },
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>

                                  <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3 shadow-sm">
                                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                      Add match combination
                                    </div>
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <Label className="text-[10px] font-medium text-slate-500">
                                            Left Item
                                          </Label>
                                          <Select
                                            value={draft.leftId}
                                            onValueChange={(value) =>
                                              updateMatchingDraft(
                                                component.id,
                                                { leftId: value },
                                              )
                                            }
                                            disabled={isSaving}
                                          >
                                            <SelectTrigger className="h-8 w-full border-slate-200 bg-white text-xs">
                                              <SelectValue placeholder="Select a node" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {leftNodes.map((node) => (
                                                <SelectItem
                                                  key={node.id}
                                                  value={node.id}
                                                >
                                                  {node.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-[10px] font-medium text-slate-500">
                                            Right Item
                                          </Label>
                                          <Select
                                            value={draft.rightId}
                                            onValueChange={(value) =>
                                              updateMatchingDraft(
                                                component.id,
                                                { rightId: value },
                                              )
                                            }
                                            disabled={isSaving}
                                          >
                                            <SelectTrigger className="h-8 w-full border-slate-200 bg-white text-xs">
                                              <SelectValue placeholder="Select a node" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {rightNodes.map((node) => (
                                                <SelectItem
                                                  key={node.id}
                                                  value={node.id}
                                                >
                                                  {node.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 bg-blue-600 px-4 hover:bg-blue-700"
                                        onClick={() =>
                                          void handleAddMatchingPairCombination(
                                            component,
                                            draft.leftId,
                                            draft.rightId,
                                          )
                                        }
                                        disabled={
                                          isSaving ||
                                          !draft.leftId ||
                                          !draft.rightId ||
                                          hasDraftCombination
                                        }
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span className="ml-1.5 text-xs font-semibold">
                                          Add Combination
                                        </span>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 space-y-4">
                              <div className="rounded-md border bg-slate-50 px-3 py-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Question Type
                                </div>
                                <div className="mt-1 text-sm font-medium text-slate-700">
                                  Slider
                                </div>
                              </div>

                              {results.length === 0 ? (
                                <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                  No result pages available. Create result pages
                                  before configuring slider scores.
                                </div>
                              ) : sliderConfig ? (
                                <div className="space-y-3">
                                  <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    The slider snaps to the nearest tick. The
                                    submitted score is calculated as{" "}
                                    <span className="font-medium text-slate-700">
                                      selected tick value / {sliderConfig.max} *
                                      total score
                                    </span>
                                    .
                                  </div>
                                  {results.map((result, resultIndex) => {
                                    const resultId = result._id as string;
                                    const rawTotalScore =
                                      sliderResultTotals[resultId];
                                    const totalScore =
                                      typeof rawTotalScore === "number" &&
                                      Number.isFinite(rawTotalScore)
                                        ? rawTotalScore
                                        : 0;

                                    return (
                                      <div
                                        key={result._id}
                                        className="rounded-md border bg-slate-50/60 px-3 py-2"
                                      >
                                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                                          <div className="text-sm font-medium text-gray-700">
                                            {result.pageName?.trim() ||
                                              `Result ${resultIndex + 1}`}
                                          </div>
                                          <Input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            className="h-8 w-full sm:w-24"
                                            value={totalScore}
                                            onChange={(e) =>
                                              void handleSliderTotalScoreChange(
                                                component,
                                                resultId,
                                                e.target.value,
                                              )
                                            }
                                            disabled={isSaving}
                                          />
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {Array.from(
                                            {
                                              length:
                                                sliderConfig.divisions + 1,
                                            },
                                            (_, index) => {
                                              const tick = index;
                                              const tickValue =
                                                sliderConfig.min + index;
                                              const score =
                                                totalScore *
                                                (tickValue / sliderConfig.max);
                                              const label = Number.isInteger(
                                                score,
                                              )
                                                ? String(score)
                                                : score.toFixed(2);

                                              return (
                                                <span
                                                  key={tick}
                                                  className="rounded border bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
                                                >
                                                  {tickValue}: {label}
                                                </span>
                                              );
                                            },
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
