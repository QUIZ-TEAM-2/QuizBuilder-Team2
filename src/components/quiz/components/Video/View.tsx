"use client";

import { Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveVideoUrl } from "./types";

export interface VideoViewProps {
  url?: string;
  rounded?: boolean;
  isEditable?: boolean;
}

export function VideoView({
  url,
  rounded = true,
  isEditable = false,
}: VideoViewProps) {
  const video = resolveVideoUrl(url);
  const frameClass = cn(
    "h-full w-full overflow-hidden bg-black",
    rounded && "rounded-lg",
  );

  if (video.kind === "none") {
    return (
      <div
        className={cn(
          frameClass,
          "flex flex-col items-center justify-center gap-1 bg-slate-900 px-3 text-center text-white/80",
        )}
      >
        <VideoIcon className="h-6 w-6" />
        <span className="text-[11px] leading-tight">
          {url ? "Unsupported link" : "Add a YouTube or Vimeo link"}
        </span>
      </div>
    );
  }

  if (video.kind === "file") {
    return (
      <div className={frameClass}>
        <video
          src={video.src}
          controls={!isEditable}
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <iframe
        src={video.src}
        title={video.provider === "youtube" ? "YouTube video" : "Vimeo video"}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        // In the editor the frame is a preview only; clicks select the component.
        style={{ pointerEvents: isEditable ? "none" : "auto" }}
      />
    </div>
  );
}

export default VideoView;
