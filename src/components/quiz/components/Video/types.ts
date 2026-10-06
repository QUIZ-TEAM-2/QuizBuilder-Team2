import type { Component } from "@/types";

export interface VideoProps extends Record<string, unknown> {
  /** A YouTube or Vimeo link, or a direct link to an .mp4/.webm file. */
  url?: string;
  /** Rounded corners on the video frame. */
  rounded?: boolean;
}

export interface VideoComponent extends Component {
  type: "video";
  data?: string;
  props?: VideoProps;
}

export const VIDEO_COMPONENT_SLUG = "video";

export type ResolvedVideo =
  | { kind: "iframe"; src: string; provider: "youtube" | "vimeo" }
  | { kind: "file"; src: string }
  | { kind: "none" };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeIdFrom(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && YOUTUBE_ID.test(v)) return v;
    const [, kind, id] = url.pathname.split("/");
    if ((kind === "embed" || kind === "shorts" || kind === "live") && id) {
      return YOUTUBE_ID.test(id) ? id : null;
    }
  }
  return null;
}

function vimeoIdFrom(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const id = url.pathname
    .split("/")
    .filter(Boolean)
    .find((part) => /^\d+$/.test(part));
  return id ?? null;
}

/** Turns a pasted link into something the page can embed. */
export function resolveVideoUrl(raw: unknown): ResolvedVideo {
  if (typeof raw !== "string" || raw.trim() === "") return { kind: "none" };

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { kind: "none" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { kind: "none" };
  }

  const youtubeId = youtubeIdFrom(url);
  if (youtubeId) {
    return {
      kind: "iframe",
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&playsinline=1`,
    };
  }

  const vimeoId = vimeoIdFrom(url);
  if (vimeoId) {
    return {
      kind: "iframe",
      provider: "vimeo",
      src: `https://player.vimeo.com/video/${vimeoId}`,
    };
  }

  if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) {
    return { kind: "file", src: url.toString() };
  }

  return { kind: "none" };
}
