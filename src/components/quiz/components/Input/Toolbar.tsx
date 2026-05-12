"use client";

import type { ComponentToolbarProps } from "@/lib/quizComponents";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type InputComponent,
  DEFAULT_INPUT_PLACEHOLDER,
  DEFAULT_INPUT_MAX_LENGTH,
  DEFAULT_INPUT_COLOR,
  DEFAULT_INPUT_TEXT_COLOR,
} from "./types";

export function InputToolbar({
  component,
  onUpdateProps,
}: ComponentToolbarProps<InputComponent>) {
  const props = component.props ?? {};
  const placeholder = props.placeholder ?? DEFAULT_INPUT_PLACEHOLDER;
  const maxLength = props.maxLength ?? DEFAULT_INPUT_MAX_LENGTH;
  const color = props.color ?? DEFAULT_INPUT_COLOR;
  const textColor = props.textColor ?? DEFAULT_INPUT_TEXT_COLOR;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="placeholder_input" className="text-sm font-medium">
          Placeholder
        </Label>
        <Input
          id="placeholder_input"
          type="text"
          value={placeholder}
          onChange={(e) =>
            onUpdateProps({
              ...props,
              placeholder: e.target.value,
            })
          }
          placeholder="Enter placeholder text"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="maxlength_input" className="text-sm font-medium">
          Max Length
        </Label>
        <Input
          id="maxlength_input"
          type="number"
          min="1"
          value={maxLength}
          onChange={(e) =>
            onUpdateProps({
              ...props,
              maxLength: Math.max(1, parseInt(e.target.value, 10) || 0),
            })
          }
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="bg_color_input" className="text-sm font-medium">
          Background Color
        </Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            id="bg_color_input"
            type="color"
            value={color}
            onChange={(e) =>
              onUpdateProps({
                ...props,
                color: e.target.value,
              })
            }
            className="w-10 h-10 rounded cursor-pointer"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) =>
              onUpdateProps({
                ...props,
                color: e.target.value,
              })
            }
            className="flex-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="text_color_input" className="text-sm font-medium">
          Text Color
        </Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            id="text_color_input"
            type="color"
            value={textColor}
            onChange={(e) =>
              onUpdateProps({
                ...props,
                textColor: e.target.value,
              })
            }
            className="w-10 h-10 rounded cursor-pointer"
          />
          <Input
            type="text"
            value={textColor}
            onChange={(e) =>
              onUpdateProps({
                ...props,
                textColor: e.target.value,
              })
            }
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

InputToolbar.displayName = "InputToolbar";
