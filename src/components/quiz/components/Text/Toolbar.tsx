"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TextComponent, TextAlign } from "./types";

const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];

export interface TextToolbarProps {
  component: TextComponent;
  onUpdateProps: (props: Record<string, unknown>) => void;
}

export function TextToolbar({ component, onUpdateProps }: TextToolbarProps) {
  const props = component.props ?? {};
  const align = (props.align as TextAlign) || "center";
  const bold = props.bold === true;
  const italic = props.italic === true;
  const underline = props.underline === true;
  const fontSize = typeof props.fontSize === "number" ? props.fontSize : 16;
  const color = typeof props.color === "string" ? props.color : "#FFFFFF";

  return (
    <>
      {/* Font Size */}
      <Select
        value={String(fontSize)}
        onValueChange={(next) => {
          const parsed = Number(next);
          if (!Number.isNaN(parsed)) {
            onUpdateProps({ fontSize: parsed });
          }
        }}
      >
        <SelectTrigger className="h-8 w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-gray-200" />

      {/* Text Formatting */}
      <Toggle
        aria-label="Bold"
        size="sm"
        pressed={bold}
        onPressedChange={(pressed) => onUpdateProps({ bold: pressed })}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        aria-label="Italic"
        size="sm"
        pressed={italic}
        onPressedChange={(pressed) => onUpdateProps({ italic: pressed })}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        aria-label="Underline"
        size="sm"
        pressed={underline}
        onPressedChange={(pressed) => onUpdateProps({ underline: pressed })}
      >
        <Underline className="h-4 w-4" />
      </Toggle>

      <div className="h-6 w-px bg-gray-200" />

      {/* Alignment */}
      <ToggleGroup
        type="single"
        value={align}
        onValueChange={(next) => {
          if (next) onUpdateProps({ align: next as TextAlign });
        }}
        size="sm"
      >
        <ToggleGroupItem value="left" aria-label="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right">
          <AlignRight className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="h-6 w-px bg-gray-200" />

      {/* Color */}
      <Input
        type="color"
        className="h-8 w-10 cursor-pointer p-1"
        value={color}
        onChange={(e) => onUpdateProps({ color: e.target.value })}
      />
    </>
  );
}

export default TextToolbar;

