import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverSettings } from "../domain/types";
import { LOCAL_SETTINGS_KEY, SETTINGS_KEY } from "../storage/settings";
import { useObserverSettings } from "./hooks";

const initialSettings: ObserverSettings = {
  consentVersion: 3,
  observerEnabled: true,
  showBadges: true,
  dockCollapsed: false,
  viewerHandle: null,
  uiLocale: "auto",
  hideMutedAccounts: false,
  hideBlockedByAccounts: false,
  hideByFilterRules: false,
  sidePanelTab: "status",
};

function SettingsProbe({
  onSettings,
}: {
  onSettings: (settings: ObserverSettings, ready: boolean) => void;
}) {
  const { settings, settingsReady } = useObserverSettings();
  useEffect(() => onSettings(settings, settingsReady), [onSettings, settings, settingsReady]);
  return null;
}

describe("useObserverSettings", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("updates an open extension page when settings change in another context", async () => {
    let listener: (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => void = () => undefined;
    const removeListener = vi.fn();
    let syncedSettings = { ...initialSettings, viewerHandle: undefined };
    let localSettings = { viewerHandle: initialSettings.viewerHandle };
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ [LOCAL_SETTINGS_KEY]: localSettings })),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn(async () => ({ [SETTINGS_KEY]: syncedSettings })),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn((next) => { listener = next; }),
          removeListener,
        },
      },
    });

    const states: Array<{ settings: ObserverSettings; ready: boolean }> = [];
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
      root.render(<SettingsProbe onSettings={(settings, ready) => {
        states.push({ settings, ready });
      }} />);
    });
    expect(states.at(-1)).toEqual({ settings: initialSettings, ready: true });

    const nextSettings: ObserverSettings = {
      ...initialSettings,
      observerEnabled: false,
    };
    syncedSettings = { ...nextSettings, viewerHandle: undefined };
    await act(async () => {
      listener({
        [SETTINGS_KEY]: { oldValue: initialSettings, newValue: syncedSettings },
      }, "sync");
    });

    expect(states.at(-1)).toEqual({ settings: nextSettings, ready: true });

    localSettings = { viewerHandle: "interjc" };
    await act(async () => {
      listener({
        [LOCAL_SETTINGS_KEY]: {
          oldValue: { viewerHandle: null },
          newValue: localSettings,
        },
      }, "local");
    });

    expect(states.at(-1)).toEqual({
      settings: { ...nextSettings, viewerHandle: "interjc" },
      ready: true,
    });
    await act(async () => root.unmount());
    expect(removeListener).toHaveBeenCalledOnce();
  });
});
