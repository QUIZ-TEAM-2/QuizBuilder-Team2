"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { REGEN_INSTRUCTION_MAX_LENGTH } from "../../../convex/aiQuestionRegen";
import type { Id } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const IDEAS = ["Make it funnier", "Make it harder", "More Aussie", "Shorter answers"];

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return "Something went wrong rewriting the question. Please try again.";
}

interface AiRegenerateQuestionButtonProps {
  pageId: Id<"pages">;
  /** Called before the AI runs, e.g. to deselect the component being edited. */
  onBeforeRegenerate?: () => void;
  disabled?: boolean;
}

export function AiRegenerateQuestionButton({
  pageId,
  onBeforeRegenerate,
  disabled,
}: AiRegenerateQuestionButtonProps) {
  const regenerate = useAction(api.aiQuiz.regenerateQuestion);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const handleRegenerate = async () => {
    if (isWorking) return;
    setIsWorking(true);
    onBeforeRegenerate?.();
    try {
      const result = await regenerate({
        pageId,
        instruction: instruction.trim() || undefined,
      });
      toast.success("Question rewritten", {
        description: result.question,
      });
      setOpen(false);
      setInstruction("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        title="Rewrite this question and its answers with AI"
      >
        <Sparkles className="h-4 w-4" />
        Rewrite with AI
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isWorking) setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Rewrite this question
            </DialogTitle>
            <DialogDescription>
              AI writes a new question and answers in the same spots and
              style, and updates the scoring to match. Undo (Cmd+Z) brings the
              old one back.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="ai-regen-instruction">
              Anything to change? <span className="font-normal text-slate-500">(optional)</span>
            </Label>
            <Textarea
              id="ai-regen-instruction"
              value={instruction}
              onChange={(event) =>
                setInstruction(
                  event.target.value.slice(0, REGEN_INSTRUCTION_MAX_LENGTH),
                )
              }
              placeholder="e.g. make it about food"
              rows={2}
              disabled={isWorking}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleRegenerate();
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  disabled={isWorking}
                  onClick={() => setInstruction(idea)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isWorking}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRegenerate()}
              disabled={isWorking}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isWorking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rewriting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Rewrite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AiRegenerateQuestionButton;
