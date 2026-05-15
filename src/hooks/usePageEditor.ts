"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useEditingComponent } from "./useEditingComponent";
import type { PageTransitionEffect } from "@/lib/pageTransitions";
import type { QuestionMode } from "@/types";
import type {
  Component,
  ComponentPosition,
  EditorActions,
  GroupChild,
  Id,
  PageAction,
  PageBackground,
  PageEntity,
  PageTemplate,
  ResultEntity,
} from "@/types";

type PageType = "page" | "result" | "onboarding";

const createClientComponentId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `component-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const cloneGroupChildrenForPaste = (
  children: GroupChild[] | undefined,
): GroupChild[] | undefined => {
  if (!children?.length) return undefined;

  return children.map((child) => ({
    ...child,
    id: createClientComponentId(),
    props: child.props ? { ...child.props } : undefined,
    actionProps: child.actionProps ? { ...child.actionProps } : undefined,
    relativePosition: { ...child.relativePosition },
  }));
};

type SetComponentsMutation<TId> = (args: {
  id: TId;
  components: Component[];
}) => Promise<unknown>;

type UpdateEntityMutation<TId> = (args: {
  id: TId;
  pageName?: string;
  background?: PageBackground;
  transitionEffect?: PageTransitionEffect;
  questionMode?: QuestionMode;
}) => Promise<unknown>;

type UsePageEditorOptions<TEntity extends PageEntity | ResultEntity> = {
  quizId: Id<"quiz"> | null;
  pageType: PageType;
  /** The current entity (page/result/onboarding) being edited */
  entity: TEntity | null | undefined;
  /** Mutation to set components on the entity */
  setComponentsMutation: SetComponentsMutation<TEntity["_id"]>;
  /** Mutation to update entity metadata (pageName, background) */
  updateEntityMutation: UpdateEntityMutation<TEntity["_id"]>;
  /** Whether to enable clipboard shortcuts (Cmd+C/X/V/D) */
  enableClipboard?: boolean;
  /** Whether to enable z-index reordering */
  enableZIndex?: boolean;
  /** Whether to enable undo/redo placeholders */
  enableUndoRedo?: boolean;
};

export function usePageEditor<TEntity extends PageEntity | ResultEntity>({
  quizId,
  pageType,
  entity,
  setComponentsMutation,
  updateEntityMutation,
  enableClipboard = true,
  enableZIndex = true,
  enableUndoRedo = false,
}: UsePageEditorOptions<TEntity>) {
  const createComponent = useMutation(api.quiz.createComponent);
  const deleteComponentMutation = useMutation(api.quiz.deleteComponent);
  const createMergeGroup = useMutation(api.quiz.createMergeGroup);
  const unmergeGroupMutation = useMutation(api.quiz.unmergeGroup);
  const imagesQuery = useQuery(api.images.getUserImages);
  const audiosQuery = useQuery(api.audios.getUserAudios);

  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isSavingPageMeta, setIsSavingPageMeta] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [localPageName, setLocalPageName] = useState<string | null>(null);

  // Components from Convex
  const serverComponents = useMemo(
    () => (entity?.components ?? []) as Component[],
    [entity?.components],
  );

  // Use the editing hook for selected component
  const editing = useEditingComponent(
    serverComponents,
    (error) => {
      if (error) {
        toast.error("Failed to save changes");
      }
    },
    { quizId: quizId ?? undefined },
  );

  // Get display components (merges editing state with server state)
  const displayComponents = editing.getDisplayComponents();

  // Sync local page name when entity changes
  useEffect(() => {
    setLocalPageName(null);
  }, [entity?._id, entity?.pageName]);

  const currentPageName = localPageName ?? entity?.pageName ?? "";
  const currentBackground = entity?.background;
  const currentTransitionEffect = entity?.transitionEffect ?? "none";

  const handlePageNameBlur = useCallback(async () => {
    if (!entity || localPageName === null) return;
    if (localPageName === (entity.pageName ?? "")) return;

    setIsSavingPageMeta(true);
    try {
      await updateEntityMutation({
        id: entity._id,
        pageName: localPageName.trim() || undefined,
      });
    } catch (error) {
      console.error("Failed to save page name:", error);
      toast.error("Failed to save page name");
    } finally {
      setIsSavingPageMeta(false);
      setLocalPageName(null);
    }
  }, [entity, localPageName, updateEntityMutation]);

  const handleComponentPositionChange = useCallback(
    (componentId: string, position: ComponentPosition) => {
      if (componentId === editing.selectedId) {
        editing.updateLocalPosition(position);
      }
    },
    [editing],
  );

  const handleUpdateProps = useCallback(
    (props: Record<string, unknown>) => {
      editing.updateLocalProps(props);
    },
    [editing],
  );

  const handleUpdateData = useCallback(
    (data: string) => {
      editing.updateLocalData(data);
    },
    [editing],
  );

  const handleUpdateAction = useCallback(
    (action: PageAction | undefined, actionProps?: Record<string, unknown>) => {
      editing.updateLocalAction(action, actionProps);
    },
    [editing],
  );

  const handleTextChange = useCallback(
    (componentId: string, text: string) => {
      if (componentId === editing.selectedId) {
        editing.updateLocalData(text);
      }
    },
    [editing],
  );

  const handleDeleteComponent = useCallback(async () => {
    if (!editing.selectedId) return;

    try {
      await deleteComponentMutation({
        componentId: editing.selectedId as Id<"components">,
      });
      editing.selectComponent(null);
    } catch (error) {
      console.error("Failed to delete component:", error);
      toast.error("Failed to delete component");
    }
  }, [editing, deleteComponentMutation]);

  const handleDropComponent = useCallback(
    async (
      componentType:
        | "image"
        | "text"
        | "shape"
        | "progressBar"
        | "ranking"
        | "input"
        | "matching"
        | "slider"
        | "bgm",
      dropPosition: { x: number; y: number },
      shapeVariant?: string,
    ) => {
      if (!entity) return;

      try {
        if (
          componentType === "bgm" &&
          displayComponents.some((component) => component.type === "bgm")
        ) {
          toast.error("Each page can only have one BGM component");
          return;
        }

        const props: Record<string, unknown> = {};
        let width = 40;
        let height = 20;

        if (componentType === "text") {
          width = 80;
          height = 10;
        } else if (componentType === "shape") {
          width = 25;
          height = 15;
          if (shapeVariant) {
            props.variant = shapeVariant;
          }
        } else if (componentType === "progressBar") {
          width = 24;
          height = 8;
          props.currentColor = "#d8b4fe";
          props.totalColor = "#f8fafc";
        } else if (componentType === "ranking") {
          width = 84;
          height = 36;
          props.itemColor = "#ffffff";
          props.items = [
            { id: "rank-1", label: "First option" },
            { id: "rank-2", label: "Second option" },
            { id: "rank-3", label: "Third option" },
            { id: "rank-4", label: "Fourth option" },
          ];
        } else if (componentType === "input") {
          width = 80;
          height = 12;
          props.placeholder = "Enter text...";
          props.maxLength = 200;
          props.color = "#F8FAFC";
          props.textColor = "#111827";
        } else if (componentType === "matching") {
          width = 84;
          height = 36;
        } else if (componentType === "slider") {
          width = 80;
          height = 14;
          props.min = 0;
          props.max = 5;
          props.divisions = 5;
          props.defaultValue = 3;
          props.trackColor = "#FFFFFF";
          props.rangeColor = "#FFFFFF";
          props.thumbColor = "#111827";
          props.textColor = "#FFFFFF";
          props.showValue = true;
        } else if (componentType === "bgm") {
          width = 12;
          height = 8;
          props.muted = false;
          props.volume = 70;
          props.loop = true;
          props.fileName = "";
          props.backgroundColor = "#020617";
          props.iconColor = "#ffffff";
          props.opacity = 100;
        }

        const newComponent = await createComponent({
          pageId: entity._id,
          pageType,
          type: componentType,
          data: componentType === "text" ? "New Text" : "",
          props,
          position: {
            x: dropPosition.x,
            y: dropPosition.y,
            width,
            height,
          },
        });

        if (newComponent) {
          editing.selectComponent(newComponent._id);
        }
      } catch (error) {
        console.error("Failed to create component:", error);
        toast.error("Failed to add component");
      }
    },
    [displayComponents, entity, pageType, createComponent, editing],
  );

  const handleImageSelect = useCallback(
    (url: string) => {
      editing.updateLocalData(url);
      setIsImagePickerOpen(false);
    },
    [editing],
  );

  const handleAudioSelect = useCallback(
    (url: string, fileName: string) => {
      editing.updateLocalData(url);
      editing.updateLocalProps({ fileName });
      setIsAudioPickerOpen(false);
    },
    [editing],
  );

  const handleApplyTemplate = useCallback(
    async (template: PageTemplate) => {
      if (!entity) return;

      const newComponents = template.build();
      try {
        await setComponentsMutation({
          id: entity._id,
          components: newComponents,
        });
        // Templates now carry the transition choice too, so applying one gives
        // the page the same motion preset as the saved design.
        await updateEntityMutation({
          id: entity._id,
          background: template.background,
          transitionEffect: template.transitionEffect ?? "none",
          questionMode: pageType === "page" ? template.questionMode : undefined,
        });
        editing.selectComponent(null);
        toast.success("Template applied");
      } catch (error) {
        console.error("Failed to apply template:", error);
        toast.error("Failed to apply template");
      }
    },
    [entity, setComponentsMutation, updateEntityMutation, editing],
  );

  const handleDeselectComponent = useCallback(() => {
    editing.deselectComponent();
  }, [editing]);

  const handleUpdateBackground = useCallback(
    async (background: { color?: string; image?: string }) => {
      if (!entity) return;
      try {
        await updateEntityMutation({
          id: entity._id,
          background,
        });
      } catch (error) {
        console.error("Failed to update background:", error);
        toast.error("Failed to update background");
      }
    },
    [entity, updateEntityMutation],
  );

  const handleUpdateTransitionEffect = useCallback(
    async (transitionEffect: PageTransitionEffect) => {
      if (!entity) return;
      try {
        // This is intentionally saved as page metadata instead of component data
        // because the effect belongs to the whole screen, not a single block.
        await updateEntityMutation({
          id: entity._id,
          transitionEffect,
        });
      } catch (error) {
        console.error("Failed to update transition effect:", error);
        toast.error("Failed to update transition effect");
      }
    },
    [entity, updateEntityMutation],
  );

  const handleMergeComponents = useCallback(
    async (componentIds: string[]) => {
      if (componentIds.length < 2) return;

      try {
        const result = await createMergeGroup({
          componentIds: componentIds as Id<"components">[],
        });
        setMultiSelectedIds([]);
        if (result) {
          editing.selectComponent(result._id);
        }
        toast.success("Components merged into group");
      } catch (error) {
        console.error("Failed to merge components:", error);
        toast.error("Failed to merge components");
      }
    },
    [createMergeGroup, editing],
  );

  const handleUnmergeGroup = useCallback(
    async (groupId: string) => {
      try {
        await unmergeGroupMutation({
          groupId: groupId as Id<"components">,
        });
        editing.selectComponent(null);
        toast.success("Group unmerged");
      } catch (error) {
        console.error("Failed to unmerge group:", error);
        toast.error("Failed to unmerge group");
      }
    },
    [unmergeGroupMutation, editing],
  );

  // Clipboard handlers
  const handleCopy = useCallback(() => {
    if (!editing.selectedComponent) return;
    sessionStorage.setItem(
      "copiedComponent",
      JSON.stringify(editing.selectedComponent),
    );
    toast.success("Copied to clipboard");
  }, [editing.selectedComponent]);

  const handleCut = useCallback(async () => {
    if (!editing.selectedComponent) return;
    sessionStorage.setItem(
      "copiedComponent",
      JSON.stringify(editing.selectedComponent),
    );
    await handleDeleteComponent();
    toast.success("Cut to clipboard");
  }, [editing.selectedComponent, handleDeleteComponent]);

  const handlePaste = useCallback(async () => {
    if (!entity) return;
    const copiedJson = sessionStorage.getItem("copiedComponent");
    if (!copiedJson) return;

    try {
      const copied = JSON.parse(copiedJson) as Component;
      if (
        copied.type === "bgm" &&
        displayComponents.some((component) => component.type === "bgm")
      ) {
        toast.error("Each page can only have one BGM component");
        return;
      }
      const children = cloneGroupChildrenForPaste(copied.children);
      const newComponent = await createComponent({
        pageId: entity._id,
        pageType,
        type: copied.type,
        data: copied.data,
        props: copied.props,
        action: copied.action,
        actionProps: copied.actionProps,
        children,
        position: copied.position
          ? {
              ...copied.position,
              x: copied.position.x + 5,
              y: copied.position.y + 5,
            }
          : { x: 10, y: 10, width: 80, height: 15 },
      });

      if (newComponent) {
        editing.selectComponent(newComponent._id);
      }
      toast.success("Pasted");
    } catch (error) {
      console.error("Failed to paste:", error);
      toast.error("Failed to paste");
    }
  }, [displayComponents, entity, pageType, createComponent, editing]);

  const handleDuplicate = useCallback(async () => {
    if (!editing.selectedComponent || !entity) return;

    try {
      const comp = editing.selectedComponent;
      if (comp.type === "bgm") {
        toast.error("Each page can only have one BGM component");
        return;
      }
      const children = cloneGroupChildrenForPaste(comp.children);
      const newComponent = await createComponent({
        pageId: entity._id,
        pageType,
        type: comp.type,
        data: comp.data,
        props: comp.props,
        action: comp.action,
        actionProps: comp.actionProps,
        children,
        position: comp.position
          ? {
              ...comp.position,
              x: comp.position.x + 5,
              y: comp.position.y + 5,
            }
          : { x: 10, y: 10, width: 80, height: 15 },
      });

      if (newComponent) {
        editing.selectComponent(newComponent._id);
      }
      toast.success("Duplicated");
    } catch (error) {
      console.error("Failed to duplicate:", error);
      toast.error("Failed to duplicate");
    }
  }, [editing, entity, pageType, createComponent]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    toast.info("Undo not available in this version");
  }, []);

  const handleRedo = useCallback(() => {
    toast.info("Redo not available in this version");
  }, []);

  // Z-index handlers
  const selectedIndex = editing.selectedId
    ? displayComponents.findIndex((c) => c.id === editing.selectedId)
    : -1;
  const canBringForward =
    selectedIndex >= 0 && selectedIndex < displayComponents.length - 1;
  const canSendBackward = selectedIndex > 0;

  const reorderComponents = useCallback(
    async (newComponents: Component[]) => {
      if (!entity) return;
      try {
        await setComponentsMutation({
          id: entity._id,
          components: newComponents,
        });
      } catch (error) {
        console.error("Failed to reorder:", error);
        toast.error("Failed to reorder");
      }
    },
    [entity, setComponentsMutation],
  );

  const handleBringForward = useCallback(async () => {
    if (selectedIndex < 0 || selectedIndex >= displayComponents.length - 1)
      return;
    const newComponents = [...displayComponents];
    const component = newComponents[selectedIndex];
    if (!component) return;
    newComponents.splice(selectedIndex, 1);
    newComponents.splice(selectedIndex + 1, 0, component);
    await reorderComponents(newComponents);
  }, [displayComponents, selectedIndex, reorderComponents]);

  const handleSendBackward = useCallback(async () => {
    if (selectedIndex <= 0) return;
    const newComponents = [...displayComponents];
    const component = newComponents[selectedIndex];
    if (!component) return;
    newComponents.splice(selectedIndex, 1);
    newComponents.splice(selectedIndex - 1, 0, component);
    await reorderComponents(newComponents);
  }, [displayComponents, selectedIndex, reorderComponents]);

  const handleBringToFront = useCallback(async () => {
    if (selectedIndex < 0 || selectedIndex >= displayComponents.length - 1)
      return;
    const newComponents = [...displayComponents];
    const component = newComponents[selectedIndex];
    if (!component) return;
    newComponents.splice(selectedIndex, 1);
    newComponents.push(component);
    await reorderComponents(newComponents);
  }, [displayComponents, selectedIndex, reorderComponents]);

  const handleSendToBack = useCallback(async () => {
    if (selectedIndex <= 0) return;
    const newComponents = [...displayComponents];
    const component = newComponents[selectedIndex];
    if (!component) return;
    newComponents.splice(selectedIndex, 1);
    newComponents.unshift(component);
    await reorderComponents(newComponents);
  }, [displayComponents, selectedIndex, reorderComponents]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        editing.deselectComponent();
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (enableUndoRedo && modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (
        enableUndoRedo &&
        modifier &&
        ((e.key === "z" && e.shiftKey) || e.key === "y")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (enableClipboard && modifier && e.key === "c") {
        e.preventDefault();
        handleCopy();
        return;
      }

      if (enableClipboard && modifier && e.key === "x") {
        e.preventDefault();
        void handleCut();
        return;
      }

      if (enableClipboard && modifier && e.key === "v") {
        e.preventDefault();
        void handlePaste();
        return;
      }

      if (enableClipboard && modifier && e.key === "d") {
        e.preventDefault();
        void handleDuplicate();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (editing.selectedComponent) {
          e.preventDefault();
          void handleDeleteComponent();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editing,
    enableClipboard,
    enableUndoRedo,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleDeleteComponent,
  ]);

  const hasCopiedComponent =
    typeof window !== "undefined" &&
    !!sessionStorage.getItem("copiedComponent");

  // Build the EditorActions object
  const editorActions: EditorActions = useMemo(
    () => ({
      onComponentPositionChange: handleComponentPositionChange,
      onTextChange: handleTextChange,
      onUpdateProps: handleUpdateProps,
      onUpdateData: handleUpdateData,
      onUpdateAction: handleUpdateAction,
      onDeleteComponent: handleDeleteComponent,
      onDropComponent: handleDropComponent,
      onOpenImagePicker: () => setIsImagePickerOpen(true),
      onOpenAudioPicker: () => setIsAudioPickerOpen(true),
      onCopy: enableClipboard ? handleCopy : undefined,
      onCut: enableClipboard ? handleCut : undefined,
      onPaste: enableClipboard ? handlePaste : undefined,
      onDuplicate: enableClipboard ? handleDuplicate : undefined,
      canPaste: enableClipboard ? hasCopiedComponent : false,
      onUndo: enableUndoRedo ? handleUndo : undefined,
      onRedo: enableUndoRedo ? handleRedo : undefined,
      canUndo: false,
      canRedo: false,
      onBringForward: enableZIndex ? handleBringForward : undefined,
      onSendBackward: enableZIndex ? handleSendBackward : undefined,
      onBringToFront: enableZIndex ? handleBringToFront : undefined,
      onSendToBack: enableZIndex ? handleSendToBack : undefined,
      canBringForward: enableZIndex ? canBringForward : false,
      canSendBackward: enableZIndex ? canSendBackward : false,
      multiSelectedIds,
      onMultiSelect: setMultiSelectedIds,
      onMergeComponents: handleMergeComponents,
      onUnmergeGroup: handleUnmergeGroup,
    }),
    [
      handleComponentPositionChange,
      handleTextChange,
      handleUpdateProps,
      handleUpdateData,
      handleUpdateAction,
      handleDeleteComponent,
      handleDropComponent,
      enableClipboard,
      handleCopy,
      handleCut,
      handlePaste,
      handleDuplicate,
      hasCopiedComponent,
      enableUndoRedo,
      handleUndo,
      handleRedo,
      enableZIndex,
      handleBringForward,
      handleSendBackward,
      handleBringToFront,
      handleSendToBack,
      canBringForward,
      canSendBackward,
      multiSelectedIds,
      handleMergeComponents,
      handleUnmergeGroup,
    ],
  );

  return {
    // Editing state
    editing,
    displayComponents,

    // Page name
    currentPageName,
    setLocalPageName,
    handlePageNameBlur,

    // Background
    currentBackground,
    currentTransitionEffect,
    handleUpdateBackground,
    handleUpdateTransitionEffect,

    // Image picker
    isImagePickerOpen,
    setIsImagePickerOpen,
    imagesQuery,
    handleImageSelect,
    isAudioPickerOpen,
    setIsAudioPickerOpen,
    audiosQuery,
    handleAudioSelect,

    // Template
    handleApplyTemplate,

    // Selection
    handleDeselectComponent,
    multiSelectedIds,
    setMultiSelectedIds,

    // Meta
    isSavingPageMeta,
    isSaving: editing.isSaving || isSavingPageMeta,

    // Grouped actions object
    editorActions,
  };
}
