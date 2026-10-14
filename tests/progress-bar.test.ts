import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProgressValues } from "../src/components/quiz/components/ProgressBar/types";

describe("getProgressValues", () => {
  it("shows the player's real progress", () => {
    assert.deepEqual(
      getProgressValues({ isEditable: false, currentPageNumber: 2, totalPages: 5 }),
      { currentValue: "2", totalValue: "5" },
    );
  });

  it("shows the page's position in the editor when the page count is known", () => {
    assert.deepEqual(
      getProgressValues({ isEditable: true, currentPageNumber: 1, totalPages: 3 }),
      { currentValue: "1", totalValue: "3" },
    );
  });

  it("falls back to placeholders in the editor without a page count", () => {
    assert.deepEqual(getProgressValues({ isEditable: true }), {
      currentValue: "X",
      totalValue: "Y",
    });
  });
});
