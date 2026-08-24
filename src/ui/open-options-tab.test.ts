import { beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_KEY } from "../storage/settings";
import { openSidePanelOptionsTab } from "./open-options-tab";

describe("openSidePanelOptionsTab", () => {
  const storage = new Map<string, unknown>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) =>
            storage.has(key) ? { [key]: storage.get(key) } : {},
          ),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) storage.set(key, value);
          }),
        },
      },
      windows: {
        WINDOW_ID_CURRENT: -2,
      },
      sidePanel: {
        open: vi.fn(async () => undefined),
      },
    });
  });

  it("persists the options tab and opens the side panel", async () => {
    expect(await openSidePanelOptionsTab()).toBe(true);
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: -2 });
    expect(storage.get(SETTINGS_KEY)).toMatchObject({ sidePanelTab: "options" });
  });

  it("still persists the options tab when the side panel cannot open", async () => {
    vi.mocked(chrome.sidePanel.open).mockRejectedValue(new Error("no gesture"));
    expect(await openSidePanelOptionsTab()).toBe(false);
    expect(storage.get(SETTINGS_KEY)).toMatchObject({ sidePanelTab: "options" });
  });
});
