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

type DeletePageDialogProps = {
  open: boolean;
  pageName?: string | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeletePageDialog({
  open,
  pageName,
  isDeleting,
  onOpenChange,
  onCancel,
  onConfirm,
}: DeletePageDialogProps) {
  const label = pageName?.trim() || "this page";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isDeleting) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-left">Delete Page</DialogTitle>
          <DialogDescription className="text-left">
            This will permanently remove{" "}
            <span className="font-semibold">{label}</span>. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Page"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
