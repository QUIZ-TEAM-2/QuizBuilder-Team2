"use client";

import type React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BGMViewProps {
  src?: string;
  fileName?: string;
  muted?: boolean;
  volume?: number;
  loop?: boolean;
  backgroundColor?: string;
  iconColor?: string;
  opacity?: number;
  isEditable?: boolean;
  isBlocked?: boolean;
  onToggleMute?: () => void;
}

export function BGMView({
  src,
  fileName,
  muted = false,
  backgroundColor = "#020617",
  iconColor = "#ffffff",
  opacity = 100,
  isBlocked = false,
  onToggleMute,
}: BGMViewProps) {
  const hasAudio = Boolean(src);
  const opacityValue = Math.min(100, Math.max(0, opacity)) / 100;

  const handleToggleMute = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!hasAudio) return;
    onToggleMute?.();
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <button
        type="button"
        data-bgm-toggle="true"
        onClick={handleToggleMute}
        disabled={!hasAudio}
        title={
          fileName || (hasAudio ? "Background music" : "No audio selected")
        }
        aria-label={muted ? "Unmute background music" : "Mute background music"}
        className={cn(
          "flex h-full min-h-8 w-full min-w-8 items-center justify-center rounded-md border shadow-sm transition-colors",
          hasAudio
            ? "border-slate-900/15"
            : "border-dashed border-slate-300 bg-slate-100 text-slate-400",
          isBlocked && "ring-2 ring-amber-300",
        )}
        style={
          hasAudio
            ? {
                backgroundColor,
                color: iconColor,
                opacity: opacityValue,
              }
            : undefined
        }
      >
        {muted || !hasAudio ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

export default BGMView;
