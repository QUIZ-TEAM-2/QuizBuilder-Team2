import type { Component } from "@/types";

export interface ImageComponent extends Component {
  type: "image";
  data: string;
  props?: {
    width?: number;
    height?: number;
    opacity?: number;
    /** Alt text for screen readers. */
    alt?: string;
  } & Record<string, unknown>;
}

export const DEFAULT_IMAGE_OPACITY = 100;
