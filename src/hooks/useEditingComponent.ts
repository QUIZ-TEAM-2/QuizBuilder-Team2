"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Component, ComponentPosition, Id, PageAction } from "@/types";

type EditingComponentOptions = {
  /**
   * If provided, enables optimistic updates against the cached
   * `api.quiz.getQuiz({ id: quizId })` query result.
   */
  quizId?: Id<"quiz">;
};

/**
 * Hook for managing local state of a selected component.
 *
 * Architecture:
 * - All components display from Convex query (real-time)
 * - When a component is selected, copy it to local state
 * - Edit local state for responsiveness
 * - Selection changes, deselect, and page changes flush pending edits immediately
 */
export function useEditingComponent(
  /** All components from the Convex query (source of truth for unselected components) */
  serverComponents: Component[],
  /** Callback when a save completes (success or error) */
  onSaveComplete?: (error?: Error) => void,
  options?: EditingComponentOptions,
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<Component | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const quizId = options?.quizId;

  const hasChangesRef = useRef(false);
  const originalComponentRef = useRef<Component | null>(null);
  const saveChangesRef = useRef<() => Promise<void>>(async () => undefined);

  /**
   * Optimistically patch the cached `api.quiz.getQuiz({ id: quizId })` result by
   * applying `patch` to the matching component (by id) across pages/results/onboarding.
   *
   * This prevents flicker on deselect when the UI falls back from local state to query state.
   */
  const patchCachedQuizComponent = useCallback(
    (
      localStore: OptimisticLocalStore,
      componentId: string,
      patch: (component: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      if (!quizId) return;

      const args = { id: quizId };
      const cached = localStore.getQuery(api.quiz.getQuiz, args);
      if (!cached) return;

      const patchComponents = <T>(
        components: T[] | undefined,
      ): T[] | undefined => {
        if (!Array.isArray(components)) return components;
        let changed = false;
        const next = components.map((c) => {
          const rec = c as Record<string, unknown>;
          const cid = rec.id ?? rec._id;
          if (cid !== componentId) return c;
          changed = true;
          return patch(rec) as T;
        });
        return changed ? next : components;
      };

      const patchPageLike = <T extends { components: unknown[] }>(
        pageLike: T,
      ): T => {
        if (!pageLike) return pageLike;
        const nextComponents = patchComponents(pageLike.components);
        return nextComponents === pageLike.components
          ? pageLike
          : { ...pageLike, components: nextComponents };
      };

      const nextCached = {
        ...cached,
        pages: Array.isArray(cached.pages)
          ? cached.pages.map(patchPageLike)
          : cached.pages,
        results: Array.isArray(cached.results)
          ? cached.results.map(patchPageLike)
          : cached.results,
        onboardingPage: cached.onboardingPage
          ? patchPageLike(cached.onboardingPage)
          : cached.onboardingPage,
      };

      localStore.setQuery(api.quiz.getQuiz, args, nextCached);
    },
    [quizId],
  );

  // Convex mutations for individual component updates
  const updatePosition = useMutation(
    api.quiz.updateComponentPosition,
  ).withOptimisticUpdate((localStore, args) => {
    patchCachedQuizComponent(localStore, args.componentId, (component) => ({
      ...component,
      position: args.position,
    }));
  });

  const updateProps = useMutation(
    api.quiz.updateComponentProps,
  ).withOptimisticUpdate((localStore, args) => {
    patchCachedQuizComponent(localStore, args.componentId, (component) => ({
      ...component,
      // Server merges props: { ...(component.props ?? {}), ...args.props }
      props: { ...(component.props ?? {}), ...(args.props ?? {}) },
    }));
  });

  const updateData = useMutation(
    api.quiz.updateComponentData,
  ).withOptimisticUpdate((localStore, args) => {
    patchCachedQuizComponent(localStore, args.componentId, (component) => ({
      ...component,
      data: args.data,
    }));
  });

  const updateAction = useMutation(
    api.quiz.updateComponentAction,
  ).withOptimisticUpdate((localStore, args) => {
    patchCachedQuizComponent(localStore, args.componentId, (component) => ({
      ...component,
      action: args.action,
      actionProps: args.actionProps,
    }));
  });

  // When selection changes, copy the component to local state
  useEffect(() => {
    if (!selectedId) {
      setEditingComponent(null);
      originalComponentRef.current = null;
      hasChangesRef.current = false;
      return;
    }

    const component = serverComponents.find((c) => c.id === selectedId);
    if (component) {
      if (hasChangesRef.current) {
        return;
      }
      setEditingComponent({ ...component });
      originalComponentRef.current = { ...component };
      hasChangesRef.current = false;
    } else {
      // Component was deleted or doesn't exist
      setSelectedId(null);
      setEditingComponent(null);
      originalComponentRef.current = null;
    }
  }, [selectedId, serverComponents]);

  // Save changes to Convex
  const saveChanges = useCallback(async () => {
    if (
      !editingComponent ||
      !originalComponentRef.current ||
      !hasChangesRef.current
    ) {
      return;
    }

    const original = originalComponentRef.current;
    const current = editingComponent;

    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // Check if position changed
      if (
        JSON.stringify(current.position) !==
          JSON.stringify(original.position) &&
        current.position
      ) {
        promises.push(
          updatePosition({
            componentId: current.id as Id<"components">,
            position: current.position,
          }),
        );
      }

      // Check if props changed
      if (JSON.stringify(current.props) !== JSON.stringify(original.props)) {
        promises.push(
          updateProps({
            componentId: current.id as Id<"components">,
            props: current.props ?? {},
          }),
        );
      }

      // Check if data changed
      if (current.data !== original.data) {
        promises.push(
          updateData({
            componentId: current.id as Id<"components">,
            data: current.data ?? "",
          }),
        );
      }

      // Check if action changed
      if (
        current.action !== original.action ||
        JSON.stringify(current.actionProps) !==
          JSON.stringify(original.actionProps)
      ) {
        promises.push(
          updateAction({
            componentId: current.id as Id<"components">,
            action: current.action,
            actionProps: current.actionProps,
          }),
        );
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      hasChangesRef.current = false;
      originalComponentRef.current = { ...current };
      onSaveComplete?.();
    } catch (error) {
      console.error("Failed to save component changes:", error);
      onSaveComplete?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [
    editingComponent,
    updatePosition,
    updateProps,
    updateData,
    updateAction,
    onSaveComplete,
  ]);

  useEffect(() => {
    saveChangesRef.current = saveChanges;
  }, [saveChanges]);

  useEffect(
    () => () => {
      if (hasChangesRef.current) {
        void saveChangesRef.current();
      }
    },
    [],
  );

  // Select a component (copies to local state)
  const selectComponent = useCallback(
    (componentId: string | null) => {
      // If changing selection, save current changes first
      if (selectedId && selectedId !== componentId && hasChangesRef.current) {
        void saveChanges();
      }
      setSelectedId(componentId);
    },
    [selectedId, saveChanges],
  );

  // Deselect and save
  const deselectComponent = useCallback(() => {
    if (hasChangesRef.current) {
      void saveChanges();
    }
    setSelectedId(null);
  }, [saveChanges]);

  const updateLocalPosition = useCallback((position: ComponentPosition) => {
    setEditingComponent((prev) => {
      if (!prev) return prev;
      hasChangesRef.current = true;
      return { ...prev, position };
    });
  }, []);

  const updateLocalProps = useCallback((props: Record<string, unknown>) => {
    setEditingComponent((prev) => {
      if (!prev) return prev;
      hasChangesRef.current = true;
      return { ...prev, props: { ...prev.props, ...props } };
    });
  }, []);

  const updateLocalData = useCallback((data: string) => {
    setEditingComponent((prev) => {
      if (!prev) return prev;
      hasChangesRef.current = true;
      return { ...prev, data };
    });
  }, []);

  const updateLocalAction = useCallback(
    (action: PageAction | undefined, actionProps?: Record<string, unknown>) => {
      setEditingComponent((prev) => {
        if (!prev) return prev;
        hasChangesRef.current = true;
        return { ...prev, action, actionProps };
      });
    },
    [],
  );

  // Get component for display - use local editing state if selected, otherwise from server
  const getDisplayComponent = useCallback(
    (componentId: string): Component | null => {
      if (componentId === selectedId && editingComponent) {
        return editingComponent;
      }
      return serverComponents.find((c) => c.id === componentId) ?? null;
    },
    [selectedId, editingComponent, serverComponents],
  );

  // Get all components for display (merging editing component)
  const getDisplayComponents = useCallback((): Component[] => {
    // Only merge if editingComponent matches selectedId (prevents duplicates during selection change)
    if (
      !selectedId ||
      !editingComponent ||
      editingComponent.id !== selectedId
    ) {
      return serverComponents;
    }

    return serverComponents.map((c) =>
      c.id === selectedId ? editingComponent : c,
    );
  }, [serverComponents, selectedId, editingComponent]);

  return {
    // Selection state
    selectedId,
    selectedComponent: editingComponent,

    // Actions
    selectComponent,
    deselectComponent,

    // Local updates (for responsive editing)
    updateLocalPosition,
    updateLocalProps,
    updateLocalData,
    updateLocalAction,

    // Display helpers
    getDisplayComponent,
    getDisplayComponents,

    // Status
    isSaving,
    hasUnsavedChanges: hasChangesRef.current,

    // Manual save (usually not needed - save happens on deselect)
    saveChanges,
  };
}
