"use client";

import React, { useState, useEffect } from "react";
import { DEFAULT_INPUT_PLACEHOLDER, DEFAULT_INPUT_MAX_LENGTH } from "./types";

interface InputViewProps {
  placeholder?: string;
  maxLength?: number;
  color?: string;
  textColor?: string;
  onInputChange?: (value: string) => void;
  initialValue?: string;
  isEditable?: boolean;
}

export function InputView({
  placeholder = DEFAULT_INPUT_PLACEHOLDER,
  maxLength = DEFAULT_INPUT_MAX_LENGTH,
  color = "#E8E8E8",
  textColor = "#333333",
  onInputChange,
  initialValue = "",
  isEditable = false,
}: InputViewProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (maxLength && newValue.length <= maxLength) {
      setValue(newValue);
      onInputChange?.(newValue);
    } else if (!maxLength) {
      setValue(newValue);
      onInputChange?.(newValue);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center px-4">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={isEditable}
        style={{
          backgroundColor: color,
          color: textColor,
          width: "100%",
          padding: "12px",
          borderRadius: "4px",
          border: "none",
          fontSize: "14px",
          fontFamily: "inherit",
        }}
        className="focus:outline-none focus:ring-2 focus:ring-offset-0"
      />
    </div>
  );
}

InputView.displayName = "InputView";
