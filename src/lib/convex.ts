import { ConvexReactClient } from "convex/react";

function requireConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "[QuizBuilder] Missing NEXT_PUBLIC_CONVEX_URL. Add it to .env.local (Convex dashboard → Settings → URL).",
    );
  }
  return url;
}

const convex = new ConvexReactClient(requireConvexUrl());

export { convex };
