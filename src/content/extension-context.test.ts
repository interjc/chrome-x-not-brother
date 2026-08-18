import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasExtensionContext,
  isExtensionContextInvalidated,
} from "./extension-context";

afterEach(() => vi.unstubAllGlobals());

describe("extension context lifecycle", () => {
  it("detects a content script orphaned by an extension reload", () => {
    vi.stubGlobal("chrome", { runtime: {}, storage: {} });

    expect(hasExtensionContext()).toBe(false);
    expect(isExtensionContextInvalidated(new TypeError(
      "Cannot read properties of undefined (reading 'local')",
    ))).toBe(true);
  });

  it("does not swallow an unrelated runtime error in a valid context", () => {
    vi.stubGlobal("chrome", {
      runtime: { id: "extension-id" },
      storage: { local: {} },
    });

    expect(hasExtensionContext()).toBe(true);
    expect(isExtensionContextInvalidated(new Error("Unexpected response"))).toBe(false);
  });
});
