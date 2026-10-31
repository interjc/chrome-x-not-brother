import { describe, expect, it } from "vitest";
import { extractReleaseNotes, releaseBody } from "./release-notes.mjs";

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

  it("lists the downloads after the notes", () => {
    const body = releaseBody("- Fix.");
    expect(body.startsWith("- Fix.\n")).toBe(true);
    expect(body).toContain("Safari 18.4+");
  });
});
