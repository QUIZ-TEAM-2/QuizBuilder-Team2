"use client";

import { useEffect, useState } from "react";
import { Square, SquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
import { resolveVideoUrl, type VideoComponent } from "./types";

export function VideoToolbar({
  component,
  onUpdateProps,
}: ComponentToolbarProps<VideoComponent>) {
  const props = component.props ?? {};
  const savedUrl = typeof props.url === "string" ? props.url : "";
  const rounded = props.rounded !== false;
  const [draft, setDraft] = useState(savedUrl);

  useEffect(() => {
    setDraft(savedUrl);
  }, [savedUrl]);

  // Apply the link when the user leaves the box or presses Enter, rather than
  // on every keystroke, so the embed doesn't reload while typing.
  const commit = () => {
    const next = draft.trim();
    if (next !== savedUrl) onUpdateProps({ url: next });
  };

  const isInvalid =
    draft.trim() !== "" && resolveVideoUrl(draft).kind === "none";

  return (
    <>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Video link</Label>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          placeholder="https://youtube.com/watch?v=..."
          className={`h-8 w-72 ${isInvalid ? "border-red-400" : ""}`}
          title="YouTube, Vimeo, or a direct .mp4 / .webm link"
        />
      </div>
      <Button
        variant={rounded ? "default" : "outline"}
        size="sm"
        onClick={() => onUpdateProps({ rounded: !rounded })}
        className="gap-1"
        title="Rounded or square corners"
      >
        {rounded ? (
          <Square className="h-4 w-4" />
        ) : (
          <SquareDashed className="h-4 w-4" />
        )}
        {rounded ? "Rounded" : "Square"}
      </Button>
    </>
  );
}

export default VideoToolbar;
