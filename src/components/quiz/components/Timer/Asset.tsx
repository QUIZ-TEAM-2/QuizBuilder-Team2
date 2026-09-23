"use client";

import { Timer as TimerIcon } from "lucide-react";

export const TIMER_COMPONENT_SLUG = "timer";

export function TimerAsset() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-900 text-white">
      <TimerIcon className="h-5 w-5" />
    </div>
  );
}

export default TimerAsset;
