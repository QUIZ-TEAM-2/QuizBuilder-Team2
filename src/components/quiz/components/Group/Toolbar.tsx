"use client";

import { Ungroup } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupComponent } from "./types";
import type { ComponentToolbarProps } from "@/lib/quizComponents";

export type GroupToolbarProps = ComponentToolbarProps<GroupComponent>;

export function GroupToolbar({ component, onUnmerge }: GroupToolbarProps) {
  const childCount = component.children?.length ?? 0;

  return (
    <>
      <span className="text-sm text-gray-500">
        Group ({childCount} items)
      </span>

      <div className="h-6 w-px bg-gray-200" />

      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={onUnmerge}
        title="Ungroup components"
      >
        <Ungroup className="h-4 w-4" />
        <span className="text-xs">Ungroup</span>
      </Button>
    </>
  );
}

export default GroupToolbar;

