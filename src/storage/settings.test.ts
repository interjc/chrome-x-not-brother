import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_CONSENT_VERSION,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  getSettings,
  updateSettings,
} from "./settings";

describe("observer settings", () => {
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
    });
  });

  it("starts without consent and with observation disabled", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.consentVersion).toBe(0);
    expect(DEFAULT_SETTINGS.observerEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.dockCollapsed).toBe(false);
  });

  it("persists affirmative consent and observation atomically", async () => {
    const settings = await updateSettings({
      consentVersion: CURRENT_CONSENT_VERSION,
      observerEnabled: true,
    });

    expect(settings.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    expect(settings.observerEnabled).toBe(true);
    expect(storage.get(SETTINGS_KEY)).toEqual(settings);
  });

  it("fills new fields when reading older partial settings", async () => {
    storage.set(SETTINGS_KEY, { showBadges: false, collectUnknown: true });

    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      showBadges: false,
    });
  });

  it("persists the observer dock presentation preference", async () => {
    const settings = await updateSettings({ dockCollapsed: true });

    expect(settings.dockCollapsed).toBe(true);
    expect(await getSettings()).toEqual(settings);
  });

  it("reports an invalidated extension context without dereferencing storage.local", async () => {
    vi.stubGlobal("chrome", {});

    await expect(getSettings()).rejects.toThrow("Extension context invalidated");
  });
});
