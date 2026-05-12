"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QuestionTypeChangeDialogProps = {
  open: boolean;
  pageName: string;
  nextQuestionTypeLabel: string;
  removedComponentCount: number;
  removedComponents: Array<{
    key: "answerBox" | "ranking" | "input" | "matching" | "slider";
    label: string;
    count: number;
  }>;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function QuestionTypeChangeDialog({
  open,
  pageName,
  nextQuestionTypeLabel,
  removedComponentCount,
  removedComponents,
  onOpenChange,
  onCancel,
  onConfirm,
}: QuestionTypeChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-left">Switch Question Type</DialogTitle>
          <DialogDescription className="text-left text-[15px] leading-7">
            Switching{" "}
            <span className="font-semibold text-slate-900">{pageName}</span> to{" "}
            <span className="font-semibold text-slate-900">
              {nextQuestionTypeLabel}
            </span>{" "}
            will remove{" "}
            <span className="font-semibold text-slate-900">
              {removedComponentCount} incompatible question component
              {removedComponentCount === 1 ? "" : "s"}
            </span>
            . This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {removedComponents.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-900">
              Components that will be removed
            </p>
            <div className="mt-2 space-y-2">
              {removedComponents.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between text-sm text-slate-600"
                >
                  <span>{item.label}</span>
                  <span className="font-semibold text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Switch Question Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
