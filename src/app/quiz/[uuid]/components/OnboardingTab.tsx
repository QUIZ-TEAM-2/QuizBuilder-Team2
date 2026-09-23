"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Loader2, Plus, X } from "lucide-react";
import EditorPreviewPanel from "./EditorPreviewPanel";
import RenamePageDialog from "./RenamePageDialog";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import AudioPickerDialog from "@/components/quiz/AudioPickerDialog";
import { api } from "../../../../../convex/_generated/api";
import { usePageEditor } from "@/hooks/usePageEditor";
import { useTemplates } from "@/hooks/useTemplates";
import type { Component, PageEntity } from "@/types";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface OnboardingTabProps {
  quizId: Id<"quiz"> | null;
}

type QuizBasicInfo = {
  _id: Id<"quiz">;
  description?: string;
  tags?: string[];
  topic?: QuizTopic;
  brandName?: string;
  brandAvatar?: string;
  coverImage?: string;
};

type QuizTopic =
  | "general"
  | "personality"
  | "beauty"
  | "fashion"
  | "wellness"
  | "education"
  | "entertainment"
  | "marketing"
  | "lifestyle"
  | "others";

type BasicInfoForm = {
  description: string;
  tags: string[];
  topic: QuizTopic;
  brandName: string;
  brandAvatar: string;
  coverImage: string;
};

const QUIZ_TOPICS: Array<{ value: QuizTopic; label: string }> = [
  { value: "general", label: "General" },
  { value: "personality", label: "Personality" },
  { value: "beauty", label: "Beauty" },
  { value: "fashion", label: "Fashion" },
  { value: "wellness", label: "Wellness" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "marketing", label: "Marketing" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "others", label: "Others" },
];

const DEFAULT_BRAND_NAME = "VisionVerse";

const formatTag = (tag: string) =>
  tag.trim().startsWith("#") ? tag.trim() : `#${tag.trim()}`;

