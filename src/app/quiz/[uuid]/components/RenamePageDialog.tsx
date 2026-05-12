"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RenamePageDialogProps = {
  open: boolean;
  value: string;
  error?: string | null;
  isSaving: boolean;
  title?: string;
  description?: string;
  inputLabel?: string;
  saveLabel?: string;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function RenamePageDialog({
  open,
  value,
  error,
  isSaving,
  title = "Rename Page",
  description = "Page names must be unique within this quiz.",
  inputLabel = "Page name",
  saveLabel = "Save Name",
  onOpenChange,
  onValueChange,
  onCancel,
  onConfirm,
}: RenamePageDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSaving) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-left">{title}</DialogTitle>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-page-name">{inputLabel}</Label>
          <Input
            id="rename-page-name"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className="text-center"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onConfirm();
              }
            }}
            disabled={isSaving}
            autoFocus
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              saveLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
