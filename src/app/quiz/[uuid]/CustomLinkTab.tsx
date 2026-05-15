"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import {
  Link as LinkIcon,
  Copy,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Id } from "@/types";

type CustomLinkTabProps = {
  quizId: Id<"quiz"> | null;
};

const RESERVED_WORDS = [
  "quiz",
  "play",
  "template",
  "discover",
  "admin",
  "api",
  "login",
  "register",
  "new",
  "undefined",
  "null",
  "false",
  "true",
  "custom",
  "static",
  "public",
  "dashboard",
  "settings",
];

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export default function CustomLinkTab({ quizId }: CustomLinkTabProps) {
  const quiz = useQuery(api.quiz.getQuiz, quizId ? { id: quizId } : "skip");
  const updateSlug = useMutation(api.quiz.updateCustomSlug);
  const clearCustomSlug = useMutation(api.quiz.clearCustomSlug);

  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (quiz?.customSlug) {
      setInputValue(quiz.customSlug);
    }
  }, [quiz?.customSlug]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(normalizeSlug(inputValue));
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const validation = useMemo(() => {
    const slug = normalizeSlug(inputValue);
    if (!slug)
      return { valid: null, message: "Enter a custom link for your quiz." };
    if (slug.length < 3)
      return { valid: false, message: "Link must be at least 3 characters." };
    if (slug.length > 50)
      return {
        valid: false,
        message: "Link must be no more than 50 characters.",
      };
    if (!SLUG_PATTERN.test(slug))
      return {
        valid: false,
        message: "Use lowercase letters, numbers, and hyphens only.",
      };
    if (slug.startsWith("-") || slug.endsWith("-"))
      return { valid: false, message: "Cannot start or end with a hyphen." };
    if (slug.includes("--"))
      return { valid: false, message: "Cannot contain consecutive hyphens." };
    if (RESERVED_WORDS.includes(slug))
      return { valid: false, message: "This link is reserved." };
    return { valid: true, message: "Format is valid." };
  }, [inputValue]);

  const shouldCheckAvailability =
    validation.valid && debouncedValue === normalizeSlug(inputValue);

  const availabilityQuery = useQuery(
    api.quiz.checkSlugAvailability,
    shouldCheckAvailability
      ? { slug: debouncedValue, quizId: quizId ?? undefined }
      : "skip",
  );

  const finalValidation = useMemo(() => {
    if (!validation.valid) return validation;
    if (!shouldCheckAvailability || availabilityQuery === undefined)
      return { valid: null, message: "Checking availability..." };

    if (availabilityQuery.available) {
      return { valid: true, message: "This link is available!" };
    } else {
      const message =
        availabilityQuery.reason === "taken"
          ? "This link is already taken."
          : "This link is unavailable.";
      return { valid: false, message };
    }
  }, [validation, shouldCheckAvailability, availabilityQuery]);

  const handleSave = async () => {
    if (!finalValidation.valid || !quizId) return;
    setIsSaving(true);
    try {
      await updateSlug({ quizId, slug: normalizeSlug(inputValue) });
      toast.success("Custom link updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update custom link");
    } finally {
      setIsSaving(true);
      // Brief delay to show success state before enabling button again
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handleConfirmClear = async () => {
    if (!quizId) return;

    setIsSaving(true);
    try {
      await clearCustomSlug({ quizId });
      setInputValue("");
      setIsRemoveDialogOpen(false);
      toast.success("Custom link removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove custom link");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    const fullUrl = `${baseUrl}/custom/${quiz?.customSlug}`;
    void navigator.clipboard.writeText(fullUrl);
    toast.success("Link copied to clipboard");
  };

  if (!quiz) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isUnchanged = inputValue === (quiz?.customSlug || "");
  const isCustomLinkActive = quiz.customSlug && quiz.status === "published";

  return (
    <>
      <div className="flex-1 overflow-y-auto p-1">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <Card className="border-none bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2 text-xl">
                <LinkIcon className="h-5 w-5 text-primary" />
                Custom Link
              </CardTitle>
              <CardDescription>
                Create a personalized, easy-to-remember URL for sharing your
                quiz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
              {/* Share Section */}
              {quiz.customSlug && (
                <div className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
                  <span className="text-sm font-semibold text-slate-600">
                    Your Shareable Link
                  </span>
                  {!isCustomLinkActive ? (
                    <p className="text-xs font-medium text-amber-700">
                      This custom link will become active after the quiz is
                      published.
                    </p>
                  ) : null}
                  <div className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 break-all font-mono text-sm text-slate-700">
                      {baseUrl}/custom/
                      <span className="font-bold text-primary">
                        {quiz.customSlug}
                      </span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={handleCopy}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCopy}
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              )}

              {/* Editor Section */}
              <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                <div className="space-y-2">
                  <Label
                    htmlFor="slug-input"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Configure Slug
                  </Label>
                  <div className="group flex items-center gap-0">
                    <div className="flex h-10 items-center rounded-l-lg border border-r-0 bg-slate-100 px-3 text-sm font-medium text-slate-500">
                      {baseUrl}/custom/
                    </div>
                    <Input
                      id="slug-input"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="my-awesome-quiz"
                      className={`h-10 flex-1 rounded-l-none border-slate-200 focus-visible:ring-primary ${
                        finalValidation.valid === true
                          ? "border-green-200"
                          : finalValidation.valid === false
                            ? "border-red-200"
                            : ""
                      }`}
                      disabled={isSaving}
                    />
                  </div>

                  {/* Real-time Validation UI */}
                  <div className="mt-2 flex items-start gap-2">
                    {finalValidation.valid === true && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {finalValidation.message}
                      </div>
                    )}
                    {finalValidation.valid === false && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {finalValidation.message}
                      </div>
                    )}
                    {finalValidation.valid === null && inputValue && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {finalValidation.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                    Live Preview
                  </div>
                  <div className="break-all font-mono text-sm text-slate-600">
                    {baseUrl}/custom/
                    <span
                      className={
                        inputValue
                          ? "font-bold text-primary"
                          : "italic text-slate-300"
                      }
                    >
                      {normalizeSlug(inputValue) || "your-slug"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t pt-2">
                  <div className="flex-1">
                    {quiz.customSlug && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setIsRemoveDialogOpen(true)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Link
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInputValue(quiz.customSlug || "")}
                      disabled={isSaving || isUnchanged}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={
                        isSaving || !finalValidation.valid || isUnchanged
                      }
                      className="min-w-[100px]"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Guidelines */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <h4 className="mb-2 text-xs font-bold uppercase text-blue-700">
                  Rules & Guidelines
                </h4>
                <ul className="list-disc space-y-1.5 pl-4 text-xs text-blue-600/80">
                  <li>Length must be between 3 and 50 characters.</li>
                  <li>
                    Only lowercase letters (a-z), numbers (0-9), and hyphens (-)
                    are allowed.
                  </li>
                  <li>
                    Cannot start or end with a hyphen, and no consecutive
                    hyphens (--).
                  </li>
                  <li>Reserved system keywords cannot be used as links.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isRemoveDialogOpen}
        onOpenChange={(open) => {
          if (isSaving) return;
          setIsRemoveDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove custom link?</DialogTitle>
            <DialogDescription className="text-left">
              This will remove the shareable link{" "}
              <span className="font-medium text-slate-700">
                {baseUrl}/custom/{quiz.customSlug}
              </span>
              . You can create a new custom link later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setIsRemoveDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmClear()}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
