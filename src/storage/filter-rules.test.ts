import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyFilterRuleSet } from "../domain/filter-rules";
import {
  FILTER_RULES_KEY,
  filterRulesStorageKey,
  getFilterRuleSet,
  getStoredFilterRuleSet,
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
          remove: vi.fn(async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key);
          }),
        },
      },
    });
  });

  it("namespaced storage keys from signed-in handles", () => {
    expect(filterRulesStorageKey("@Alice")).toBe("notBrother.filterRules.v1.ns.alice");
    expect(filterRulesStorageKey(null)).toBe(FILTER_RULES_KEY);
    expect(filterRulesStorageKey("not a handle")).toBe(FILTER_RULES_KEY);
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
    await expect(getStoredFilterRuleSet()).resolves.toBeNull();
    await expect(getFilterRuleSet()).resolves.toEqual(createEmptyFilterRuleSet());
  });

  it("recognizes only the local rule storage key", () => {
    expect(isFilterRulesStorageChange({
      [FILTER_RULES_KEY]: { newValue: createEmptyFilterRuleSet() },
    }, "local")).toBe(true);
    expect(isFilterRulesStorageChange({
      [filterRulesStorageKey("alice")]: { newValue: createEmptyFilterRuleSet() },
    }, "local")).toBe(true);
    expect(isFilterRulesStorageChange({
      [filterRulesStorageKey("alice")]: { newValue: createEmptyFilterRuleSet() },
    }, "local", "bob")).toBe(false);
    expect(isFilterRulesStorageChange({
      [FILTER_RULES_KEY]: { newValue: createEmptyFilterRuleSet() },
    }, "sync")).toBe(false);
  });

  it("stores and reads rule documents per signed-in handle", async () => {
    const aliceRules = {
      ...createEmptyFilterRuleSet(),
      name: "Alice",
      rules: [{
        id: "alice",
        label: "Alice",
        enabled: true,
        expiresAt: null,
        type: "user_handles" as const,
        handles: ["@Alice"],
      }],
    };
    const bobRules = {
      ...createEmptyFilterRuleSet(),
      name: "Bob",
      rules: [{
        id: "bob",
        label: "Bob",
        enabled: true,
        expiresAt: null,
        type: "content" as const,
        match: { mode: "contains" as const, value: "bob", caseSensitive: false },
      }],
    };

    await saveFilterRuleSet(aliceRules, "Alice");
    await saveFilterRuleSet(bobRules, "bob");

    expect(storage.has(FILTER_RULES_KEY)).toBe(false);
    expect(storage.get(filterRulesStorageKey("alice"))).toMatchObject({
      rules: [{ handles: ["alice"] }],
    });
    await expect(getFilterRuleSet("BOB")).resolves.toMatchObject({
      name: "Bob",
      rules: [{ id: "bob" }],
    });
  });

  it("moves a legacy unscoped document onto the first known handle", async () => {
    storage.set(FILTER_RULES_KEY, {
      ...createEmptyFilterRuleSet(),
      name: "Legacy",
      rules: [{
        id: "legacy",
        label: "Legacy",
        enabled: true,
        expiresAt: null,
        type: "content" as const,
        match: { mode: "contains" as const, value: "ads", caseSensitive: false },
      }],
    });

    await expect(getFilterRuleSet("InterJC")).resolves.toMatchObject({
      name: "Legacy",
      rules: [{ id: "legacy" }],
    });
    expect(storage.has(FILTER_RULES_KEY)).toBe(false);
    expect(storage.get(filterRulesStorageKey("interjc"))).toMatchObject({
      name: "Legacy",
    });
  });
});
