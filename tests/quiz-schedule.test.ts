import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCountdown,
  fromDateTimeLocalValue,
  getScheduleBadge,
  getScheduleState,
  toDateTimeLocalValue,
  validateSchedule,
} from "../convex/quizSchedule";

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 14, 2, 0, 0);

describe("getScheduleState", () => {
  it("is open with no schedule", () => {
    assert.equal(getScheduleState({}, now), "open");
    assert.equal(getScheduleState({ opensAt: null, closesAt: null }, now), "open");
  });

  it("is upcoming before it opens and ended once it closes", () => {
    assert.equal(getScheduleState({ opensAt: now + HOUR }, now), "upcoming");
    assert.equal(getScheduleState({ closesAt: now - 1 }, now), "ended");
    assert.equal(getScheduleState({ closesAt: now }, now), "ended");
  });

  it("is open inside the window", () => {
    assert.equal(
      getScheduleState({ opensAt: now - HOUR, closesAt: now + HOUR }, now),
      "open",
    );
  });
});

describe("validateSchedule", () => {
  it("needs the close time after the open time", () => {
    assert.match(
      validateSchedule({ opensAt: now, closesAt: now - HOUR }) ?? "",
      /after the opening time/,
    );
    assert.equal(validateSchedule({ opensAt: now, closesAt: now + HOUR }), null);
    assert.equal(validateSchedule({ opensAt: now }), null);
    assert.equal(validateSchedule({}), null);
  });

  it("rejects invalid numbers", () => {
    assert.ok(validateSchedule({ opensAt: Number.NaN }));
  });
});

describe("formatCountdown", () => {
  it("shows the two biggest units", () => {
    assert.equal(formatCountdown(2 * 24 * HOUR + 4 * HOUR + 5_000), "2d 4h");
    assert.equal(formatCountdown(3 * HOUR + 5 * 60_000), "3h 05m");
    assert.equal(formatCountdown(4 * 60_000 + 9_000), "4m 09s");
    assert.equal(formatCountdown(11_200), "12s");
    assert.equal(formatCountdown(-5), "0s");
  });
});

describe("getScheduleBadge", () => {
  it("only labels published quizzes with a schedule", () => {
    assert.equal(getScheduleBadge("draft", { opensAt: now + HOUR }, now), null);
    assert.equal(getScheduleBadge("published", {}, now), null);
    assert.equal(
      getScheduleBadge("published", { opensAt: now + HOUR }, now)?.tone,
      "upcoming",
    );
    assert.equal(
      getScheduleBadge("published", { closesAt: now + HOUR }, now)?.tone,
      "closing",
    );
    assert.equal(
      getScheduleBadge("published", { closesAt: now - HOUR }, now)?.tone,
      "ended",
    );
  });
});

describe("badge labels", () => {
  it("shows the time for today and the date otherwise", () => {
    const today = getScheduleBadge("published", { opensAt: now + 60_000 }, now)!;
    assert.match(today.label, /^Opens \d{1,2}:\d{2}/);
    const later = getScheduleBadge("published", { opensAt: now + 5 * 24 * HOUR }, now)!;
    assert.match(later.label, /^Opens \d{1,2} [A-Z][a-z]{2}/);
  });
});

describe("datetime-local conversion", () => {
  it("round trips to the minute in local time", () => {
    const value = toDateTimeLocalValue(now);
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(fromDateTimeLocalValue(value), now);
    assert.equal(fromDateTimeLocalValue(""), null);
    assert.equal(toDateTimeLocalValue(null), "");
  });
});
