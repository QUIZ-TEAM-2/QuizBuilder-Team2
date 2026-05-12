"use client";

import React from "react";

export const TEXT_COMPONENT_SLUG = "text";

export function TextAsset() {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ kind: "component", slug: TEXT_COMPONENT_SLUG }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className="flex cursor-grab flex-col items-center overflow-hidden rounded-lg border border-gray-200 p-2 transition-all hover:border-blue-500 hover:shadow-md active:cursor-grabbing"
      draggable
      onDragStart={handleDragStart}
      title="Text"
    >
      <div className="flex h-[75px] w-[75px] items-center justify-center rounded bg-gray-100">
        <span className="text-2xl" aria-hidden>
          🔤
        </span>
      </div>
      <p className="mt-auto text-xs text-gray-600">Text</p>
    </div>
  );
}

export default TextAsset;
