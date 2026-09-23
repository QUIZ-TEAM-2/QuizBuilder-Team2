"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Component } from "@/types";

/** How many steps back the history keeps per page. */
const HISTORY_LIMIT = 50;

/**
 * How long the page's components must stay unchanged before the change is
 * recorded as one history step. Saving a single edit can fire up to four
 * mutations (position, props, data, action), and each one updates the query,
 * so this groups that burst into a single undo step.
 */
const SETTLE_MS = 400;

type Snapshot = {
  components: Component[];
  /** Content fingerprint that ignores component IDs. */
  key: string;
};

/**
 * Component IDs change whenever a page's components are bulk-saved (the
 * backend deletes and re-inserts them), so compare content without IDs.
 */
function toSnapshot(components: Component[]): Snapshot {
  // JSON.stringify drops undefined fields, so this leaves the ID out.
  const key = JSON.stringify(
    components.map((component) => ({ ...component, id: undefined })),
  );
  return { components, key };
}

type UseUndoRedoOptions = {
  /** ID of the page being edited. History resets when this changes. */
  entityId: string | undefined;
  /** The page's components as currently saved in Convex. */
  serverComponents: Component[];
  enabled: boolean;
  /** Replaces all of the page's components with the given list. */
  applySnapshot: (components: Component[]) => Promise<unknown>;
  /** Called right before an undo/redo is applied (e.g. to clear selection). */
  onBeforeApply?: () => void;
  onError?: (error: unknown) => void;
};

/**
 * Page-level undo/redo built on snapshots of the saved components.
 *
 * Every settled change to the page's components (add, delete, move, resize,
 * edit, reorder, paste, template) becomes one step. Undo restores the previous
 * snapshot by bulk-saving it with the same mutation that z-index reordering
 * already uses.
 */
export function useUndoRedo({
  entityId,
  serverComponents,
  enabled,
  applySnapshot,
  onBeforeApply,
  onError,
}: UseUndoRedoOptions) {
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const committedRef = useRef<Snapshot | null>(null);
  const latestRef = useRef<Snapshot>(toSnapshot(serverComponents));
  const isApplyingRef = useRef(false);
  const [, setVersion] = useState(0);
  const rerender = useCallback(() => setVersion((v) => v + 1), []);

  latestRef.current = toSnapshot(serverComponents);

  // Fresh history for each page.
  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    committedRef.current = null;
    rerender();
  }, [entityId, rerender]);

  // Record settled changes as history steps.
  useEffect(() => {
    if (!enabled || !entityId) return;

    const current = toSnapshot(serverComponents);

    // First load of this page: this is the starting point, not a change.
    if (!committedRef.current) {
      committedRef.current = current;
      return;
    }
    if (current.key === committedRef.current.key) return;

    const timer = window.setTimeout(() => {
      // Our own undo/redo is landing; it adopts the result itself.
      if (isApplyingRef.current) return;

      const previous = committedRef.current;
      if (!previous || previous.key === current.key) return;

      undoStackRef.current = [...undoStackRef.current, previous].slice(
        -HISTORY_LIMIT,
      );
      redoStackRef.current = [];
      committedRef.current = current;
      rerender();
    }, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [serverComponents, enabled, entityId, rerender]);

  const applyStep = useCallback(
    async (target: Snapshot, onFailure: () => void) => {
      isApplyingRef.current = true;
      onBeforeApply?.();
      try {
        await applySnapshot(target.components);
      } catch (error) {
        onFailure();
        onError?.(error);
      } finally {
        // Wait for the query to reflect the change, then treat whatever is
        // saved as the new starting point without recording it as an edit.
        window.setTimeout(() => {
          committedRef.current = latestRef.current;
          isApplyingRef.current = false;
          rerender();
        }, SETTLE_MS + 100);
      }
    },
    [applySnapshot, onBeforeApply, onError, rerender],
  );

  const undo = useCallback(async () => {
    if (!enabled || isApplyingRef.current) return;
    const target = undoStackRef.current.at(-1);
    const current = committedRef.current;
    if (!target || !current) return;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, current];
    rerender();

    await applyStep(target, () => {
      // Put the stacks back the way they were.
      redoStackRef.current = redoStackRef.current.slice(0, -1);
      undoStackRef.current = [...undoStackRef.current, target];
    });
  }, [enabled, applyStep, rerender]);

  const redo = useCallback(async () => {
    if (!enabled || isApplyingRef.current) return;
    const target = redoStackRef.current.at(-1);
    const current = committedRef.current;
    if (!target || !current) return;

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, current].slice(
      -HISTORY_LIMIT,
    );
    rerender();

    await applyStep(target, () => {
      undoStackRef.current = undoStackRef.current.slice(0, -1);
      redoStackRef.current = [...redoStackRef.current, target];
    });
  }, [enabled, applyStep, rerender]);

  return {
    undo,
    redo,
    canUndo: enabled && undoStackRef.current.length > 0,
    canRedo: enabled && redoStackRef.current.length > 0,
  };
}
