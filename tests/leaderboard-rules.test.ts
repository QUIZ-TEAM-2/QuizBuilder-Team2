import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEADERBOARD_NAME_MAX,
  cleanLeaderboardName,
  computeRankKey,
  formatDuration,
  isLeaderboardOn,
  rankSortedKeys,
} from "../convex/leaderboardRules";

describe("isLeaderboardOn", () => {
  it("is on for knowledge quizzes unless switched off", () => {
    assert.equal(isLeaderboardOn({ quizType: "knowledge" }), true);
    assert.equal(
      isLeaderboardOn({ quizType: "knowledge", leaderboardEnabled: false }),
      false,
    );
    assert.equal(isLeaderboardOn({ quizType: "personality" }), false);
    assert.equal(isLeaderboardOn({}), false);
  });
});

describe("cleanLeaderboardName", () => {
  it("trims, collapses spaces and strips markup characters", () => {
    assert.equal(cleanLeaderboardName("  Amaar   B  "), "Amaar B");
    assert.equal(cleanLeaderboardName("<b>Zita</b>"), "bZita/b");
  });

  it("rejects empty names", () => {
    assert.equal(cleanLeaderboardName("   "), null);
    assert.equal(cleanLeaderboardName(42), null);
  });

  it("caps the length without splitting emoji", () => {
    const long = "🔥".repeat(30);
    const cleaned = cleanLeaderboardName(long)!;
    assert.equal(Array.from(cleaned).length, LEADERBOARD_NAME_MAX);
  });
});

describe("computeRankKey", () => {
  it("ranks a higher percentage above a faster time", () => {
    assert.ok(computeRankKey(5, 5, 600_000) > computeRankKey(4, 5, 1_000));
  });

  it("breaks ties on percentage with the faster time", () => {
    assert.ok(computeRankKey(3, 5, 20_000) > computeRankKey(3, 5, 25_000));
  });

  it("compares quizzes of different lengths by percentage", () => {
    assert.ok(computeRankKey(9, 10, 5_000) > computeRankKey(4, 5, 5_000));
  });
});

describe("rankSortedKeys", () => {
  it("gives tied scores the same rank", () => {
    assert.deepEqual(rankSortedKeys([90, 80, 80, 70]), [1, 2, 2, 4]);
    assert.deepEqual(rankSortedKeys([]), []);
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    assert.equal(formatDuration(9_400), "9s");
    assert.equal(formatDuration(125_000), "2m 05s");
    assert.equal(formatDuration(3_720_000), "1h 02m");
  });
});
