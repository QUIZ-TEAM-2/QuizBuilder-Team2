"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useMutation } from "convex/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import PhonePreview from "@/components/editor/PhonePreview";
import { Button } from "@/components/ui/button";
import { api } from "../../../../../convex/_generated/api";
import { getQuestionModeLabel } from "@/lib/questionTypeGuard";
import type { PageTemplate } from "@/types";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";

type TemplatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: PageTemplate[];
  isProcessing?: boolean;
  title: string;
  description?: string;
  onSelect: (template: PageTemplate) => void;
};

type TemplatePreviewCardProps = {
  template: PageTemplate;
  disabled: boolean;
  onSelect: (template: PageTemplate) => void;
};

function TemplatePreviewCard({ template, disabled, onSelect }: TemplatePreviewCardProps) {
  const previewComponents = useMemo(() => template.build(), [template]);
  const deleteTemplate = useMutation(api.templates.deleteTemplate);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletable = !template.id.includes("blank");

  const handleDelete = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (!isDeletable || isDeleting) return;

      setIsDeleting(true);
      try {
        await deleteTemplate({ id: template.id as Id<"templates"> });
        toast.success("Template deleted");
      } catch (error) {
        console.error("Failed to delete template", error);
        toast.error("Failed to delete template");
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteTemplate, isDeletable, isDeleting, template.id],
  );

  const handleSelect = useCallback(() => {
    if (disabled || isDeleting) return;
    onSelect(template);
  }, [disabled, isDeleting, onSelect, template]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || isDeleting) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(template);
      }
    },
    [disabled, isDeleting, onSelect, template],
  );

  return (
    <div
      role="button"
      tabIndex={disabled || isDeleting ? -1 : 0}
      aria-disabled={disabled || isDeleting}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-400 hover:shadow ${disabled || isDeleting ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      {isDeletable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(event) => void handleDelete(event)}
          disabled={disabled || isDeleting}
          className="absolute right-3 top-3 z-10 h-7 w-7 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Delete template"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      ) : null}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-900">{template.title}</h3>
          {template.questionMode ? (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {getQuestionModeLabel(template.questionMode)}
            </span>
          ) : null}
        </div>
        {disabled ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
      </div>
      <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
        <PhonePreview
          components={previewComponents}
          background={template.background}
          transitionEffect={template.transitionEffect}
          scale={0.28}
          roundedCorners
          className="pointer-events-none"
        />
      </div>
    </div>
  );
}

export default function TemplatePickerDialog({
  open,
  onOpenChange,
  templates,
  isProcessing = false,
  title,
  description,
  onSelect,
}: TemplatePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isProcessing && onOpenChange(next)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplatePreviewCard
              key={template.id}
              template={template}
              disabled={isProcessing}
              onSelect={onSelect}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