export default function OnboardingTab({ quizId }: OnboardingTabProps) {
  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const updateQuiz = useMutation(api.quiz.updateQuiz);
  const updateOnboardingPage = useMutation(api.quiz.updateOnboardingPage);
  const setOnboardingComponents = useMutation(api.quiz.setOnboardingComponents);
  const createOnboardingPage = useMutation(api.quiz.createOnboardingPage);

  const [isCreatingOnboarding, setIsCreatingOnboarding] = useState(false);
  const [isSavingBasicInfo, setIsSavingBasicInfo] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenamingOnboarding, setIsRenamingOnboarding] = useState(false);
  const [isBrandAvatarPickerOpen, setIsBrandAvatarPickerOpen] = useState(false);
  const [isCoverImagePickerOpen, setIsCoverImagePickerOpen] = useState(false);
  const [basicInfo, setBasicInfo] = useState<BasicInfoForm>({
    description: "",
    tags: [],
    topic: "general",
    brandName: DEFAULT_BRAND_NAME,
    brandAvatar: "",
    coverImage: "",
  });

  const quizInfo = quizQuery as (typeof quizQuery & QuizBasicInfo) | undefined;
  const onboardingPage = quizQuery?.onboardingPage as
    | PageEntity
    | null
    | undefined;
  const transitionPreviewTarget = useMemo(() => {
    const firstQuizPage = (quizQuery?.pages ?? [])[0] as PageEntity | undefined;
    if (!firstQuizPage) {
      return null;
    }

    return {
      key: String(firstQuizPage._id),
      components: (firstQuizPage.components ?? []) as Component[],
      background: firstQuizPage.background,
      sequence: 1,
    };
  }, [quizQuery?.pages]);

  const editor = usePageEditor({
    quizId,
    pageType: "onboarding",
    entity: onboardingPage,
    setComponentsMutation: setOnboardingComponents,
    updateEntityMutation: updateOnboardingPage,
    enableClipboard: true,
    enableZIndex: true,
    enableUndoRedo: true,
  });

  const templates = useTemplates("onboarding");

  useEffect(() => {
    if (!quizInfo) return;

    setBasicInfo({
      description: quizInfo.description ?? "",
      tags: quizInfo.tags ?? [],
      topic: quizInfo.topic ?? "general",
      brandName: quizInfo.brandName ?? DEFAULT_BRAND_NAME,
      brandAvatar: quizInfo.brandAvatar ?? "",
      coverImage: quizInfo.coverImage ?? "",
    });
  }, [quizInfo]);

  const handleCreateOnboarding = useCallback(async () => {
    if (!quizId || isCreatingOnboarding) return;
    setIsCreatingOnboarding(true);
    try {
      await createOnboardingPage({ quizId });
      toast.success("Onboarding page created");
    } catch (error) {
      console.error("Failed to create onboarding page:", error);
      toast.error("Failed to create onboarding page");
    } finally {
      setIsCreatingOnboarding(false);
    }
  }, [quizId, createOnboardingPage, isCreatingOnboarding]);

  const requestRenameOnboarding = useCallback(() => {
    if (!onboardingPage) return;
    setRenameValue(editor.currentPageName.trim() || "Onboarding");
    setRenameError(null);
    setIsRenameDialogOpen(true);
  }, [editor.currentPageName, onboardingPage]);

  const handleCancelRenameOnboarding = useCallback(() => {
    if (isRenamingOnboarding) return;
    setIsRenameDialogOpen(false);
    setRenameError(null);
  }, [isRenamingOnboarding]);

  const handleRenameOnboarding = useCallback(async () => {
    if (!onboardingPage) return;

    const normalizedName = renameValue.trim();
    if (!normalizedName) {
      setRenameError("Onboarding page name is required.");
      return;
    }

    const existingName = (onboardingPage.pageName ?? "").trim();
    if (existingName === normalizedName) {
      setIsRenameDialogOpen(false);
      setRenameError(null);
      return;
    }

    setIsRenamingOnboarding(true);
    setRenameError(null);
    try {
      await updateOnboardingPage({
        id: onboardingPage._id,
        pageName: normalizedName,
      });
      editor.setLocalPageName(null);
      toast.success("Onboarding page renamed");
      setIsRenameDialogOpen(false);
    } catch (error) {
      console.error("Failed to rename onboarding page", error);
      setRenameError("Failed to rename onboarding page.");
      toast.error("Failed to rename onboarding page");
    } finally {
      setIsRenamingOnboarding(false);
    }
  }, [editor, onboardingPage, renameValue, updateOnboardingPage]);

  const handleSaveBasicInfo = useCallback(
    async (nextInfo: BasicInfoForm = basicInfo) => {
      if (!quizId || isSavingBasicInfo) return;

      setIsSavingBasicInfo(true);
      try {
        await updateQuiz({
          id: quizId,
          description: nextInfo.description.trim(),
          tags: nextInfo.tags,
          topic: nextInfo.topic,
          brandName: nextInfo.brandName.trim() || DEFAULT_BRAND_NAME,
          brandAvatar: nextInfo.brandAvatar.trim(),
          coverImage: nextInfo.coverImage.trim(),
        });
      } catch (error) {
        console.error("Failed to update quiz info:", error);
        toast.error("Failed to save quiz info");
      } finally {
        setIsSavingBasicInfo(false);
      }
    },
    [basicInfo, isSavingBasicInfo, quizId, updateQuiz],
  );

  const handleBrandAvatarSelect = useCallback(
    (url: string) => {
      const nextInfo = { ...basicInfo, brandAvatar: url };
      setBasicInfo(nextInfo);
      void handleSaveBasicInfo(nextInfo);
    },
    [basicInfo, handleSaveBasicInfo],
  );

  const handleBrandAvatarClear = useCallback(() => {
    const nextInfo = { ...basicInfo, brandAvatar: "" };
    setBasicInfo(nextInfo);
    void handleSaveBasicInfo(nextInfo);
  }, [basicInfo, handleSaveBasicInfo]);

  const handleCoverImageSelect = useCallback(
    (url: string) => {
      const nextInfo = { ...basicInfo, coverImage: url };
      setBasicInfo(nextInfo);
      void handleSaveBasicInfo(nextInfo);
    },
    [basicInfo, handleSaveBasicInfo],
  );

  const handleCoverImageClear = useCallback(() => {
    const nextInfo = { ...basicInfo, coverImage: "" };
    setBasicInfo(nextInfo);
    void handleSaveBasicInfo(nextInfo);
  }, [basicInfo, handleSaveBasicInfo]);

  const sidebar = useMemo(
    () => (
      <QuizBasicInfoSidebar
        value={basicInfo}
        onChange={setBasicInfo}
        onSave={(nextInfo) => void handleSaveBasicInfo(nextInfo)}
        onPickBrandAvatar={() => setIsBrandAvatarPickerOpen(true)}
        onClearBrandAvatar={handleBrandAvatarClear}
        onPickCoverImage={() => setIsCoverImagePickerOpen(true)}
        onClearCoverImage={handleCoverImageClear}
        isSaving={isSavingBasicInfo}
      />
    ),
    [
      basicInfo,
      handleBrandAvatarClear,
      handleCoverImageClear,
      handleSaveBasicInfo,
      isSavingBasicInfo,
    ],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white">
        <p className="max-w-sm text-center text-sm text-gray-600">
          Save the quiz before configuring onboarding.
        </p>
      </div>
    );
  }

  if (quizQuery === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading onboarding...
        </div>
      </div>
    );
  }

  if (quizQuery === null) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50">
        <p className="text-sm text-red-600">
          Unable to load quiz details. Please try again later.
        </p>
      </div>
    );
  }

  if (!onboardingPage) {
    return (
      <div className="flex h-full min-h-0 gap-4">
        {sidebar}

        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-gray-500">
              No onboarding page exists yet.
            </div>
            <Button
              onClick={() => void handleCreateOnboarding()}
              disabled={isCreatingOnboarding}
              className="gap-2"
            >
              {isCreatingOnboarding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Onboarding Page
                </>
              )}
            </Button>
          </div>
        </div>

        <ImagePickerDialog
          isOpen={isBrandAvatarPickerOpen}
          onClose={() => setIsBrandAvatarPickerOpen(false)}
          images={editor.imagesQuery ?? []}
          onImageSelect={handleBrandAvatarSelect}
        />

        <ImagePickerDialog
          isOpen={isCoverImagePickerOpen}
          onClose={() => setIsCoverImagePickerOpen(false)}
          images={editor.imagesQuery ?? []}
          onImageSelect={handleCoverImageSelect}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      {sidebar}

      <EditorPreviewPanel
        title="Onboarding Preview"
        hasEntity={true}
        components={editor.displayComponents}
        background={editor.currentBackground}
        previewKey={onboardingPage._id}
        pageName={editor.currentPageName}
        onPageNameChange={(value) => editor.setLocalPageName(value)}
        onPageNameBlur={editor.handlePageNameBlur}
        onRequestPageRename={requestRenameOnboarding}
        selectedComponentId={editor.editing.selectedId}
        selectedComponent={editor.editing.selectedComponent}
        onComponentClick={(component: Component) =>
          editor.editing.selectComponent(component.id)
        }
        onBackgroundClick={editor.handleDeselectComponent}
        editorActions={editor.editorActions}
        isSaving={editor.isSaving}
        templates={templates}
        onApplyTemplate={editor.handleApplyTemplate}
        templateDialogTitle="Select an Onboarding Template"
        templateDialogDescription="Choose a template to apply to the onboarding page. This will replace the current content."
        onUpdateBackground={editor.handleUpdateBackground}
        pageType="onboarding"
        transitionEffect={editor.currentTransitionEffect}
        onTransitionEffectChange={(effect) =>
          void editor.handleUpdateTransitionEffect(effect)
        }
        transitionPreviewTarget={transitionPreviewTarget}
      />

      <ImagePickerDialog
        isOpen={editor.isImagePickerOpen}
        onClose={() => editor.setIsImagePickerOpen(false)}
        images={editor.imagesQuery ?? []}
        onImageSelect={editor.handleImageSelect}
      />

      <AudioPickerDialog
        isOpen={editor.isAudioPickerOpen}
        onClose={() => editor.setIsAudioPickerOpen(false)}
        audios={editor.audiosQuery ?? []}
        onAudioSelect={editor.handleAudioSelect}
      />

      <ImagePickerDialog
        isOpen={isBrandAvatarPickerOpen}
        onClose={() => setIsBrandAvatarPickerOpen(false)}
        images={editor.imagesQuery ?? []}
        onImageSelect={handleBrandAvatarSelect}
      />

      <ImagePickerDialog
        isOpen={isCoverImagePickerOpen}
        onClose={() => setIsCoverImagePickerOpen(false)}
        images={editor.imagesQuery ?? []}
        onImageSelect={handleCoverImageSelect}
      />
      <RenamePageDialog
        open={isRenameDialogOpen}
        value={renameValue}
        error={renameError}
        isSaving={isRenamingOnboarding}
        onOpenChange={(open) => {
          setIsRenameDialogOpen(open);
          if (!open) setRenameError(null);
        }}
        onValueChange={(value) => {
          setRenameValue(value);
          if (renameError) setRenameError(null);
        }}
        onCancel={handleCancelRenameOnboarding}
        onConfirm={() => void handleRenameOnboarding()}
      />
    </div>
  );
}

