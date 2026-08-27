import { describe, expect, it } from "vitest";
import {
  createEmptyFilterRuleSet,
  FilterRuleValidationError,
  MAX_FILTER_RULES_JSON_BYTES,
  importFilterRuleSet,
  parseFilterRuleSet,
  parseFilterRuleSetJson,
  serializeFilterRuleSet,
  type FilterRule,
  type FilterRuleSet,
} from "./filter-rules";
import { compileFilterRuleSet } from "./filter-rule-matching";
import { bundledDefaultFilterRuleSet } from "./filter-rules-default";

function ruleSet(rules: FilterRule[]): FilterRuleSet {
  return {
    ...createEmptyFilterRuleSet(),
    name: "Test rules",
    rules,
  };
}

function common(id: string) {
  return { id, label: id, enabled: true, expiresAt: null } as const;
}

describe("filter rule schema", () => {
  it("accepts the bundled default example document", () => {
    expect(bundledDefaultFilterRuleSet.rules.length).toBeGreaterThan(0);
    expect(serializeFilterRuleSet(bundledDefaultFilterRuleSet)).toContain("not-brother-filter-rules");
  });

  it("normalizes handles and ISO expiration timestamps", () => {
    const parsed = parseFilterRuleSet({
      ...ruleSet([]),
      rules: [{
        ...common("handles"),
        type: "user_handles",
        handles: [" @Alice ", "BOB"],
        expiresAt: "2030-01-02T03:04:05+09:00",
      }],
    });

    expect(parsed.rules[0]).toMatchObject({
      handles: ["alice", "bob"],
      expiresAt: "2030-01-01T18:04:05.000Z",
    });
  });

  it("rejects unknown fields, duplicate ids, duplicate handles, and unsafe regex", () => {
    expect(() => parseFilterRuleSet({ ...ruleSet([]), extra: true })).toThrow(
      FilterRuleValidationError,
    );
    expect(() => parseFilterRuleSet(ruleSet([
      { ...common("same"), type: "user_handles", handles: ["alice"] },
      { ...common("same"), type: "user_handles", handles: ["bob"] },
    ]))).toThrow(FilterRuleValidationError);
    expect(() => parseFilterRuleSet(ruleSet([
      { ...common("dupes"), type: "user_handles", handles: ["Alice", "@alice"] },
    ]))).toThrow(FilterRuleValidationError);
    expect(() => parseFilterRuleSet(ruleSet([{
      ...common("regex"),
      type: "content",
      match: { mode: "regex", value: "(a+)+$", caseSensitive: false },
    }]))).toThrow(FilterRuleValidationError);
  });

  it("rejects malformed or oversized JSON", () => {
    expect(() => parseFilterRuleSetJson("{"))
      .toThrow("must be valid JSON");
    expect(() => parseFilterRuleSetJson(`"${"x".repeat(MAX_FILTER_RULES_JSON_BYTES)}"`))
      .toThrow("1 MiB");
  });

  it("serializes a canonical rule set", () => {
    const json = serializeFilterRuleSet(ruleSet([
      { ...common("handles"), type: "user_handles", handles: ["@Alice"] },
    ]));
    expect(JSON.parse(json)).toMatchObject({
      format: "not-brother-filter-rules",
      schemaVersion: 1,
      rules: [{ handles: ["alice"] }],
    });
  });
});

describe("filter rule matching", () => {
  it("matches handles exactly and names/content by contains or safe regex", () => {
    const compiled = compileFilterRuleSet(ruleSet([
      { ...common("handle"), type: "user_handles", handles: ["alice"] },
      {
        ...common("name"),
        type: "display_name",
        match: { mode: "contains", value: "公式", caseSensitive: false },
      },
      {
        ...common("content"),
        type: "content",
        match: { mode: "regex", value: "giveaway\\s+today", caseSensitive: false },
      },
    ]));

    expect(compiled.activeRuleCount).toBe(3);
    expect(compiled.match({
      userKey: "ALICE",
      displayName: null,
      contentText: null,
    })?.id).toBe("handle");
    expect(compiled.match({
      userKey: "other",
      displayName: "公式ニュース",
      contentText: null,
    })?.id).toBe("name");
    expect(compiled.match({
      userKey: "other",
      displayName: "Other",
      contentText: "GIVEAWAY   TODAY!",
    })?.id).toBe("content");
  });

  it("ignores disabled and expired rules while preserving them in the document", () => {
    const rules = ruleSet([
      {
        ...common("expired"),
        type: "user_handles",
        handles: ["alice"],
        expiresAt: "2020-01-01T00:00:00.000Z",
      },
      {
        ...common("disabled"),
        type: "user_handles",
        handles: ["bob"],
        enabled: false,
      },
    ]);
    const compiled = compileFilterRuleSet(rules, Date.parse("2025-01-01T00:00:00Z"));
    expect(compiled.activeRuleCount).toBe(0);
    expect(rules.rules).toHaveLength(2);
  });

  it("stops matching as soon as a compiled rule expires", () => {
    const compiled = compileFilterRuleSet(ruleSet([{
      ...common("temporary"),
      type: "user_handles",
      handles: ["alice"],
      expiresAt: "2025-01-02T00:00:00.000Z",
    }]), Date.parse("2025-01-01T00:00:00Z"));
    const candidate = {
      userKey: "alice",
      displayName: "Alice",
      contentText: null,
      sourceType: "timeline" as const,
    };

    expect(compiled.activeRuleCount).toBe(1);
    expect(compiled.match(candidate, Date.parse("2025-01-01T23:59:59Z"))?.id)
      .toBe("temporary");
    expect(compiled.match(candidate, Date.parse("2025-01-02T00:00:00Z"))).toBeNull();
  });
});

describe("filter rule imports", () => {
  it("appends incoming rules and mint a new id on collision", () => {
    const current = ruleSet([
      { ...common("same"), type: "user_handles", handles: ["old"] },
      { ...common("local"), type: "user_handles", handles: ["local"] },
    ]);
    const incoming = {
      ...ruleSet([
        { ...common("same"), type: "user_handles", handles: ["new"] },
        { ...common("remote"), type: "user_handles", handles: ["remote"] },
      ]),
      name: "Remote",
    };

    const appended = importFilterRuleSet(current, incoming, "append");
    expect(appended.name).toBe("Test rules");
    expect(appended.rules.map((rule) => rule.id)).toEqual(["same", "local", "same-2", "remote"]);
    expect(appended.rules[0]).toMatchObject({ handles: ["old"] });
    expect(appended.rules[2]).toMatchObject({ id: "same-2", handles: ["new"] });
  });

  it("replaces the current document when overwrite is requested", () => {
    const current = ruleSet([
      { ...common("local"), type: "user_handles", handles: ["local"] },
    ]);
    const incoming = {
      ...ruleSet([
        { ...common("remote"), type: "user_handles", handles: ["remote"] },
      ]),
      name: "Remote",
    };
    expect(importFilterRuleSet(current, incoming, "replace")).toEqual(incoming);
  });
});
