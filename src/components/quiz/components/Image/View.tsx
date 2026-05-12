"use client";

import React from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

export interface ImageViewProps {
  src: string;
  opacity?: number;
}

export function ImageView({ src, opacity = 100 }: ImageViewProps) {
  const opacityValue = Math.min(100, Math.max(0, opacity)) / 100;

  // Show placeholder when no image is set
  if (!src) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-gray-100">
        <ImageIcon className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Image
        src={src}
        alt="image"
        fill
        sizes="100vw"
        className="object-contain object-center"
        style={{ opacity: opacityValue }}
      />
    </div>
  );
}

export default ImageView;
