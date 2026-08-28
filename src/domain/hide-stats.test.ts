import { describe, expect, it } from "vitest";
import {
  addHideStats,
  coerceHideStats,
  emptyHideStats,
  hideStatsHaveIncrements,
} from "./hide-stats";

describe("hide stats", () => {
  it("coerces missing or invalid values to empty counts", () => {
    expect(coerceHideStats(undefined)).toEqual(emptyHideStats());
    expect(coerceHideStats({ hiddenByRules: -3, hiddenByMuted: "1" })).toEqual({
      hiddenByRules: 0,
      hiddenByMuted: 0,
      hiddenByBlockedBy: 0,
    });
  });

  it("adds whole-number increments only", () => {
    expect(addHideStats({
      hiddenByRules: 2,
      hiddenByMuted: 1,
      hiddenByBlockedBy: 4,
    }, {
      hiddenByRules: 3.8,
      hiddenByMuted: 0,
    })).toEqual({
      hiddenByRules: 5,
      hiddenByMuted: 1,
      hiddenByBlockedBy: 4,
    });
    expect(hideStatsHaveIncrements({ hiddenByRules: 1 })).toBe(true);
    expect(hideStatsHaveIncrements({ hiddenByMuted: 0 })).toBe(false);
  });
});
