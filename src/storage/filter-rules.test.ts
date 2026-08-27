import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyFilterRuleSet } from "../domain/filter-rules";
import {
  FILTER_RULES_KEY,
  getFilterRuleSet,
  isFilterRulesStorageChange,
  saveFilterRuleSet,
} from "./filter-rules";

describe("filter rule storage", () => {
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

  it("keeps the rule document in local storage", async () => {
    const ruleSet = {
      ...createEmptyFilterRuleSet(),
      rules: [{
        id: "alice",
        label: "Alice",
        enabled: true,
        expiresAt: null,
        type: "user_handles" as const,
        handles: ["@Alice"],
      }],
    };
    await saveFilterRuleSet(ruleSet);

    expect(storage.get(FILTER_RULES_KEY)).toMatchObject({
      rules: [{ handles: ["alice"] }],
    });
    await expect(getFilterRuleSet()).resolves.toMatchObject({
      rules: [{ handles: ["alice"] }],
    });
  });

  it("returns an empty set when no rules have been saved", async () => {
    await expect(getFilterRuleSet()).resolves.toEqual(createEmptyFilterRuleSet());
  });

  it("recognizes only the local rule storage key", () => {
    expect(isFilterRulesStorageChange({
      [FILTER_RULES_KEY]: { newValue: createEmptyFilterRuleSet() },
    }, "local")).toBe(true);
    expect(isFilterRulesStorageChange({
      [FILTER_RULES_KEY]: { newValue: createEmptyFilterRuleSet() },
    }, "sync")).toBe(false);
  });
});
