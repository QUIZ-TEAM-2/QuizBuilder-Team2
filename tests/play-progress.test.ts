import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAY_PROGRESS_TTL_MS,
  parseSavedProgress,
  seededShuffle,
} from "../src/lib/playProgress";

void describe("seededShuffle", () => {
  const items = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];

  void it("keeps every item exactly once", () => {
    const shuffled = seededShuffle(items, "session-a");
    assert.deepEqual([...shuffled].sort(), [...items].sort());
  });

  void it("gives the same order for the same seed", () => {
    assert.deepEqual(
      seededShuffle(items, "session-a"),
      seededShuffle(items, "session-a"),
    );
  });

  void it("gives different orders for different seeds", () => {
    const orders = new Set(
      ["a", "b", "c", "d", "e"].map((seed) =>
        seededShuffle(items, seed).join(","),
      ),
    );
    assert.ok(orders.size > 1);
  });

  void it("does not modify the input", () => {
    const copy = [...items];
    seededShuffle(items, "session-a");
    assert.deepEqual(items, copy);
  });
});

void describe("parseSavedProgress", () => {
  const now = 1_800_000_000_000;
  const valid = { sessionId: "s1", pageId: "p1", savedAt: now - 1000 };

  void it("accepts valid recent progress", () => {
    assert.deepEqual(parseSavedProgress(JSON.stringify(valid), now), valid);
  });

  void it("rejects missing, malformed and incomplete data", () => {
    assert.equal(parseSavedProgress(null, now), null);
    assert.equal(parseSavedProgress("not json", now), null);
    assert.equal(parseSavedProgress("[]", now), null);
    assert.equal(
      parseSavedProgress(JSON.stringify({ ...valid, pageId: "" }), now),
      null,
    );
  });

  void it("rejects expired progress", () => {
    const old = { ...valid, savedAt: now - PLAY_PROGRESS_TTL_MS - 1 };
    assert.equal(parseSavedProgress(JSON.stringify(old), now), null);
  });
});
