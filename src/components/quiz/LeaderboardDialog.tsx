"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import {
  LEADERBOARD_NAME_MAX,
  LEADERBOARD_SIZE,
  formatDuration,
} from "../../../convex/leaderboardRules";
import type { Id } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NAME_STORAGE_KEY = "visionverse:leaderboard-name";
const MEDALS = ["🥇", "🥈", "🥉"];

function readSavedName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Storage can be blocked (private mode, embedded iframes). Not important.
  }
}

type Row = {
  rank: number;
  name: string;
  score: number;
  total: number;
  durationMs: number;
  isYou: boolean;
};

function LeaderboardRow({ row }: { row: Row }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5",
        row.isYou
          ? "bg-amber-400/15 ring-1 ring-amber-300/60"
          : "bg-white/[0.04]",
      )}
    >
      <span className="w-8 shrink-0 text-center text-base font-semibold tabular-nums text-white/80">
        {MEDALS[row.rank - 1] ?? row.rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-white">
        {row.name}
        {row.isYou ? (
          <span className="ml-2 text-xs font-semibold text-amber-300">You</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold tabular-nums text-white">
          {row.score}/{row.total}
        </span>
        <span className="block text-xs tabular-nums text-white/50">
          {formatDuration(row.durationMs)}
        </span>
      </span>
    </li>
  );
}

interface LeaderboardDialogProps {
  quizId: Id<"quiz">;
  quizTitle?: string;
  /** The player's session. Omit in preview so nothing can be joined. */
  sessionId?: string;
  isPreview: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaderboardDialog({
  quizId,
  quizTitle,
  sessionId,
  isPreview,
  open,
  onOpenChange,
}: LeaderboardDialogProps) {
  const board = useQuery(
    api.leaderboard.getLeaderboard,
    open ? { quizId, sessionId: isPreview ? undefined : sessionId } : "skip",
  );
  const join = useMutation(api.leaderboard.joinLeaderboard);
  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (open && name === "") setName(readSavedName());
    // Only prefill when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleJoin = async () => {
    if (!sessionId || isJoining) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a name first");
      return;
    }
    setIsJoining(true);
    try {
      await join({ quizId, sessionId, name: trimmed });
      saveName(trimmed);
      toast.success("You're on the leaderboard");
    } catch (error) {
      toast.error(
        error instanceof ConvexError && typeof error.data === "string"
          ? error.data
          : "Couldn't join the leaderboard. Please try again.",
      );
    } finally {
      setIsJoining(false);
    }
  };

  const entries = board && board.enabled ? board.entries : [];
  const you = board && board.enabled ? board.you : null;
  const canJoin = board && board.enabled ? board.canJoin : null;
  const youOutsideTop = you && !entries.some((entry) => entry.isYou);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-md [&>button]:text-white/70">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-amber-300" />
            Leaderboard
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {quizTitle ? `${quizTitle} · ` : ""}Top {LEADERBOARD_SIZE}, ranked
            by score then time
          </DialogDescription>
        </DialogHeader>

        {board === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : !board.enabled ? (
          <p className="py-6 text-center text-sm text-white/60">
            This quiz doesn&apos;t have a leaderboard.
          </p>
        ) : (
          <div className="space-y-4">
            {isPreview ? (
              <p className="rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white/70">
                Preview runs don&apos;t go on the leaderboard. Players see a
                spot to add their name here after finishing.
              </p>
            ) : null}

            {canJoin ? (
              <form
                className="space-y-3 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-500/5 p-4 ring-1 ring-amber-300/30"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleJoin();
                }}
              >
                <p className="text-sm text-white/80">
                  You scored{" "}
                  <span className="font-semibold text-white">
                    {canJoin.score}/{canJoin.total}
                  </span>{" "}
                  in{" "}
                  <span className="font-semibold text-white">
                    {formatDuration(canJoin.durationMs)}
                  </span>
                  . Add your name to the board.
                </p>
                <div className="flex gap-2">
                  <label htmlFor="leaderboard-name" className="sr-only">
                    Your name
                  </label>
                  <input
                    id="leaderboard-name"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value.slice(0, LEADERBOARD_NAME_MAX))
                    }
                    maxLength={LEADERBOARD_NAME_MAX}
                    placeholder="Your name"
                    autoComplete="nickname"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <Button
                    type="submit"
                    disabled={isJoining || name.trim() === ""}
                    className="h-10 bg-amber-400 font-semibold text-slate-950 hover:bg-amber-300"
                  >
                    {isJoining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Join"
                    )}
                  </Button>
                </div>
              </form>
            ) : null}

            {you ? (
              <p className="text-center text-sm text-white/70">
                You&apos;re{" "}
                <span className="font-semibold text-amber-300">#{you.rank}</span>{" "}
                on this quiz.
              </p>
            ) : null}

            {entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/60">
                No scores yet. Be the first!
              </p>
            ) : (
              <ol className="space-y-1.5" aria-label="Top scores">
                {entries.map((row) => (
                  <LeaderboardRow key={`${row.rank}-${row.name}-${row.durationMs}`} row={row} />
                ))}
                {youOutsideTop && you ? (
                  <>
                    <li aria-hidden className="py-1 text-center text-white/30">
                      ⋯
                    </li>
                    <LeaderboardRow row={you} />
                  </>
                ) : null}
              </ol>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LeaderboardDialog;
