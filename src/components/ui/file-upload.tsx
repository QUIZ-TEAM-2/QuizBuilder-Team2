"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "./button";
import { Upload, Loader2 } from "lucide-react";
import { type Id } from "convex/_generated/dataModel";

type FileUploadRenderState = {
  isUploading: boolean;
};

interface FileUploadProps {
  onUploadComplete?: (result: {
    url: string;
    storageId: string;
    name: string;
  }) => void;
  onUploadError?: (error: Error) => void;
  accept?: string;
  uploadKind?: "image" | "audio";
  className?: string;
  children?:
    | React.ReactNode
    | ((state: FileUploadRenderState) => React.ReactNode);
}

export function FileUpload({
  onUploadComplete,
  onUploadError,
  accept = "image/*",
  uploadKind = "image",
  className,
  children,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateImageUploadUrl = useMutation(api.images.generateUploadUrl);
  const saveImage = useMutation(api.images.saveImage);
  const generateAudioUploadUrl = useMutation(api.audios.generateUploadUrl);
  const saveAudio = useMutation(api.audios.saveAudio);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const uploadUrl =
        uploadKind === "audio"
          ? await generateAudioUploadUrl()
          : await generateImageUploadUrl();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId } = (await result.json()) as { storageId: string };

      const savedFile =
        uploadKind === "audio"
          ? await saveAudio({
              name: file.name,
              storageId: storageId as Id<"_storage">,
              format: file.type,
              size: file.size,
            })
          : await saveImage({
              name: file.name,
              storageId: storageId as Id<"_storage">,
              format: file.type,
              size: file.size,
            });

      onUploadComplete?.({
        url: savedFile.url,
        storageId: savedFile.storageId as string,
        name: file.name,
      });
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      onUploadError?.(errorObj);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {children ? (
        <div
          onClick={handleButtonClick}
          className={className}
          aria-busy={isUploading}
          aria-disabled={isUploading}
        >
          {typeof children === "function"
            ? children({ isUploading })
            : children}
        </div>
      ) : (
        <Button
          type="button"
          onClick={handleButtonClick}
          disabled={isUploading}
          className={className}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isUploading ? "Uploading..." : "Upload File"}
        </Button>
      )}
    </>
  );
}
