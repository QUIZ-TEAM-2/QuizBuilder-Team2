import type { Component } from "@/types";

export const INPUT_COMPONENT_SLUG = "input";

export interface InputComponent extends Component {
  type: "input";
  props?: {
    placeholder?: string;
    maxLength?: number;
    color?: string;
    textColor?: string;
    /** When set with collectAsLead, maps this field into quizLeads on play submit. */
    leadField?: "email" | "name" | "phone";
    /** On question pages (non-result), marks free-text inputs as eligible for quizLeads mapping. */
    collectAsLead?: boolean;
  };
}

export const DEFAULT_INPUT_COLOR = "#E8E8E8";
export const DEFAULT_INPUT_TEXT_COLOR = "#333333";
export const DEFAULT_INPUT_PLACEHOLDER = "Enter text here...";
export const DEFAULT_INPUT_MAX_LENGTH = 500;
