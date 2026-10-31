import { describe, expect, it } from "vitest";
import { assetLabel, extractReleaseNotes, releaseAssets, releaseBody } from "./release-notes.mjs";

const listing = `## English listing

### Version 1.2.3 release notes

- Fixes a thing.
- Adds another thing.

### Version 1.2.2 release notes

- Older.

## 中文商店文案
`;

describe("release notes", () => {
  it("extracts only the requested version", () => {
    expect(extractReleaseNotes(listing, "1.2.3")).toBe("- Fixes a thing.\n- Adds another thing.");
    expect(extractReleaseNotes(listing, "1.2.2")).toBe("- Older.");
  });

  it("fails when the version has no notes", () => {
    expect(() => extractReleaseNotes(listing, "9.9.9")).toThrow(/missing/);
    expect(() => extractReleaseNotes("### Version 1.0.0 release notes\n\n### Version 0.9.0 release notes\n- x", "1.0.0"))
      .toThrow(/empty/);
  });

  it("names release assets that stay distinct on GitHub's case-insensitive asset store", () => {
    const names = releaseAssets("1.2.3").map((asset) => asset.name);
    expect(names).toEqual([
      "not-brother-safari-app-1.2.3.zip",
      "not-brother-1.2.3.zip",
      "not-brother-safari-1.2.3.zip",
    ]);
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);
  });

  it("labels each asset with its audience and keeps the file name visible", () => {
    for (const asset of releaseAssets("1.2.3")) {
      expect(assetLabel(asset.name)).toBe(asset.label);
      expect(asset.label).toContain(`(${asset.name})`);
    }
    expect(assetLabel("not-brother-safari-app-1.2.3.zip")).toMatch(/download this/);
    expect(assetLabel("not-brother-1.2.3.zip")).toMatch(/offline install/);
    expect(() => assetLabel("something-else.zip")).toThrow(/Unknown release asset/);
  });

  it("puts the notes first, then a table of every file", () => {
    const body = releaseBody("- Fix.", "1.2.3");
    expect(body.startsWith("- Fix.\n")).toBe(true);
    for (const asset of releaseAssets("1.2.3")) expect(body).toContain(`\`${asset.name}\``);
    expect(body).toContain("Safari users: download this one");
    expect(body).toContain("Source code");
    expect(body).not.toContain("<version>");
  });
});
