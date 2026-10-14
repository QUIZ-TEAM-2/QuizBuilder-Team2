import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmbedSnippet,
  buildEmbedUrl,
  buildPublicQuizLink,
  toFileSlug,
} from "../src/lib/shareLinks";

const origin = "https://quiz-builder-team2.vercel.app";

describe("share links", () => {
  it("uses the custom slug when there is one", () => {
    assert.equal(
      buildPublicQuizLink({ _id: "abc", title: "T", customSlug: "coffee" }, origin),
      `${origin}/custom/coffee`,
    );
  });

  it("falls back to the discover page", () => {
    assert.equal(
      buildPublicQuizLink({ _id: "abc", title: "T" }, `${origin}/`),
      `${origin}/discover/abc`,
    );
  });

  it("builds an embed url that hides the back button", () => {
    const url = new URL(buildEmbedUrl("abc", origin));
    assert.equal(url.pathname, "/play/abc");
    assert.equal(url.searchParams.get("embed"), "1");
    assert.equal(url.searchParams.get("source"), "embed");
  });

  it("escapes the title inside the iframe snippet", () => {
    const snippet = buildEmbedSnippet(
      { _id: "abc", title: 'Are you a "night owl" <or> early bird?' },
      origin,
    );
    assert.match(snippet, /^<iframe/);
    assert.match(snippet, /<\/iframe>$/);
    assert.ok(snippet.includes("&quot;night owl&quot; &lt;or&gt;"));
    assert.ok(!snippet.includes('"night owl"'));
    assert.ok(snippet.includes("src=\"https://quiz-builder-team2.vercel.app/play/abc?source=embed&amp;embed=1\""));
  });

  it("makes safe file names", () => {
    assert.equal(toFileSlug("Which Study Style Suits You Best?"), "which-study-style-suits-you-best");
    assert.equal(toFileSlug("!!!"), "quiz");
  });
});
