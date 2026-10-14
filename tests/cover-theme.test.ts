import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COVER_THEME,
  coverTitle,
  isEmojiOnly,
  pickCoverTheme,
} from "../src/lib/coverTheme";

describe("pickCoverTheme", () => {
  it("uses the page background, most used shape colour and the emoji", () => {
    const theme = pickCoverTheme(
      [
        { type: "shape", props: { fillColor: "#0B1E33" } },
        { type: "shape", props: { fillColor: "#38bdf8" } },
        { type: "shape", props: { fillColor: "#38BDF8" } },
        { type: "shape", props: { fillColor: "#123456" } },
        { type: "text", data: "Which city?" },
        { type: "text", data: " 🏙️ " },
      ],
      { color: "#0b1e33" },
    );
    assert.deepEqual(theme, {
      background: "#0b1e33",
      accent: "#38bdf8",
      emoji: "🏙️",
    });
  });

  it("falls back to defaults for an empty or image background page", () => {
    assert.deepEqual(pickCoverTheme(undefined, undefined), DEFAULT_COVER_THEME);
    assert.deepEqual(
      pickCoverTheme([{ type: "text", data: "Hi" }], { color: "not a colour" }),
      DEFAULT_COVER_THEME,
    );
  });

  it("expands short hex colours", () => {
    assert.equal(pickCoverTheme([], { color: "#fff" }).background, "#ffffff");
  });
});

describe("isEmojiOnly", () => {
  it("accepts emoji, including joined ones, and rejects text", () => {
    assert.equal(isEmojiOnly("☕"), true);
    assert.equal(isEmojiOnly("👩‍💻"), true);
    assert.equal(isEmojiOnly("Coffee ☕"), false);
    assert.equal(isEmojiOnly("123"), false);
    assert.equal(isEmojiOnly(""), false);
  });
});

describe("coverTitle", () => {
  it("drops duplicate number suffixes", () => {
    assert.equal(coverTitle("Which city suits you? (2)"), "Which city suits you?");
    assert.equal(coverTitle("Top 10 (fun) facts"), "Top 10 (fun) facts");
    assert.equal(coverTitle(undefined), "My quiz");
  });
});
