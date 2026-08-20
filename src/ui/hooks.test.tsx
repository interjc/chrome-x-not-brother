import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverSettings } from "../domain/types";
import { SETTINGS_KEY } from "../storage/settings";
import { useObserverSettings } from "./hooks";

const initialSettings: ObserverSettings = {
  consentVersion: 1,
  observerEnabled: true,
  showBadges: true,
  dockCollapsed: false,
  viewerHandle: null,
  uiLocale: "auto",
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
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [SETTINGS_KEY]: initialSettings }),
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
      viewerHandle: "interjc",
    };
    await act(async () => {
      listener({
        [SETTINGS_KEY]: { oldValue: initialSettings, newValue: nextSettings },
      }, "local");
    });

    expect(states.at(-1)).toEqual({ settings: nextSettings, ready: true });
    await act(async () => root.unmount());
    expect(removeListener).toHaveBeenCalledOnce();
  });
});
