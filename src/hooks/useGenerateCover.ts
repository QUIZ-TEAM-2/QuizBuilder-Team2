"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "@/types";
import { createCoverImage, type CoverDetails } from "@/lib/coverArt";
import { toFileSlug } from "@/lib/shareLinks";

/**
 * Draws a cover image, uploads it to the user's image library and returns
 * its URL, ready to save as the quiz's coverImage.
 */
export function useGenerateCover() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const saveImage = useMutation(api.images.saveImage);

  return useCallback(
    async (details: CoverDetails): Promise<string> => {
      const blob = await createCoverImage(details);
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!response.ok) throw new Error("Cover upload failed");
      const { storageId } = (await response.json()) as { storageId: string };
      const saved = await saveImage({
        name: `${toFileSlug(details.title)}-cover.jpg`,
        storageId: storageId as Id<"_storage">,
        format: blob.type || "image/jpeg",
        size: blob.size,
      });
      return saved.url;
    },
    [generateUploadUrl, saveImage],
  );
}
