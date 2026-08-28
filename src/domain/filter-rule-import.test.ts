import { describe, expect, it, vi } from "vitest";
import { createEmptyFilterRuleSet } from "./filter-rules";
import {
  fetchFilterRuleSet,
  FilterRuleImportError,
  resolveFilterRuleImportTarget,
} from "./filter-rule-import";

const payload = JSON.stringify({
  ...createEmptyFilterRuleSet(),
  name: "Remote rules",
});

describe("remote filter rule import targets", () => {
  it("normalizes public Gist page and API URLs", () => {
    expect(resolveFilterRuleImportTarget(
      "https://gist.github.com/example/abcdef12345#file-rules-json",
    )).toEqual({
      kind: "gist",
      requestUrl: "https://api.github.com/gists/abcdef12345",
      permissionOrigins: [
        "https://api.github.com/*",
        "https://gist.githubusercontent.com/*",
      ],
    });
    expect(resolveFilterRuleImportTarget("https://api.github.com/gists/abcdef12345").kind)
      .toBe("gist");
  });

  it("accepts only HTTPS URLs without embedded credentials", () => {
    expect(resolveFilterRuleImportTarget("https://example.com/rules.json")).toEqual({
      kind: "json",
      requestUrl: "https://example.com/rules.json",
      permissionOrigins: ["https://example.com/*"],
    });
    expect(() => resolveFilterRuleImportTarget("http://example.com/rules.json"))
      .toThrow(FilterRuleImportError);
    expect(() => resolveFilterRuleImportTarget("https://user:pass@example.com/rules.json"))
      .toThrow(FilterRuleImportError);
  });

  it("rewrites GitHub repository raw links so fetch does not follow redirects", () => {
    expect(resolveFilterRuleImportTarget(
      "https://github.com/interjc/chrome-x-not-brother-rules/raw/refs/heads/main/rules/filter-default.json",
    )).toEqual({
      kind: "json",
      requestUrl:
        "https://raw.githubusercontent.com/interjc/chrome-x-not-brother-rules/refs/heads/main/rules/filter-default.json",
      permissionOrigins: ["https://raw.githubusercontent.com/*"],
    });
  });
});

describe("remote filter rule fetch", () => {
  it("loads and validates an ordinary public JSON file", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(payload, { status: 200 }));
    const target = resolveFilterRuleImportTarget("https://example.com/rules.json");

    await expect(fetchFilterRuleSet(target, { fetchImpl })).resolves.toMatchObject({
      name: "Remote rules",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/rules.json",
      expect.objectContaining({ credentials: "omit", redirect: "error" }),
    );
  });

  it("selects the only JSON file in a Gist", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      files: {
        "notes.md": {
          filename: "notes.md",
          raw_url: "https://gist.githubusercontent.com/example/id/raw/notes.md",
          size: 5,
          truncated: false,
          content: "notes",
        },
        "rules.json": {
          filename: "rules.json",
          raw_url: "https://gist.githubusercontent.com/example/id/raw/rules.json",
          size: payload.length,
          truncated: false,
          content: payload,
        },
      },
    }), { status: 200 }));
    const target = resolveFilterRuleImportTarget("https://gist.github.com/example/abcdef12345");

    await expect(fetchFilterRuleSet(target, { fetchImpl })).resolves.toMatchObject({
      name: "Remote rules",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("loads a truncated Gist file only from GitHub's raw host", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        files: {
          "rules.json": {
            filename: "rules.json",
            raw_url: "https://gist.githubusercontent.com/example/id/raw/rules.json",
            size: payload.length,
            truncated: true,
          },
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(payload, { status: 200 }));
    const target = resolveFilterRuleImportTarget("https://gist.github.com/example/abcdef12345");

    await expect(fetchFilterRuleSet(target, { fetchImpl })).resolves.toMatchObject({
      name: "Remote rules",
    });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      "https://gist.githubusercontent.com/example/id/raw/rules.json",
      expect.any(Object),
    );
  });

  it("rejects ambiguous Gists, invalid rules, and oversized responses", async () => {
    const ambiguous = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      files: {
        "one.json": { filename: "one.json", raw_url: "https://gist.githubusercontent.com/x/1/raw", size: 2, content: "{}" },
        "two.json": { filename: "two.json", raw_url: "https://gist.githubusercontent.com/x/2/raw", size: 2, content: "{}" },
      },
    }), { status: 200 }));
    const gist = resolveFilterRuleImportTarget("https://gist.github.com/example/abcdef12345");
    await expect(fetchFilterRuleSet(gist, { fetchImpl: ambiguous })).rejects
      .toMatchObject({ code: "gist-file-ambiguous" });

    const invalid = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    const json = resolveFilterRuleImportTarget("https://example.com/rules.json");
    await expect(fetchFilterRuleSet(json, { fetchImpl: invalid })).rejects
      .toMatchObject({ code: "invalid-rules" });

    const large = vi.fn<typeof fetch>(async () => new Response("", {
      status: 200,
      headers: { "content-length": String(2 * 1024 * 1024) },
    }));
    await expect(fetchFilterRuleSet(json, { fetchImpl: large })).rejects
      .toMatchObject({ code: "response-too-large" });
  });
});
