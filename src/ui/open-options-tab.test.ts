import { beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_KEY } from "../storage/settings";
import { openSidePanelOptionsTab } from "./open-options-tab";

describe("openSidePanelOptionsTab", () => {
  const syncStorage = new Map<string, unknown>();

  beforeEach(() => {
    syncStorage.clear();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
        sync: {
          get: vi.fn(async (key: string) =>
            syncStorage.has(key) ? { [key]: syncStorage.get(key) } : {},
          ),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) syncStorage.set(key, value);
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
    expect(syncStorage.get(SETTINGS_KEY)).toMatchObject({ sidePanelTab: "options" });
  });

  it("still persists the options tab when the side panel cannot open", async () => {
    vi.mocked(chrome.sidePanel.open).mockRejectedValue(new Error("no gesture"));
    expect(await openSidePanelOptionsTab()).toBe(false);
    expect(syncStorage.get(SETTINGS_KEY)).toMatchObject({ sidePanelTab: "options" });
  });
});
