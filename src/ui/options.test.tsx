import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverSettings } from "../domain/types";
import { DEFAULT_SETTINGS } from "../storage/settings";

const testState = vi.hoisted(() => ({
  opened: true,
  settings: {
    consentVersion: 1,
    observerEnabled: false,
    showBadges: true,
    dockCollapsed: false,
    viewerHandle: null,
    uiLocale: "zh-CN",
    hideMutedAccounts: false,
    hideBlockedByAccounts: false,
    sidePanelTab: "status",
  } as ObserverSettings,
}));

vi.mock("./hooks", async () => {
  const { useState } = await import("react");
  return {
    useObserverSettings: () => {
      const [settings, setSettingsState] = useState(testState.settings);
      return {
        settings,
        settingsReady: true,
        setSettings: async (patch: Partial<ObserverSettings>) => {
          setSettingsState((current) => ({ ...current, ...patch }));
        },
        setSetting: async <Key extends keyof ObserverSettings>(
          key: Key,
          value: ObserverSettings[Key],
        ) => {
          setSettingsState((current) => ({ ...current, [key]: value }));
        },
      };
    },
  };
});

vi.mock("./open-options-tab", () => ({
  openSidePanelOptionsTab: vi.fn(async () => testState.opened),
}));

describe("Options page", () => {
  beforeEach(async () => {
    testState.opened = true;
    testState.settings = { ...DEFAULT_SETTINGS, consentVersion: 1, uiLocale: "zh-CN" };
    vi.stubGlobal("chrome", {
      i18n: { getUILanguage: () => "zh-CN" },
    });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(window, "close").mockImplementation(() => undefined);
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
  });

  it("opens the side panel Options tab from the Chrome Options entry", async () => {
    await act(async () => {
      await import("./options");
    });
    const { openSidePanelOptionsTab } = await import("./open-options-tab");
    expect(openSidePanelOptionsTab).toHaveBeenCalledOnce();
    expect(window.close).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("正在打开侧栏选项");
  });

  it("falls back to the options form when the side panel cannot open", async () => {
    testState.opened = false;
    await act(async () => {
      await import("./options");
    });
    expect(document.body.textContent).toContain("彻底隐藏已静音账号");
    expect(document.body.textContent).toContain("隐藏拉黑了我的账号");
    expect(document.querySelector(".language-switch")).not.toBeNull();
  });
});
