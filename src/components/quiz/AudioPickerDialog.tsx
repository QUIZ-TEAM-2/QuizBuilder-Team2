"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { FileAudio, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import type { Audio } from "@/types";
import { api } from "../../../convex/_generated/api";

interface AudioPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  audios: Audio[];
  onAudioSelect: (url: string, name: string) => void;
}

const formatFileSize = (size?: number) => {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const AudioPickerDialog = ({
  isOpen,
  onClose,
  audios,
  onAudioSelect,
}: AudioPickerDialogProps) => {
  const [deletingAudioId, setDeletingAudioId] = useState<string | null>(null);
  const [audioPendingRemoval, setAudioPendingRemoval] = useState<Audio | null>(
    null,
  );
  const deleteAudio = useMutation(api.audios.deleteAudio);

  const handleAudioSelect = (audio: Audio) => {
    const url = audio.url ?? "";
    if (url) {
      onAudioSelect(url, audio.name);
      onClose();
    }
  };

  const requestAudioRemoval = (
    event: React.MouseEvent<HTMLButtonElement>,
    audio: Audio,
  ) => {
    event.stopPropagation();
    setAudioPendingRemoval(audio);
  };

  const handleAudioRemoval = async () => {
    if (!audioPendingRemoval) return;

    setDeletingAudioId(audioPendingRemoval._id);
    try {
      await deleteAudio({ audioId: audioPendingRemoval._id });
      toast.success("Audio removed from library");
      setAudioPendingRemoval(null);
    } catch (error) {
      console.error("Failed to remove audio from library", error);
      toast.error("Failed to remove audio from library");
    } finally {
      setDeletingAudioId(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[80vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Audio</DialogTitle>
            <DialogDescription>
              Choose an audio file from your library or upload a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto p-2 md:grid-cols-2">
            {audios.map((audio) => (
              <div
                key={audio._id}
                onClick={() => handleAudioSelect(audio)}
                className="group relative flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition-all hover:border-blue-500 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <FileAudio className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700">
                    {audio.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {[audio.format, formatFileSize(audio.size)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7 opacity-0 shadow-sm transition-opacity focus:opacity-100 group-hover:opacity-100"
                  onClick={(event) => requestAudioRemoval(event, audio)}
                  disabled={deletingAudioId === audio._id}
                  aria-label={`Remove ${audio.name} from library`}
                >
                  {deletingAudioId === audio._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {audios.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              <FileAudio className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p>No audio uploaded yet</p>
              <p className="mt-1 text-sm">
                Upload audio first to reuse it as page BGM.
              </p>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <FileUpload
              accept="audio/*"
              uploadKind="audio"
              onUploadComplete={() => {
                toast.success("Audio uploaded to library");
              }}
              onUploadError={() => {
                toast.error("Failed to upload audio");
              }}
            >
              {({ isUploading }) => (
                <Button type="button" variant="default" disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isUploading ? "Uploading..." : "Upload Audio"}
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
        open={audioPendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !deletingAudioId) {
            setAudioPendingRemoval(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Audio from Library</DialogTitle>
            <DialogDescription>
              This audio will no longer appear in the audio picker. Existing
              pages that already use it will keep playing it.
            </DialogDescription>
          </DialogHeader>
          {audioPendingRemoval ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="truncate text-sm font-medium text-gray-700">
                {audioPendingRemoval.name}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAudioPendingRemoval(null)}
              disabled={deletingAudioId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleAudioRemoval()}
              disabled={deletingAudioId !== null}
            >
              {deletingAudioId !== null ? (
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

export default AudioPickerDialog;
