"use client";

import { Volume2 } from "lucide-react";

export const BGM_COMPONENT_SLUG = "bgm";

export function BGMAsset() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-900 text-white">
      <Volume2 className="h-5 w-5" />
    </div>
  );
}

export default BGMAsset;
