import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSidePanel, setBadgeTextColor } from "./capabilities";

describe("platform capabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects the Chrome side panel", () => {
    vi.stubGlobal("chrome", { sidePanel: { open: vi.fn() } });
    expect(hasSidePanel()).toBe(true);
  });

  it("reports no side panel on hosts without the API", () => {
    vi.stubGlobal("chrome", {});
    expect(hasSidePanel()).toBe(false);
  });

  it("sets the badge text color only when the host supports it", async () => {
    const setColor = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { action: { setBadgeTextColor: setColor } });
    await setBadgeTextColor("#16221B");
    expect(setColor).toHaveBeenCalledWith({ color: "#16221B" });

    vi.stubGlobal("chrome", { action: {} });
    await expect(setBadgeTextColor("#16221B")).resolves.toBeUndefined();
  });
});
