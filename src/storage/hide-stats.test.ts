import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HIDE_STATS_KEY,
  getHideStats,
  hideStatsStorageKey,
  incrementHideStats,
  isHideStatsStorageChange,
} from "./hide-stats";

describe("hide stats storage", () => {
  const storage = new Map<string, unknown>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => Object.fromEntries(storage)),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) storage.set(key, value);
          }),
        },
      },
    });
  });

  it("namespaces counts by signed-in handle", () => {
    expect(hideStatsStorageKey("@Alice")).toBe("notBrother.hideStats.v1.ns.alice");
    expect(hideStatsStorageKey(null)).toBe(HIDE_STATS_KEY);
  });

  it("increments namespaced counts without mixing accounts", async () => {
    expect(await getHideStats("alice")).toEqual({
      hiddenByRules: 0,
      hiddenByMuted: 0,
      hiddenByBlockedBy: 0,
    });
    expect(await incrementHideStats({ hiddenByRules: 2, hiddenByMuted: 1 }, "alice")).toEqual({
      hiddenByRules: 2,
      hiddenByMuted: 1,
      hiddenByBlockedBy: 0,
    });
    expect(await incrementHideStats({ hiddenByBlockedBy: 3 }, "alice")).toEqual({
      hiddenByRules: 2,
      hiddenByMuted: 1,
      hiddenByBlockedBy: 3,
    });
    expect(await getHideStats("bob")).toEqual({
      hiddenByRules: 0,
      hiddenByMuted: 0,
      hiddenByBlockedBy: 0,
    });
    expect(isHideStatsStorageChange({
      [hideStatsStorageKey("alice")]: { newValue: { hiddenByRules: 2 } },
    }, "local", "alice")).toBe(true);
    expect(isHideStatsStorageChange({
      [hideStatsStorageKey("alice")]: { newValue: { hiddenByRules: 2 } },
    }, "local", "bob")).toBe(false);
  });
});
