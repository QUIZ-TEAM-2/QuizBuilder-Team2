import React, { useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Image as ImageType } from "@/types";
import { FileUpload } from "@/components/ui/file-upload";
import { api } from "../../../convex/_generated/api";

interface ImagePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageType[];
  onImageSelect: (url: string) => void;
}

const ImagePickerDialog = ({
  isOpen,
  onClose,
  images,
  onImageSelect,
}: ImagePickerDialogProps) => {
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [imagePendingRemoval, setImagePendingRemoval] =
    useState<ImageType | null>(null);
  const deleteImage = useMutation(api.images.deleteImage);

  const handleImageSelect = (image: ImageType) => {
    const url = image.url ?? "";
    if (url) {
      onImageSelect(url);
      onClose();
    }
  };

  const requestImageRemoval = (
    event: React.MouseEvent<HTMLButtonElement>,
    image: ImageType,
  ) => {
    event.stopPropagation();
    setImagePendingRemoval(image);
  };

  const handleImageRemoval = async () => {
    if (!imagePendingRemoval) return;

    setDeletingImageId(imagePendingRemoval._id);
    try {
      await deleteImage({ imageId: imagePendingRemoval._id });
      toast.success("Image removed from library");
      setImagePendingRemoval(null);
    } catch (error) {
      console.error("Failed to remove image from library", error);
      toast.error("Failed to remove image from library");
    } finally {
      setDeletingImageId(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[80vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select Image</DialogTitle>
            <DialogDescription>
              Choose an image from your uploaded images or upload a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-96 grid-cols-1 gap-4 overflow-y-auto p-2 md:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <div
                key={image._id}
                onClick={() => handleImageSelect(image)}
                className="group relative cursor-pointer rounded-lg border border-gray-200 p-2 transition-all hover:border-blue-500 hover:shadow-md"
              >
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-3 top-3 z-10 h-7 w-7 opacity-0 shadow-sm transition-opacity focus:opacity-100 group-hover:opacity-100"
                  onClick={(event) => requestImageRemoval(event, image)}
                  disabled={deletingImageId === image._id}
                  aria-label={`Remove ${image.name} from library`}
                >
                  {deletingImageId === image._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
                {image.url && (
                  <Image
                    src={image.url}
                    alt={image.name}
                    width={150}
                    height={150}
                    className="h-32 w-full rounded-lg object-cover"
                  />
                )}
                <p className="mt-2 truncate text-xs text-gray-600">
                  {image.name}
                </p>
              </div>
            ))}
          </div>

          {images.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p>No images uploaded yet</p>
              <p className="mt-1 text-sm">
                Upload some images first to use them in your quiz.
              </p>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <FileUpload
              onUploadComplete={({ url }) => {
                if (url) {
                  toast.success("Image uploaded to library");
                }
              }}
              onUploadError={() => {
                toast.error("Failed to upload image");
              }}
            >
              {({ isUploading }) => (
                <Button type="button" variant="default" disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isUploading ? "Uploading..." : "Upload Image"}
                </Button>
              )}
            </FileUpload>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={imagePendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !deletingImageId) {
            setImagePendingRemoval(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Image from Library</DialogTitle>
            <DialogDescription>
              This image will no longer appear in the image picker. Existing
              pages and quizzes that already use it will keep showing it.
            </DialogDescription>
          </DialogHeader>
          {imagePendingRemoval ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="truncate text-sm font-medium text-gray-700">
                {imagePendingRemoval.name}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImagePendingRemoval(null)}
              disabled={deletingImageId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleImageRemoval()}
              disabled={deletingImageId !== null}
            >
              {deletingImageId !== null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImagePickerDialog;