type QuizBasicInfoSidebarProps = {
  value: BasicInfoForm;
  onChange: (value: BasicInfoForm) => void;
  onSave: (value?: BasicInfoForm) => void;
  onPickBrandAvatar: () => void;
  onClearBrandAvatar: () => void;
  onPickCoverImage: () => void;
  onClearCoverImage: () => void;
  isSaving: boolean;
};

function QuizBasicInfoSidebar({
  value,
  onChange,
  onSave,
  onPickBrandAvatar,
  onClearBrandAvatar,
  onPickCoverImage,
  onClearCoverImage,
  isSaving,
}: QuizBasicInfoSidebarProps) {
  const [pendingTag, setPendingTag] = useState("");

  const commitTag = useCallback(() => {
    const normalized = pendingTag.trim();
    if (!normalized) return;

    const exists = value.tags.some(
      (tag) => tag.toLowerCase() === normalized.toLowerCase(),
    );
    setPendingTag("");

    if (exists) return;

    const nextValue = {
      ...value,
      tags: [...value.tags, normalized],
    };
    onChange(nextValue);
    onSave(nextValue);
  }, [onChange, onSave, pendingTag, value]);

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const nextValue = {
        ...value,
        tags: value.tags.filter((tag) => tag !== tagToRemove),
      };
      onChange(nextValue);
      onSave(nextValue);
    },
    [onChange, onSave, value],
  );

  return (
    <Card className="flex w-80 min-w-[20rem] flex-col">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Quiz Basic Info
          </CardTitle>
          {isSaving ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-5 overflow-y-auto py-4">
        <div className="space-y-2">
          <Label htmlFor="quiz-description">Description</Label>
          <Textarea
            id="quiz-description"
            value={value.description}
            onChange={(event) =>
              onChange({ ...value, description: event.target.value })
            }
            onBlur={() => onSave()}
            placeholder="Short quiz description"
            className="min-h-28 resize-none text-sm"
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-tags">Tags</Label>
          <div className="flex gap-2">
            <Input
              id="quiz-tags"
              value={pendingTag}
              onChange={(event) => setPendingTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitTag();
                }
              }}
              placeholder="Add a tag"
              disabled={isSaving}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={commitTag}
              disabled={isSaving || pendingTag.trim().length === 0}
              aria-label="Add tag"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {value.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {value.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 rounded-md pr-1"
                >
                  <span className="max-w-[11rem] truncate">
                    {formatTag(tag)}
                  </span>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 text-gray-500 hover:bg-gray-200 hover:text-red-600"
                    onClick={() => removeTag(tag)}
                    disabled={isSaving}
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-topic">Topic</Label>
          <Select
            value={value.topic}
            onValueChange={(topic: QuizTopic) => {
              const nextValue = { ...value, topic };
              onChange(nextValue);
              onSave(nextValue);
            }}
            disabled={isSaving}
          >
            <SelectTrigger id="quiz-topic">
              <SelectValue placeholder="Select a topic" />
            </SelectTrigger>
            <SelectContent>
              {QUIZ_TOPICS.map((topic) => (
                <SelectItem key={topic.value} value={topic.value}>
                  {topic.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-brand-name">Brand Name</Label>
          <Input
            id="quiz-brand-name"
            value={value.brandName}
            onChange={(event) =>
              onChange({ ...value, brandName: event.target.value })
            }
            onBlur={() => onSave()}
            placeholder="Your brand name"
            disabled={isSaving}
          />
        </div>

        <div className="space-y-3">
          <Label>Brand Avatar</Label>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50">
              {value.brandAvatar ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${value.brandAvatar})` }}
                  aria-label="Brand avatar preview"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onPickBrandAvatar}
                disabled={isSaving}
              >
                <ImageIcon className="h-4 w-4" />
                Choose
              </Button>
              {value.brandAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-gray-500 hover:text-red-600"
                  onClick={onClearBrandAvatar}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Cover Image</Label>
          <div
            className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 bg-cover bg-center"
            style={{
              backgroundImage: value.coverImage
                ? `url(${value.coverImage})`
                : undefined,
            }}
            aria-label="Cover image preview"
          >
            {!value.coverImage ? (
              <ImageIcon className="h-7 w-7 text-gray-400" />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onPickCoverImage}
              disabled={isSaving}
            >
              <ImageIcon className="h-4 w-4" />
              Choose
            </Button>
            {value.coverImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-gray-500 hover:text-red-600"
                onClick={onClearCoverImage}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
