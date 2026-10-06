"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { AI_QUIZ_LIMITS } from "../../../convex/aiQuizDraft";
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

const EXAMPLES = [
  "Which Melbourne suburb matches your vibe?",
  "What kind of coffee are you?",
  "Which study style suits you best?",
];

const range = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i);

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return "Something went wrong generating the quiz. Please try again.";
}

interface AiQuizGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiQuizGeneratorDialog({
  open,
  onOpenChange,
}: AiQuizGeneratorDialogProps) {
  const router = useRouter();
  const generateQuiz = useAction(api.aiQuiz.generateQuiz);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<number>(
    AI_QUIZ_LIMITS.questions.default,
  );
  const [results, setResults] = useState<number>(
    AI_QUIZ_LIMITS.results.default,
  );
  const [answers, setAnswers] = useState<number>(
    AI_QUIZ_LIMITS.answers.default,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const trimmed = topic.trim();
    if (trimmed.length < 3) {
      setError("Describe your quiz in a few words first.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const { quizId } = await generateQuiz({
        topic: trimmed,
        questions,
        results,
        answers,
      });
      toast.success(
        "Quiz generated. Review it, then publish when you're happy.",
      );
      onOpenChange(false);
      setTopic("");
      router.push(`/quiz/${quizId}`);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const countSelect = (
    id: string,
    label: string,
    value: number,
    limits: { min: number; max: number },
    onChange: (value: number) => void,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        disabled={isGenerating}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
      >
        {range(limits.min, limits.max).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isGenerating) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleGenerate();
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-left">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Generate a quiz with AI
            </DialogTitle>
            <DialogDescription className="text-left">
              Describe your quiz and AI will build the start page, questions,
              results and scoring. You can edit everything afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Label htmlFor="ai-quiz-topic">What&apos;s your quiz about?</Label>
            <Textarea
              id="ai-quiz-topic"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                if (error) setError(null);
              }}
              placeholder={EXAMPLES[0]}
              maxLength={AI_QUIZ_LIMITS.topicMaxLength}
              rows={3}
              disabled={isGenerating}
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setTopic(example)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {countSelect(
              "ai-quiz-questions",
              "Questions",
              questions,
              AI_QUIZ_LIMITS.questions,
              setQuestions,
            )}
            {countSelect(
              "ai-quiz-results",
              "Results",
              results,
              AI_QUIZ_LIMITS.results,
              setResults,
            )}
            {countSelect(
              "ai-quiz-answers",
              "Answers each",
              answers,
              AI_QUIZ_LIMITS.answers,
              setAnswers,
            )}
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <DialogFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
              className="w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-auto bg-slate-900 text-white hover:bg-slate-800"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating… (up to 30s)
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate quiz
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AiQuizGeneratorDialog;
