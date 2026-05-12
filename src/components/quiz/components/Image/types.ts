import type { Component } from "@/types";

export interface ImageComponent extends Component {
  type: "image";
  data: string;
  props?: {
    width?: number;
    height?: number;
    opacity?: number;
  } & Record<string, unknown>;
}

export const DEFAULT_IMAGE_OPACITY = 100;
