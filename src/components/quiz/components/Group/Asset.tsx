"use client";

import { Group } from "lucide-react";

export const GROUP_COMPONENT_SLUG = "group";

export function GroupAsset() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
      <Group className="h-6 w-6" />
    </div>
  );
}

export default GroupAsset;






