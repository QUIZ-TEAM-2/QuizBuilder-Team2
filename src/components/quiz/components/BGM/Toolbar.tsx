"use client";

import { Music, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { ComponentToolbarProps } from "@/lib/quizComponents";
import type { BGMComponent } from "./types";
import {
  DEFAULT_BGM_PROPS,
  normalizeBGMOpacity,
  normalizeBGMVolume,
} from "./types";

export function BGMToolbar({
  component,
  onUpdateProps,
  onOpenAudioPicker,
}: ComponentToolbarProps<BGMComponent>) {
  const props = component.props ?? {};
  const fileName =
    typeof props.fileName === "string" && props.fileName.trim()
      ? props.fileName
      : "No audio selected";
  const muted =
    typeof props.muted === "boolean" ? props.muted : DEFAULT_BGM_PROPS.muted;
  const volume = normalizeBGMVolume(props.volume);
  const backgroundColor =
    typeof props.backgroundColor === "string"
      ? props.backgroundColor
      : DEFAULT_BGM_PROPS.backgroundColor;
  const iconColor =
    typeof props.iconColor === "string"
      ? props.iconColor
      : DEFAULT_BGM_PROPS.iconColor;
  const opacity = normalizeBGMOpacity(props.opacity);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAudioPicker}
        className="gap-1"
      >
        <Music className="h-4 w-4" />
        Change Audio
      </Button>
      <span
        className="max-w-40 truncate text-xs text-gray-600"
        title={fileName}
      >
        {fileName}
      </span>
      <div className="h-6 w-px bg-gray-200" />
      <Button
        variant={muted ? "default" : "outline"}
        size="sm"
        onClick={() => onUpdateProps({ muted: !muted })}
        className="gap-1"
      >
        {muted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {muted ? "Muted" : "Sound"}
      </Button>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Volume: {volume}%</Label>
        <Slider
          value={[volume]}
          onValueChange={([value]) => onUpdateProps({ volume: value })}
          min={0}
          max={100}
          step={5}
          className="w-24"
        />
      </div>
      <div className="h-6 w-px bg-gray-200" />
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Button</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(event) =>
            onUpdateProps({ backgroundColor: event.target.value })
          }
          className="h-8 w-10 cursor-pointer p-1"
          title="Button color"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Icon</Label>
        <Input
          type="color"
          value={iconColor}
          onChange={(event) => onUpdateProps({ iconColor: event.target.value })}
          className="h-8 w-10 cursor-pointer p-1"
          title="Icon color"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-xs">Opacity: {opacity}%</Label>
        <Slider
          value={[opacity]}
          onValueChange={([value]) => onUpdateProps({ opacity: value })}
          min={0}
          max={100}
          step={5}
          className="w-24"
        />
      </div>
    </>
  );
}

export default BGMToolbar;
