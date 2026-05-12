"use client";

import React from "react";

export const IMAGE_COMPONENT_SLUG = "image";

export function ImageAsset() {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ kind: "component", slug: IMAGE_COMPONENT_SLUG }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className="flex cursor-grab flex-col items-center overflow-hidden rounded-lg border border-gray-200 p-2 transition-all hover:border-blue-500 hover:shadow-md active:cursor-grabbing"
      draggable
      onDragStart={handleDragStart}
      title="Image"
    >
      <div className="flex h-[75px] w-[75px] items-center justify-center rounded bg-gray-100">
        <span className="text-2xl" aria-hidden>
          🖼️
        </span>
      </div>
      <p className="mt-auto text-xs text-gray-600">Image</p>
    </div>
  );
}

export default ImageAsset;
