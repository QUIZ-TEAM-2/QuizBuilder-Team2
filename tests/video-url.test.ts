import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVideoUrl } from "../src/components/quiz/components/Video/types";

void test("YouTube watch, short, shorts and embed links resolve to the same embed", () => {
  const expected =
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1";
  for (const link of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
  ]) {
    const result = resolveVideoUrl(link);
    assert.equal(result.kind, "iframe", link);
    assert.equal(result.kind === "iframe" ? result.src : "", expected, link);
  }
});

void test("Vimeo links resolve to the Vimeo player", () => {
  const result = resolveVideoUrl("https://vimeo.com/76979871");
  assert.deepEqual(result, {
    kind: "iframe",
    provider: "vimeo",
    src: "https://player.vimeo.com/video/76979871",
  });
});

void test("direct video files play natively", () => {
  assert.equal(resolveVideoUrl("https://example.com/clip.mp4").kind, "file");
});

void test("empty, invalid and unsupported links resolve to none", () => {
  for (const link of [
    "",
    "   ",
    "not a url",
    "javascript:alert(1)",
    "https://example.com/page",
    "https://youtube.com/watch?v=short",
    undefined,
  ]) {
    assert.equal(resolveVideoUrl(link).kind, "none", String(link));
  }
});
