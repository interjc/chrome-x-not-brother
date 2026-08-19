import { describe, expect, it } from "vitest";
import {
  isProfileImageUrl,
  isUsableDisplayName,
  normalizeProfileImageUrl,
  preferAvatarUrl,
  preferDisplayName,
  visibleDisplayName,
} from "./identity";

describe("identity presentation", () => {
  it("rejects separator-only display names", () => {
    expect(isUsableDisplayName("·", "OpenAI")).toBe(false);
    expect(isUsableDisplayName(".", "OpenAI")).toBe(false);
    expect(isUsableDisplayName("@OpenAI", "OpenAI")).toBe(false);
    expect(isUsableDisplayName("OpenAI", "OpenAI")).toBe(true);
  });

  it("falls back to the handle when the stored name is unusable", () => {
    expect(visibleDisplayName("·", "OpenAI")).toBe("@OpenAI");
    expect(visibleDisplayName("OpenAI", "OpenAI")).toBe("OpenAI");
  });

  it("keeps a usable stored name when the incoming name is punctuation", () => {
    expect(preferDisplayName("·", "OpenAI", "OpenAI")).toBe("OpenAI");
    expect(preferDisplayName("OpenAI", ".", "OpenAI")).toBe("OpenAI");
  });

  it("accepts X profile image URLs and upgrades the tiny variant", () => {
    const normal = "https://pbs.twimg.com/profile_images/1/abc_normal.jpg";
    expect(isProfileImageUrl(normal)).toBe(true);
    expect(normalizeProfileImageUrl(normal)).toBe(
      "https://pbs.twimg.com/profile_images/1/abc_x96.jpg",
    );
    expect(preferAvatarUrl("https://example.com/cat.jpg", normal)).toBe(
      "https://pbs.twimg.com/profile_images/1/abc_x96.jpg",
    );
  });
});
