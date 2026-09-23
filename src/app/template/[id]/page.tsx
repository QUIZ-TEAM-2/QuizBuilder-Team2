"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PencilIcon, ArrowLeft, Loader2 } from "lucide-react";
import ConvexUserButton from "@/components/auth/convex-user-button";
import PreviewPanel from "@/app/quiz/[uuid]/components/PreviewPanel";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import AudioPickerDialog from "@/components/quiz/AudioPickerDialog";
import type { Id, Component, ComponentPosition, PageAction } from "@/types";

export default function TemplateEditorPage() {
  const params = useParams();
  const templateId = params?.id as string;
  const router = useRouter();

  const [templateTitle, setTemplateTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const lastSavedTitleRef = useRef<string>("");

  const templateQuery = useQuery(
    api.templates.getTemplate,
    templateId ? { id: templateId as Id<"templates"> } : "skip",
  );
  const audiosQuery = useQuery(api.audios.getUserAudios);
  const updateTemplate = useMutation(
    api.templates.updateTemplate,
  ).withOptimisticUpdate((localStore, args) => {
    const cached = localStore.getQuery(api.templates.getTemplate, {
      id: args.id,
    });
    if (cached) {
      localStore.setQuery(
        api.templates.getTemplate,
        { id: args.id },
        { ...cached, ...args },
      );
    }

    // Best-effort: keep the templates list in sync too.
    const allTemplates = localStore.getQuery(api.templates.getAllTemplates, {});
    if (Array.isArray(allTemplates)) {
      localStore.setQuery(
        api.templates.getAllTemplates,
        {},
        allTemplates.map((t) => (t?._id === args.id ? { ...t, ...args } : t)),
      );
    }
  });

  const setTemplateComponents = useMutation(
    api.templates.setTemplateComponents,
  ).withOptimisticUpdate((localStore, args) => {
    const cached = localStore.getQuery(api.templates.getTemplate, {
      id: args.id,
    });
    if (cached) {
      localStore.setQuery(
        api.templates.getTemplate,
        { id: args.id },
        { ...cached, components: args.components },
      );
    }
  });
  const imagesQuery = useQuery(api.images.getUserImages);

  useEffect(() => {
    if (!templateQuery) {
      return;
    }

    try {
      const resolvedTitle = templateQuery.title?.trim() || "Untitled Template";
      lastSavedTitleRef.current = resolvedTitle;
      setTemplateTitle(resolvedTitle);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error("Failed to load template");
      router.push("/template");
    }
  }, [templateQuery, router]);

  const handleTitleCommit = useCallback(async () => {
    if (!templateId) return;

    const trimmed = templateTitle.trim();
    const normalized = trimmed.length === 0 ? "Untitled Template" : trimmed;

    if (templateTitle !== normalized) {
      setTemplateTitle(normalized);
    }

    if (normalized === lastSavedTitleRef.current) {
      return;
    }

    setIsSavingTitle(true);
    try {
      await updateTemplate({
        id: templateId as Id<"templates">,
        title: normalized,
      });
      lastSavedTitleRef.current = normalized;
    } catch (error) {
      console.error("Failed to update template title:", error);
      toast.error("Failed to update template title");
      setTemplateTitle(lastSavedTitleRef.current);
    } finally {
      setIsSavingTitle(false);
    }
  }, [templateId, templateTitle, updateTemplate]);

  // Components from Convex
  const serverComponents = useMemo(
    () => (templateQuery?.components ?? []) as Component[],
    [templateQuery?.components],
  );

  // Local editing state for selected component
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<Component | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // When selection changes, copy the component to local state
  useEffect(() => {
    if (selectedId) {
      const component = serverComponents.find((c) => c.id === selectedId);
      setEditingComponent(component || null);
    } else {
      setEditingComponent(null);
    }
  }, [selectedId, serverComponents]);

  // Get display components (use editing state if selected, otherwise from server)
  const displayComponents = useMemo(() => {
    if (!selectedId || !editingComponent) {
      return serverComponents;
    }
    return serverComponents.map((c) =>
      c.id === selectedId ? editingComponent : c,
    );
  }, [serverComponents, selectedId, editingComponent]);

  const selectedComponent = editingComponent;

  const currentBackground = templateQuery?.background;
  const [localPageName, setLocalPageName] = useState<string | null>(null);
  const currentPageName = localPageName ?? templateQuery?.pageName ?? "";

  // Sync local page name when template changes
  useEffect(() => {
    if (templateQuery?.pageName !== undefined) {
      setLocalPageName(null);
    }
  }, [templateQuery?.pageName]);

  // Save page name on blur
  const handlePageNameBlur = useCallback(async () => {
    if (!templateId || !templateQuery || localPageName === null) return;
    const newName = localPageName.trim() || undefined;
    if (newName === templateQuery.pageName) {
      setLocalPageName(null);
      return;
    }

    try {
      await updateTemplate({
        id: templateId as Id<"templates">,
        pageName: newName,
      });
      setLocalPageName(null);
    } catch (error) {
      console.error("Failed to save page name:", error);
      toast.error("Failed to save page name");
    }
  }, [templateId, templateQuery, localPageName, updateTemplate]);

  // Save component changes
  const saveComponentChanges = useCallback(async () => {
    if (!selectedId || !editingComponent || !templateId) return;

    setIsSaving(true);
    try {
      const updatedComponents = serverComponents.map((c) =>
        c.id === selectedId ? editingComponent : c,
      );
      await setTemplateComponents({
        id: templateId as Id<"templates">,
        components: updatedComponents,
      });
    } catch (error) {
      console.error("Failed to save component changes:", error);
      toast.error("Failed to save component changes");
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedId,
    editingComponent,
    templateId,
    serverComponents,
    setTemplateComponents,
  ]);

  const handleComponentPositionChange = useCallback(
    (componentId: string, position: ComponentPosition) => {
      if (componentId === selectedId && editingComponent) {
        setEditingComponent({ ...editingComponent, position });
      } else {
        // Update in database immediately for non-selected components
        const updatedComponents = serverComponents.map((c) =>
          c.id === componentId ? { ...c, position } : c,
        );
        setTemplateComponents({
          id: templateId as Id<"templates">,
          components: updatedComponents,
        }).catch((error) => {
          console.error("Failed to update component position:", error);
          toast.error("Failed to update component position");
        });
      }
    },
    [
      selectedId,
      editingComponent,
      serverComponents,
      templateId,
      setTemplateComponents,
    ],
  );

  const handleTextChange = useCallback(
    (componentId: string, text: string) => {
      if (componentId === selectedId && editingComponent) {
        setEditingComponent({ ...editingComponent, data: text });
      }
    },
    [selectedId, editingComponent],
  );

  const handleUpdateProps = useCallback(
    (props: Record<string, unknown>) => {
      if (editingComponent) {
        setEditingComponent({
          ...editingComponent,
          props: { ...editingComponent.props, ...props },
        });
      }
    },
    [editingComponent],
  );

  const handleUpdateData = useCallback(
    (data: string) => {
      if (editingComponent) {
        setEditingComponent({ ...editingComponent, data });
      }
    },
    [editingComponent],
  );

  const handleUpdateAction = useCallback(
    (action: PageAction | undefined, actionProps?: Record<string, unknown>) => {
      if (editingComponent) {
        setEditingComponent({ ...editingComponent, action, actionProps });
      }
    },
    [editingComponent],
  );

  // Handle background click - deselect and save
  const handleBackgroundClick = useCallback(() => {
    if (selectedId) {
      void saveComponentChanges();
      setSelectedId(null);
    }
  }, [selectedId, saveComponentChanges]);

  const handleUpdateBackground = useCallback(
    async (background: { color?: string; image?: string }) => {
      if (!templateId) return;
      try {
        await updateTemplate({
          id: templateId as Id<"templates">,
          background,
        });
      } catch (error) {
        console.error("Failed to update background:", error);
        toast.error("Failed to update background");
      }
    },
    [templateId, updateTemplate],
  );

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
        | "bgm"
        | "timer",
      dropPosition: { x: number; y: number },
      shapeVariant?: string,
    ) => {
      if (!templateId || !templateQuery) return;

      try {
        if (
          componentType === "bgm" &&
          serverComponents.some((component) => component.type === "bgm")
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
          props.variant = "rainbow";
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
        } else if (componentType === "timer") {
          width = 26;
          height = 10;
          props.duration = 60;
          props.warningAt = 10;
          props.textColor = "#f8fafc";
          props.warningColor = "#f87171";
          props.backgroundColor = "#020617";
          props.showBackground = true;
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

        const newComponent: Component = {
          id: `component-${Date.now()}-${Math.random()}`,
          type: componentType,
          data: componentType === "text" ? "New Text" : "",
          props,
          position: {
            x: dropPosition.x,
            y: dropPosition.y,
            width,
            height,
          },
        };

        const updatedComponents = [...serverComponents, newComponent];
        await setTemplateComponents({
          id: templateId as Id<"templates">,
          components: updatedComponents,
        });

        // Select the new component
        setSelectedId(newComponent.id);
      } catch (error) {
        console.error("Failed to create component:", error);
        toast.error("Failed to add component");
      }
    },
    [templateId, templateQuery, serverComponents, setTemplateComponents],
  );

  const handleDeleteComponent = useCallback(async () => {
    if (!selectedId || !templateId) return;

    try {
      const updatedComponents = serverComponents.filter(
        (c) => c.id !== selectedId,
      );
      await setTemplateComponents({
        id: templateId as Id<"templates">,
        components: updatedComponents,
      });
      setSelectedId(null);
    } catch (error) {
      console.error("Failed to delete component:", error);
      toast.error("Failed to delete component");
    }
  }, [selectedId, templateId, serverComponents, setTemplateComponents]);

  const handleComponentClick = useCallback(
    (component: Component) => {
      if (selectedId && selectedId !== component.id) {
        // Save previous component before selecting new one
        void saveComponentChanges();
      }
      setSelectedId(component.id);
    },
    [selectedId, saveComponentChanges],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
          <p className="text-gray-500">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!templateQuery) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Template not found</p>
          <Button onClick={() => router.push("/template")} className="mt-4">
            Back to Templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100">
      {/* Top Toolbar */}
      <div className="relative flex flex-row border-b bg-white px-4 py-2">
        {/* Left side controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/template")}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Center content */}
        <div className="absolute left-1/2 -translate-x-1/2 transform">
          <div className="flex flex-col items-center gap-2">
            {/* Template Title with Edit Icon */}
            <div className="group flex items-center gap-2">
              {isEditingTitle ? (
                <Input
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    void handleTitleCommit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setIsEditingTitle(false);
                      void handleTitleCommit();
                    } else if (e.key === "Escape") {
                      setTemplateTitle(lastSavedTitleRef.current);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="max-w-xs text-center"
                  autoFocus
                  disabled={isSavingTitle}
                />
              ) : (
                <div
                  onClick={() => setIsEditingTitle(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1 transition-colors hover:border-blue-500"
                >
                  <span className="font-medium">
                    {templateTitle || "Template Editor"}
                  </span>
                  <PencilIcon className="h-3 w-3 text-gray-400" />
                </div>
              )}
              {isSavingTitle && (
                <span className="text-xs text-gray-500">Saving...</span>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 transform">
          <div className="flex items-center gap-3">
            <ConvexUserButton />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview Panel */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <PreviewPanel
            page={{
              _id: templateId as Id<"pages">,
              quizId: "" as Id<"quiz">,
              pageName: currentPageName,
              components: displayComponents,
              background: currentBackground,
              userId: "" as Id<"users">,
              _creationTime: 0,
            }}
            components={displayComponents}
            background={currentBackground}
            pageName={currentPageName}
            onPageNameChange={(value) => setLocalPageName(value)}
            onPageNameBlur={handlePageNameBlur}
            activeIndex={0}
            pageCount={1}
            onSelectPage={() => {
              // No-op: templates don't have multiple pages
            }}
            selectedComponentId={selectedId}
            selectedComponent={selectedComponent}
            onComponentClick={handleComponentClick}
            onBackgroundClick={handleBackgroundClick}
            isSaving={isSaving}
            onComponentPositionChange={handleComponentPositionChange}
            onTextChange={handleTextChange}
            onDropComponent={handleDropComponent}
            onUpdateProps={handleUpdateProps}
            onUpdateData={handleUpdateData}
            onDeleteComponent={handleDeleteComponent}
            onOpenImagePicker={() => setIsImagePickerOpen(true)}
            onOpenAudioPicker={() => setIsAudioPickerOpen(true)}
            onUpdateBackground={handleUpdateBackground}
            multiSelectedIds={multiSelectedIds}
            onMultiSelect={setMultiSelectedIds}
            onUpdateAction={handleUpdateAction}
            hideTemplateButton={true}
          />
        </div>
      </div>

      {/* Image Picker Dialog */}
      {imagesQuery && (
        <ImagePickerDialog
          isOpen={isImagePickerOpen}
          onClose={() => setIsImagePickerOpen(false)}
          images={imagesQuery}
          onImageSelect={async (url: string) => {
            if (!selectedId || !templateId) return;
            const updatedComponents = serverComponents.map((c) =>
              c.id === selectedId ? { ...c, data: url } : c,
            );
            try {
              await setTemplateComponents({
                id: templateId as Id<"templates">,
                components: updatedComponents,
              });
              setSelectedId(null);
            } catch (error) {
              console.error("Failed to update image:", error);
              toast.error("Failed to update image");
            }
          }}
        />
      )}
      {audiosQuery && (
        <AudioPickerDialog
          isOpen={isAudioPickerOpen}
          onClose={() => setIsAudioPickerOpen(false)}
          audios={audiosQuery}
          onAudioSelect={async (url: string, fileName: string) => {
            if (!selectedId || !templateId) return;
            const updatedComponents = serverComponents.map((c) =>
              c.id === selectedId
                ? { ...c, data: url, props: { ...c.props, fileName } }
                : c,
            );
            try {
              await setTemplateComponents({
                id: templateId as Id<"templates">,
                components: updatedComponents,
              });
              setSelectedId(null);
            } catch (error) {
              console.error("Failed to update audio:", error);
              toast.error("Failed to update audio");
            }
          }}
        />
      )}
    </div>
  );
}
