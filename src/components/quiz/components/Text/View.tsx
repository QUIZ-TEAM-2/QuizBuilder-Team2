"use client";

import React, { useRef, useEffect } from "react";
import { type TextAlign, resolveTextFontSize } from "./types";

export interface TextViewProps {
  text: string;
  fontSize?: number;
  align?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  isEditing?: boolean;
  onTextChange?: (text: string) => void;
}

const alignClass: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function TextView({
  text,
  fontSize,
  align = "center",
  bold = false,
  italic = false,
  underline = false,
  color,
  isEditing = false,
  onTextChange,
}: TextViewProps) {
  const resolvedFontSize = resolveTextFontSize(fontSize);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      requestAnimationFrame(() => {
        textarea.select();
      });
    }
  }, [isEditing]);

  const baseClasses = [
    "flex",
    "flex-col",
    "justify-center",
    "h-full",
    "w-full",
    "my-1",
    alignClass[align],
    bold ? "font-bold" : "font-normal",
    italic ? "italic" : "not-italic",
    underline ? "underline" : "no-underline",
    color ? "" : "text-white",
    "max-w-full",
    "break-words",
    "whitespace-pre-wrap",
  ]
    .filter(Boolean)
    .join(" ");

  const style: React.CSSProperties = {
    fontSize: `${resolvedFontSize}px`,
    lineHeight:
      resolvedFontSize <= 14 ? 1.5 : resolvedFontSize >= 28 ? 1.2 : 1.35,
  };
  if (color && typeof color === "string") {
    style.color = color;
  }

  if (isEditing && onTextChange) {
    return (
      <div className={baseClasses} style={style}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="m-0 w-full resize-none border-none bg-transparent p-0 outline-none"
          rows={Math.max(1, text.split("\n").length)}
          style={{
            fontSize: `${resolvedFontSize}px`,
            lineHeight: style.lineHeight,
            color: style.color,
            fontWeight: bold ? "bold" : "normal",
            fontStyle: italic ? "italic" : "normal",
            textDecoration: underline ? "underline" : "none",
            textAlign: align,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div className={baseClasses} style={style}>
      {text}
    </div>
  );
}

export default TextView;
