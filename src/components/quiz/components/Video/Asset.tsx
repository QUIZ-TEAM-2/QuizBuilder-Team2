"use client";

import { Video as VideoIcon } from "lucide-react";

export function VideoAsset() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-900 text-white">
      <VideoIcon className="h-5 w-5" />
    </div>
  );
}

export default VideoAsset;
